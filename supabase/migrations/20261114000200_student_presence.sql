-- 등하원 현황(2026-11-14 학원 피드백): 오늘 오기로 한 학생이 지금 학원에 있는지 표시한다.
-- 일정별 출결(attendance_records)과 별개이며, 학생·날짜당 등원 시각과 하원 시각을 한 번씩만 가진다.
-- 행은 등원을 기록할 때 만들고 등원 취소 때 지운다(그래서 arrived_at은 항상 있다).
-- 브라우저는 표를 직접 읽거나 쓰지 못하고 아래 RPC로만 접근한다.
--   record_student_presence      : 원장·데스크만. 오늘(서울) 날짜에만 기록한다.
--   list_daily_student_presence  : 그날 예정된 학원·개인·보강 일정의 학생과 기록을 합쳐 돌려준다.
--                                  원장·데스크는 전체, 선생님은 담당 원생만 읽는다(읽기 전용).
-- 학부모 열람은 이번 범위에서 제외한다.

create table public.student_presence (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  presence_date date not null,
  arrived_at timestamptz not null,
  left_at timestamptz,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, student_id, presence_date),
  check (left_at is null or left_at >= arrived_at)
);

create index student_presence_academy_date_idx on public.student_presence (academy_id, presence_date);

create trigger student_presence_set_updated_at
before update on public.student_presence
for each row execute function private.set_updated_at();

-- 정책을 만들지 않고 권한을 회수해 브라우저의 직접 접근을 막는다. RPC(security definer)만 읽고 쓴다.
alter table public.student_presence enable row level security;
revoke all on public.student_presence from anon, authenticated;

create or replace function public.record_student_presence(
  p_academy_id uuid,
  p_student_id uuid,
  p_date date,
  p_action text
)
returns public.student_presence
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_presence public.student_presence%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '이 작업을 할 권한이 없습니다. 등하원 기록은 원장과 데스크만 할 수 있습니다.';
  end if;

  if p_action is null or p_action not in ('arrive', 'leave', 'cancel-arrive', 'cancel-leave') then
    raise exception '등하원 입력값을 확인해 주세요.';
  end if;

  if p_date is null or p_date <> (now() at time zone 'Asia/Seoul')::date then
    raise exception '등하원은 오늘 날짜에만 기록할 수 있습니다.';
  end if;

  perform 1
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found then
    raise exception '원생을 찾을 수 없습니다. 화면을 새로고침해 주세요.';
  end if;

  if p_action = 'arrive' then
    -- 이미 등원했으면 처음 등원 시각을 유지한다.
    insert into public.student_presence (academy_id, student_id, presence_date, arrived_at, recorded_by)
    values (p_academy_id, p_student_id, p_date, now(), (select auth.uid()))
    on conflict (academy_id, student_id, presence_date) do nothing;
  else
    select *
    into v_presence
    from public.student_presence
    where academy_id = p_academy_id
      and student_id = p_student_id
      and presence_date = p_date
    for update;

    if p_action = 'leave' then
      if not found then
        raise exception '등원을 먼저 기록해 주세요.';
      end if;

      update public.student_presence
      set left_at = coalesce(left_at, now()),
          recorded_by = (select auth.uid())
      where id = v_presence.id;
    elsif p_action = 'cancel-arrive' then
      if found then
        if v_presence.left_at is not null then
          raise exception '하원 기록을 먼저 취소해 주세요.';
        end if;

        delete from public.student_presence where id = v_presence.id;
      end if;
    elsif found then
      -- cancel-leave: 하원 시각만 지우고 등원 기록은 둔다.
      update public.student_presence
      set left_at = null,
          recorded_by = (select auth.uid())
      where id = v_presence.id;
    end if;
  end if;

  select *
  into v_presence
  from public.student_presence
  where academy_id = p_academy_id
    and student_id = p_student_id
    and presence_date = p_date;

  return v_presence;
end;
$$;

create or replace function public.list_daily_student_presence(
  p_academy_id uuid,
  p_date date
)
returns table (
  student_id uuid,
  student_name text,
  lesson_kinds text[],
  first_starts_at timestamptz,
  arrived_at timestamptz,
  left_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_is_teacher boolean;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role, 'teacher'::public.academy_member_role]
  ) then
    raise exception '이 작업을 할 권한이 없습니다. 등하원 현황은 원장·데스크·선생님만 볼 수 있습니다.';
  end if;

  if p_date is null then
    raise exception '날짜를 확인해 주세요.';
  end if;

  v_is_teacher := not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  );

  return query
  with roster as (
    -- 그날 예정된 일정의 학생. 삭제·취소된 일정은 오기로 한 학생에서 뺀다. 보강은 학원레슨으로 묶는다.
    select
      event.student_id as roster_student_id,
      array_agg(distinct case when event.lesson_kind = 'makeup' then 'academy' else event.lesson_kind end) as roster_kinds,
      min(event.starts_at) as roster_first_starts_at
    from public.lesson_events event
    where event.academy_id = p_academy_id
      and event.status = 'scheduled'
      and event.starts_at >= (p_date::timestamp at time zone 'Asia/Seoul')
      and event.starts_at < ((p_date + 1)::timestamp at time zone 'Asia/Seoul')
    group by event.student_id
  )
  select
    student.id,
    student.name,
    coalesce(roster.roster_kinds, '{}'::text[]),
    roster.roster_first_starts_at,
    presence.arrived_at,
    presence.left_at
  from public.students student
  left join roster
    on roster.roster_student_id = student.id
  left join public.student_presence presence
    on presence.academy_id = student.academy_id
   and presence.student_id = student.id
   and presence.presence_date = p_date
  where student.academy_id = p_academy_id
    and (roster.roster_student_id is not null or presence.id is not null)
    and (not v_is_teacher or private.teacher_can_access_student(student.academy_id, student.id))
  order by roster.roster_first_starts_at nulls last, student.name, student.id;
end;
$$;

revoke all on function public.record_student_presence(uuid, uuid, date, text) from public, anon;
grant execute on function public.record_student_presence(uuid, uuid, date, text) to authenticated;
revoke all on function public.list_daily_student_presence(uuid, date) from public, anon;
grant execute on function public.list_daily_student_presence(uuid, date) to authenticated;

notify pgrst, 'reload schema';

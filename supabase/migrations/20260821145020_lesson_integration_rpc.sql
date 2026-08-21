create unique index if not exists lesson_events_generated_enrollment_unique_idx
on public.lesson_events (academy_id, student_instrument_id, starts_at)
where generated_from_enrollment
  and lesson_kind = 'academy'
  and student_instrument_id is not null;

create or replace function public.ensure_monthly_academy_lesson_events(
  p_academy_id uuid,
  p_month text
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_month_start date;
  v_month_end date;
  v_inserted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.is_active_academy_member(p_academy_id) then
    raise exception '학원 정기 일정을 생성할 권한이 없습니다.';
  end if;

  if p_month is null or p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식은 YYYY-MM이어야 합니다.';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month')::date;

  with calendar_days as (
    select generate_series(
      v_month_start::timestamp,
      (v_month_end - 1)::timestamp,
      interval '1 day'
    )::date as lesson_day
  ),
  scheduled_lessons as (
    select
      instrument.academy_id,
      instrument.student_id,
      instrument.id as student_instrument_id,
      instrument.teacher_id,
      instrument.instrument_id,
      instrument.instrument_name,
      ((calendar.lesson_day::timestamp + instrument.start_time) at time zone 'Asia/Seoul') as starts_at,
      ((calendar.lesson_day::timestamp + instrument.end_time) at time zone 'Asia/Seoul') as ends_at
    from public.student_instruments instrument
    join public.students student
      on student.academy_id = instrument.academy_id
     and student.id = instrument.student_id
    join calendar_days calendar
      on case extract(dow from calendar.lesson_day)::int
           when 0 then '일'
           when 1 then '월'
           when 2 then '화'
           when 3 then '수'
           when 4 then '목'
           when 5 then '금'
           when 6 then '토'
         end = any (instrument.weekdays)
    where instrument.academy_id = p_academy_id
      and instrument.lesson_type = 'academy'
      and instrument.active is true
      and instrument.teacher_id is not null
      and instrument.start_time is not null
      and instrument.end_time is not null
      and student.status = 'active'
      and calendar.lesson_day >= greatest(v_month_start, student.registered_on)
      and instrument.end_time > instrument.start_time
  ),
  inserted as (
    insert into public.lesson_events (
      academy_id,
      student_id,
      student_instrument_id,
      teacher_id,
      lesson_kind,
      instrument_id,
      instrument_name,
      starts_at,
      ends_at,
      status,
      generated_from_enrollment
    )
    select
      academy_id,
      student_id,
      student_instrument_id,
      teacher_id,
      'academy',
      instrument_id,
      instrument_name,
      starts_at,
      ends_at,
      'scheduled',
      true
    from scheduled_lessons
    on conflict (academy_id, student_instrument_id, starts_at)
      where generated_from_enrollment
        and lesson_kind = 'academy'
        and student_instrument_id is not null
      do nothing
    returning 1
  )
  select count(*) into v_inserted_count
  from inserted;

  return v_inserted_count;
end;
$$;

revoke all on function public.ensure_monthly_academy_lesson_events(uuid, text) from public;
revoke all on function public.ensure_monthly_academy_lesson_events(uuid, text) from anon;
grant execute on function public.ensure_monthly_academy_lesson_events(uuid, text) to authenticated;

create or replace function public.mark_private_lesson_attendance(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_student_id uuid,
  p_instrument_id text,
  p_status text,
  p_marked_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_lesson public.lesson_events%rowtype;
  v_lesson_date date;
  v_ticket public.lesson_ticket_grants%rowtype;
  v_usage public.lesson_ticket_usages%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not (
    private.has_academy_role(
      p_academy_id,
      array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
    )
    or private.teacher_can_access_student(p_academy_id, p_student_id)
  ) then
    raise exception '개인레슨 출결을 저장할 권한이 없습니다.';
  end if;

  if p_status not in ('present', 'absent') then
    raise exception '개인레슨 출결 상태는 present 또는 absent만 가능합니다.';
  end if;

  select *
  into v_lesson
  from public.lesson_events
  where id = p_lesson_event_id
    and academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_id = p_instrument_id
    and lesson_kind = 'private'
    and status = 'scheduled'
  for update;

  if not found then
    raise exception '개인레슨 일정을 찾지 못했습니다.';
  end if;

  v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;

  insert into public.attendance_records (
    academy_id,
    lesson_event_id,
    student_id,
    status,
    absence_reason,
    marked_at,
    marked_by
  )
  values (
    p_academy_id,
    p_lesson_event_id,
    p_student_id,
    p_status,
    case when p_status = 'absent' then '결석 확인' else null end,
    p_marked_at,
    (select auth.uid())
  )
  on conflict (academy_id, lesson_event_id, student_id)
  do update set
    status = excluded.status,
    absence_reason = excluded.absence_reason,
    marked_at = excluded.marked_at,
    marked_by = excluded.marked_by;

  if p_status = 'absent' then
    select *
    into v_usage
    from public.lesson_ticket_usages
    where academy_id = p_academy_id
      and lesson_event_id = p_lesson_event_id
      and student_id = p_student_id
      and instrument_id = p_instrument_id
    for update;

    if found then
      update public.lesson_ticket_grants
      set remaining_count = least(total_granted_count, remaining_count + v_usage.used_count)
      where id = v_usage.lesson_ticket_grant_id
        and academy_id = p_academy_id;

      delete from public.lesson_ticket_usages
      where id = v_usage.id
        and academy_id = p_academy_id;
    end if;

    return;
  end if;

  select *
  into v_usage
  from public.lesson_ticket_usages
  where academy_id = p_academy_id
    and lesson_event_id = p_lesson_event_id
    and student_id = p_student_id
    and instrument_id = p_instrument_id
  for update;

  if found then
    return;
  end if;

  select *
  into v_ticket
  from public.lesson_ticket_grants
  where academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_id = p_instrument_id
    and remaining_count > 0
    and valid_from <= v_lesson_date
    and valid_until >= v_lesson_date
  order by valid_until asc, created_at asc
  limit 1
  for update;

  if not found then
    raise exception '사용 가능한 % 회차권이 없습니다.', p_instrument_id;
  end if;

  update public.lesson_ticket_grants
  set remaining_count = remaining_count - 1
  where id = v_ticket.id
    and academy_id = p_academy_id;

  insert into public.lesson_ticket_usages (
    academy_id,
    lesson_ticket_grant_id,
    lesson_event_id,
    student_id,
    instrument_id,
    used_at
  )
  values (
    p_academy_id,
    v_ticket.id,
    p_lesson_event_id,
    p_student_id,
    p_instrument_id,
    p_marked_at
  )
  on conflict (academy_id, lesson_event_id, student_id, instrument_id)
  do nothing;
end;
$$;

revoke all on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz) from public;
revoke all on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz) from anon;
grant execute on function public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz) to authenticated;

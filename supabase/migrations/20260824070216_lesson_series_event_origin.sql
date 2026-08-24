create table public.lesson_series (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  student_instrument_id uuid not null references public.student_instruments (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  lesson_kind text not null default 'academy' check (lesson_kind in ('academy', 'private')),
  instrument_id text not null,
  instrument_name text not null,
  weekdays text[] not null default '{}',
  start_time time not null,
  end_time time not null,
  effective_from date not null,
  effective_until date,
  active boolean not null default true,
  superseded_by uuid references public.lesson_series (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (effective_until is null or effective_until >= effective_from)
);

create index lesson_series_academy_student_idx
on public.lesson_series (academy_id, student_id, active, effective_from);

create index lesson_series_instrument_effective_idx
on public.lesson_series (academy_id, student_instrument_id, effective_from, effective_until);

alter table public.lesson_series
  add constraint lesson_series_academy_id_id_key unique (academy_id, id),
  add constraint lesson_series_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint lesson_series_academy_student_instrument_fk
    foreign key (academy_id, student_instrument_id) references public.student_instruments (academy_id, id)
    on delete cascade,
  add constraint lesson_series_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete set null (teacher_id);

create trigger lesson_series_set_updated_at
before update on public.lesson_series
for each row execute function private.set_updated_at();

alter table public.lesson_series enable row level security;

grant select, insert, update on public.lesson_series to authenticated;

create policy "lesson_series_select_allowed_members"
on public.lesson_series for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "lesson_series_write_owner_desk"
on public.lesson_series for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

alter table public.lesson_events
  add column if not exists series_id uuid,
  add column if not exists origin text,
  add column if not exists source_lesson_event_id uuid,
  add column if not exists counts_for_ticket boolean,
  add column if not exists creation_reason text;

alter table public.lesson_events
  drop constraint if exists lesson_events_status_check,
  drop constraint if exists lesson_events_origin_check;

alter table public.lesson_events
  alter column origin set default 'regular',
  alter column counts_for_ticket set default false;

update public.lesson_events
set origin = case
    when lesson_kind = 'private' then 'private'
    when lesson_kind = 'makeup' then 'makeup'
    when generated_from_enrollment then 'regular'
    else 'manual'
  end
where origin is null;

update public.lesson_events
set counts_for_ticket = lesson_kind = 'private'
where counts_for_ticket is null;

alter table public.lesson_events
  alter column origin set not null,
  alter column counts_for_ticket set not null,
  add constraint lesson_events_status_check
    check (status in ('scheduled', 'completed', 'cancelled', 'deleted')),
  add constraint lesson_events_origin_check
    check (origin in ('regular', 'manual', 'makeup', 'private', 'special'));

alter table public.lesson_events
  add constraint lesson_events_academy_series_fk
    foreign key (academy_id, series_id) references public.lesson_series (academy_id, id)
    on delete set null (series_id),
  add constraint lesson_events_source_lesson_event_fk
    foreign key (source_lesson_event_id) references public.lesson_events (id)
    on delete set null,
  add constraint lesson_events_academy_source_lesson_event_fk
    foreign key (academy_id, source_lesson_event_id) references public.lesson_events (academy_id, id)
    on delete set null (source_lesson_event_id);

insert into public.lesson_series (
  academy_id,
  student_id,
  student_instrument_id,
  teacher_id,
  lesson_kind,
  instrument_id,
  instrument_name,
  weekdays,
  start_time,
  end_time,
  effective_from,
  active
)
select
  instrument.academy_id,
  instrument.student_id,
  instrument.id,
  instrument.teacher_id,
  'academy',
  instrument.instrument_id,
  instrument.instrument_name,
  instrument.weekdays,
  instrument.start_time,
  instrument.end_time,
  greatest(student.registered_on, current_date),
  instrument.active
from public.student_instruments instrument
join public.students student
  on student.academy_id = instrument.academy_id
 and student.id = instrument.student_id
where instrument.lesson_type = 'academy'
  and instrument.teacher_id is not null
  and instrument.start_time is not null
  and instrument.end_time is not null
  and instrument.end_time > instrument.start_time
  and cardinality(instrument.weekdays) > 0
on conflict do nothing;

update public.lesson_events event
set series_id = series.id
from public.lesson_series series
where event.academy_id = series.academy_id
  and event.student_instrument_id = series.student_instrument_id
  and event.lesson_kind = 'academy'
  and event.generated_from_enrollment
  and event.series_id is null;

create index if not exists lesson_events_series_time_idx
on public.lesson_events (academy_id, series_id, starts_at)
where series_id is not null;

create index if not exists lesson_events_origin_time_idx
on public.lesson_events (academy_id, origin, starts_at);

drop index if exists public.lesson_events_generated_enrollment_unique_idx;

create unique index if not exists lesson_events_generated_series_unique_idx
on public.lesson_events (academy_id, series_id, starts_at)
where generated_from_enrollment
  and origin = 'regular'
  and lesson_kind = 'academy'
  and series_id is not null;

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
      series.academy_id,
      series.student_id,
      series.student_instrument_id,
      series.id as series_id,
      series.teacher_id,
      series.instrument_id,
      series.instrument_name,
      ((calendar.lesson_day::timestamp + series.start_time) at time zone 'Asia/Seoul') as starts_at,
      ((calendar.lesson_day::timestamp + series.end_time) at time zone 'Asia/Seoul') as ends_at
    from public.lesson_series series
    join public.students student
      on student.academy_id = series.academy_id
     and student.id = series.student_id
    join calendar_days calendar
      on case extract(dow from calendar.lesson_day)::int
           when 0 then '일'
           when 1 then '월'
           when 2 then '화'
           when 3 then '수'
           when 4 then '목'
           when 5 then '금'
           when 6 then '토'
         end = any (series.weekdays)
    where series.academy_id = p_academy_id
      and series.lesson_kind = 'academy'
      and series.active is true
      and series.teacher_id is not null
      and student.status = 'enrolled'
      and calendar.lesson_day >= greatest(v_month_start, student.registered_on)
      and calendar.lesson_day >= series.effective_from
      and (series.effective_until is null or calendar.lesson_day <= series.effective_until)
  ),
  inserted as (
    insert into public.lesson_events (
      academy_id,
      student_id,
      student_instrument_id,
      series_id,
      teacher_id,
      lesson_kind,
      origin,
      source_lesson_event_id,
      counts_for_ticket,
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
      series_id,
      teacher_id,
      'academy',
      'regular',
      null,
      false,
      instrument_id,
      instrument_name,
      starts_at,
      ends_at,
      'scheduled',
      true
    from scheduled_lessons
    on conflict (academy_id, series_id, starts_at)
      where generated_from_enrollment
        and origin = 'regular'
        and lesson_kind = 'academy'
        and series_id is not null
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

  if v_lesson.counts_for_ticket is not true then
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

create or replace function public.update_student_profile_from_date(
  p_academy_id uuid,
  p_student_id uuid,
  p_name text,
  p_student_instrument_id uuid default null,
  p_teacher_id uuid default null,
  p_instrument_id text default '',
  p_instrument_name text default '',
  p_lesson_type text default 'academy',
  p_weekdays text[] default '{}',
  p_start_time text default null,
  p_end_time text default null,
  p_progress text default '',
  p_lesson_fee integer default 0,
  p_discount_total integer default 0,
  p_final_monthly_fee integer default 0,
  p_effective_from date default (now() at time zone 'Asia/Seoul')::date
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_effective_from date := coalesce(p_effective_from, (now() at time zone 'Asia/Seoul')::date);
  v_old_instrument public.student_instruments%rowtype;
  v_old_series_ids uuid[] := '{}';
  v_new_series_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 정보를 수정할 권한이 없습니다.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception '원생명은 필수입니다.';
  end if;

  if p_lesson_type not in ('academy', 'private') then
    raise exception '수업 유형을 확인해 주세요.';
  end if;

  update public.students
  set name = trim(p_name)
  where academy_id = p_academy_id
    and id = p_student_id;

  if p_student_instrument_id is null then
    return;
  end if;

  select *
  into v_old_instrument
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and id = p_student_instrument_id
  for update;

  if not found then
    raise exception '수정할 원생 수강 정보를 찾지 못했습니다.';
  end if;

  select coalesce(array_agg(id), '{}')
  into v_old_series_ids
  from public.lesson_series
  where academy_id = p_academy_id
    and student_instrument_id = p_student_instrument_id
    and lesson_kind = 'academy'
    and active is true
    and (effective_until is null or effective_until >= v_effective_from);

  update public.lesson_series
  set
    active = false,
    effective_until = v_effective_from - 1
  where id = any (v_old_series_ids)
    and academy_id = p_academy_id;

  update public.lesson_events event
  set
    status = 'cancelled',
    deletion_reason = '정기 일정 변경으로 이후 미출석 일정 취소',
    deleted_at = now(),
    deleted_by = (select auth.uid())
  where event.academy_id = p_academy_id
    and event.series_id = any (v_old_series_ids)
    and event.generated_from_enrollment
    and event.origin = 'regular'
    and event.status = 'scheduled'
    and event.starts_at >= (v_effective_from::timestamp at time zone 'Asia/Seoul')
    and not exists (
      select 1
      from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
    );

  update public.student_instruments
  set
    teacher_id = p_teacher_id,
    instrument_id = p_instrument_id,
    instrument_name = p_instrument_name,
    lesson_type = p_lesson_type,
    weekdays = coalesce(p_weekdays, '{}'),
    start_time = nullif(p_start_time, '')::time,
    end_time = nullif(p_end_time, '')::time,
    progress = coalesce(p_progress, ''),
    lesson_fee = greatest(coalesce(p_lesson_fee, 0), 0),
    discount_total = greatest(coalesce(p_discount_total, 0), 0),
    final_monthly_fee = greatest(coalesce(p_final_monthly_fee, 0), 0)
  where academy_id = p_academy_id
    and id = p_student_instrument_id;

  update public.student_teacher_assignments
  set
    teacher_id = p_teacher_id,
    instrument_name = p_instrument_name
  where academy_id = p_academy_id
    and student_id = p_student_id
    and active;

  if p_lesson_type = 'academy'
    and p_teacher_id is not null
    and nullif(p_start_time, '') is not null
    and nullif(p_end_time, '') is not null
    and cardinality(coalesce(p_weekdays, '{}')) > 0
    and nullif(p_end_time, '')::time > nullif(p_start_time, '')::time
  then
    insert into public.lesson_series (
      academy_id,
      student_id,
      student_instrument_id,
      teacher_id,
      lesson_kind,
      instrument_id,
      instrument_name,
      weekdays,
      start_time,
      end_time,
      effective_from,
      active
    )
    values (
      p_academy_id,
      p_student_id,
      p_student_instrument_id,
      p_teacher_id,
      'academy',
      p_instrument_id,
      p_instrument_name,
      coalesce(p_weekdays, '{}'),
      nullif(p_start_time, '')::time,
      nullif(p_end_time, '')::time,
      v_effective_from,
      true
    )
    returning id into v_new_series_id;

    update public.lesson_series
    set superseded_by = v_new_series_id
    where id = any (v_old_series_ids)
      and academy_id = p_academy_id;

    perform public.ensure_monthly_academy_lesson_events(
      p_academy_id,
      to_char(v_effective_from, 'YYYY-MM')
    );
  end if;
end;
$$;

revoke all on function public.update_student_profile_from_date(uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date) from public;
revoke all on function public.update_student_profile_from_date(uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date) from anon;
grant execute on function public.update_student_profile_from_date(uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date) to authenticated;

create or replace function public.create_makeup_lesson_event(
  p_academy_id uuid,
  p_source_lesson_event_id uuid,
  p_student_id uuid,
  p_target_date date,
  p_start_time text,
  p_end_time text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_source public.lesson_events%rowtype;
  v_attendance_id uuid;
  v_makeup_lesson_event_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '보강 일정을 저장할 권한이 없습니다.';
  end if;

  select *
  into v_source
  from public.lesson_events
  where academy_id = p_academy_id
    and id = p_source_lesson_event_id
    and student_id = p_student_id
  for update;

  if not found then
    raise exception '보강 원본 수업을 찾지 못했습니다.';
  end if;

  if nullif(p_reason, '') is null then
    raise exception '보강 사유는 필수입니다.';
  end if;

  if nullif(p_end_time, '')::time <= nullif(p_start_time, '')::time then
    raise exception '보강 종료 시간은 시작 시간보다 늦어야 합니다.';
  end if;

  insert into public.lesson_events (
    academy_id,
    student_id,
    student_instrument_id,
    series_id,
    teacher_id,
    lesson_kind,
    origin,
    source_lesson_event_id,
    counts_for_ticket,
    instrument_id,
    instrument_name,
    starts_at,
    ends_at,
    status,
    generated_from_enrollment,
    creation_reason
  )
  values (
    p_academy_id,
    p_student_id,
    v_source.student_instrument_id,
    null,
    v_source.teacher_id,
    'academy',
    'makeup',
    p_source_lesson_event_id,
    false,
    v_source.instrument_id,
    v_source.instrument_name,
    (p_target_date::timestamp + nullif(p_start_time, '')::time) at time zone 'Asia/Seoul',
    (p_target_date::timestamp + nullif(p_end_time, '')::time) at time zone 'Asia/Seoul',
    'scheduled',
    false,
    trim(p_reason)
  )
  returning id into v_makeup_lesson_event_id;

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
    p_source_lesson_event_id,
    p_student_id,
    'absent',
    trim(p_reason),
    now(),
    (select auth.uid())
  )
  on conflict (academy_id, lesson_event_id, student_id)
  do update set
    status = 'absent',
    absence_reason = excluded.absence_reason,
    marked_at = excluded.marked_at,
    marked_by = excluded.marked_by
  returning id into v_attendance_id;

  insert into public.absence_resolutions (
    academy_id,
    attendance_record_id,
    lesson_event_id,
    student_id,
    resolved_as,
    reason,
    makeup_lesson_event_id,
    confirmed_at,
    confirmed_by
  )
  values (
    p_academy_id,
    v_attendance_id,
    p_source_lesson_event_id,
    p_student_id,
    'makeup',
    trim(p_reason),
    v_makeup_lesson_event_id,
    now(),
    (select auth.uid())
  )
  on conflict (academy_id, attendance_record_id)
  do update set
    resolved_as = 'makeup',
    reason = excluded.reason,
    makeup_lesson_event_id = excluded.makeup_lesson_event_id,
    confirmed_at = excluded.confirmed_at,
    confirmed_by = excluded.confirmed_by;

  return v_makeup_lesson_event_id;
end;
$$;

revoke all on function public.create_makeup_lesson_event(uuid, uuid, uuid, date, text, text, text) from public;
revoke all on function public.create_makeup_lesson_event(uuid, uuid, uuid, date, text, text, text) from anon;
grant execute on function public.create_makeup_lesson_event(uuid, uuid, uuid, date, text, text, text) to authenticated;

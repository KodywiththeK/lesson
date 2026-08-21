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
      and student.status = 'enrolled'
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

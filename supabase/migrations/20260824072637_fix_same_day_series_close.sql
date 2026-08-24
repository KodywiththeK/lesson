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
  v_existing_student_instrument_id uuid;
  v_old_series_ids uuid[] := array[]::uuid[];
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

  select id
  into v_existing_student_instrument_id
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and id = p_student_instrument_id
  for update;

  if not found then
    raise exception '수정할 원생 수강 정보를 찾지 못했습니다.';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
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
    effective_until = case
      when effective_from < v_effective_from then v_effective_from - 1
      else effective_from
    end
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
    and id = v_existing_student_instrument_id;

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
      v_existing_student_instrument_id,
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

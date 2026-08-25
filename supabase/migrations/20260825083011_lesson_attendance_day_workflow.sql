alter table public.lesson_events
  drop constraint if exists lesson_events_origin_check;

alter table public.lesson_events
  add constraint lesson_events_origin_check
    check (origin in ('regular', 'manual', 'makeup', 'private', 'special', 'rescheduled'));

create or replace function public.move_academy_lesson_event(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_target_date date,
  p_start_time time,
  p_end_time time,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_source public.lesson_events%rowtype;
  v_moved public.lesson_events%rowtype;
  v_student_name text;
  v_teacher_name text;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), '일정 이동');
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '학원 일정을 이동할 권한이 없습니다.';
  end if;

  if p_target_date is null or p_start_time is null or p_end_time is null then
    raise exception '이동 날짜와 시작/종료 시간은 필수입니다.';
  end if;

  if p_end_time <= p_start_time then
    raise exception '종료 시간은 시작 시간보다 늦어야 합니다.';
  end if;

  select *
  into v_source
  from public.lesson_events
  where academy_id = p_academy_id
    and id = p_lesson_event_id
    and lesson_kind = 'academy'
    and status = 'scheduled'
  for update;

  if not found then
    raise exception '이동할 학원 일정을 찾지 못했습니다.';
  end if;

  if exists (
    select 1
    from public.attendance_records attendance
    where attendance.academy_id = p_academy_id
      and attendance.lesson_event_id = p_lesson_event_id
  ) then
    raise exception '이미 출결 처리된 일정은 이동할 수 없습니다.';
  end if;

  update public.lesson_events
  set
    status = 'cancelled',
    deletion_reason = '일정 이동: ' || v_reason,
    deleted_at = now(),
    deleted_by = (select auth.uid())
  where academy_id = p_academy_id
    and id = p_lesson_event_id;

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
    v_source.academy_id,
    v_source.student_id,
    v_source.student_instrument_id,
    null,
    v_source.teacher_id,
    v_source.lesson_kind,
    'rescheduled',
    v_source.id,
    v_source.counts_for_ticket,
    v_source.instrument_id,
    v_source.instrument_name,
    (p_target_date + p_start_time) at time zone 'Asia/Seoul',
    (p_target_date + p_end_time) at time zone 'Asia/Seoul',
    'scheduled',
    false,
    v_reason
  )
  returning * into v_moved;

  select name
  into v_student_name
  from public.students
  where academy_id = p_academy_id
    and id = v_moved.student_id;

  select name
  into v_teacher_name
  from public.teachers
  where academy_id = p_academy_id
    and id = v_moved.teacher_id;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'lesson_event.rescheduled',
    'lesson_events',
    v_source.id::text,
    v_reason,
    jsonb_build_object(
      'source_lesson_event_id', v_source.id,
      'moved_lesson_event_id', v_moved.id,
      'target_date', p_target_date,
      'start_time', p_start_time,
      'end_time', p_end_time
    )
  );

  return jsonb_build_object(
    'id', v_moved.id,
    'academy_id', v_moved.academy_id,
    'student_id', v_moved.student_id,
    'students', jsonb_build_object('name', v_student_name),
    'instrument_id', v_moved.instrument_id,
    'instrument_name', v_moved.instrument_name,
    'teacher_id', v_moved.teacher_id,
    'teachers', jsonb_build_object('name', v_teacher_name),
    'lesson_kind', v_moved.lesson_kind,
    'origin', v_moved.origin,
    'starts_at', v_moved.starts_at,
    'ends_at', v_moved.ends_at,
    'status', v_moved.status,
    'attendance_records', '[]'::jsonb
  );
end;
$$;

create or replace function public.reset_academy_lesson_attendance(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_student_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_attendance public.attendance_records%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), '출결 상태 초기화');
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '학원 수업 출결을 초기화할 권한이 없습니다.';
  end if;

  if not exists (
    select 1
    from public.lesson_events event
    where event.academy_id = p_academy_id
      and event.id = p_lesson_event_id
      and event.student_id = p_student_id
      and event.lesson_kind = 'academy'
      and event.status = 'scheduled'
  ) then
    raise exception '출결 초기화할 학원 일정을 찾지 못했습니다.';
  end if;

  select *
  into v_attendance
  from public.attendance_records
  where academy_id = p_academy_id
    and lesson_event_id = p_lesson_event_id
    and student_id = p_student_id
  for update;

  if not found then
    return;
  end if;

  if exists (
    select 1
    from public.absence_resolutions resolution
    where resolution.academy_id = p_academy_id
      and resolution.lesson_event_id = p_lesson_event_id
      and resolution.attendance_record_id = v_attendance.id
  ) then
    raise exception '이미 보강 처리된 결석은 초기화할 수 없습니다.';
  end if;

  delete from public.attendance_records
  where id = v_attendance.id
    and academy_id = p_academy_id;

  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    reason,
    metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'attendance.reset',
    'attendance_records',
    v_attendance.id::text,
    v_reason,
    jsonb_build_object(
      'lesson_event_id', p_lesson_event_id,
      'student_id', p_student_id,
      'previous_status', v_attendance.status
    )
  );
end;
$$;

revoke all on function public.move_academy_lesson_event(uuid, uuid, date, time, time, text) from public;
revoke all on function public.move_academy_lesson_event(uuid, uuid, date, time, time, text) from anon;
grant execute on function public.move_academy_lesson_event(uuid, uuid, date, time, time, text) to authenticated;

revoke all on function public.reset_academy_lesson_attendance(uuid, uuid, uuid, text) from public;
revoke all on function public.reset_academy_lesson_attendance(uuid, uuid, uuid, text) from anon;
grant execute on function public.reset_academy_lesson_attendance(uuid, uuid, uuid, text) to authenticated;

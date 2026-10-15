-- 레슨 시간표 명세 반영 (2026-10-16)
-- 학원 레슨 결석 확정(보강/패스), 일정 삭제, 같은 달 이동 제한, 개인레슨 등원 확인 취소,
-- 월별 포스트잇(lesson_kind), 보강시간 미입력 표시.
-- 주의: 이 파일은 작성만 되어 있고 원격 DB에는 적용하지 않았다. 적용 절차는
-- docs/engineering/supabase-migration-runbook.md를 따른다.

alter table public.lesson_events
  add column if not exists time_unspecified boolean not null default false;

comment on column public.lesson_events.time_unspecified is
  '보강 시간을 입력하지 않아 원본 시간을 임시로 저장한 경우 true. 화면에서 시간을 숨긴다.';

-- 월별 포스트잇: 학원/개인레슨 화면별로 달마다 하나.
alter table public.monthly_memos
  add column if not exists lesson_kind text not null default 'academy'
    check (lesson_kind in ('academy', 'private'));

-- 옛 (academy_id, month) unique는 두 이름으로 존재할 수 있다: 최초 테이블의 인라인 제약
-- (monthly_memos_academy_id_month_key)과 이후 추가한 제약(monthly_memos_academy_month_key).
-- 하나라도 남으면 학원/개인레슨 메모가 같은 달에 공존하지 못한다.
alter table public.monthly_memos
  drop constraint if exists monthly_memos_academy_month_key;

alter table public.monthly_memos
  drop constraint if exists monthly_memos_academy_id_month_key;

-- 위 두 이름이 아닌 이름으로 남아 있을 수 있는 (academy_id, month) unique도 컬럼 기준으로 모두 지운다.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.monthly_memos'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from pg_attribute att
        where att.attrelid = con.conrelid
          and att.attnum = any (con.conkey)
      ) = array['academy_id', 'month']
  loop
    execute format('alter table public.monthly_memos drop constraint %I', v_constraint.conname);
  end loop;
end
$$;

alter table public.monthly_memos
  add constraint monthly_memos_academy_kind_month_key unique (academy_id, lesson_kind, month);

-- 학원 레슨 일정은 같은 달 안에서만 이동할 수 있다.
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

  if to_char(v_source.starts_at at time zone 'Asia/Seoul', 'YYYY-MM') <> to_char(p_target_date, 'YYYY-MM') then
    raise exception '일정은 같은 달 안에서만 이동할 수 있습니다.';
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
    creation_reason,
    time_unspecified
  )
  values (
    v_source.academy_id,
    v_source.student_id,
    v_source.student_instrument_id,
    null,
    v_source.teacher_id,
    v_source.lesson_kind,
    -- 보강 일정을 옮기면 보강 표시와 원래 결석 수업 연결을 그대로 유지한다.
    case when v_source.origin = 'makeup' then 'makeup' else 'rescheduled' end,
    case
      when v_source.origin = 'makeup' then coalesce(v_source.source_lesson_event_id, v_source.id)
      else v_source.id
    end,
    v_source.counts_for_ticket,
    v_source.instrument_id,
    v_source.instrument_name,
    (p_target_date + p_start_time) at time zone 'Asia/Seoul',
    (p_target_date + p_end_time) at time zone 'Asia/Seoul',
    'scheduled',
    false,
    v_reason,
    -- 시간 미정 보강은 시간을 바꾸지 않고 날짜만 옮길 때만 미정 표시를 유지한다.
    v_source.time_unspecified
      and p_start_time = (v_source.starts_at at time zone 'Asia/Seoul')::time
  )
  returning * into v_moved;

  -- 이 일정이 결석 처리(보강)의 보강 일정이면 새 일정으로 연결을 옮긴다.
  update public.absence_resolutions
  set makeup_lesson_event_id = v_moved.id
  where academy_id = p_academy_id
    and makeup_lesson_event_id = p_lesson_event_id;

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
    'source_lesson_event_id', v_moved.source_lesson_event_id,
    'time_unspecified', v_moved.time_unspecified,
    'starts_at', v_moved.starts_at,
    'ends_at', v_moved.ends_at,
    'status', v_moved.status,
    'attendance_records', '[]'::jsonb
  );
end;
$$;

-- 결석 1건을 보강 또는 패스로 확정한다. 이미 처리된 결석은 다시 처리할 수 없다(보강 이중 생성 방지).
-- 학원 레슨은 월 정액이라 회차 차감·복구를 하지 않는다. 사유서 내용은 월별 포스트잇에 자동 기록한다.
create or replace function public.resolve_academy_lesson_absence(
  p_academy_id uuid,
  p_source_lesson_event_id uuid,
  p_student_id uuid,
  p_resolution text,
  p_target_date date default null,
  p_start_time time default null,
  p_end_time time default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_source public.lesson_events%rowtype;
  v_attendance public.attendance_records%rowtype;
  v_reason text := coalesce(btrim(p_reason), '');
  v_student_name text;
  v_makeup_id uuid;
  v_start_time time;
  v_end_time time;
  v_unspecified boolean := false;
  v_source_date date;
  v_weekdays text[] := array['일', '월', '화', '수', '목', '금', '토'];
  v_absent_label text;
  v_makeup_label text;
  v_line text;
  v_month text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '결석 사유를 저장할 권한이 없습니다.';
  end if;

  if p_resolution not in ('makeup', 'pass') then
    raise exception '사유는 보강 또는 패스 중에서 선택해야 합니다.';
  end if;

  if p_resolution = 'makeup' and p_target_date is null then
    raise exception '보강 날짜를 선택해 주세요.';
  end if;

  select *
  into v_source
  from public.lesson_events
  where academy_id = p_academy_id
    and id = p_source_lesson_event_id
    and student_id = p_student_id
    and lesson_kind = 'academy'
    and status = 'scheduled'
  for update;

  if not found then
    raise exception '결석 처리할 학원 수업을 찾지 못했습니다.';
  end if;

  select *
  into v_attendance
  from public.attendance_records
  where academy_id = p_academy_id
    and lesson_event_id = p_source_lesson_event_id
    and student_id = p_student_id
  for update;

  if not found or v_attendance.status <> 'absent' then
    raise exception '결석으로 확인된 수업만 보강·패스로 처리할 수 있습니다.';
  end if;

  if exists (
    select 1
    from public.absence_resolutions resolution
    where resolution.academy_id = p_academy_id
      and resolution.attendance_record_id = v_attendance.id
  ) then
    raise exception '이미 보강 또는 패스로 처리된 결석입니다.';
  end if;

  v_source_date := (v_source.starts_at at time zone 'Asia/Seoul')::date;

  select name
  into v_student_name
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id;

  if p_resolution = 'makeup' then
    if p_start_time is null then
      v_start_time := (v_source.starts_at at time zone 'Asia/Seoul')::time;
      v_end_time := (v_source.ends_at at time zone 'Asia/Seoul')::time;
      v_unspecified := true;
    else
      v_start_time := p_start_time;
      v_end_time := coalesce(
        p_end_time,
        p_start_time + ((v_source.ends_at - v_source.starts_at))
      );

      if v_end_time <= v_start_time then
        raise exception '보강 종료 시간은 시작 시간보다 늦어야 합니다.';
      end if;
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
      creation_reason,
      time_unspecified
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
      (p_target_date::timestamp + v_start_time) at time zone 'Asia/Seoul',
      (p_target_date::timestamp + v_end_time) at time zone 'Asia/Seoul',
      'scheduled',
      false,
      case when v_reason = '' then '보강' else v_reason end,
      v_unspecified
    )
    returning id into v_makeup_id;
  end if;

  update public.attendance_records
  set absence_reason = case when v_reason = '' then absence_reason else v_reason end
  where id = v_attendance.id
    and academy_id = p_academy_id;

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
    v_attendance.id,
    p_source_lesson_event_id,
    p_student_id,
    p_resolution,
    v_reason,
    v_makeup_id,
    now(),
    (select auth.uid())
  );

  v_absent_label := extract(month from v_source_date)::int || '/' || extract(day from v_source_date)::int
    || ' [' || v_weekdays[extract(dow from v_source_date)::int + 1] || '요일]';

  if p_resolution = 'makeup' then
    v_makeup_label := extract(month from p_target_date)::int || '/' || extract(day from p_target_date)::int
      || ' [' || v_weekdays[extract(dow from p_target_date)::int + 1] || '요일]'
      || case when v_unspecified then '' else ' ' || to_char(v_start_time, 'HH24:MI') end;
    v_line := v_student_name || ', ' || v_makeup_label || ' 보강 - ' || v_absent_label
      || case when v_reason = '' then '' else ' ' || v_reason end;
  else
    v_line := v_student_name || ', ' || v_absent_label || ' '
      || case when v_reason = '' then '사유없음' else v_reason end;
  end if;

  v_month := to_char(v_source_date, 'YYYY-MM');

  insert into public.monthly_memos (academy_id, lesson_kind, month, content, unread, updated_by)
  values (p_academy_id, 'academy', v_month, v_line, true, (select auth.uid()))
  on conflict (academy_id, lesson_kind, month)
  do update set
    content = case
      when btrim(public.monthly_memos.content) = '' then excluded.content
      else public.monthly_memos.content || E'\n' || excluded.content
    end,
    unread = true,
    updated_by = excluded.updated_by;

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
    'absence.resolved',
    'attendance_records',
    v_attendance.id::text,
    case when v_reason = '' then null else v_reason end,
    jsonb_build_object(
      'resolution', p_resolution,
      'source_lesson_event_id', p_source_lesson_event_id,
      'makeup_lesson_event_id', v_makeup_id,
      'target_date', p_target_date,
      'time_unspecified', v_unspecified
    )
  );

  return jsonb_build_object(
    'resolution', p_resolution,
    'makeup_lesson_event_id', v_makeup_id,
    'memo_line', v_line,
    'month', v_month
  );
end;
$$;

revoke all on function public.resolve_academy_lesson_absence(uuid, uuid, uuid, text, date, time, time, text) from public;
revoke all on function public.resolve_academy_lesson_absence(uuid, uuid, uuid, text, date, time, time, text) from anon;
grant execute on function public.resolve_academy_lesson_absence(uuid, uuid, uuid, text, date, time, time, text) to authenticated;

-- 학원 레슨 일정 삭제: 사유 필수, 출결 처리된 일정은 먼저 초기화해야 한다.
-- 삭제된 일정은 결석인원에 남지 않고, 정기 일정 재생성(on conflict do nothing)에서도 다시 만들어지지 않는다.
create or replace function public.delete_academy_lesson_event(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_resolution public.absence_resolutions%rowtype;
  v_student_name text;
  v_absent_date date;
  v_weekdays text[] := array['일', '월', '화', '수', '목', '금', '토'];
  v_line text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '학원 일정을 삭제할 권한이 없습니다.';
  end if;

  if v_reason = '' then
    raise exception '삭제 사유를 입력해 주세요.';
  end if;

  if not exists (
    select 1
    from public.lesson_events event
    where event.academy_id = p_academy_id
      and event.id = p_lesson_event_id
      and event.lesson_kind = 'academy'
      and event.status = 'scheduled'
  ) then
    raise exception '삭제할 학원 일정을 찾지 못했습니다.';
  end if;

  if exists (
    select 1
    from public.attendance_records attendance
    where attendance.academy_id = p_academy_id
      and attendance.lesson_event_id = p_lesson_event_id
  ) then
    raise exception '이미 출결 처리된 일정은 삭제할 수 없습니다. 먼저 출결을 초기화해 주세요.';
  end if;

  update public.lesson_events
  set
    status = 'deleted',
    deletion_reason = v_reason,
    deleted_at = now(),
    deleted_by = (select auth.uid())
  where academy_id = p_academy_id
    and id = p_lesson_event_id;

  -- 보강 일정을 삭제하면 그 결석은 보강 없이 결석(패스)으로 처리된 상태가 된다.
  -- 결석 처리 기록을 지우지 않고 패스로 바꿔 같은 결석이 다시 처리되거나 목록에 되살아나지 않게 한다.
  select *
  into v_resolution
  from public.absence_resolutions
  where academy_id = p_academy_id
    and makeup_lesson_event_id = p_lesson_event_id
    and resolved_as = 'makeup'
  for update;

  if found then
    update public.absence_resolutions
    set resolved_as = 'pass',
        makeup_lesson_event_id = null
    where id = v_resolution.id;

    select (starts_at at time zone 'Asia/Seoul')::date
    into v_absent_date
    from public.lesson_events
    where academy_id = p_academy_id
      and id = v_resolution.lesson_event_id;

    select name
    into v_student_name
    from public.students
    where academy_id = p_academy_id
      and id = v_resolution.student_id;

    v_line := v_student_name || ', '
      || extract(month from v_absent_date)::int || '/' || extract(day from v_absent_date)::int
      || ' [' || v_weekdays[extract(dow from v_absent_date)::int + 1] || '요일] 보강 삭제로 패스 처리';

    insert into public.monthly_memos (academy_id, lesson_kind, month, content, unread, updated_by)
    values (p_academy_id, 'academy', to_char(v_absent_date, 'YYYY-MM'), v_line, true, (select auth.uid()))
    on conflict (academy_id, lesson_kind, month)
    do update set
      content = case
        when btrim(public.monthly_memos.content) = '' then excluded.content
        else public.monthly_memos.content || E'\n' || excluded.content
      end,
      unread = true,
      updated_by = excluded.updated_by;
  end if;

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
    'lesson_event.deleted',
    'lesson_events',
    p_lesson_event_id::text,
    v_reason,
    jsonb_build_object('lesson_kind', 'academy')
  );
end;
$$;

revoke all on function public.delete_academy_lesson_event(uuid, uuid, text) from public;
revoke all on function public.delete_academy_lesson_event(uuid, uuid, text) from anon;
grant execute on function public.delete_academy_lesson_event(uuid, uuid, text) to authenticated;

-- 개인레슨 등원 확인 취소: 출결 기록을 지우고 차감된 회차를 복구해 예정 상태로 되돌린다.
create or replace function public.cancel_private_lesson_attendance(
  p_academy_id uuid,
  p_lesson_event_id uuid,
  p_student_id uuid,
  p_instrument_id text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_attendance public.attendance_records%rowtype;
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
    raise exception '개인레슨 등원 확인을 취소할 권한이 없습니다.';
  end if;

  if not exists (
    select 1
    from public.lesson_events event
    where event.academy_id = p_academy_id
      and event.id = p_lesson_event_id
      and event.student_id = p_student_id
      and event.instrument_id = p_instrument_id
      and event.lesson_kind = 'private'
      and event.status = 'scheduled'
  ) then
    raise exception '개인레슨 일정을 찾지 못했습니다.';
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
    'attendance.cancelled',
    'attendance_records',
    v_attendance.id::text,
    '등원 확인 취소',
    jsonb_build_object(
      'lesson_event_id', p_lesson_event_id,
      'student_id', p_student_id,
      'previous_status', v_attendance.status,
      'restored_ticket', v_usage.id is not null
    )
  );
end;
$$;

revoke all on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text) from public;
revoke all on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text) from anon;
grant execute on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text) to authenticated;

-- 보강·패스로 처리된 결석의 출결은 직접 수정하거나 지울 수 없다.
-- 다른 관리자의 오래된 화면에서 처리된 결석을 "등원"으로 바꿔 결석 처리·보강 일정·포스트잇 기록이
-- 서로 어긋나는 일을 서버에서 막는다. 학생 삭제 같은 연쇄 삭제(FK cascade)는 depth > 1이라 통과한다.
create or replace function private.guard_resolved_absence_attendance()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if exists (
    select 1
    from public.absence_resolutions resolution
    where resolution.attendance_record_id = old.id
  ) then
    raise exception '이미 보강 또는 패스로 처리된 결석은 변경할 수 없습니다.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_resolved_absence_attendance on public.attendance_records;

create trigger guard_resolved_absence_attendance
  before update or delete on public.attendance_records
  for each row
  execute function private.guard_resolved_absence_attendance();

-- 옛 보강 생성 RPC는 같은 결석에 보강 일정을 반복 생성할 수 있고 사유서 기록도 남기지 않는다.
-- 화면은 resolve_academy_lesson_absence만 사용하므로 직접 호출 권한을 회수한다.
revoke execute on function public.create_makeup_lesson_event(uuid, uuid, uuid, date, text, text, text)
  from public, anon, authenticated;

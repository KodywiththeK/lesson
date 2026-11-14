-- 외상(credit) 기능 물리 삭제.
-- 외상은 미입금 회차권(등록·입금대기)으로 대체되었고(2026-11-14 결정) 앱은 더 이상 외상 표·칸·함수를 쓰지 않는다.
-- 운영 데이터를 지우지 않도록 외상 일정·외상 기록이 하나라도 남아 있으면 적용을 멈춘다.
-- 적용 순서: 외상 칸(credit_authorized)을 읽지 않는 앱을 먼저 배포한 뒤 적용한다.

do $$
declare
  v_events integer;
  v_credits integer;
begin
  select count(*) into v_events from public.lesson_events where credit_authorized;
  select count(*) into v_credits from public.private_lesson_credits;
  if v_events > 0 or v_credits > 0 then
    raise exception '외상 데이터가 남아 있어 삭제를 멈춥니다(외상 일정 %건, 외상 기록 %건). 먼저 정리해 주세요.',
      v_events, v_credits;
  end if;
end;
$$;

drop trigger if exists private_ticket_credit_attach on public.lesson_ticket_usages;
drop function if exists private.attach_private_credit_usage();
drop trigger if exists lesson_events_reject_credit on public.lesson_events;
drop function if exists private.reject_private_lesson_credit();

CREATE OR REPLACE FUNCTION public.cancel_private_lesson_attendance(p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid, p_instrument_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  return private.cancel_private_lesson_attendance_impl(
    p_academy_id, p_lesson_event_id, p_student_id, p_instrument_id);
end;
$$;

CREATE OR REPLACE FUNCTION public.mark_private_lesson_attendance(p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid, p_instrument_id text, p_status text, p_marked_at timestamp with time zone DEFAULT now(), p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_lesson public.lesson_events%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), '결석 확인');
  v_lesson_date date;
begin
  if p_status not in ('present', 'absent') then
    raise exception '개인레슨 출결 상태를 확인해 주세요.';
  end if;
  if char_length(v_reason) > 100 then raise exception '사유는 100자 이하로 입력해 주세요.'; end if;
  select * into v_lesson from public.lesson_events
  where academy_id = p_academy_id and id = p_lesson_event_id
    and student_id = p_student_id and instrument_id = p_instrument_id
    and lesson_kind = 'private' and status = 'scheduled' for update;
  if not found then raise exception '개인레슨 일정을 찾지 못했습니다.'; end if;
  v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  perform set_config('app.private_ticket_attendance', '1', true);
  perform private.mark_private_lesson_attendance_impl(
    p_academy_id, p_lesson_event_id, p_student_id,
    p_instrument_id, p_status, p_marked_at);
  if p_status = 'absent' then
    update public.attendance_records set absence_reason = v_reason
    where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
      and student_id = p_student_id;
  end if;
  perform set_config('app.private_ticket_attendance', '', true);
end;
$$;

CREATE OR REPLACE FUNCTION private.mark_private_lesson_attendance_impl(p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid, p_instrument_id text, p_status text, p_marked_at timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_lesson public.lesson_events%rowtype;
  v_ticket public.lesson_ticket_grants%rowtype;
  v_usage public.lesson_ticket_usages%rowtype;
  v_lesson_date date;
  v_ticket_id uuid;
begin
  if (select auth.uid()) is null then raise exception '로그인이 필요합니다.'; end if;
  if not (private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
    or private.teacher_can_access_student(p_academy_id, p_student_id)) then
    raise exception '개인레슨 출결을 저장할 권한이 없습니다.';
  end if;
  if p_status not in ('present', 'absent') then
    raise exception '개인레슨 출결 상태는 present 또는 absent만 가능합니다.';
  end if;
  select * into v_lesson from public.lesson_events
  where id = p_lesson_event_id and academy_id = p_academy_id
    and student_id = p_student_id and instrument_id = p_instrument_id
    and lesson_kind = 'private' and status = 'scheduled' for update;
  if not found then raise exception '개인레슨 일정을 찾지 못했습니다.'; end if;
  v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;
  insert into public.attendance_records (
    academy_id, lesson_event_id, student_id, status, absence_reason,
    marked_at, marked_by
  ) values (
    p_academy_id, p_lesson_event_id, p_student_id, p_status,
    case when p_status = 'absent' then '결석 확인' else null end,
    p_marked_at, (select auth.uid())
  ) on conflict (academy_id, lesson_event_id, student_id)
  do update set status = excluded.status, absence_reason = excluded.absence_reason,
    marked_at = excluded.marked_at, marked_by = excluded.marked_by;
  if p_status = 'absent' then
    select * into v_usage from public.lesson_ticket_usages
    where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
      and student_id = p_student_id and instrument_id = p_instrument_id for update;
    if found then
      update public.lesson_ticket_grants
      set remaining_count = least(total_granted_count, remaining_count + v_usage.used_count)
      where id = v_usage.lesson_ticket_grant_id and academy_id = p_academy_id;
      delete from public.lesson_ticket_usages
      where id = v_usage.id and academy_id = p_academy_id;
    end if;
    return;
  end if;
  if not v_lesson.counts_for_ticket then return; end if;
  select * into v_usage from public.lesson_ticket_usages
  where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
    and student_id = p_student_id and instrument_id = p_instrument_id for update;
  if found then return; end if;
  v_ticket_id := v_lesson.ticket_grant_id;
  select * into v_ticket from public.lesson_ticket_grants
  where id = v_ticket_id and academy_id = p_academy_id
    and student_id = p_student_id and instrument_id = p_instrument_id
    and remaining_count > 0 for update;
  if not found then raise exception '연결된 회차권에 사용할 수 있는 회차가 없습니다.'; end if;
  update public.lesson_ticket_grants set remaining_count = remaining_count - 1
  where id = v_ticket.id and academy_id = p_academy_id;
  insert into public.lesson_ticket_usages (
    academy_id, lesson_ticket_grant_id, lesson_event_id, student_id,
    instrument_id, used_at
  ) values (
    p_academy_id, v_ticket.id, p_lesson_event_id, p_student_id,
    p_instrument_id, p_marked_at
  ) on conflict (academy_id, lesson_event_id, student_id, instrument_id) do nothing;
end;
$$;

CREATE OR REPLACE FUNCTION private.assign_private_ticket_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_lesson public.lesson_events%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_lesson_date date;
begin
  select * into v_grant from public.lesson_ticket_grants
  where id = new.lesson_ticket_grant_id and academy_id = new.academy_id
    and student_id = new.student_id and instrument_id = new.instrument_id for update;
  if not found then raise exception '출석에 연결된 회차권 범위가 올바르지 않습니다.'; end if;
  select * into v_lesson from public.lesson_events
  where id = new.lesson_event_id and academy_id = new.academy_id
    and student_id = new.student_id and instrument_id = new.instrument_id;
  if not found then raise exception '출석 수업을 찾을 수 없습니다.'; end if;
  if v_lesson.ticket_grant_id is distinct from new.lesson_ticket_grant_id then
    raise exception '출석은 예약된 회차권에서만 차감할 수 있습니다.';
  end if;
  v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;
  select * into v_registration from public.lesson_ticket_registrations
  where lesson_ticket_grant_id = v_grant.id and is_service
    and refunded_at is null and service_remaining_count > 0
    and registered_at <= v_lesson_date and valid_until >= v_lesson_date
  order by registered_at, created_at, id limit 1 for update;
  if found then
    update public.lesson_ticket_registrations
    set service_remaining_count = service_remaining_count - 1 where id = v_registration.id;
    update public.lesson_ticket_grants
    set service_remaining_count = service_remaining_count - 1 where id = v_grant.id;
    new.funding_kind := 'service';
    new.funding_registration_id := v_registration.id;
  else
    if v_grant.remaining_count < v_grant.service_remaining_count or not exists (
      select 1 from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = v_grant.id
        and not registration.is_service and registration.refunded_at is null
        and registration.registered_at <= v_lesson_date
        and registration.valid_until >= v_lesson_date
    ) then raise exception '수업 날짜에 사용할 수 있는 회차권이 없습니다.'; end if;
    new.funding_kind := 'paid';
    select id into new.funding_registration_id from public.lesson_ticket_registrations
    where lesson_ticket_grant_id = v_grant.id and not is_service and refunded_at is null
      and registered_at <= v_lesson_date and valid_until >= v_lesson_date
    order by registered_at, created_at, id limit 1;
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.guard_private_absence_cancel_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare v_lesson public.lesson_events%rowtype;
begin
  if old.status <> 'absent' then return old; end if;
  select * into v_lesson from public.lesson_events
  where academy_id = old.academy_id and id = old.lesson_event_id
    and lesson_kind = 'private';
  if not found then return old; end if;
  if v_lesson.ticket_grant_id is null then
    raise exception '결석 당시 회차권이 삭제되어 출결을 취소할 수 없습니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    old.academy_id::text || ':' || old.student_id::text || ':' || v_lesson.instrument_id, 0));
  if private.private_lesson_grant_available_count(v_lesson.ticket_grant_id,
    (v_lesson.starts_at at time zone 'Asia/Seoul')::date) < 1 then
    raise exception '결석을 취소하면 이 회차권의 예약 한도가 초과됩니다. 먼저 일정을 정리해 주세요.';
  end if;
  return old;
end;
$$;

CREATE OR REPLACE FUNCTION private.guard_private_ticket_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_lesson public.lesson_events%rowtype;
  v_old_private boolean := false;
begin
  if tg_op = 'UPDATE' then
    select lesson_kind = 'private' into v_old_private from public.lesson_events
    where academy_id = old.academy_id and id = old.lesson_event_id;
  end if;
  select * into v_lesson from public.lesson_events
  where academy_id = new.academy_id and id = new.lesson_event_id;
  if tg_op = 'UPDATE' and (coalesce(v_old_private, false)
      or (found and v_lesson.lesson_kind = 'private'))
    and (old.lesson_event_id is distinct from new.lesson_event_id
      or old.student_id is distinct from new.student_id
      or old.academy_id is distinct from new.academy_id) then
    raise exception '개인레슨 출결의 수업·원생은 변경할 수 없습니다.';
  end if;
  if not found or v_lesson.lesson_kind <> 'private' then return new; end if;
  if current_setting('app.private_ticket_attendance', true) is distinct from '1' then
    raise exception '개인레슨 출결은 출석 확인 기능에서 처리해 주세요.';
  end if;
  if not private.has_academy_role(new.academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
    and not exists (
      select 1 from public.teachers teacher
      join public.academy_members member on member.id = teacher.member_id
        and member.academy_id = teacher.academy_id
      where teacher.academy_id = new.academy_id and teacher.id = v_lesson.teacher_id
        and teacher.status <> 'resigned' and member.user_id = (select auth.uid())
        and member.role = 'teacher' and member.status = 'active'
    ) then raise exception '담당 선생님만 이 수업의 출석을 처리할 수 있습니다.'; end if;
  if new.status = 'present' and v_lesson.counts_for_ticket
    and not exists (
      select 1 from public.lesson_ticket_grants grant_row
      join public.lesson_ticket_registrations registration
        on registration.lesson_ticket_grant_id = grant_row.id
      where grant_row.id = v_lesson.ticket_grant_id
        and grant_row.academy_id = new.academy_id
        and grant_row.student_id = new.student_id
        and grant_row.instrument_id = v_lesson.instrument_id
        and grant_row.remaining_count > 0
        and registration.refunded_at is null
        and registration.registered_at <= (v_lesson.starts_at at time zone 'Asia/Seoul')::date
        and registration.valid_until >= (v_lesson.starts_at at time zone 'Asia/Seoul')::date
    ) then raise exception '연결된 회차권에 사용할 수 있는 회차가 없습니다.'; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.guard_private_ticket_reservations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare v_reserved integer;
begin
  if tg_op = 'DELETE' then
    perform pg_advisory_xact_lock(hashtextextended(
      old.academy_id::text || ':' || old.student_id::text || ':' || old.instrument_id, 0));
    if private.private_lesson_grant_reserved_count(old.id) > 0 then
      raise exception '예약된 개인레슨이 있어 회차권을 삭제할 수 없습니다. 일정을 먼저 정리해 주세요.';
    end if;
    return old;
  end if;
  if current_setting('app.private_ticket_attendance', true) = '1' then return new; end if;
  if new.remaining_count >= old.remaining_count and new.valid_until >= old.valid_until then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.academy_id::text || ':' || new.student_id::text || ':' || new.instrument_id, 0));
  v_reserved := private.private_lesson_grant_reserved_count(new.id);
  if new.remaining_count < v_reserved then
    raise exception '예약된 개인레슨보다 이 회차권의 잔여가 적어질 수 없습니다.';
  end if;
  if new.valid_until < old.valid_until and exists (
    select 1 from public.lesson_events event
    where event.ticket_grant_id = new.id and event.status = 'scheduled'
      and (event.starts_at at time zone 'Asia/Seoul')::date > new.valid_until
      and not exists (select 1 from public.attendance_records attendance
        where attendance.academy_id = event.academy_id and attendance.lesson_event_id = event.id)
  ) then raise exception '예약된 개인레슨의 날짜보다 회차권 만료일을 앞당길 수 없습니다.'; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION private.private_lesson_grant_reserved_count(p_grant_id uuid, p_exclude_event_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
  select count(*)::integer from public.lesson_events event
  where event.ticket_grant_id = p_grant_id and event.lesson_kind = 'private'
    and event.status = 'scheduled'
    and (p_exclude_event_id is null or event.id <> p_exclude_event_id)
    and not exists (select 1 from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
        and attendance.status in ('present', 'absent'));
$$;

CREATE OR REPLACE FUNCTION private.guard_private_lesson_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_date date;
  v_grant public.lesson_ticket_grants%rowtype;
  v_existing_reservation boolean := false;
begin
  if tg_op = 'DELETE' then
    if old.lesson_kind = 'private' then
      raise exception '개인레슨은 직접 삭제할 수 없습니다. 시간표의 일정 삭제 기능을 사용해 주세요.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.lesson_kind = 'private'
    and current_setting('app.private_lesson_mutation', true) is distinct from '1' then
    raise exception '개인레슨 일정 수정·삭제는 시간표 기능에서 처리해 주세요.';
  end if;
  if new.lesson_kind <> 'private' or new.status <> 'scheduled' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'scheduled'
    and old.student_id = new.student_id and old.instrument_id = new.instrument_id
    and old.starts_at = new.starts_at and old.ends_at = new.ends_at
    and old.teacher_id is not distinct from new.teacher_id then return new; end if;
  if new.teacher_id is null or not exists (
    select 1 from public.teachers teacher
    where teacher.id = new.teacher_id and teacher.academy_id = new.academy_id
      and teacher.status = 'employed'
  ) then raise exception '이 학원의 재직 선생님을 선택해 주세요.'; end if;
  v_date := (new.starts_at at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(
    new.academy_id::text || ':' || new.student_id::text || ':' || new.instrument_id, 0));
  if tg_op = 'INSERT' then new.ticket_session_number := null; end if;
  if tg_op = 'UPDATE' and old.ticket_grant_id is not null then
    if new.ticket_grant_id is distinct from old.ticket_grant_id then
      raise exception '기존 레슨의 회차권을 다른 권으로 바꿀 수 없습니다.';
    end if;
    v_existing_reservation := old.status = 'scheduled' and not exists (
      select 1 from public.attendance_records attendance
      where attendance.academy_id = old.academy_id
        and attendance.lesson_event_id = old.id);
    if new.ticket_session_number is distinct from old.ticket_session_number then
      raise exception '기존 레슨의 회차 번호를 직접 바꿀 수 없습니다.';
    end if;
  else
    new.ticket_grant_id := private.pick_private_lesson_ticket_grant(
      new.academy_id, new.student_id, new.instrument_id, v_date,
      case when tg_op = 'UPDATE' then new.id else null end);
  end if;
  select * into v_grant from public.lesson_ticket_grants grant_row
  where grant_row.id = new.ticket_grant_id and grant_row.academy_id = new.academy_id
    and grant_row.student_id = new.student_id and grant_row.instrument_id = new.instrument_id
  for update;
  if not found then
    raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하고 입금대기로 바꾼 뒤 다시 시도해 주세요.';
  end if;
  if not exists (select 1 from public.lesson_ticket_registrations registration
    where registration.lesson_ticket_grant_id = v_grant.id
      and registration.refunded_at is null
      and registration.registered_at <= v_date
      and registration.valid_until >= v_date) then
    raise exception '연결된 회차권의 유효기간 밖으로는 일정을 이동할 수 없습니다.';
  end if;
  if not v_existing_reservation and private.private_lesson_grant_available_count(
    v_grant.id, v_date, case when tg_op = 'UPDATE' then new.id else null end) < 1 then
    raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하고 입금대기로 바꾼 뒤 다시 시도해 주세요.';
  end if;
  new.ticket_total_count := case when tg_op = 'INSERT'
    then v_grant.total_granted_count
    else coalesce(old.ticket_total_count, v_grant.total_granted_count) end;
  if new.ticket_session_number is null then
    select number into new.ticket_session_number
    from generate_series(1, v_grant.total_granted_count) as number
    where not exists (
      select 1 from public.lesson_events event
      left join public.attendance_records attendance
        on attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
      where event.ticket_grant_id = v_grant.id
        and event.ticket_session_number = number
        and event.status = 'scheduled'
        and (attendance.status is null or attendance.status = 'present')
        and event.id <> new.id
    ) order by number limit 1;
  end if;
  if new.ticket_session_number is null then
    raise exception '회차권의 회차 번호를 배정할 수 없습니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'teacher:' || new.academy_id::text || ':' || new.teacher_id::text, 0));
  if exists (
    select 1 from public.lesson_events event
    where event.academy_id = new.academy_id and event.lesson_kind = 'private'
      and event.status = 'scheduled' and event.teacher_id = new.teacher_id
      and event.id <> new.id and event.starts_at < new.ends_at
      and event.ends_at > new.starts_at
  ) then raise exception '같은 선생님의 개인레슨 시간이 겹칩니다.'; end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.register_lesson_ticket(p_academy_id uuid, p_student_id uuid, p_instrument_id text, p_instrument_name text, p_granted_count integer, p_valid_days integer, p_registered_at date, p_paid_amount integer, p_is_service boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $$
declare
  v_result jsonb;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_grant public.lesson_ticket_grants%rowtype;
begin
  if p_is_service is null or (p_is_service and coalesce(p_paid_amount, -1) <> 0)
    or (not p_is_service and coalesce(p_paid_amount, 0) <= 0) then
    raise exception '양수 결제 금액을 입력하거나 서비스로 지급하기를 선택해 주세요.';
  end if;
  perform set_config('app.capture_ticket_registration', '1', true);
  v_result := private.register_lesson_ticket_impl(
    p_academy_id, p_student_id, p_instrument_id, p_instrument_name,
    p_granted_count, p_valid_days, p_registered_at, p_paid_amount);
  perform set_config('app.capture_ticket_registration', '', true);
  select * into v_registration from public.lesson_ticket_registrations
  where id = current_setting('app.last_ticket_registration_id', true)::uuid
    and academy_id = p_academy_id
    and lesson_ticket_grant_id = (v_result->>'ticket_id')::uuid
  for update;
  if not found then raise exception '새 회차권 등록 이력을 확인할 수 없습니다.'; end if;
  if p_is_service then
    update public.lesson_ticket_registrations set is_service = true,
      service_remaining_count = granted_count where id = v_registration.id;
    update public.lesson_ticket_grants
    set service_total_count = service_total_count + p_granted_count,
      service_remaining_count = service_remaining_count + p_granted_count
    where id = (v_result->>'ticket_id')::uuid;
  end if;
  select * into v_grant from public.lesson_ticket_grants
  where id = (v_result->>'ticket_id')::uuid;
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()),
    case when p_is_service then 'lesson_ticket.service_granted'
      else 'lesson_ticket.paid_granted' end,
    'lesson_ticket_grants', v_grant.id::text,
    jsonb_build_object('granted_count', p_granted_count,
      'registration_id', v_registration.id)
  );
  return v_result || jsonb_build_object(
    'total_granted_count', v_grant.total_granted_count,
    'remaining_count', v_grant.remaining_count,
    'service_total_count', v_grant.service_total_count,
    'service_remaining_count', v_grant.service_remaining_count
  );
end;
$$;

drop function if exists public.get_private_lesson_credit_balances(uuid);
drop function if exists private.settle_private_lesson_credits(uuid, uuid, text);
drop table if exists public.private_lesson_credits;
alter table public.lesson_events drop column if exists credit_authorized;

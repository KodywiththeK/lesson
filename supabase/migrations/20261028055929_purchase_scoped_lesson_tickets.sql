-- 새 구매는 별도 권이다. 기존에 합쳐진 권과 사용 이력은 분할하지 않는다.
alter table public.student_instruments
  drop constraint student_instruments_lesson_duration_minutes_check;
alter table public.student_instruments
  add constraint student_instruments_lesson_duration_minutes_check
  check (lesson_duration_minutes is null or lesson_duration_minutes between 5 and 240);

create or replace function private.validate_private_lesson_settings(p_enrollment jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  v_sessions integer;
  v_duration integer;
  v_lesson_fee integer;
  v_schedules jsonb := coalesce(p_enrollment -> 'weekly_schedules', '[]'::jsonb);
  v_weekday_count integer;
  v_schedule jsonb;
  v_start_time time;
  v_end_time time;
begin
  if coalesce(p_enrollment ->> 'lesson_type', '') <> 'private' then return; end if;
  begin
    v_sessions := nullif(p_enrollment ->> 'sessions_per_month', '')::integer;
    v_duration := nullif(p_enrollment ->> 'lesson_duration_minutes', '')::integer;
    v_lesson_fee := nullif(p_enrollment ->> 'lesson_fee', '')::integer;
  exception when invalid_text_representation then
    raise exception '개인레슨 월 횟수·수업 시간·레슨비를 다시 확인해 주세요.';
  end;
  if v_sessions is null or v_sessions <= 0 then
    raise exception '개인레슨 월 횟수는 1회 이상이어야 합니다.';
  end if;
  if v_duration is null or v_duration < 5 or v_duration > 240 then
    raise exception '개인레슨 수업 시간은 5~240분의 정수로 입력해 주세요.';
  end if;
  if v_duration not in (40, 60) and coalesce(v_lesson_fee, 0) <= 0 then
    raise exception '수업 시간에 맞는 레슨비를 직접 입력해 주세요.';
  end if;
  if jsonb_typeof(v_schedules) <> 'array' or jsonb_array_length(v_schedules) = 0 then
    raise exception '개인레슨 수강 요일을 하나 이상 선택해 주세요.';
  end if;
  v_weekday_count := jsonb_array_length(v_schedules);
  if (v_weekday_count = 1 and v_sessions <> 4)
    or (v_weekday_count = 2 and v_sessions <> 8) then
    raise exception '개인레슨 월 횟수는 주 1일이면 4회, 주 2일이면 8회여야 합니다.';
  end if;
  for v_schedule in select value from jsonb_array_elements(v_schedules)
  loop
    if coalesce(v_schedule ->> 'weekday', '') not in ('월', '화', '수', '목', '금', '토', '일') then
      raise exception '개인레슨 수강 요일을 확인해 주세요.';
    end if;
    if (nullif(v_schedule ->> 'start_time', '') is null)
      <> (nullif(v_schedule ->> 'end_time', '') is null) then
      raise exception '개인레슨 시작 시간과 종료 시간을 함께 입력해 주세요.';
    end if;
    if nullif(v_schedule ->> 'start_time', '') is not null then
      begin
        v_start_time := (v_schedule ->> 'start_time')::time;
        v_end_time := (v_schedule ->> 'end_time')::time;
      exception when invalid_datetime_format or datetime_field_overflow then
        raise exception '개인레슨 시간을 다시 확인해 주세요.';
      end;
      if extract(epoch from v_start_time) / 60 + v_duration >= 1440
        or v_end_time <> v_start_time + make_interval(mins => v_duration) then
        raise exception '개인레슨 종료 시간은 시작 시간에 수업 시간을 더한 값이어야 합니다.';
      end if;
    end if;
  end loop;
end;
$$;

alter table public.lesson_ticket_grants
  drop constraint lesson_ticket_grants_one_per_instrument;

alter table public.lesson_events
  add column ticket_grant_id uuid,
  add column ticket_session_number integer check (ticket_session_number > 0),
  add column ticket_total_count integer check (ticket_total_count > 0),
  add constraint lesson_events_ticket_grant_fk
    foreign key (academy_id, ticket_grant_id)
    references public.lesson_ticket_grants(academy_id, id)
    on delete set null (ticket_grant_id);
create index lesson_events_ticket_grant_idx
  on public.lesson_events (ticket_grant_id, starts_at)
  where ticket_grant_id is not null;
create index lesson_ticket_grants_priority_idx
  on public.lesson_ticket_grants (academy_id, student_id, instrument_id, registered_at, id);

-- 이전 스키마에서는 학원·원생·악기마다 최대 한 권이었다. 출석 이력은 보존한다.
-- 이관 중 레슨의 권·번호 필드만 바꾸므로 일정 수정 차단 트리거를 잠시 멈춘다.
alter table public.lesson_events disable trigger private_lesson_reservation_guard;
update public.lesson_events event
set ticket_grant_id = grant_row.id,
  ticket_total_count = grant_row.total_granted_count
from public.lesson_ticket_grants grant_row
where event.academy_id = grant_row.academy_id
  and event.student_id = grant_row.student_id
  and event.instrument_id = grant_row.instrument_id
  and event.lesson_kind = 'private' and event.counts_for_ticket
  and not event.credit_authorized;

-- 이미 정산된 외상 출석도 실제 사용 권에 연결한다.
update public.lesson_events event
set ticket_grant_id = usage.lesson_ticket_grant_id,
  ticket_total_count = grant_row.total_granted_count
from public.lesson_ticket_usages usage
join public.lesson_ticket_grants grant_row on grant_row.id = usage.lesson_ticket_grant_id
where event.id = usage.lesson_event_id and event.academy_id = usage.academy_id
  and event.credit_authorized and event.lesson_kind = 'private'
  and event.counts_for_ticket and grant_row.academy_id = event.academy_id;

do $$
begin
  if exists (
    select 1 from public.lesson_events event
    where event.lesson_kind = 'private' and event.counts_for_ticket
      and not event.credit_authorized and event.status = 'scheduled'
      and event.ticket_grant_id is null
  ) then
    raise exception '기존 개인레슨에 연결할 회차권이 없어 이관을 중단합니다.';
  end if;
end;
$$;

with ranked as (
  select event.id, row_number() over (
    partition by event.ticket_grant_id order by event.starts_at, event.id
  )::integer as session_number
  from public.lesson_events event
  where event.ticket_grant_id is not null and event.status = 'scheduled'
)
update public.lesson_events event
set ticket_session_number = ranked.session_number
from ranked where event.id = ranked.id;
alter table public.lesson_events enable trigger private_lesson_reservation_guard;

create function private.private_lesson_grant_reserved_count(
  p_grant_id uuid, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select count(*)::integer from public.lesson_events event
  where event.ticket_grant_id = p_grant_id and event.lesson_kind = 'private'
    and event.status = 'scheduled' and not event.credit_authorized
    and (p_exclude_event_id is null or event.id <> p_exclude_event_id)
    and not exists (select 1 from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
        and attendance.status in ('present', 'absent'));
$$;
revoke all on function private.private_lesson_grant_reserved_count(uuid, uuid)
  from public, anon, authenticated;

create function private.private_lesson_grant_available_count(
  p_grant_id uuid, p_lesson_date date,
  p_exclude_event_id uuid default null, p_ignore_period boolean default false
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select greatest(0,
    case when exists (select 1 from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = grant_row.id
        and not registration.is_service and registration.refunded_at is null
        and (p_ignore_period or (registration.registered_at <= p_lesson_date
          and registration.valid_until >= p_lesson_date)))
      then grant_row.remaining_count - grant_row.service_remaining_count else 0 end
    + coalesce((select sum(registration.service_remaining_count)::integer
      from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = grant_row.id
        and registration.is_service and registration.refunded_at is null
        and (p_ignore_period or (registration.registered_at <= p_lesson_date
          and registration.valid_until >= p_lesson_date))), 0)
    - private.private_lesson_grant_reserved_count(grant_row.id, p_exclude_event_id))
  from public.lesson_ticket_grants grant_row where grant_row.id = p_grant_id;
$$;
revoke all on function private.private_lesson_grant_available_count(uuid, date, uuid, boolean)
  from public, anon, authenticated;

create or replace function private.private_lesson_reserved_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select coalesce(sum(private.private_lesson_grant_reserved_count(grant_row.id,
    p_exclude_event_id)), 0)::integer
  from public.lesson_ticket_grants grant_row
  where grant_row.academy_id = p_academy_id and grant_row.student_id = p_student_id
    and grant_row.instrument_id = p_instrument_id;
$$;

create or replace function private.private_lesson_available_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_lesson_date date, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select case when bool_or(private.private_lesson_grant_reserved_count(grant_row.id,
      p_exclude_event_id) > grant_row.remaining_count)
    then 0 else coalesce(sum(private.private_lesson_grant_available_count(grant_row.id,
      p_lesson_date, p_exclude_event_id)), 0)::integer end
  from public.lesson_ticket_grants grant_row
  where grant_row.academy_id = p_academy_id and grant_row.student_id = p_student_id
    and grant_row.instrument_id = p_instrument_id;
$$;

create function private.pick_private_lesson_ticket_grant(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_lesson_date date, p_exclude_event_id uuid default null,
  p_ignore_period boolean default false
) returns uuid language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select grant_row.id from public.lesson_ticket_grants grant_row
  where grant_row.academy_id = p_academy_id and grant_row.student_id = p_student_id
    and grant_row.instrument_id = p_instrument_id
    and not exists (select 1 from public.lesson_ticket_grants excess
      where excess.academy_id = p_academy_id and excess.student_id = p_student_id
        and excess.instrument_id = p_instrument_id
        and private.private_lesson_grant_reserved_count(excess.id,
          p_exclude_event_id) > excess.remaining_count)
    and private.private_lesson_grant_available_count(grant_row.id, p_lesson_date,
      p_exclude_event_id, p_ignore_period) > 0
  order by case when exists (
    select 1 from public.lesson_ticket_registrations registration
    where registration.lesson_ticket_grant_id = grant_row.id
      and registration.is_service and registration.refunded_at is null
      and registration.service_remaining_count > 0
      and (p_ignore_period or (registration.registered_at <= p_lesson_date
        and registration.valid_until >= p_lesson_date))
  ) then 0 else 1 end,
    grant_row.registered_at, grant_row.created_at, grant_row.id
  limit 1;
$$;
revoke all on function private.pick_private_lesson_ticket_grant(uuid, uuid, text, date, uuid, boolean)
  from public, anon, authenticated;

create or replace function public.get_private_lesson_availability(
  p_academy_id uuid, p_lesson_date date
) returns table (student_id uuid, instrument_id text, remaining_count integer,
  reserved_count integer, available_count integer)
language plpgsql volatile security definer
set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '개인레슨 예약 가능 회차를 조회할 권한이 없습니다.';
  end if;
  if p_lesson_date is null then raise exception '레슨 날짜를 선택해 주세요.'; end if;
  return query
  select grant_row.student_id, grant_row.instrument_id,
    sum(grant_row.remaining_count)::integer,
    sum(private.private_lesson_grant_reserved_count(grant_row.id))::integer,
    private.private_lesson_available_count(p_academy_id, grant_row.student_id,
      grant_row.instrument_id, p_lesson_date)
  from public.lesson_ticket_grants grant_row
  where grant_row.academy_id = p_academy_id
  group by grant_row.student_id, grant_row.instrument_id;
end;
$$;

create or replace function private.guard_private_lesson_reservation()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
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
    and current_setting('app.private_lesson_mutation', true) is distinct from '1'
    and current_setting('app.credit_settlement', true) is distinct from '1' then
    raise exception '개인레슨 일정 수정·삭제는 시간표 기능에서 처리해 주세요.';
  end if;
  if tg_op = 'UPDATE' and current_setting('app.credit_settlement', true) = '1'
    and old.credit_authorized and new.credit_authorized then
    if new.academy_id is distinct from old.academy_id
      or new.student_id is distinct from old.student_id
      or new.instrument_id is distinct from old.instrument_id then
      raise exception '외상 정산 중 레슨 범위를 바꿀 수 없습니다.';
    end if;
    return new;
  end if;
  if new.credit_authorized and (new.lesson_kind <> 'private'
    or not new.counts_for_ticket
    or not private.has_academy_role(new.academy_id,
      array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])) then
    raise exception '외상 일정은 원장·데스크가 개인레슨에서만 등록할 수 있습니다.';
  end if;
  if new.lesson_kind <> 'private' or new.status <> 'scheduled' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'scheduled'
    and old.student_id = new.student_id and old.instrument_id = new.instrument_id
    and old.starts_at = new.starts_at and old.ends_at = new.ends_at
    and old.teacher_id is not distinct from new.teacher_id
    and old.credit_authorized = new.credit_authorized then return new; end if;
  if new.teacher_id is null or not exists (
    select 1 from public.teachers teacher
    where teacher.id = new.teacher_id and teacher.academy_id = new.academy_id
      and teacher.status = 'employed'
  ) then raise exception '이 학원의 재직 선생님을 선택해 주세요.'; end if;
  v_date := (new.starts_at at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(
    new.academy_id::text || ':' || new.student_id::text || ':' || new.instrument_id, 0));
  if new.credit_authorized then
    if private.private_lesson_available_count(new.academy_id, new.student_id,
      new.instrument_id, v_date, case when tg_op = 'UPDATE' then new.id else null end) > 0 then
      raise exception '예약 가능한 회차가 있습니다. 일반 일정으로 등록해 주세요.';
    end if;
    new.ticket_grant_id := null;
    new.ticket_session_number := null;
    new.ticket_total_count := null;
  else
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
      raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하거나 외상 일정을 확인해 주세요.';
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
      raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하거나 외상 일정을 확인해 주세요.';
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

create or replace function private.guard_private_absence_cancel_reservation()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_lesson public.lesson_events%rowtype;
begin
  if old.status <> 'absent' then return old; end if;
  select * into v_lesson from public.lesson_events
  where academy_id = old.academy_id and id = old.lesson_event_id
    and lesson_kind = 'private';
  if not found or v_lesson.credit_authorized then return old; end if;
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

create or replace function private.guard_private_ticket_reservations()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
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
      and not event.credit_authorized
      and (event.starts_at at time zone 'Asia/Seoul')::date > new.valid_until
      and not exists (select 1 from public.attendance_records attendance
        where attendance.academy_id = event.academy_id and attendance.lesson_event_id = event.id)
  ) then raise exception '예약된 개인레슨의 날짜보다 회차권 만료일을 앞당길 수 없습니다.'; end if;
  return new;
end;
$$;

create or replace function private.guard_private_ticket_attendance()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
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
    and not v_lesson.credit_authorized
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

create or replace function private.assign_private_ticket_usage()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_lesson public.lesson_events%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_lesson_date date;
  v_ignore_period boolean := current_setting('app.credit_settlement', true) = '1';
begin
  select * into v_grant from public.lesson_ticket_grants
  where id = new.lesson_ticket_grant_id and academy_id = new.academy_id
    and student_id = new.student_id and instrument_id = new.instrument_id for update;
  if not found then raise exception '출석에 연결된 회차권 범위가 올바르지 않습니다.'; end if;
  select * into v_lesson from public.lesson_events
  where id = new.lesson_event_id and academy_id = new.academy_id
    and student_id = new.student_id and instrument_id = new.instrument_id;
  if not found then raise exception '출석 수업을 찾을 수 없습니다.'; end if;
  if not v_ignore_period and not v_lesson.credit_authorized
    and v_lesson.ticket_grant_id is distinct from new.lesson_ticket_grant_id then
    raise exception '출석은 예약된 회차권에서만 차감할 수 있습니다.';
  end if;
  v_lesson_date := (v_lesson.starts_at at time zone 'Asia/Seoul')::date;
  select * into v_registration from public.lesson_ticket_registrations
  where lesson_ticket_grant_id = v_grant.id and is_service
    and refunded_at is null and service_remaining_count > 0
    and (v_ignore_period or (registered_at <= v_lesson_date and valid_until >= v_lesson_date))
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
        and (v_ignore_period or (registration.registered_at <= v_lesson_date
          and registration.valid_until >= v_lesson_date))
    ) then raise exception '수업 날짜에 사용할 수 있는 회차권이 없습니다.'; end if;
    new.funding_kind := 'paid';
    select id into new.funding_registration_id from public.lesson_ticket_registrations
    where lesson_ticket_grant_id = v_grant.id and not is_service and refunded_at is null
      and (v_ignore_period or (registered_at <= v_lesson_date and valid_until >= v_lesson_date))
    order by registered_at, created_at, id limit 1;
  end if;
  return new;
end;
$$;

create function private.attach_private_credit_usage()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_next_number integer;
  v_previous_setting text := current_setting('app.credit_settlement', true);
begin
  if not exists (select 1 from public.lesson_events event
    where event.id = new.lesson_event_id and event.academy_id = new.academy_id
      and event.credit_authorized) then return new; end if;
  select coalesce(max(event.ticket_session_number), 0) + 1 into v_next_number
  from public.lesson_events event
  where event.ticket_grant_id = new.lesson_ticket_grant_id
    and event.id <> new.lesson_event_id;
  perform set_config('app.credit_settlement', '1', true);
  update public.lesson_events event set
    ticket_grant_id = new.lesson_ticket_grant_id,
    ticket_session_number = v_next_number,
    ticket_total_count = grant_row.total_granted_count
  from public.lesson_ticket_grants grant_row
  where event.id = new.lesson_event_id and event.academy_id = new.academy_id
    and grant_row.id = new.lesson_ticket_grant_id
    and grant_row.academy_id = new.academy_id;
  perform set_config('app.credit_settlement', coalesce(v_previous_setting, ''), true);
  return new;
end;
$$;
revoke all on function private.attach_private_credit_usage() from public, anon, authenticated;
create trigger private_ticket_credit_attach
after insert on public.lesson_ticket_usages
for each row execute function private.attach_private_credit_usage();

create or replace function private.mark_private_lesson_attendance_impl(
  p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid,
  p_instrument_id text, p_status text, p_marked_at timestamptz default now()
) returns void language plpgsql security definer
set search_path = public, private, pg_temp as $$
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
  v_ticket_id := case when v_lesson.credit_authorized then
    private.pick_private_lesson_ticket_grant(p_academy_id, p_student_id,
      p_instrument_id, v_lesson_date) else v_lesson.ticket_grant_id end;
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

create or replace function private.settle_private_lesson_credits(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text
) returns integer language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_credit public.private_lesson_credits%rowtype;
  v_usage public.lesson_ticket_usages%rowtype;
  v_grant_id uuid;
  v_settled integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  for v_credit in
    select * from public.private_lesson_credits
    where academy_id = p_academy_id and student_id = p_student_id
      and instrument_id = p_instrument_id and status = 'open'
    order by (select starts_at from public.lesson_events where id = lesson_event_id),
      created_at, id for update
  loop
    v_grant_id := private.pick_private_lesson_ticket_grant(
      p_academy_id, p_student_id, p_instrument_id, current_date, null, true);
    if v_grant_id is null then exit; end if;
    select * into v_grant from public.lesson_ticket_grants
    where id = v_grant_id for update;
    update public.lesson_ticket_grants set remaining_count = remaining_count - 1
    where id = v_grant.id;
    perform set_config('app.credit_settlement', '1', true);
    insert into public.lesson_ticket_usages (
      academy_id, lesson_ticket_grant_id, lesson_event_id, student_id,
      instrument_id, used_at
    ) values (
      p_academy_id, v_grant.id, v_credit.lesson_event_id,
      p_student_id, p_instrument_id, now()
    ) returning * into v_usage;
    perform set_config('app.credit_settlement', '', true);
    update public.private_lesson_credits set status = 'settled',
      settlement_kind = v_usage.funding_kind, settlement_grant_id = v_grant.id,
      settled_at = now() where id = v_credit.id;
    insert into public.audit_events (
      academy_id, actor_id, event_type, entity_table, entity_id, metadata
    ) values (
      p_academy_id, (select auth.uid()), 'private_lesson_credit.settled',
      'private_lesson_credits', v_credit.id::text,
      jsonb_build_object('lesson_event_id', v_credit.lesson_event_id,
        'ticket_id', v_grant.id, 'funding_kind', v_usage.funding_kind)
    );
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;

create or replace function private.register_lesson_ticket_impl(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer default 0
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_instrument_name text;
  v_student_name text;
  v_valid_until date;
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권을 등록할 권한이 없습니다.';
  end if;
  if p_granted_count is null or p_granted_count <= 0 then
    raise exception '부여 회수는 1회 이상이어야 합니다.';
  end if;
  if p_valid_days is null or p_valid_days < 1 or p_valid_days > 3650 then
    raise exception '사용 기한은 1~3650일로 입력해 주세요.';
  end if;
  if p_registered_at is null then raise exception '등록일을 입력해 주세요.'; end if;
  if p_paid_amount is null or p_paid_amount < 0 then
    raise exception '결제 금액은 0원 이상이어야 합니다.';
  end if;
  select student.name, instrument.instrument_name into v_student_name, v_instrument_name
  from public.students student
  join public.student_instruments instrument
    on instrument.academy_id = student.academy_id
    and instrument.student_id = student.id
  where student.academy_id = p_academy_id and student.id = p_student_id
    and student.status = 'enrolled' and instrument.instrument_id = p_instrument_id
    and instrument.lesson_type = 'private' and instrument.active;
  if not found then
    raise exception '활성 개인레슨 악기를 찾을 수 없습니다. 원생 수업을 확인해 주세요.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  if exists (select 1 from public.lesson_ticket_grants grant_row
    where grant_row.academy_id = p_academy_id and grant_row.student_id = p_student_id
      and grant_row.instrument_id = p_instrument_id
      and grant_row.registered_at > p_registered_at) then
    raise exception '등록일은 직전 등록일보다 앞설 수 없습니다.';
  end if;
  v_valid_until := p_registered_at + p_valid_days;
  insert into public.lesson_ticket_grants (
    academy_id, student_id, instrument_id, instrument_name,
    total_granted_count, remaining_count, valid_from, valid_until,
    registered_at, paid_amount, paid_at, created_by
  ) values (
    p_academy_id, p_student_id, p_instrument_id, v_instrument_name,
    p_granted_count, p_granted_count, p_registered_at, v_valid_until,
    p_registered_at, p_paid_amount,
    case when p_paid_amount > 0 then p_registered_at else null end,
    (select auth.uid())
  ) returning * into v_ticket;
  if p_paid_amount > 0 then
    perform set_config('app.ledger_rpc', 'lesson-ticket', true);
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    ) values (
      p_academy_id, p_registered_at, 'income', 'lesson-ticket', 'lesson-ticket',
      p_paid_amount, v_student_name || ' ' || v_instrument_name ||
        ' 회차권 ' || p_granted_count || '회 구매',
      'lesson_ticket_grants', v_ticket.id::text, (select auth.uid())
    ) returning id into v_ledger_id;
    perform set_config('app.ledger_rpc', '', true);
  end if;
  insert into public.lesson_ticket_registrations (
    academy_id, lesson_ticket_grant_id, registered_at, granted_count,
    valid_until, original_paid_amount, ledger_entry_id, created_by
  ) values (
    p_academy_id, v_ticket.id, p_registered_at, p_granted_count,
    v_valid_until, p_paid_amount, v_ledger_id, (select auth.uid())
  );
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.registered',
    'lesson_ticket_grants', v_ticket.id::text,
    jsonb_build_object('merged', false, 'granted_count', p_granted_count,
      'valid_days', p_valid_days, 'paid_amount', p_paid_amount)
  );
  return jsonb_build_object('ticket_id', v_ticket.id, 'merged', false,
    'total_granted_count', v_ticket.total_granted_count,
    'remaining_count', v_ticket.remaining_count,
    'valid_from', v_ticket.valid_from, 'valid_until', v_ticket.valid_until);
end;
$$;

create or replace function public.get_assigned_lesson_ticket_balances(p_academy_id uuid)
returns table (student_id uuid, instrument_id text, remaining_count integer, valid_until date)
language plpgsql stable security definer
set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['teacher'::public.academy_member_role]) then
    raise exception '담당 회차권을 조회할 권한이 없습니다.';
  end if;
  return query
  select grant_row.student_id, grant_row.instrument_id,
    sum(grant_row.remaining_count)::integer, max(grant_row.valid_until)
  from public.lesson_ticket_grants grant_row
  join public.student_instruments instrument
    on instrument.academy_id = grant_row.academy_id
    and instrument.student_id = grant_row.student_id
    and instrument.instrument_id = grant_row.instrument_id
    and instrument.lesson_type = 'private' and instrument.active
  join public.teachers teacher
    on teacher.academy_id = instrument.academy_id and teacher.id = instrument.teacher_id
    and teacher.status <> 'resigned'
  join public.academy_members member
    on member.academy_id = teacher.academy_id and member.id = teacher.member_id
  where grant_row.academy_id = p_academy_id
    and member.user_id = (select auth.uid()) and member.status = 'active'
    and member.role = 'teacher'
  group by grant_row.student_id, grant_row.instrument_id;
end;
$$;

create or replace function public.revoke_service_lesson_ticket(
  p_academy_id uuid, p_ticket_id uuid, p_count integer, p_reason text
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_left integer := p_count;
  v_reduce integer;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '서비스 회차를 회수할 권한이 없습니다.';
  end if;
  if p_count is null or p_count < 1 or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '회수 횟수와 사유를 입력해 주세요.';
  end if;
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found or v_grant.service_remaining_count < p_count then
    raise exception '회수할 수 있는 미사용 서비스 회차가 부족합니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_grant.student_id::text || ':' || v_grant.instrument_id, 0));
  if v_grant.remaining_count - p_count < private.private_lesson_grant_reserved_count(v_grant.id) then
    raise exception '예약된 개인레슨보다 잔여 회차가 적어질 수 없습니다.';
  end if;
  for v_registration in
    select * from public.lesson_ticket_registrations
    where lesson_ticket_grant_id = p_ticket_id and is_service
      and service_remaining_count > 0 and refunded_at is null
    order by registered_at desc, created_at desc, id desc for update
  loop
    exit when v_left = 0;
    v_reduce := least(v_left, v_registration.service_remaining_count);
    update public.lesson_ticket_registrations
    set service_remaining_count = service_remaining_count - v_reduce,
      revoked_count = revoked_count + v_reduce
    where id = v_registration.id;
    v_left := v_left - v_reduce;
  end loop;
  if v_left <> 0 then raise exception '서비스 등록 이력과 잔여 횟수가 일치하지 않습니다.'; end if;
  if v_grant.total_granted_count = p_count then
    -- 유료분 환불 뒤 남은 서비스만 모두 회수하는 경우에는 환불된
    -- 유료 사용 기록도 grant와 함께 정리된다. 외상 정산 이력은 별도 테이블에 남는다.
    perform set_config('app.service_revoke', '1', true);
    delete from public.lesson_ticket_grants where id = p_ticket_id;
    perform set_config('app.service_revoke', '', true);
  else
    update public.lesson_ticket_grants set
      total_granted_count = total_granted_count - p_count,
      remaining_count = remaining_count - p_count,
      service_total_count = service_total_count - p_count,
      service_remaining_count = service_remaining_count - p_count
    where id = p_ticket_id;
  end if;
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.service_revoked',
    'lesson_ticket_grants', p_ticket_id::text, btrim(p_reason),
    jsonb_build_object('count', p_count)
  );
  return jsonb_build_object('ticket_id', p_ticket_id, 'revoked_count', p_count);
end;
$$;
revoke all on function public.revoke_service_lesson_ticket(uuid, uuid, integer, text)
from public, anon;
grant execute on function public.revoke_service_lesson_ticket(uuid, uuid, integer, text)
to authenticated;

notify pgrst, 'reload schema';

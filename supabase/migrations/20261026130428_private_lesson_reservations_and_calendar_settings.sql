-- 개인레슨 예약은 출석 차감과 분리한다. 모든 경로가 같은 학원·원생·악기 잠금을 사용한다.
create function private.private_lesson_reserved_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select count(*)::integer
  from public.lesson_events event
  where event.academy_id = p_academy_id
    and event.student_id = p_student_id
    and event.instrument_id = p_instrument_id
    and event.lesson_kind = 'private'
    and event.status = 'scheduled'
    and (p_exclude_event_id is null or event.id <> p_exclude_event_id)
    and not exists (
      select 1 from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
        and attendance.status in ('present', 'absent')
    );
$$;
revoke all on function private.private_lesson_reserved_count(uuid, uuid, text, uuid) from public, anon, authenticated;

create function private.private_lesson_available_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_lesson_date date, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select case when exists (
    select 1 from public.lesson_ticket_registrations registration
    join public.lesson_ticket_grants grant_row
      on grant_row.academy_id = registration.academy_id
     and grant_row.id = registration.lesson_ticket_grant_id
    where grant_row.academy_id = p_academy_id
      and grant_row.student_id = p_student_id
      and grant_row.instrument_id = p_instrument_id
      and registration.registered_at <= p_lesson_date
      and registration.valid_until >= p_lesson_date
  ) then greatest(0, coalesce((
    select sum(remaining_count)::integer from public.lesson_ticket_grants
    where academy_id = p_academy_id and student_id = p_student_id
      and instrument_id = p_instrument_id
  ), 0) - private.private_lesson_reserved_count(
    p_academy_id, p_student_id, p_instrument_id, p_exclude_event_id
  )) else 0 end;
$$;
revoke all on function private.private_lesson_available_count(uuid, uuid, text, date, uuid) from public, anon, authenticated;

create function public.get_private_lesson_availability(p_academy_id uuid, p_lesson_date date)
returns table (
  student_id uuid, instrument_id text, remaining_count integer,
  reserved_count integer, available_count integer
) language plpgsql volatile security definer
set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '개인레슨 예약 가능 회차를 조회할 권한이 없습니다.';
  end if;
  if p_lesson_date is null then raise exception '레슨 날짜를 선택해 주세요.'; end if;
  return query
  select grant_row.student_id, grant_row.instrument_id,
    grant_row.remaining_count,
    private.private_lesson_reserved_count(p_academy_id, grant_row.student_id, grant_row.instrument_id),
    private.private_lesson_available_count(p_academy_id, grant_row.student_id,
      grant_row.instrument_id, p_lesson_date)
  from public.lesson_ticket_grants grant_row
  where grant_row.academy_id = p_academy_id;
end;
$$;
revoke all on function public.get_private_lesson_availability(uuid, date) from public, anon;
grant execute on function public.get_private_lesson_availability(uuid, date) to authenticated;

create function private.guard_private_lesson_reservation()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_date date;
begin
  if tg_op = 'DELETE' then
    if old.lesson_kind = 'private' then
      raise exception '개인레슨은 직접 삭제할 수 없습니다. 시간표의 일정 삭제 기능을 사용해 주세요.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.lesson_kind = 'private'
       and current_setting('app.private_lesson_mutation', true) is distinct from '1' then
      raise exception '개인레슨 일정 수정·삭제는 시간표 기능에서 처리해 주세요.';
    end if;
  end if;
  if new.lesson_kind <> 'private' or new.status <> 'scheduled' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'scheduled' and old.student_id = new.student_id
       and old.instrument_id = new.instrument_id and old.starts_at = new.starts_at
       and old.ends_at = new.ends_at
       and old.teacher_id is not distinct from new.teacher_id then return new; end if;
  end if;
  if new.teacher_id is null or not exists (
    select 1 from public.teachers teacher
    where teacher.id = new.teacher_id and teacher.academy_id = new.academy_id
      and teacher.status = 'employed'
  ) then raise exception '이 학원의 재직 선생님을 선택해 주세요.'; end if;
  v_date := (new.starts_at at time zone 'Asia/Seoul')::date;
  perform pg_advisory_xact_lock(hashtextextended(
    new.academy_id::text || ':' || new.student_id::text || ':' || new.instrument_id, 0));
  if private.private_lesson_available_count(new.academy_id, new.student_id,
      new.instrument_id, v_date, case when tg_op = 'UPDATE' then new.id else null end) < 1 then
    raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하거나 기존 일정을 정리해 주세요.';
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
revoke all on function private.guard_private_lesson_reservation() from public, anon, authenticated;
create trigger private_lesson_reservation_guard
before insert or update or delete on public.lesson_events
for each row execute function private.guard_private_lesson_reservation();

create function private.guard_private_absence_cancel_reservation()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_lesson public.lesson_events%rowtype;
begin
  if old.status <> 'absent' then return old; end if;
  select * into v_lesson from public.lesson_events
  where academy_id = old.academy_id and id = old.lesson_event_id and lesson_kind = 'private';
  if not found then return old; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    old.academy_id::text || ':' || old.student_id::text || ':' || v_lesson.instrument_id, 0));
  if private.private_lesson_available_count(old.academy_id, old.student_id,
      v_lesson.instrument_id, (v_lesson.starts_at at time zone 'Asia/Seoul')::date) < 1 then
    raise exception '결석을 취소하면 예약 회차가 초과됩니다. 먼저 일정을 정리하거나 회차권을 등록해 주세요.';
  end if;
  return old;
end;
$$;
revoke all on function private.guard_private_absence_cancel_reservation() from public, anon, authenticated;
create trigger private_absence_cancel_reservation_guard
before delete on public.attendance_records
for each row execute function private.guard_private_absence_cancel_reservation();

create function private.guard_private_ticket_reservations()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_reserved integer;
begin
  if tg_op = 'DELETE' then
    perform pg_advisory_xact_lock(hashtextextended(
      old.academy_id::text || ':' || old.student_id::text || ':' || old.instrument_id, 0));
    if private.private_lesson_reserved_count(old.academy_id, old.student_id, old.instrument_id) > 0 then
      raise exception '예약된 개인레슨이 있어 회차권을 삭제할 수 없습니다. 일정을 먼저 정리해 주세요.';
    end if;
    return old;
  end if;
  if current_setting('app.private_ticket_attendance', true) = '1' then return new; end if;
  if new.remaining_count >= old.remaining_count and new.valid_until >= old.valid_until then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    new.academy_id::text || ':' || new.student_id::text || ':' || new.instrument_id, 0));
  v_reserved := private.private_lesson_reserved_count(new.academy_id, new.student_id, new.instrument_id);
  if new.remaining_count < v_reserved then
    raise exception '예약된 개인레슨보다 회차권 잔여가 적어질 수 없습니다. 일정을 먼저 정리해 주세요.';
  end if;
  if new.valid_until < old.valid_until and exists (
    select 1 from public.lesson_events event
    where event.academy_id = new.academy_id and event.student_id = new.student_id
      and event.instrument_id = new.instrument_id and event.lesson_kind = 'private'
      and event.status = 'scheduled'
      and (event.starts_at at time zone 'Asia/Seoul')::date > new.valid_until
      and not exists (select 1 from public.attendance_records attendance
        where attendance.academy_id = event.academy_id and attendance.lesson_event_id = event.id)
  ) then raise exception '예약된 개인레슨의 날짜보다 회차권 만료일을 앞당길 수 없습니다.'; end if;
  return new;
end;
$$;
revoke all on function private.guard_private_ticket_reservations() from public, anon, authenticated;
create trigger private_ticket_reservation_guard
before update or delete on public.lesson_ticket_grants
for each row execute function private.guard_private_ticket_reservations();

create function public.update_private_lesson_event(
  p_academy_id uuid, p_event_id uuid, p_teacher_id uuid,
  p_starts_at timestamptz, p_ends_at timestamptz, p_reason text default null
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_lesson public.lesson_events%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '개인레슨 일정을 수정할 권한이 없습니다.';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception '레슨 시작·종료 시간을 확인해 주세요.';
  end if;
  if not exists (select 1 from public.teachers where academy_id = p_academy_id
    and id = p_teacher_id and status = 'employed') then
    raise exception '재직 중인 선생님을 선택해 주세요.';
  end if;
  select * into v_lesson from public.lesson_events
  where academy_id = p_academy_id and id = p_event_id
    and lesson_kind = 'private' and status = 'scheduled' for update;
  if not found then raise exception '수정할 예정 개인레슨을 찾지 못했습니다.'; end if;
  if exists (select 1 from public.attendance_records
    where academy_id = p_academy_id and lesson_event_id = p_event_id) then
    raise exception '출결을 먼저 취소한 뒤 일정을 수정해 주세요.';
  end if;
  perform set_config('app.private_lesson_mutation', '1', true);
  update public.lesson_events set teacher_id = p_teacher_id,
    starts_at = p_starts_at, ends_at = p_ends_at
  where academy_id = p_academy_id and id = p_event_id;
  perform set_config('app.private_lesson_mutation', '', true);
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_event.rescheduled', 'lesson_events', p_event_id::text,
    nullif(btrim(coalesce(p_reason, '')), ''), jsonb_build_object(
      'kind', 'private', 'old_starts_at', v_lesson.starts_at,
      'new_starts_at', p_starts_at, 'old_teacher_id', v_lesson.teacher_id,
      'new_teacher_id', p_teacher_id));
  return jsonb_build_object('event_id', p_event_id);
end;
$$;
revoke all on function public.update_private_lesson_event(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.update_private_lesson_event(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated;

create function public.delete_private_lesson_event(p_academy_id uuid, p_event_id uuid)
returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_lesson public.lesson_events%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '개인레슨 일정을 삭제할 권한이 없습니다.';
  end if;
  select * into v_lesson from public.lesson_events
  where academy_id = p_academy_id and id = p_event_id
    and lesson_kind = 'private' and status = 'scheduled' for update;
  if not found then raise exception '삭제할 예정 개인레슨을 찾지 못했습니다.'; end if;
  if exists (select 1 from public.attendance_records
    where academy_id = p_academy_id and lesson_event_id = p_event_id) then
    raise exception '출결을 먼저 취소한 뒤 일정을 삭제해 주세요.';
  end if;
  perform set_config('app.private_lesson_mutation', '1', true);
  update public.lesson_events set status = 'deleted', deleted_at = now(), deleted_by = (select auth.uid())
  where academy_id = p_academy_id and id = p_event_id;
  perform set_config('app.private_lesson_mutation', '', true);
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_event.deleted', 'lesson_events', p_event_id::text,
    jsonb_build_object('kind', 'private', 'starts_at', v_lesson.starts_at));
  return jsonb_build_object('event_id', p_event_id);
end;
$$;
revoke all on function public.delete_private_lesson_event(uuid, uuid) from public, anon;
grant execute on function public.delete_private_lesson_event(uuid, uuid) to authenticated;

create table public.academy_instrument_colors (
  academy_id uuid not null references public.academies(id) on delete cascade,
  instrument_id text not null,
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now(),
  primary key (academy_id, instrument_id)
);
alter table public.academy_instrument_colors enable row level security;
revoke all on public.academy_instrument_colors from anon, authenticated;
grant select, insert, update, delete on public.academy_instrument_colors to authenticated;
create policy academy_instrument_colors_read on public.academy_instrument_colors
for select to authenticated using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role,
    'teacher'::public.academy_member_role]));
create policy academy_instrument_colors_write on public.academy_instrument_colors
for all to authenticated using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create table public.academy_closures (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  starts_on date not null,
  ends_on date not null,
  weekday smallint check (weekday between 0 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (academy_id, id)
);
create index academy_closures_range_idx on public.academy_closures (academy_id, starts_on, ends_on) where active;
alter table public.academy_closures enable row level security;
revoke all on public.academy_closures from anon, authenticated;
grant select, insert, update on public.academy_closures to authenticated;
create policy academy_closures_read on public.academy_closures
for select to authenticated using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role,
    'teacher'::public.academy_member_role]));
create policy academy_closures_write on public.academy_closures
for all to authenticated using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

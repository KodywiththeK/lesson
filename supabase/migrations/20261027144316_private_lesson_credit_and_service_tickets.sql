-- 외상 출석은 출결과 별도 이력을 유지한다. 기존 출결 중 사용 기록이 없다는
-- 사실만으로 과거 외상을 추정하지 않는다(과거 환불 등과 구별할 수 없다).
do $$
begin
  if exists (
    select 1 from public.lesson_ticket_grants grant_row
    where grant_row.total_granted_count <> (
      select coalesce(sum(registration.granted_count), 0)
      from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = grant_row.id
    )
  ) then
    raise exception '회차권 총 부여 횟수와 등록 이력이 달라 자동 이관을 중단합니다.';
  end if;
  if exists (
    select 1 from public.lesson_ticket_registrations registration
    where registration.original_paid_amount = 0
      and (exists (select 1 from public.lesson_ticket_adjustments adjustment
        where adjustment.lesson_ticket_grant_id = registration.lesson_ticket_grant_id)
        or exists (select 1 from public.lesson_ticket_usages usage
          where usage.lesson_ticket_grant_id = registration.lesson_ticket_grant_id))
  ) then
    raise exception '0원 등록과 사용·수동 조정이 섞인 회차권은 출처를 확인한 뒤 이관해 주세요.';
  end if;
end;
$$;

alter table public.lesson_events
  add column credit_authorized boolean not null default false;

alter table public.lesson_ticket_grants
  add column service_total_count integer not null default 0 check (service_total_count >= 0),
  add column service_remaining_count integer not null default 0 check (service_remaining_count >= 0);

alter table public.lesson_ticket_registrations
  add column is_service boolean not null default false,
  add column service_remaining_count integer not null default 0 check (service_remaining_count >= 0),
  add column revoked_count integer not null default 0 check (revoked_count >= 0),
  add column refunded_at timestamptz;

update public.lesson_ticket_registrations
set is_service = true
where original_paid_amount = 0;

with service_totals as (
  select grant_row.id, grant_row.academy_id,
    coalesce(sum(registration.granted_count), 0)::integer as service_total,
    greatest(0, coalesce(sum(registration.granted_count), 0)::integer
      - (grant_row.total_granted_count - grant_row.remaining_count)) as service_remaining
  from public.lesson_ticket_grants grant_row
  left join public.lesson_ticket_registrations registration
    on registration.lesson_ticket_grant_id = grant_row.id and registration.is_service
  group by grant_row.id
)
update public.lesson_ticket_grants grant_row
set service_total_count = service_totals.service_total,
  service_remaining_count = service_totals.service_remaining
from service_totals
where grant_row.id = service_totals.id;

with ranked as (
  select registration.id, registration.lesson_ticket_grant_id, registration.granted_count,
    sum(registration.granted_count) over (
      partition by registration.lesson_ticket_grant_id
      order by registration.registered_at desc, registration.created_at desc, registration.id desc
      rows between unbounded preceding and current row
    ) as cumulative_count
  from public.lesson_ticket_registrations registration
  where registration.is_service
)
update public.lesson_ticket_registrations registration
set service_remaining_count = greatest(0, least(ranked.granted_count,
  grant_row.service_remaining_count - (ranked.cumulative_count - ranked.granted_count)))
from ranked
join public.lesson_ticket_grants grant_row on grant_row.id = ranked.lesson_ticket_grant_id
where registration.id = ranked.id;

alter table public.lesson_ticket_grants
  add constraint lesson_ticket_service_balance_check
  check (service_total_count <= total_granted_count
    and service_remaining_count <= service_total_count);

alter table public.lesson_ticket_registrations
  add constraint lesson_ticket_registration_service_check
  check ((is_service and original_paid_amount = 0
    and service_remaining_count <= granted_count - revoked_count)
    or (not is_service and original_paid_amount >= 0 and service_remaining_count = 0));

alter table public.lesson_ticket_usages
  add column funding_kind text not null default 'paid'
    check (funding_kind in ('paid', 'service')),
  add column funding_registration_id uuid references public.lesson_ticket_registrations(id) on delete set null,
  add column funding_refunded boolean not null default false;

create table public.private_lesson_credits (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  lesson_event_id uuid not null references public.lesson_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  instrument_id text not null,
  status text not null default 'open' check (status in ('open', 'settled', 'cancelled')),
  settlement_kind text check (settlement_kind in ('paid', 'service')),
  settlement_grant_id uuid references public.lesson_ticket_grants(id) on delete set null,
  settled_at timestamptz,
  funding_refunded boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (academy_id, lesson_event_id),
  check ((status = 'settled' and settlement_kind is not null and settled_at is not null)
    or (status <> 'settled' and settlement_kind is null))
);
create index private_lesson_credits_open_idx
  on public.private_lesson_credits(academy_id, student_id, instrument_id, created_at)
  where status = 'open';
alter table public.private_lesson_credits enable row level security;
revoke all on public.private_lesson_credits from anon, authenticated;
grant select on public.private_lesson_credits to authenticated;
create policy private_lesson_credits_read on public.private_lesson_credits
for select to authenticated using (private.has_academy_role(academy_id,
  array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or exists (
    select 1 from public.lesson_events lesson
    join public.teachers teacher on teacher.academy_id = lesson.academy_id
      and teacher.id = lesson.teacher_id
    join public.academy_members member on member.academy_id = teacher.academy_id
      and member.id = teacher.member_id
    where lesson.academy_id = private_lesson_credits.academy_id
      and lesson.id = private_lesson_credits.lesson_event_id
      and member.user_id = (select auth.uid())
      and member.role = 'teacher' and member.status = 'active'
  ));

create function public.get_private_lesson_credit_balances(p_academy_id uuid)
returns table (student_id uuid, student_name text, instrument_id text,
  instrument_name text, open_count integer)
language plpgsql stable security definer
set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null then raise exception '로그인이 필요합니다.'; end if;
  if not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role,
      'teacher'::public.academy_member_role]) then
    raise exception '미정산 횟수를 조회할 권한이 없습니다.';
  end if;
  return query
  select credit.student_id, student.name, credit.instrument_id,
    min(lesson.instrument_name), count(*)::integer
  from public.private_lesson_credits credit
  join public.students student on student.id = credit.student_id
    and student.academy_id = credit.academy_id
  join public.lesson_events lesson on lesson.id = credit.lesson_event_id
    and lesson.academy_id = credit.academy_id
  where credit.academy_id = p_academy_id and credit.status = 'open'
    and (private.has_academy_role(p_academy_id,
      array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
      or exists (
        select 1 from public.lesson_events lesson
        join public.teachers teacher on teacher.academy_id = lesson.academy_id
          and teacher.id = lesson.teacher_id
        join public.academy_members member on member.academy_id = teacher.academy_id
          and member.id = teacher.member_id
        where lesson.id = credit.lesson_event_id
          and lesson.academy_id = credit.academy_id
          and member.user_id = (select auth.uid())
          and member.role = 'teacher' and member.status = 'active'
      ))
  group by credit.student_id, student.name, credit.instrument_id;
end;
$$;
revoke all on function public.get_private_lesson_credit_balances(uuid) from public, anon;
grant execute on function public.get_private_lesson_credit_balances(uuid) to authenticated;

-- 정상 예약만 회차를 점유한다. 외상 예정은 출석 때 다시 판정한다.
create or replace function private.private_lesson_reserved_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select count(*)::integer from public.lesson_events event
  where event.academy_id = p_academy_id and event.student_id = p_student_id
    and event.instrument_id = p_instrument_id and event.lesson_kind = 'private'
    and event.status = 'scheduled' and not event.credit_authorized
    and (p_exclude_event_id is null or event.id <> p_exclude_event_id)
    and not exists (select 1 from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
        and attendance.status in ('present', 'absent'));
$$;

create or replace function private.private_lesson_available_count(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_lesson_date date, p_exclude_event_id uuid default null
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select greatest(0, coalesce((
    select case when exists (
      select 1 from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = grant_row.id
        and not registration.is_service and registration.refunded_at is null
        and registration.registered_at <= p_lesson_date
        and registration.valid_until >= p_lesson_date
    ) then grant_row.remaining_count - grant_row.service_remaining_count else 0 end
    + coalesce((select sum(registration.service_remaining_count)::integer
      from public.lesson_ticket_registrations registration
      where registration.lesson_ticket_grant_id = grant_row.id
        and registration.is_service and registration.refunded_at is null
        and registration.registered_at <= p_lesson_date
        and registration.valid_until >= p_lesson_date), 0)
    from public.lesson_ticket_grants grant_row
    where grant_row.academy_id = p_academy_id
      and grant_row.student_id = p_student_id
      and grant_row.instrument_id = p_instrument_id
  ), 0) - private.private_lesson_reserved_count(
    p_academy_id, p_student_id, p_instrument_id, p_exclude_event_id));
$$;

create or replace function private.guard_private_ticket_reservations()
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
      and event.status = 'scheduled' and not event.credit_authorized
      and (event.starts_at at time zone 'Asia/Seoul')::date > new.valid_until
      and not exists (select 1 from public.attendance_records attendance
        where attendance.academy_id = event.academy_id and attendance.lesson_event_id = event.id)
  ) then raise exception '예약된 개인레슨의 날짜보다 회차권 만료일을 앞당길 수 없습니다.'; end if;
  return new;
end;
$$;

-- 회차 사용의 출처를 한 곳에서 정한다. 회차권 잔액은 호출 RPC가 먼저 1 차감한다.
create function private.assign_private_ticket_usage()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_lesson_date date;
  v_ignore_period boolean := current_setting('app.credit_settlement', true) = '1';
begin
  select * into v_grant from public.lesson_ticket_grants
  where id = new.lesson_ticket_grant_id and academy_id = new.academy_id for update;
  select (starts_at at time zone 'Asia/Seoul')::date into v_lesson_date
  from public.lesson_events where id = new.lesson_event_id and academy_id = new.academy_id;
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
    ) then
      raise exception '수업 날짜에 사용할 수 있는 회차권이 없습니다.';
    end if;
    new.funding_kind := 'paid';
    select id into new.funding_registration_id from public.lesson_ticket_registrations
    where lesson_ticket_grant_id = v_grant.id and not is_service and refunded_at is null
      and (v_ignore_period or (registered_at <= v_lesson_date and valid_until >= v_lesson_date))
    order by registered_at, created_at, id limit 1;
  end if;
  return new;
end;
$$;
revoke all on function private.assign_private_ticket_usage() from public, anon, authenticated;
create trigger private_ticket_usage_funding
before insert on public.lesson_ticket_usages
for each row execute function private.assign_private_ticket_usage();

create function private.restore_private_ticket_usage()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
begin
  if old.funding_refunded and
    current_setting('app.service_revoke', true) is distinct from '1' then
    raise exception '환불된 회차로 정산한 출석입니다. 원장이 환불·정산 이력을 먼저 정정해야 합니다.';
  end if;
  if old.funding_kind = 'service' then
    update public.lesson_ticket_registrations
    set service_remaining_count = service_remaining_count + 1
    where id = old.funding_registration_id and is_service
      and service_remaining_count < granted_count - revoked_count;
    if not found then raise exception '서비스 회차의 사용 출처를 복구할 수 없습니다.'; end if;
    update public.lesson_ticket_grants
    set service_remaining_count = service_remaining_count + 1
    where id = old.lesson_ticket_grant_id
      and service_remaining_count < service_total_count;
  end if;
  return old;
end;
$$;
revoke all on function private.restore_private_ticket_usage() from public, anon, authenticated;
create trigger private_ticket_usage_restore
before delete on public.lesson_ticket_usages
for each row execute function private.restore_private_ticket_usage();

create function private.settle_private_lesson_credits(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text
) returns integer language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_credit public.private_lesson_credits%rowtype;
  v_usage public.lesson_ticket_usages%rowtype;
  v_settled integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and student_id = p_student_id
    and instrument_id = p_instrument_id for update;
  if not found then return 0; end if;
  for v_credit in
    select * from public.private_lesson_credits
    where academy_id = p_academy_id and student_id = p_student_id
      and instrument_id = p_instrument_id and status = 'open'
    order by (select starts_at from public.lesson_events where id = lesson_event_id),
      created_at, id for update
  loop
    if v_grant.remaining_count <= private.private_lesson_reserved_count(
      p_academy_id, p_student_id, p_instrument_id) then exit; end if;
    update public.lesson_ticket_grants set remaining_count = remaining_count - 1
    where id = v_grant.id returning * into v_grant;
    perform set_config('app.credit_settlement', '1', true);
    insert into public.lesson_ticket_usages (
      academy_id, lesson_ticket_grant_id, lesson_event_id, student_id,
      instrument_id, used_at
    ) values (
      p_academy_id, v_grant.id, v_credit.lesson_event_id, p_student_id,
      p_instrument_id, now()
    ) returning * into v_usage;
    perform set_config('app.credit_settlement', '', true);
    update public.private_lesson_credits set status = 'settled',
      settlement_kind = v_usage.funding_kind, settlement_grant_id = v_grant.id,
      settled_at = now()
    where id = v_credit.id;
    insert into public.audit_events (
      academy_id, actor_id, event_type, entity_table, entity_id, metadata
    ) values (
      p_academy_id, (select auth.uid()), 'private_lesson_credit.settled',
      'private_lesson_credits', v_credit.id::text,
      jsonb_build_object('lesson_event_id', v_credit.lesson_event_id,
        'funding_kind', v_usage.funding_kind, 'grant_id', v_grant.id)
    );
    v_settled := v_settled + 1;
  end loop;
  return v_settled;
end;
$$;
revoke all on function private.settle_private_lesson_credits(uuid, uuid, text)
from public, anon, authenticated;

create or replace function private.guard_private_lesson_reservation()
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
  if tg_op = 'UPDATE' and old.lesson_kind = 'private'
    and current_setting('app.private_lesson_mutation', true) is distinct from '1' then
    raise exception '개인레슨 일정 수정·삭제는 시간표 기능에서 처리해 주세요.';
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
  elsif private.private_lesson_available_count(new.academy_id, new.student_id,
      new.instrument_id, v_date, case when tg_op = 'UPDATE' then new.id else null end) < 1 then
    raise exception '예약 가능한 회차권이 없습니다. 회차권을 등록하거나 외상 일정을 확인해 주세요.';
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
  perform pg_advisory_xact_lock(hashtextextended(
    old.academy_id::text || ':' || old.student_id::text || ':' || v_lesson.instrument_id, 0));
  if private.private_lesson_available_count(old.academy_id, old.student_id,
      v_lesson.instrument_id, (v_lesson.starts_at at time zone 'Asia/Seoul')::date) < 1 then
    raise exception '결석을 취소하면 예약 회차가 초과됩니다. 먼저 일정을 정리하거나 회차권을 등록해 주세요.';
  end if;
  return old;
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
    select lesson_kind = 'private' into v_old_private
    from public.lesson_events
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
    ) then
    raise exception '담당 선생님만 이 수업의 출석을 처리할 수 있습니다.';
  end if;
  if new.status = 'present' and v_lesson.counts_for_ticket
    and not v_lesson.credit_authorized
    and private.private_lesson_available_count(new.academy_id, new.student_id,
      v_lesson.instrument_id, (v_lesson.starts_at at time zone 'Asia/Seoul')::date,
      v_lesson.id) < 1 then
    -- 자신이 차지한 정상 예약은 제외하고 조회한다.
    raise exception '수업 날짜에 사용할 수 있는 회차권이 없습니다.';
  end if;
  return new;
end;
$$;

create or replace function public.mark_private_lesson_attendance(
  p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid,
  p_instrument_id text, p_status text, p_marked_at timestamptz default now(),
  p_reason text default null
) returns void language plpgsql security definer
set search_path = public, private, pg_temp as $$
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
  if v_lesson.credit_authorized and p_status = 'present'
    and exists (select 1 from public.attendance_records attendance
      join public.private_lesson_credits credit
        on credit.academy_id = attendance.academy_id
        and credit.lesson_event_id = attendance.lesson_event_id
      where attendance.academy_id = p_academy_id
        and attendance.lesson_event_id = p_lesson_event_id
        and attendance.status = 'present' and credit.status in ('open', 'settled')) then
    return;
  end if;
  perform set_config('app.private_ticket_attendance', '1', true);
  if p_status = 'absent' or not v_lesson.credit_authorized
    or (private.private_lesson_available_count(p_academy_id, p_student_id,
      p_instrument_id, v_lesson_date) > 0) then
    perform private.mark_private_lesson_attendance_impl(
      p_academy_id, p_lesson_event_id, p_student_id,
      p_instrument_id, p_status, p_marked_at);
    if p_status = 'present' and v_lesson.credit_authorized then
      update public.private_lesson_credits credit
      set status = 'settled', settlement_kind = usage.funding_kind,
        settlement_grant_id = usage.lesson_ticket_grant_id, settled_at = now()
      from public.lesson_ticket_usages usage
      where credit.academy_id = p_academy_id
        and credit.lesson_event_id = p_lesson_event_id
        and credit.status = 'open'
        and usage.academy_id = credit.academy_id
        and usage.lesson_event_id = credit.lesson_event_id;
    end if;
    if p_status = 'absent' then
      update public.private_lesson_credits set status = 'cancelled',
        settlement_kind = null, cancelled_at = now()
      where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
        and status <> 'cancelled';
    end if;
  else
    -- 담당 선생님 권한은 출결 트리거가 확인한다. 외상 출석은 회차를 차감하지 않는다.
    insert into public.attendance_records (
      academy_id, lesson_event_id, student_id, status, marked_at, marked_by
    ) values (
      p_academy_id, p_lesson_event_id, p_student_id, 'present',
      p_marked_at, (select auth.uid())
    ) on conflict (academy_id, lesson_event_id, student_id)
    do update set status = 'present', absence_reason = null,
      marked_at = excluded.marked_at, marked_by = excluded.marked_by;
    insert into public.private_lesson_credits (
      academy_id, lesson_event_id, student_id, instrument_id
    ) values (
      p_academy_id, p_lesson_event_id, p_student_id, p_instrument_id
    ) on conflict (academy_id, lesson_event_id) do update
      set status = 'open', settlement_kind = null, settlement_grant_id = null,
        settled_at = null, funding_refunded = false, cancelled_at = null
      where public.private_lesson_credits.status = 'cancelled';
    insert into public.audit_events (
      academy_id, actor_id, event_type, entity_table, entity_id, metadata
    ) values (
      p_academy_id, (select auth.uid()), 'private_lesson_credit.opened',
      'lesson_events', p_lesson_event_id::text,
      jsonb_build_object('student_id', p_student_id, 'instrument_id', p_instrument_id)
    );
    -- 수업 뒤에 구매한 회차권이 있으면 과거 수업을 즉시 정산한다.
    -- 수업 전에 만료된 회차만 있는 경우에는 새 구매 전까지 미정산으로 둔다.
    if exists (
      select 1 from public.lesson_ticket_registrations registration
      join public.lesson_ticket_grants grant_row
        on grant_row.id = registration.lesson_ticket_grant_id
      where grant_row.academy_id = p_academy_id
        and grant_row.student_id = p_student_id
        and grant_row.instrument_id = p_instrument_id
        and registration.registered_at > v_lesson_date
        and registration.refunded_at is null
    ) then
      perform private.settle_private_lesson_credits(
        p_academy_id, p_student_id, p_instrument_id);
    end if;
  end if;
  if p_status = 'absent' then
    update public.attendance_records set absence_reason = v_reason
    where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id
      and student_id = p_student_id;
  end if;
  perform set_config('app.private_ticket_attendance', '', true);
end;
$$;

alter function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text)
  set schema private;
alter function private.cancel_private_lesson_attendance(uuid, uuid, uuid, text)
  rename to cancel_private_lesson_attendance_impl;
revoke all on function private.cancel_private_lesson_attendance_impl(uuid, uuid, uuid, text)
  from public, anon, authenticated;

create function public.cancel_private_lesson_attendance(
  p_academy_id uuid, p_lesson_event_id uuid, p_student_id uuid, p_instrument_id text
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_credit public.private_lesson_credits%rowtype;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || p_student_id::text || ':' || p_instrument_id, 0));
  select * into v_credit from public.private_lesson_credits
  where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id for update;
  if found and v_credit.funding_refunded then
    raise exception '환불된 회차로 정산한 출석입니다. 원장이 환불·정산 이력을 먼저 정정해야 합니다.';
  end if;
  v_result := private.cancel_private_lesson_attendance_impl(
    p_academy_id, p_lesson_event_id, p_student_id, p_instrument_id);
  if coalesce((v_result->>'cancelled')::boolean, false) then
    update public.private_lesson_credits set status = 'cancelled',
      settlement_kind = null, cancelled_at = now()
    where academy_id = p_academy_id and lesson_event_id = p_lesson_event_id;
  end if;
  if coalesce((v_result->>'restored_ticket')::boolean, false) then
    perform private.settle_private_lesson_credits(
      p_academy_id, p_student_id, p_instrument_id);
  end if;
  return v_result;
end;
$$;
revoke all on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text)
from public, anon;
grant execute on function public.cancel_private_lesson_attendance(uuid, uuid, uuid, text)
to authenticated;

-- 기존 등록 구현은 학원·원생·악기 잠금과 수입 원장 연결을 그대로 사용한다.
-- 이전 앱의 8인자 유료 등록은 유지하되 0원 일반 등록 우회는 닫는다.
create function private.capture_lesson_ticket_registration()
returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
begin
  if current_setting('app.capture_ticket_registration', true) = '1' then
    perform set_config('app.last_ticket_registration_id', new.id::text, true);
  end if;
  return new;
end;
$$;
revoke all on function private.capture_lesson_ticket_registration()
from public, anon, authenticated;
create trigger lesson_ticket_capture_registration
after insert on public.lesson_ticket_registrations
for each row execute function private.capture_lesson_ticket_registration();

alter function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer)
  set schema private;
alter function private.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer)
  rename to register_lesson_ticket_impl;
revoke all on function private.register_lesson_ticket_impl(uuid, uuid, text, text, integer, integer, date, integer)
from public, anon, authenticated;

create function public.register_lesson_ticket(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer, p_is_service boolean
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_result jsonb;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_grant public.lesson_ticket_grants%rowtype;
  v_settled integer;
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
  v_settled := private.settle_private_lesson_credits(
    p_academy_id, p_student_id, p_instrument_id);
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
      'settled_credit_count', v_settled, 'registration_id', v_registration.id)
  );
  return v_result || jsonb_build_object(
    'total_granted_count', v_grant.total_granted_count,
    'remaining_count', v_grant.remaining_count,
    'service_total_count', v_grant.service_total_count,
    'service_remaining_count', v_grant.service_remaining_count,
    'settled_credit_count', v_settled
  );
end;
$$;
revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer, boolean)
from public, anon;
grant execute on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer, boolean)
to authenticated;

create function public.register_lesson_ticket(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
begin
  if coalesce(p_paid_amount, 0) <= 0 then
    raise exception '양수 결제 금액을 입력하거나 서비스로 지급하기를 선택해 주세요.';
  end if;
  return public.register_lesson_ticket(
    p_academy_id, p_student_id, p_instrument_id, p_instrument_name,
    p_granted_count, p_valid_days, p_registered_at, p_paid_amount, false);
end;
$$;
revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer)
from public, anon;
grant execute on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer)
to authenticated;

grant select (service_total_count, service_remaining_count)
on public.lesson_ticket_grants to authenticated;

create function public.revoke_service_lesson_ticket(
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
  if v_grant.remaining_count - p_count < private.private_lesson_reserved_count(
    p_academy_id, v_grant.student_id, v_grant.instrument_id) then
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

create or replace function public.adjust_lesson_ticket(
  p_academy_id uuid, p_ticket_id uuid, p_total_granted_count integer,
  p_remaining_count integer, p_valid_until date, p_reason text
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_paid_registration public.lesson_ticket_registrations%rowtype;
  v_total integer;
  v_remaining integer;
  v_valid_until date;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권을 수정할 권한이 없습니다.';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '수정 사유를 입력해 주세요.';
  end if;
  if p_total_granted_count is null or p_total_granted_count < 1
    or p_remaining_count is null or p_remaining_count < 0
    or p_remaining_count > p_total_granted_count then
    raise exception '유료 부여·잔여 횟수를 확인해 주세요.';
  end if;
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  select * into v_paid_registration from public.lesson_ticket_registrations
  where lesson_ticket_grant_id = p_ticket_id and not is_service
    and refunded_at is null
  order by registered_at desc, created_at desc, id desc limit 1 for update;
  if not found then raise exception '수정할 유료 회차가 없습니다.'; end if;
  if p_valid_until is null or p_valid_until < v_paid_registration.registered_at then
    raise exception '만료일은 마지막 유료 등록일 이후여야 합니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_grant.student_id::text || ':' || v_grant.instrument_id, 0));
  v_total := p_total_granted_count + v_grant.service_total_count;
  v_remaining := p_remaining_count + v_grant.service_remaining_count;
  v_valid_until := greatest(p_valid_until, coalesce((
    select max(valid_until) from public.lesson_ticket_registrations
    where lesson_ticket_grant_id = p_ticket_id and is_service and refunded_at is null
  ), p_valid_until));
  update public.lesson_ticket_grants set total_granted_count = v_total,
    remaining_count = v_remaining, valid_until = v_valid_until
  where id = p_ticket_id;
  update public.lesson_ticket_registrations set valid_until = p_valid_until
  where id = v_paid_registration.id;
  if v_remaining <> v_grant.remaining_count then
    insert into public.lesson_ticket_adjustments (
      academy_id, lesson_ticket_grant_id, student_id, instrument_id,
      previous_remaining_count, delta_count, next_remaining_count,
      adjustment_reason, adjusted_at, adjusted_by
    ) values (
      p_academy_id, p_ticket_id, v_grant.student_id, v_grant.instrument_id,
      v_grant.remaining_count, v_remaining - v_grant.remaining_count,
      v_remaining, btrim(p_reason), now(), (select auth.uid())
    );
  end if;
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.adjusted',
    'lesson_ticket_grants', p_ticket_id::text, btrim(p_reason),
    jsonb_build_object('paid_total_count', p_total_granted_count,
      'paid_remaining_count', p_remaining_count, 'paid_valid_until', p_valid_until)
  );
  return jsonb_build_object('ticket_id', p_ticket_id,
    'total_granted_count', v_total, 'remaining_count', v_remaining,
    'valid_until', v_valid_until);
end;
$$;

create or replace function private.lesson_ticket_refund_context(
  p_academy_id uuid, p_ticket_id uuid,
  out policy text, out total_granted_count integer, out remaining_count integer,
  out student_id uuid, out instrument_id text, out used_count integer,
  out eligible boolean, out refund_amount integer, out can_delete_as_mistake boolean
) language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_paid_total bigint;
  v_quote record;
begin
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id;
  if not found then raise exception '이미 삭제되었거나 찾을 수 없습니다.'; end if;
  policy := private.lesson_ticket_refund_policy(p_academy_id);
  total_granted_count := v_grant.total_granted_count - v_grant.service_total_count;
  remaining_count := v_grant.remaining_count - v_grant.service_remaining_count;
  student_id := v_grant.student_id;
  instrument_id := v_grant.instrument_id;
  select coalesce(sum(original_paid_amount), 0) into v_paid_total
  from public.lesson_ticket_registrations
  where lesson_ticket_grant_id = p_ticket_id and not is_service and refunded_at is null;
  select * into v_quote from private.lesson_ticket_refund_quote(
    policy, total_granted_count, remaining_count, v_paid_total);
  used_count := v_quote.used_count;
  eligible := v_quote.eligible and total_granted_count > 0;
  refund_amount := v_quote.refund_amount;
  can_delete_as_mistake := total_granted_count > 0
    and remaining_count >= total_granted_count
    and not exists (select 1 from public.lesson_ticket_usages usage
      where usage.lesson_ticket_grant_id = p_ticket_id
        and usage.funding_kind = 'paid' and not usage.funding_refunded);
end;
$$;

alter function public.delete_lesson_ticket(uuid, uuid, text) set schema private;
alter function private.delete_lesson_ticket(uuid, uuid, text)
  rename to delete_lesson_ticket_impl;
revoke all on function private.delete_lesson_ticket_impl(uuid, uuid, text)
from public, anon, authenticated;

create function public.delete_lesson_ticket(
  p_academy_id uuid, p_ticket_id uuid, p_mode text
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_grant public.lesson_ticket_grants%rowtype;
  v_context record;
  v_refund integer := 0;
  v_left integer;
  v_reduce integer;
  v_registration record;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '회차권 삭제는 원장과 데스크만 할 수 있습니다.';
  end if;
  if p_mode not in ('refund', 'mistake') then
    raise exception '삭제 방식을 확인해 주세요.';
  end if;
  select * into v_grant from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾지 못했습니다.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_academy_id::text || ':' || v_grant.student_id::text || ':' || v_grant.instrument_id, 0));
  select * into v_context from private.lesson_ticket_refund_context(p_academy_id, p_ticket_id);
  if v_context.total_granted_count < 1 then
    raise exception '유료 회차가 없습니다. 미사용 서비스 회차는 서비스 회수 기능을 사용해 주세요.';
  end if;
  if p_mode = 'mistake' and not v_context.can_delete_as_mistake then
    raise exception '사용한 유료 회차는 잘못 등록으로 삭제할 수 없습니다.';
  end if;
  update public.private_lesson_credits set funding_refunded = true
  where settlement_grant_id = p_ticket_id and settlement_kind = 'paid'
    and status = 'settled';
  if v_grant.service_total_count = 0 then
    -- 순수 유료 회차권은 기존 환불·삭제 구현을 사용한다. 위 정산 스냅샷은
    -- 사용 이력의 cascade와 관계없이 남는다.
    return private.delete_lesson_ticket_impl(p_academy_id, p_ticket_id, p_mode);
  end if;
  update public.lesson_ticket_usages set funding_refunded = true
  where lesson_ticket_grant_id = p_ticket_id and funding_kind = 'paid';
  perform set_config('app.ledger_rpc', 'lesson-ticket', true);
  if p_mode = 'mistake' then
    delete from public.ledger_entries
    where academy_id = p_academy_id and source = 'lesson-ticket'
      and id in (select ledger_entry_id from public.lesson_ticket_registrations
        where lesson_ticket_grant_id = p_ticket_id and not is_service
          and refunded_at is null and ledger_entry_id is not null);
  elsif v_context.refund_amount > 0 then
    v_refund := v_context.refund_amount;
    v_left := v_refund;
    for v_registration in
      select original_paid_amount, ledger_entry_id
      from public.lesson_ticket_registrations
      where lesson_ticket_grant_id = p_ticket_id and not is_service
        and refunded_at is null
      order by registered_at desc, created_at desc, id desc
    loop
      exit when v_left <= 0;
      v_reduce := least(v_registration.original_paid_amount, v_left);
      v_left := v_left - v_reduce;
      if v_registration.ledger_entry_id is not null then
        delete from public.ledger_entries
        where academy_id = p_academy_id and id = v_registration.ledger_entry_id
          and source = 'lesson-ticket' and amount <= v_reduce;
        update public.ledger_entries set amount = amount - v_reduce
        where academy_id = p_academy_id and id = v_registration.ledger_entry_id
          and source = 'lesson-ticket' and amount > v_reduce;
      end if;
    end loop;
  end if;
  perform set_config('app.ledger_rpc', '', true);
  update public.lesson_ticket_registrations set refunded_at = now()
  where lesson_ticket_grant_id = p_ticket_id and not is_service
    and refunded_at is null;
  update public.lesson_ticket_grants set
    total_granted_count = service_total_count,
    remaining_count = service_remaining_count,
    paid_amount = 0, paid_at = null,
    valid_until = (select max(valid_until) from public.lesson_ticket_registrations
      where lesson_ticket_grant_id = p_ticket_id and is_service and refunded_at is null)
  where id = p_ticket_id;
  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'lesson_ticket.paid_refunded',
    'lesson_ticket_grants', p_ticket_id::text,
    jsonb_build_object('mode', p_mode, 'paid_total_count', v_context.total_granted_count,
      'paid_remaining_count', v_context.remaining_count,
      'refund_amount', v_refund, 'service_retained', v_grant.service_total_count)
  );
  return jsonb_build_object('mode', p_mode, 'refunded', v_refund > 0,
    'refund_amount', v_refund);
end;
$$;
revoke all on function public.delete_lesson_ticket(uuid, uuid, text) from public, anon;
grant execute on function public.delete_lesson_ticket(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

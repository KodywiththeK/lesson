-- 회차권 입금 상태(2026-11-14 학원 피드백, 1단계): 등록 / 입금대기 / 입금완료 / 환불 / 취소.
--   등록(registered)      : 접수만 한 상태. 예약·출석에 쓸 수 없다. 수입 기록 없음.
--   입금대기(payment-pending): 사용 가능. 아직 수입 기록 없음.
--   입금완료(paid)        : 사용 가능. 입금일·결제 방식과 함께 수입(ledger) 행이 있다.
--   환불(refunded)·취소(cancelled): 2단계 migration에서 전환 RPC를 만든다.
-- 소진·만료는 저장하지 않고 잔여·만료일로 화면에서 계산한다.
-- 기존 회차권은 결제와 수입 기록이 이미 있으므로 모두 입금완료, 납입일은 등록일로 채운다.
-- 옛 앱의 8·9인자 등록 RPC는 그대로 바로 입금완료+수입 기록으로 동작한다(단계적 전환).
-- 새 앱은 10인자 등록 RPC(납입일 포함)를 쓰고, 유료 회차권은 '등록'으로 시작한다. 서비스(0원)는 바로 입금완료다.

alter table public.lesson_ticket_grants
  add column payment_status text not null default 'paid'
    check (payment_status in ('registered', 'payment-pending', 'paid', 'refunded', 'cancelled')),
  add column due_on date,
  add column payment_method text check (payment_method in ('card', 'cash', 'transfer', 'remote')),
  -- 구매마다 회차권을 나누기 전(20261028) 여러 유료 구매가 한 권에 합쳐진 회차권. 입금 취소를 막는다.
  add column legacy_merged boolean not null default false;

update public.lesson_ticket_grants set due_on = registered_at where due_on is null;
update public.lesson_ticket_grants grant_row set legacy_merged = true
where (select count(*) from public.lesson_ticket_registrations registration
  where registration.academy_id = grant_row.academy_id
    and registration.lesson_ticket_grant_id = grant_row.id
    and not registration.is_service and registration.refunded_at is null) > 1;

alter table public.lesson_ticket_grants
  alter column due_on set not null,
  alter column payment_status set default 'registered';

grant select (payment_status, due_on, payment_method, legacy_merged) on public.lesson_ticket_grants to authenticated;

-- 납입일을 따로 정하지 않고 만드는 경로(옛 함수·seed 등)는 등록일을 납입일로 쓴다.
create or replace function private.default_lesson_ticket_due_on() returns trigger
language plpgsql set search_path = public, private, pg_temp as $$
begin
  new.due_on := coalesce(new.due_on, new.registered_at);
  return new;
end;
$$;
revoke all on function private.default_lesson_ticket_due_on() from public, anon, authenticated;
create trigger lesson_ticket_grants_default_due_on before insert on public.lesson_ticket_grants
  for each row execute function private.default_lesson_ticket_due_on();

-- 사용 가능 회차: 입금대기·입금완료 회차권만 센다. 예약 배정(pick)·출석 차감·가용량 조회가 모두 이 함수를 거친다.
create or replace function private.private_lesson_grant_available_count(
  p_grant_id uuid, p_lesson_date date,
  p_exclude_event_id uuid default null, p_ignore_period boolean default false
) returns integer language sql volatile security definer
set search_path = public, private, pg_temp as $$
  select case when grant_row.payment_status not in ('payment-pending', 'paid') then 0 else greatest(0,
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
    - private.private_lesson_grant_reserved_count(grant_row.id, p_exclude_event_id)) end
  from public.lesson_ticket_grants grant_row where grant_row.id = p_grant_id;
$$;

-- 등록 본문. app.defer_ticket_payment='1'(새 10인자 RPC)이면 유료 회차권을 수입 기록 없이 '등록'으로 만든다.
-- 설정이 없으면(옛 8·9인자 RPC) 이전처럼 결제 금액이 있으면 바로 수입 행을 만들고 입금완료로 둔다.
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
  v_defer boolean := coalesce(current_setting('app.defer_ticket_payment', true), '') = '1';
  v_due_on date := nullif(current_setting('app.ticket_due_on', true), '')::date;
  v_record_income boolean;
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
      and grant_row.payment_status not in ('refunded', 'cancelled')
      and grant_row.registered_at > p_registered_at) then
    raise exception '등록일은 직전 등록일보다 앞설 수 없습니다.';
  end if;
  v_valid_until := p_registered_at + p_valid_days;
  v_record_income := p_paid_amount > 0 and not v_defer;
  insert into public.lesson_ticket_grants (
    academy_id, student_id, instrument_id, instrument_name,
    total_granted_count, remaining_count, valid_from, valid_until,
    registered_at, paid_amount, paid_at, created_by, payment_status, due_on
  ) values (
    p_academy_id, p_student_id, p_instrument_id, v_instrument_name,
    p_granted_count, p_granted_count, p_registered_at, v_valid_until,
    p_registered_at, p_paid_amount,
    case when v_record_income then p_registered_at else null end,
    (select auth.uid()),
    case when v_defer and p_paid_amount > 0 then 'registered' else 'paid' end,
    coalesce(v_due_on, p_registered_at)
  ) returning * into v_ticket;
  if v_record_income then
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
      'valid_days', p_valid_days, 'paid_amount', p_paid_amount,
      'payment_status', v_ticket.payment_status, 'due_on', v_ticket.due_on)
  );
  return jsonb_build_object('ticket_id', v_ticket.id, 'merged', false,
    'total_granted_count', v_ticket.total_granted_count,
    'remaining_count', v_ticket.remaining_count,
    'valid_from', v_ticket.valid_from, 'valid_until', v_ticket.valid_until,
    'payment_status', v_ticket.payment_status, 'due_on', v_ticket.due_on);
end;
$$;

-- 새 앱용 10인자 등록: 납입일을 받고 유료 회차권을 '등록' 상태로 시작한다. 검증·서비스 처리는 9인자 RPC를 재사용한다.
create or replace function public.register_lesson_ticket(
  p_academy_id uuid, p_student_id uuid, p_instrument_id text,
  p_instrument_name text, p_granted_count integer, p_valid_days integer,
  p_registered_at date, p_paid_amount integer, p_is_service boolean,
  p_due_on date
) returns jsonb language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_result jsonb;
begin
  perform set_config('app.defer_ticket_payment', '1', true);
  perform set_config('app.ticket_due_on', coalesce(p_due_on, p_registered_at)::text, true);
  v_result := public.register_lesson_ticket(
    p_academy_id, p_student_id, p_instrument_id, p_instrument_name,
    p_granted_count, p_valid_days, p_registered_at, p_paid_amount, p_is_service);
  perform set_config('app.defer_ticket_payment', '', true);
  perform set_config('app.ticket_due_on', '', true);

  return v_result;
end;
$$;
revoke all on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer, boolean, date)
from public, anon;
grant execute on function public.register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer, boolean, date)
to authenticated;

-- 등록 → 입금대기. 이때부터 예약·출석에 쓸 수 있다.
create or replace function public.start_lesson_ticket_payment_wait(
  p_academy_id uuid, p_ticket_id uuid
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 관리는 원장과 데스크만 할 수 있습니다.';
  end if;
  select * into v_ticket from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_ticket.payment_status <> 'registered' then
    raise exception '등록 상태인 회차권만 입금대기로 바꿀 수 있습니다.';
  end if;
  update public.lesson_ticket_grants set payment_status = 'payment-pending'
  where id = v_ticket.id returning * into v_ticket;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_ticket.payment_waiting', 'lesson_ticket_grants',
    v_ticket.id::text, jsonb_build_object('previous_status', 'registered'));
  return v_ticket;
end;
$$;

-- 입금대기 → 입금완료. 입금일·결제 방식을 받고 수입(ledger) 행을 만들어 등록 이력에 연결한다.
create or replace function public.mark_lesson_ticket_paid(
  p_academy_id uuid, p_ticket_id uuid, p_paid_on date, p_payment_method text
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
  v_student_name text;
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 관리는 원장과 데스크만 할 수 있습니다.';
  end if;
  if p_paid_on is null then raise exception '입금일을 입력해 주세요.'; end if;
  if p_payment_method is null or p_payment_method not in ('card', 'cash', 'transfer', 'remote') then
    raise exception '결제 방식을 선택해 주세요.';
  end if;
  select * into v_ticket from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_ticket.payment_status <> 'payment-pending' then
    raise exception '입금대기 상태인 회차권만 입금 처리할 수 있습니다.';
  end if;
  select * into v_registration from public.lesson_ticket_registrations
  where academy_id = p_academy_id and lesson_ticket_grant_id = v_ticket.id
    and not is_service and refunded_at is null
  order by registered_at desc, created_at desc limit 1 for update;
  if not found or v_registration.original_paid_amount <= 0 then
    raise exception '입금할 결제 금액이 없습니다.';
  end if;
  select name into v_student_name from public.students
  where academy_id = p_academy_id and id = v_ticket.student_id;

  perform set_config('app.ledger_rpc', 'lesson-ticket', true);
  insert into public.ledger_entries (
    academy_id, occurred_on, entry_type, source, category, amount,
    description, ref_table, ref_id, created_by
  ) values (
    p_academy_id, p_paid_on, 'income', 'lesson-ticket', 'lesson-ticket',
    v_registration.original_paid_amount,
    coalesce(v_student_name, '원생') || ' ' || v_ticket.instrument_name ||
      ' 회차권 ' || v_registration.granted_count || '회 구매',
    'lesson_ticket_grants', v_ticket.id::text, (select auth.uid())
  ) returning id into v_ledger_id;
  perform set_config('app.ledger_rpc', '', true);

  update public.lesson_ticket_registrations set ledger_entry_id = v_ledger_id
  where id = v_registration.id;
  update public.lesson_ticket_grants
  set payment_status = 'paid', paid_at = p_paid_on, payment_method = p_payment_method
  where id = v_ticket.id returning * into v_ticket;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_ticket.paid', 'lesson_ticket_grants', v_ticket.id::text,
    jsonb_build_object('paid_on', p_paid_on, 'payment_method', p_payment_method,
      'amount', v_registration.original_paid_amount, 'ledger_entry_id', v_ledger_id));
  return v_ticket;
end;
$$;

-- 입금완료 → 입금대기(잘못 누른 입금 되돌리기). 연결된 수입 행을 지운다. 사용 이력은 그대로 둔다.
create or replace function public.cancel_lesson_ticket_payment(
  p_academy_id uuid, p_ticket_id uuid
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_registration public.lesson_ticket_registrations%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 회차권 관리는 원장과 데스크만 할 수 있습니다.';
  end if;
  select * into v_ticket from public.lesson_ticket_grants
  where academy_id = p_academy_id and id = p_ticket_id for update;
  if not found then raise exception '회차권을 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_ticket.payment_status <> 'paid' then
    raise exception '입금완료 상태인 회차권만 입금을 취소할 수 있습니다.';
  end if;
  if v_ticket.legacy_merged then
    raise exception '여러 구매가 합쳐진 이전 회차권은 입금을 취소할 수 없습니다.';
  end if;
  select * into v_registration from public.lesson_ticket_registrations
  where academy_id = p_academy_id and lesson_ticket_grant_id = v_ticket.id
    and not is_service and refunded_at is null
  order by registered_at desc, created_at desc limit 1 for update;
  if not found then
    raise exception '서비스로 지급한 회차권은 입금을 취소할 수 없습니다.';
  end if;

  update public.lesson_ticket_registrations set ledger_entry_id = null
  where id = v_registration.id;
  if v_registration.ledger_entry_id is not null then
    perform set_config('app.ledger_rpc', 'lesson-ticket', true);
    delete from public.ledger_entries
    where academy_id = p_academy_id and id = v_registration.ledger_entry_id;
    perform set_config('app.ledger_rpc', '', true);
  end if;
  update public.lesson_ticket_grants
  set payment_status = 'payment-pending', paid_at = null, payment_method = null
  where id = v_ticket.id returning * into v_ticket;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
  values (p_academy_id, (select auth.uid()), 'lesson_ticket.payment_cancelled', 'lesson_ticket_grants',
    v_ticket.id::text, jsonb_build_object('ledger_entry_id', v_registration.ledger_entry_id));
  return v_ticket;
end;
$$;

revoke all on function public.start_lesson_ticket_payment_wait(uuid, uuid) from public, anon;
grant execute on function public.start_lesson_ticket_payment_wait(uuid, uuid) to authenticated;
revoke all on function public.mark_lesson_ticket_paid(uuid, uuid, date, text) from public, anon;
grant execute on function public.mark_lesson_ticket_paid(uuid, uuid, date, text) to authenticated;
revoke all on function public.cancel_lesson_ticket_payment(uuid, uuid) from public, anon;
grant execute on function public.cancel_lesson_ticket_payment(uuid, uuid) to authenticated;

-- 선생님이 보는 담당 원생 잔여·만료일: 쓸 수 있는(입금대기·입금완료) 회차권만 센다.
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
    and grant_row.payment_status in ('payment-pending', 'paid')
    and member.user_id = (select auth.uid()) and member.status = 'active'
    and member.role = 'teacher'
  group by grant_row.student_id, grant_row.instrument_id;
end;
$$;

notify pgrst, 'reload schema';

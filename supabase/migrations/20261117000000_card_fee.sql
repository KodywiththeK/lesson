-- 카드 수수료 자동 기록(2026-11-17 학원 피드백).
-- 카드 매출은 며칠 뒤 카드사가 수수료를 떼고 입금해서, 결제액 전액만 수입으로 남기면 입출입내역이 통장과 맞지 않는다.
-- 원장이 카드사별 수수료율을 설정해 두고, 카드로 입금 처리할 때 수입(전액)과 함께 '카드 수수료' 출금을 자동 기록한다.
--   * 수수료 행은 fee_for_entry_id로 수입 행에 붙는다. 수입 행이 지워지면(입금 취소·회차권 취소·환불로 0원) 같이 지워지고,
--     수입 금액이 바뀌면(회차권 부분 환불, 원장의 금액 정정) 같은 비율로 바뀐다. 그래서 기존 취소·환불 RPC는 고치지 않는다.
--   * 활성 카드사가 하나도 없으면 지금처럼 수입만 기록한다. 있으면 카드 입금 때 카드사 선택이 필수다.
--   * 옛 4인자 입금 RPC는 배포 전환 기간의 옛 앱을 위해 그대로 둔다(수수료 없이 기록).

create table public.card_fee_rates (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  rate_percent numeric(4,2) not null check (rate_percent >= 0 and rate_percent <= 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, id)
);
create unique index card_fee_rates_active_name_idx on public.card_fee_rates (academy_id, lower(btrim(name))) where active;
alter table public.card_fee_rates enable row level security;
revoke all on public.card_fee_rates from public, anon, authenticated;
grant select on public.card_fee_rates to authenticated;
-- 데스크도 회차권 입금 때 카드사를 고르므로 읽을 수 있다. 관리는 원장만 한다.
create policy card_fee_rates_owner_desk_read on public.card_fee_rates for select to authenticated
  using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create function public.save_card_fee_rate(p_academy_id uuid, p_id uuid, p_name text, p_rate_percent numeric)
returns public.card_fee_rates language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_result public.card_fee_rates%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '카드 수수료 설정은 원장만 관리할 수 있습니다.';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null or char_length(btrim(p_name)) > 30 then
    raise exception '카드사 이름을 1~30자로 입력해 주세요.';
  end if;
  if p_rate_percent is null or p_rate_percent < 0 or p_rate_percent > 10 or p_rate_percent <> round(p_rate_percent, 2) then
    raise exception '수수료율은 0~10%%, 소수점 둘째 자리까지 입력해 주세요.';
  end if;
  if exists (select 1 from public.card_fee_rates
    where academy_id = p_academy_id and active and lower(btrim(name)) = lower(btrim(p_name))
      and id is distinct from p_id) then
    raise exception '같은 이름의 카드사가 이미 있습니다.';
  end if;
  begin
    if p_id is null then
      insert into public.card_fee_rates (academy_id, name, rate_percent)
        values (p_academy_id, btrim(p_name), p_rate_percent) returning * into v_result;
    else
      update public.card_fee_rates set name = btrim(p_name), rate_percent = p_rate_percent, updated_at = now()
        where academy_id = p_academy_id and id = p_id and active returning * into v_result;
      if not found then raise exception '수정할 카드사를 찾지 못했습니다.'; end if;
    end if;
  exception when unique_violation then
    -- 동시에 같은 이름을 저장한 경우. 위 사전 검사와 같은 안내를 준다.
    raise exception '같은 이름의 카드사가 이미 있습니다.';
  end;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, metadata)
    values (p_academy_id, (select auth.uid()), 'card_fee_rate.saved', 'card_fee_rates', v_result.id::text,
      jsonb_build_object('name', v_result.name, 'rate_percent', v_result.rate_percent));
  return v_result;
end;
$$;
revoke all on function public.save_card_fee_rate(uuid, uuid, text, numeric) from public, anon;
grant execute on function public.save_card_fee_rate(uuid, uuid, text, numeric) to authenticated;

-- 보관: 이미 기록한 수수료 행은 그대로 두고 새 입금에서만 고르지 못하게 한다.
create function public.archive_card_fee_rate(p_academy_id uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '카드 수수료 설정은 원장만 관리할 수 있습니다.';
  end if;
  update public.card_fee_rates set active = false, updated_at = now()
    where academy_id = p_academy_id and id = p_id and active;
  if not found then raise exception '삭제할 카드사를 찾지 못했습니다.'; end if;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id)
    values (p_academy_id, (select auth.uid()), 'card_fee_rate.archived', 'card_fee_rates', p_id::text);
end;
$$;
revoke all on function public.archive_card_fee_rate(uuid, uuid) from public, anon;
grant execute on function public.archive_card_fee_rate(uuid, uuid) to authenticated;

-- 입출입내역: 카드 수수료 분류와 수입 행 연결.
alter table public.ledger_entries drop constraint ledger_entries_category_check;
alter table public.ledger_entries add constraint ledger_entries_category_check check (
  category in (
    'tuition', 'lesson-ticket', 'book-sale', 'payroll', 'book-order', 'rent',
    'utilities', 'tuning-repair', 'supplies', 'tax', 'card-fee', 'other'
  )
);
alter table public.ledger_entries
  add column fee_for_entry_id uuid,
  -- 같은 학원의 수입 행에만 붙는다. 수입 행이 지워지면 수수료 행도 지운다.
  add constraint ledger_entries_fee_for_entry_fk foreign key (academy_id, fee_for_entry_id)
    references public.ledger_entries(academy_id, id) on delete cascade;
create index ledger_entries_fee_for_entry_idx on public.ledger_entries (fee_for_entry_id) where fee_for_entry_id is not null;

-- 수입 금액이 바뀌면 붙은 수수료도 같은 비율로 맞춘다. 0원이 되면 지운다.
-- 수수료 행은 출금이라 이 트리거를 다시 부르지 않는다.
create function private.scale_card_fee_with_income() returns trigger
language plpgsql set search_path = public, private, pg_temp as $$
begin
  delete from public.ledger_entries fee
  where fee.academy_id = new.academy_id and fee.fee_for_entry_id = new.id
    and round(fee.amount::numeric * new.amount / old.amount) = 0;
  update public.ledger_entries fee
  set amount = round(fee.amount::numeric * new.amount / old.amount)::integer
  where fee.academy_id = new.academy_id and fee.fee_for_entry_id = new.id;
  return new;
end;
$$;
revoke all on function private.scale_card_fee_with_income() from public, anon, authenticated;
create trigger ledger_entries_scale_card_fee
  after update of amount on public.ledger_entries
  for each row when (old.amount <> new.amount and new.entry_type = 'income')
  execute function private.scale_card_fee_with_income();

-- 수입 행에 카드 수수료 출금을 붙인다. 카드가 아니면 아무것도 하지 않는다(카드사를 넘기면 거부).
-- 금액을 직접 주지 않으면 수입 금액 × 수수료율을 원 단위로 반올림한다. 0원이면 행을 만들지 않는다.
create function private.record_card_fee(
  p_academy_id uuid, p_income_entry_id uuid, p_payment_method text, p_rate_id uuid, p_fee_amount integer
) returns uuid language plpgsql set search_path = public, private, pg_temp as $$
declare
  v_rate public.card_fee_rates%rowtype;
  v_income public.ledger_entries%rowtype;
  v_fee integer;
  v_id uuid;
begin
  if p_payment_method <> 'card' then
    if p_rate_id is not null or p_fee_amount is not null then
      raise exception '카드 결제에만 카드 수수료를 기록할 수 있습니다.';
    end if;
    return null;
  end if;
  if p_rate_id is null then
    if p_fee_amount is not null or exists (select 1 from public.card_fee_rates
      where academy_id = p_academy_id and active) then
      raise exception '카드사를 선택해 주세요.';
    end if;
    return null;
  end if;
  select * into v_rate from public.card_fee_rates where academy_id = p_academy_id and id = p_rate_id and active;
  if not found then raise exception '카드사를 찾을 수 없습니다. 카드 수수료 설정을 확인해 주세요.'; end if;
  select * into v_income from public.ledger_entries
  where academy_id = p_academy_id and id = p_income_entry_id and entry_type = 'income';
  if not found then raise exception '카드 수수료를 붙일 수입 기록을 찾지 못했습니다.'; end if;
  if p_fee_amount is not null and (p_fee_amount < 0 or p_fee_amount > v_income.amount) then
    raise exception '카드 수수료는 0원부터 결제 금액까지 입력할 수 있습니다.';
  end if;
  v_fee := coalesce(p_fee_amount, round(v_income.amount::numeric * v_rate.rate_percent / 100)::integer);
  if v_fee = 0 then return null; end if;
  insert into public.ledger_entries (
    academy_id, occurred_on, entry_type, source, category, amount,
    description, ref_table, ref_id, created_by, fee_for_entry_id
  ) values (
    p_academy_id, v_income.occurred_on, 'expense', v_income.source, 'card-fee', v_fee,
    '카드 수수료(' || v_rate.name || ' ' || trim_scale(v_rate.rate_percent) || '%): ' || v_income.description,
    v_income.ref_table, v_income.ref_id, (select auth.uid()), v_income.id
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.record_card_fee(uuid, uuid, text, uuid, integer) from public, anon, authenticated;

-- 수강료 입금 + 카드 수수료. 권한·잠금·검증은 기존 4인자 RPC가 한다.
create function public.mark_fixed_income_snapshot_paid(
  p_academy_id uuid, p_snapshot_id uuid, p_paid_at date, p_payment_method text,
  p_card_fee_rate_id uuid, p_card_fee_amount integer
) returns public.fixed_income_snapshots language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_snapshot public.fixed_income_snapshots%rowtype;
begin
  v_snapshot := public.mark_fixed_income_snapshot_paid(p_academy_id, p_snapshot_id, p_paid_at, p_payment_method);
  perform private.record_card_fee(
    p_academy_id, v_snapshot.paid_ledger_entry_id, p_payment_method, p_card_fee_rate_id, p_card_fee_amount);
  return v_snapshot;
end;
$$;
revoke all on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text, uuid, integer) from public, anon;
grant execute on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date, text, uuid, integer) to authenticated;

-- 회차권 입금 + 카드 수수료. 데스크도 쓰므로 회차권 원장 가드 설정을 켜고 수입과 같은 source로 기록한다.
create function public.mark_lesson_ticket_paid(
  p_academy_id uuid, p_ticket_id uuid, p_paid_on date, p_payment_method text,
  p_card_fee_rate_id uuid, p_card_fee_amount integer
) returns public.lesson_ticket_grants language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare
  v_ticket public.lesson_ticket_grants%rowtype;
  v_income_id uuid;
begin
  v_ticket := public.mark_lesson_ticket_paid(p_academy_id, p_ticket_id, p_paid_on, p_payment_method);
  select ledger_entry_id into v_income_id from public.lesson_ticket_registrations
  where academy_id = p_academy_id and lesson_ticket_grant_id = v_ticket.id
    and not is_service and refunded_at is null and ledger_entry_id is not null
  order by registered_at desc, created_at desc limit 1;
  perform set_config('app.ledger_rpc', 'lesson-ticket', true);
  perform private.record_card_fee(p_academy_id, v_income_id, p_payment_method, p_card_fee_rate_id, p_card_fee_amount);
  perform set_config('app.ledger_rpc', '', true);
  return v_ticket;
end;
$$;
revoke all on function public.mark_lesson_ticket_paid(uuid, uuid, date, text, uuid, integer) from public, anon;
grant execute on function public.mark_lesson_ticket_paid(uuid, uuid, date, text, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

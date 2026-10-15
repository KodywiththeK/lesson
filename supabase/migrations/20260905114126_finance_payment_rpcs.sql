alter table public.salary_settlements
  add column if not exists paid_ledger_entry_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'salary_settlements_paid_ledger_fk'
  ) then
    alter table public.salary_settlements
      add constraint salary_settlements_paid_ledger_fk
      foreign key (academy_id, paid_ledger_entry_id)
      references public.ledger_entries (academy_id, id)
      on delete set null (paid_ledger_entry_id);
  end if;
end;
$$;

create or replace function public.mark_fixed_income_snapshot_paid(
  p_academy_id uuid,
  p_snapshot_id uuid,
  p_paid_at date
)
returns public.fixed_income_snapshots
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_snapshot public.fixed_income_snapshots%rowtype;
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '수강료 수납 권한이 없습니다.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '수납 처리할 수강료 항목을 찾지 못했습니다.';
  end if;

  if v_snapshot.status = 'paid' then
    raise exception '이미 수납 완료된 수강료입니다.';
  end if;

  insert into public.ledger_entries (
    academy_id,
    occurred_on,
    entry_type,
    source,
    category,
    amount,
    description,
    ref_table,
    ref_id,
    created_by
  )
  values (
    p_academy_id,
    p_paid_at,
    'income',
    'tuition',
    'tuition',
    v_snapshot.amount,
    '수강료 수납: ' || v_snapshot.month || ' ' || v_snapshot.student_name || ' ' || v_snapshot.instrument_name,
    'fixed_income_snapshots',
    v_snapshot.id::text,
    (select auth.uid())
  )
  returning id into v_ledger_id;

  update public.fixed_income_snapshots
  set
    status = 'paid',
    paid_at = p_paid_at,
    paid_ledger_entry_id = v_ledger_id,
    updated_at = now()
  where academy_id = p_academy_id
    and id = p_snapshot_id
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.mark_fixed_income_snapshot_unpaid(
  p_academy_id uuid,
  p_snapshot_id uuid
)
returns public.fixed_income_snapshots
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_snapshot public.fixed_income_snapshots%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '수강료 미수납 처리 권한이 없습니다.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '미수납 처리할 수강료 항목을 찾지 못했습니다.';
  end if;

  if v_snapshot.paid_ledger_entry_id is not null then
    delete from public.ledger_entries
    where academy_id = p_academy_id
      and id = v_snapshot.paid_ledger_entry_id;
  end if;

  update public.fixed_income_snapshots
  set
    status = 'unpaid',
    paid_at = null,
    paid_ledger_entry_id = null,
    updated_at = now()
  where academy_id = p_academy_id
    and id = p_snapshot_id
  returning * into v_snapshot;

  return v_snapshot;
end;
$$;

create or replace function public.mark_salary_settlement_paid(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_teacher_name text,
  p_month text,
  p_pay_type text,
  p_base_pay integer,
  p_withholding_tax integer,
  p_net_pay integer,
  p_lesson_event_ids uuid[],
  p_paid_at date
)
returns public.salary_settlements
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_existing public.salary_settlements%rowtype;
  v_settlement public.salary_settlements%rowtype;
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_pay_type not in ('ratio', 'monthly', 'hourly') then
    raise exception '지원하지 않는 급여 유형입니다.';
  end if;

  if p_base_pay < 0 or p_withholding_tax < 0 or p_net_pay < 0 then
    raise exception '급여 금액은 0 이상이어야 합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '급여 지급 확정 권한이 없습니다.';
  end if;

  select *
  into v_existing
  from public.salary_settlements
  where academy_id = p_academy_id
    and teacher_id = p_teacher_id
    and month = p_month
    and pay_type = p_pay_type
  for update;

  if found and v_existing.status = 'paid' then
    raise exception '이미 지급 완료된 급여입니다.';
  end if;

  insert into public.ledger_entries (
    academy_id,
    occurred_on,
    entry_type,
    source,
    category,
    amount,
    description,
    ref_table,
    ref_id,
    created_by
  )
  values (
    p_academy_id,
    p_paid_at,
    'expense',
    'payroll',
    'payroll',
    p_net_pay,
    '급여 지급: ' || p_month || ' ' || p_teacher_name,
    'salary_settlements',
    p_month || ':' || p_teacher_id::text || ':' || p_pay_type,
    (select auth.uid())
  )
  returning id into v_ledger_id;

  insert into public.salary_settlements (
    academy_id,
    teacher_id,
    teacher_name,
    month,
    pay_type,
    base_pay,
    withholding_tax,
    net_pay,
    status,
    paid_at,
    paid_ledger_entry_id,
    lesson_event_ids
  )
  values (
    p_academy_id,
    p_teacher_id,
    p_teacher_name,
    p_month,
    p_pay_type,
    p_base_pay,
    p_withholding_tax,
    p_net_pay,
    'paid',
    p_paid_at,
    v_ledger_id,
    coalesce(p_lesson_event_ids, '{}'::uuid[])
  )
  on conflict (academy_id, teacher_id, month, pay_type)
  do update set
    teacher_name = excluded.teacher_name,
    base_pay = excluded.base_pay,
    withholding_tax = excluded.withholding_tax,
    net_pay = excluded.net_pay,
    status = 'paid',
    paid_at = excluded.paid_at,
    paid_ledger_entry_id = excluded.paid_ledger_entry_id,
    lesson_event_ids = excluded.lesson_event_ids,
    updated_at = now()
  returning * into v_settlement;

  update public.ledger_entries
  set ref_id = v_settlement.id::text
  where academy_id = p_academy_id
    and id = v_ledger_id;

  return v_settlement;
end;
$$;

revoke all on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date) from public;
revoke all on function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) from public;
revoke all on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from public;

grant execute on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date) to authenticated;
grant execute on function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) to authenticated;
grant execute on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) to authenticated;

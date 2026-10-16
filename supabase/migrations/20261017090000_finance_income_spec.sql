-- 학원 수입 관리 명세 반영 (2026-10-17)
-- 수강료 입금 상태 3상태(미입금/입금/미납), 급여 지급 잠금·취소, 교재 결제 완료 전환.
-- 모든 변경은 원장(owner) 전용이다. 2026-10-16 운영 DB에 적용했다(적용 기록: docs/engineering/supabase-migration-runbook.md).
-- 적용된 migration은 수정하지 않고 변경은 새 migration으로만 한다.

-- 수강료 상태에 미납(overdue)을 추가한다. 기존 인라인 check는 이름이 다를 수 있어 내용으로 찾아 지운다.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.fixed_income_snapshots'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%unpaid%'
  loop
    execute format('alter table public.fixed_income_snapshots drop constraint %I', v_constraint.conname);
  end loop;
end
$$;

alter table public.fixed_income_snapshots
  add constraint fixed_income_snapshots_status_check
  check (status in ('unpaid', 'paid', 'overdue'));

-- 미납 처리: 아직 입금하지 않은 원생을 미납 인원에 기록한다. 입금 완료 건은 먼저 입금 취소해야 한다.
create or replace function public.mark_fixed_income_snapshot_overdue(
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
    array['owner'::public.academy_member_role]
  ) then
    raise exception '수강료 미납 처리 권한이 없습니다.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '미납 처리할 수강료 항목을 찾지 못했습니다.';
  end if;

  if v_snapshot.status = 'paid' then
    raise exception '이미 입금된 수강료는 미납으로 바꿀 수 없습니다. 먼저 입금 취소를 해 주세요.';
  end if;

  if v_snapshot.status = 'overdue' then
    raise exception '이미 미납으로 기록된 수강료입니다. 화면을 새로 고쳐 주세요.';
  end if;

  update public.fixed_income_snapshots
  set
    status = 'overdue',
    updated_at = now()
  where academy_id = p_academy_id
    and id = p_snapshot_id
  returning * into v_snapshot;

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
    'tuition.overdue',
    'fixed_income_snapshots',
    v_snapshot.id::text,
    null,
    jsonb_build_object('month', v_snapshot.month, 'student_id', v_snapshot.student_id)
  );

  return v_snapshot;
end;
$$;

-- 입금 처리: 미입금·미납에서만 가능하다. 입출입내역(수입)을 같은 트랜잭션에서 등록한다.
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
    array['owner'::public.academy_member_role]
  ) then
    raise exception '수강료 입금 처리 권한이 없습니다.';
  end if;

  if p_paid_at is null then
    raise exception '입금일을 입력해 주세요.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '입금 처리할 수강료 항목을 찾지 못했습니다.';
  end if;

  if v_snapshot.status = 'paid' then
    raise exception '이미 입금 완료된 수강료입니다.';
  end if;

  if v_snapshot.amount <= 0 then
    raise exception '결제 금액이 0원인 수강료는 입금 처리할 수 없습니다.';
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

-- 입금 취소·미납 해제: 입금 완료 건은 연결된 원장 행을 삭제하고 미입금으로 돌린다. 미납 건은 미입금으로 돌린다.
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
    array['owner'::public.academy_member_role]
  ) then
    raise exception '수강료 입금 취소 권한이 없습니다.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '입금 취소할 수강료 항목을 찾지 못했습니다.';
  end if;

  -- 다른 화면에서 이미 상태가 바뀐 항목을 오래된 화면이 취소하지 못하게 상태를 다시 확인한다.
  if v_snapshot.status <> 'paid' then
    raise exception '입금 완료된 수강료만 입금 취소할 수 있습니다. 화면을 새로 고쳐 주세요.';
  end if;

  -- 원장 연결 id가 비어 있는 이전 입금 건도 ref(fixed_income_snapshots, 항목 id)로 찾아 함께 지운다.
  delete from public.ledger_entries
  where academy_id = p_academy_id
    and (
      id = v_snapshot.paid_ledger_entry_id
      or (
        v_snapshot.paid_ledger_entry_id is null
        and ref_table = 'fixed_income_snapshots'
        and ref_id = v_snapshot.id::text
      )
    );

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

-- 미납 해제: 미납으로 기록한 항목을 미입금으로 되돌린다. 원장은 건드리지 않으며 미납 상태일 때만 받는다.
create or replace function public.clear_fixed_income_snapshot_overdue(
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
    array['owner'::public.academy_member_role]
  ) then
    raise exception '수강료 미납 해제 권한이 없습니다.';
  end if;

  select *
  into v_snapshot
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and id = p_snapshot_id
  for update;

  if not found then
    raise exception '미납 해제할 수강료 항목을 찾지 못했습니다.';
  end if;

  if v_snapshot.status <> 'overdue' then
    raise exception '미납 상태인 수강료만 미납 해제할 수 있습니다. 화면을 새로 고쳐 주세요.';
  end if;

  update public.fixed_income_snapshots
  set
    status = 'unpaid',
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
  v_settlement public.salary_settlements%rowtype;
  v_setting public.teacher_salary_settings%rowtype;
  v_teacher_name text;
  v_ledger_id uuid;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_expected_ids uuid[];
  v_provided_ids uuid[];
  v_worked_minutes integer;
  v_expected_base integer;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '급여 지급 확정 권한이 없습니다.';
  end if;

  if p_teacher_id is null
    or p_month is null
    or p_pay_type is null
    or p_base_pay is null
    or p_withholding_tax is null
    or p_net_pay is null
    or p_paid_at is null then
    raise exception '급여 지급 정보를 모두 입력해 주세요.';
  end if;

  if p_pay_type not in ('ratio', 'monthly', 'hourly') then
    raise exception '지원하지 않는 급여 유형입니다.';
  end if;

  if p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_month < '2000-01' then
    raise exception '급여 월 형식을 확인해 주세요.';
  end if;

  if p_month > to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM') then
    raise exception '아직 시작하지 않은 달의 급여는 지급 확정할 수 없습니다.';
  end if;

  if p_base_pay < 0 or p_withholding_tax < 0 or p_net_pay < 0 then
    raise exception '급여 금액은 0 이상이어야 합니다.';
  end if;

  if p_net_pay <> p_base_pay - p_withholding_tax then
    raise exception '급여 금액 계산이 맞지 않습니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
  end if;

  -- 세금은 화면의 급여 정책(PAYROLL_POLICY: 3.3% 내림)과 같은 값만 받는다. 정책을 바꾸면 화면과 함께 고친다.
  if p_withholding_tax <> floor(p_base_pay::numeric * 33 / 1000)::integer then
    raise exception '원천징수액이 계산과 다릅니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
  end if;

  if p_net_pay <= 0 then
    raise exception '지급할 금액이 0원이어서 지급 확정할 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_academy_id::text || ':' || p_teacher_id::text || ':' || p_month, 0)
  );

  select name
  into v_teacher_name
  from public.teachers
  where academy_id = p_academy_id
    and id = p_teacher_id;

  if not found then
    raise exception '지급할 선생님을 찾지 못했습니다.';
  end if;

  if exists (
    select 1
    from public.salary_settlements
    where academy_id = p_academy_id
      and teacher_id = p_teacher_id
      and month = p_month
      and status = 'paid'
  ) then
    raise exception '이미 지급 완료된 급여입니다.';
  end if;

  select *
  into v_setting
  from public.teacher_salary_settings
  where academy_id = p_academy_id
    and teacher_id = p_teacher_id
    and pay_type = p_pay_type
    and active;

  if not found then
    raise exception '급여 설정을 확인해 주세요. 선생님의 급여 형태 설정이 없습니다.';
  end if;

  -- 그 선생님이 그 달(한국 시간)에 실제로 등원 확인된 수업 전체와 화면이 보낸 목록이 같아야 한다.
  -- 오래된 화면이나 일부만 읽은 데이터로 계산한 금액이 확정되는 것을 막는다.
  v_month_start := (p_month || '-01')::date::timestamp at time zone 'Asia/Seoul';
  v_month_end := ((p_month || '-01')::date + interval '1 month') at time zone 'Asia/Seoul';

  select
    coalesce(array_agg(event.id order by event.id), '{}'::uuid[]),
    coalesce(sum(round(extract(epoch from (event.ends_at - event.starts_at)) / 60))::integer, 0)
  into v_expected_ids, v_worked_minutes
  from public.lesson_events event
  where event.academy_id = p_academy_id
    and event.teacher_id = p_teacher_id
    and event.status = 'scheduled'
    and event.starts_at >= v_month_start
    and event.starts_at < v_month_end
    and exists (
      select 1
      from public.attendance_records attendance
      where attendance.academy_id = p_academy_id
        and attendance.lesson_event_id = event.id
        and attendance.status = 'present'
    );

  select coalesce(array_agg(distinct provided.id order by provided.id), '{}'::uuid[])
  into v_provided_ids
  from unnest(coalesce(p_lesson_event_ids, '{}'::uuid[])) as provided(id);

  if p_pay_type = 'monthly' then
    if v_setting.monthly_salary is null or p_base_pay <> v_setting.monthly_salary then
      raise exception '월급이 설정 금액과 다릅니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
    end if;
  else
    if v_provided_ids <> v_expected_ids then
      raise exception '등원 기록이 바뀌어 급여 금액을 확정할 수 없습니다. 화면을 새로 고쳐 최신 금액을 확인해 주세요.';
    end if;

    if p_pay_type = 'hourly' then
      if v_setting.hourly_rate is null then
        raise exception '급여 설정을 확인해 주세요. 시급이 비어 있습니다.';
      end if;

      v_expected_base := floor(v_setting.hourly_rate::numeric * v_worked_minutes / 60)::integer;

      if p_base_pay <> v_expected_base then
        raise exception '시급 급여가 등원 시간 계산과 다릅니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
      end if;
    elsif v_setting.ratio_teacher_share is null then
      raise exception '급여 설정을 확인해 주세요. 선생님 비율이 비어 있습니다.';
    elsif cardinality(v_expected_ids) = 0 then
      -- 비율제 금액은 SQL에서 다시 계산하지 않으므로(수강료 배분은 화면 계산), 최소한 등원 기록이 있어야만 받는다.
      raise exception '등원 기록이 없어 비율제 급여를 확정할 수 없습니다.';
    end if;
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
    '급여 지급: ' || p_month || ' ' || v_teacher_name,
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
    v_teacher_name,
    p_month,
    p_pay_type,
    p_base_pay,
    p_withholding_tax,
    p_net_pay,
    'paid',
    p_paid_at,
    v_ledger_id,
    case when p_pay_type = 'monthly' then '{}'::uuid[] else v_provided_ids end
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

create or replace function public.cancel_salary_settlement_paid(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_month text
)
returns public.salary_settlements
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_settlement public.salary_settlements%rowtype;
  v_last public.salary_settlements%rowtype;
  v_cancelled integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '급여 지급 취소 권한이 없습니다.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_academy_id::text || ':' || p_teacher_id::text || ':' || p_month, 0)
  );

  -- 같은 (선생님, 월)에 지급 완료가 여러 건(급여 형태가 달랐던 레거시 데이터)이어도 모두 되돌린다.
  for v_settlement in
    select *
    from public.salary_settlements
    where academy_id = p_academy_id
      and teacher_id = p_teacher_id
      and month = p_month
      and status = 'paid'
    order by created_at, id
    for update
  loop
    -- 원장 연결 id가 비어 있는 이전 지급 건도 ref(salary_settlements, 정산 id)로 찾아 함께 지운다.
    delete from public.ledger_entries
    where academy_id = p_academy_id
      and (
        id = v_settlement.paid_ledger_entry_id
        or (
          v_settlement.paid_ledger_entry_id is null
          and ref_table = 'salary_settlements'
          and ref_id = v_settlement.id::text
        )
      );

    update public.salary_settlements
    set
      status = 'pending',
      paid_at = null,
      paid_ledger_entry_id = null,
      updated_at = now()
    where id = v_settlement.id
    returning * into v_last;

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
      'salary.payment_cancelled',
      'salary_settlements',
      v_last.id::text,
      null,
      jsonb_build_object('teacher_id', p_teacher_id, 'month', p_month, 'net_pay', v_last.net_pay)
    );

    v_cancelled := v_cancelled + 1;
  end loop;

  if v_cancelled = 0 then
    raise exception '지급 완료된 급여를 찾지 못했습니다.';
  end if;

  return v_last;
end;
$$;

-- 교재 출고에도 결제 완료 원장 행의 id를 저장해 원장 행이 지워졌을 때 알아볼 수 있게 한다(수강료·급여와 같은 방식).
alter table public.book_releases
  add column if not exists paid_ledger_entry_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'book_releases_paid_ledger_fk'
  ) then
    alter table public.book_releases
      add constraint book_releases_paid_ledger_fk
      foreign key (academy_id, paid_ledger_entry_id)
      references public.ledger_entries (academy_id, id)
      on delete set null (paid_ledger_entry_id);
  end if;
end;
$$;

-- 이미 결제 완료된 출고는 원장의 ref(book_releases, 출고 id)로 연결을 채운다.
update public.book_releases release
set paid_ledger_entry_id = ledger.id
from public.ledger_entries ledger
where release.status = 'paid'
  and release.paid_ledger_entry_id is null
  and ledger.academy_id = release.academy_id
  and ledger.ref_table = 'book_releases'
  and ledger.ref_id = release.id::text;

-- 출고 등록 때 결제 완료로 고르면 원장 행 id를 같이 저장한다(기존 함수와 같은 시그니처).
create or replace function public.register_book_release(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_book_title text,
  p_price integer,
  p_shipped_at date,
  p_status text
)
returns public.book_releases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_book_id uuid;
  created_release public.book_releases;
  created_ledger_id uuid;
begin
  if nullif(btrim(p_student_name), '') is null
    or nullif(btrim(p_book_title), '') is null
    or p_price is null or p_price <= 0
    or p_shipped_at is null
    or p_status not in ('payment-pending', 'paid') then
    raise exception '교재 출고 입력값을 확인해주세요.';
  end if;

  insert into public.books (academy_id, title, price)
  values (p_academy_id, btrim(p_book_title), p_price)
  returning id into created_book_id;

  insert into public.book_releases (
    academy_id, book_id, student_id, student_name, book_title,
    price, shipped_at, status, paid_at, created_by
  ) values (
    p_academy_id, created_book_id, p_student_id, btrim(p_student_name),
    btrim(p_book_title), p_price, p_shipped_at, p_status,
    case when p_status = 'paid' then p_shipped_at else null end, auth.uid()
  ) returning * into created_release;

  if p_status = 'paid' then
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    ) values (
      p_academy_id, p_shipped_at, 'income', 'book-sale', 'book-sale', p_price,
      '교재 판매: ' || btrim(p_book_title) || ' / ' || btrim(p_student_name),
      'book_releases', created_release.id::text, auth.uid()
    ) returning id into created_ledger_id;

    update public.book_releases
    set paid_ledger_entry_id = created_ledger_id
    where academy_id = p_academy_id
      and id = created_release.id
    returning * into created_release;
  end if;

  return created_release;
end;
$$;

create or replace function public.complete_book_release_payment(
  p_academy_id uuid,
  p_release_id uuid,
  p_paid_at date
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_release public.book_releases%rowtype;
  v_ledger_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '교재 결제 완료 처리 권한이 없습니다.';
  end if;

  if p_paid_at is null then
    raise exception '입금일을 입력해 주세요.';
  end if;

  select *
  into v_release
  from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id
  for update;

  if not found then
    raise exception '결제 완료 처리할 교재 출고를 찾지 못했습니다.';
  end if;

  if v_release.status = 'paid' then
    raise exception '이미 결제 완료된 교재입니다.';
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
    'book-sale',
    'book-sale',
    v_release.price,
    '교재 판매: ' || v_release.book_title || ' / ' || v_release.student_name,
    'book_releases',
    v_release.id::text,
    (select auth.uid())
  )
  returning id into v_ledger_id;

  update public.book_releases
  set
    status = 'paid',
    paid_at = p_paid_at,
    paid_ledger_entry_id = v_ledger_id
  where academy_id = p_academy_id
    and id = p_release_id
  returning * into v_release;

  return v_release;
end;
$$;

revoke all on function public.mark_fixed_income_snapshot_overdue(uuid, uuid) from public;
revoke all on function public.mark_fixed_income_snapshot_overdue(uuid, uuid) from anon;
grant execute on function public.mark_fixed_income_snapshot_overdue(uuid, uuid) to authenticated;

revoke all on function public.cancel_salary_settlement_paid(uuid, uuid, text) from public;
revoke all on function public.cancel_salary_settlement_paid(uuid, uuid, text) from anon;
grant execute on function public.cancel_salary_settlement_paid(uuid, uuid, text) to authenticated;

revoke all on function public.complete_book_release_payment(uuid, uuid, date) from public;
revoke all on function public.complete_book_release_payment(uuid, uuid, date) from anon;
grant execute on function public.complete_book_release_payment(uuid, uuid, date) to authenticated;

revoke all on function public.clear_fixed_income_snapshot_overdue(uuid, uuid) from public;
revoke all on function public.clear_fixed_income_snapshot_overdue(uuid, uuid) from anon;
grant execute on function public.clear_fixed_income_snapshot_overdue(uuid, uuid) to authenticated;

-- 기존 함수를 재정의했으므로 기존 ACL(public만 회수)에 남아 있을 수 있는 anon 직접 실행 권한도 회수한다.
revoke all on function public.mark_fixed_income_snapshot_paid(uuid, uuid, date) from anon;
revoke all on function public.mark_fixed_income_snapshot_unpaid(uuid, uuid) from anon;
revoke all on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from anon;
revoke all on function public.register_book_release(uuid, uuid, text, text, integer, date, text) from anon;

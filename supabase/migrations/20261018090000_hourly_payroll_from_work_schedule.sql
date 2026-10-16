-- 시급제 급여를 "시급 × 선생님 출근 요일·시간(teacher_work_schedules)의 그 달 합계"로 서버에서 다시 계산한다.
--
-- 제품 결정(2026-10-16): 시급제 급여 = 시급 × 출근 요일·시간을 해당 월(한국 달력)에 펼친 근무 시간.
--   - 계약 시작일~종료일(양 끝 포함) 밖 날짜는 제외한다.
--   - 근무 시간은 정수 분 합계, 금액은 floor(시급 × 분 / 60), 세금은 기존 3.3% 내림 검증을 그대로 쓴다.
--   - 출근 요일이 없거나 시간이 비어 있으면 지급 확정을 거부한다.
-- 시급제는 등원 확인 수업과 무관하므로 보낸 수업 목록(p_lesson_event_ids) 일치 검사는 비율제에만 남기고,
-- 시급제·월급제 정산에는 수업 목록을 저장하지 않는다.
-- 20261017090000_finance_income_spec.sql의 함수 본문에서 시급 분기와 그에 딸린 변수만 바꿨다.
-- (advisory lock, owner 검사, 같은 달 중복 거부, 세금 검증, 한국어 예외, grant/revoke는 그대로다.)

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
  v_contract_start date;
  v_contract_end date;
  v_period_start date;
  v_period_end date;
  v_expected_ids uuid[];
  v_provided_ids uuid[];
  v_schedule_count integer;
  v_unset_time_count integer;
  v_scheduled_minutes integer;
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

  select name, contract_start_on, contract_end_on
  into v_teacher_name, v_contract_start, v_contract_end
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

  select coalesce(array_agg(event.id order by event.id), '{}'::uuid[])
  into v_expected_ids
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
  elsif p_pay_type = 'hourly' then
    -- 시급제는 등원 확인 수업이 아니라 선생님의 출근 요일·시간(teacher_work_schedules)을 그 달(한국 달력)의
    -- 날짜에 펼쳐, 계약 시작일~종료일 안의 날짜만 정수 분으로 합산한다. 화면의 calculateScheduledWorkMinutes와 같은 규칙이다.
    if v_setting.hourly_rate is null then
      raise exception '급여 설정을 확인해 주세요. 시급이 비어 있습니다.';
    end if;

    v_period_start := greatest((p_month || '-01')::date, v_contract_start);
    v_period_end := least(
      ((p_month || '-01')::date + interval '1 month' - interval '1 day')::date,
      v_contract_end
    );

    select
      count(*),
      count(*) filter (where schedules.start_time is null or schedules.end_time is null),
      coalesce(sum(schedules.minutes_per_day * schedules.matching_days), 0)::integer
    into v_schedule_count, v_unset_time_count, v_scheduled_minutes
    from (
      select
        schedule.start_time,
        schedule.end_time,
        extract(hour from schedule.end_time) * 60 + extract(minute from schedule.end_time)
          - extract(hour from schedule.start_time) * 60 - extract(minute from schedule.start_time) as minutes_per_day,
        (
          select count(*)
          from generate_series(v_period_start::timestamp, v_period_end::timestamp, interval '1 day') as calendar_day(day_start)
          where extract(isodow from calendar_day.day_start)
            = array_position(array['월', '화', '수', '목', '금', '토', '일'], schedule.weekday)
        ) as matching_days
      from public.teacher_work_schedules schedule
      where schedule.academy_id = p_academy_id
        and schedule.teacher_id = p_teacher_id
    ) as schedules;

    if v_schedule_count = 0 then
      raise exception '출근 요일·시간을 설정해 주세요. 선생님 정보에서 출근 일정을 등록하면 시급을 계산할 수 있습니다.';
    end if;

    if v_unset_time_count > 0 then
      raise exception '출근 시간을 설정해 주세요. 시작·종료 시간이 비어 있는 출근 요일이 있습니다.';
    end if;

    v_expected_base := floor(v_setting.hourly_rate::numeric * v_scheduled_minutes / 60)::integer;

    if p_base_pay <> v_expected_base then
      raise exception '시급 급여가 출근 일정 계산과 다릅니다. 화면을 새로 고친 뒤 다시 시도해 주세요.';
    end if;
  else
    if v_provided_ids <> v_expected_ids then
      raise exception '등원 기록이 바뀌어 급여 금액을 확정할 수 없습니다. 화면을 새로 고쳐 최신 금액을 확인해 주세요.';
    end if;

    if v_setting.ratio_teacher_share is null then
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
    case when p_pay_type = 'ratio' then v_provided_ids else '{}'::uuid[] end
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

revoke all on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from public;
revoke all on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from anon;
grant execute on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) to authenticated;

-- 선생님 계약기간(시작일·종료일)을 선택 입력으로 바꾼다.
--
-- 제품 결정(2026-10-22): 계약기간이 없어도 선생님 등록·수정과 급여 계산이 동작해야 한다. 시작일과 종료일은
-- 각각 비워 둘 수 있고, 둘 다 있을 때만 종료일이 시작일보다 빠른지 검사한다.
--
-- 영향
--   - teachers.contract_start_on / contract_end_on의 NOT NULL을 해제한다. 기존 teachers_contract_period_check는
--     null이면 통과하므로 그대로 둔다.
--   - 급여 서버 재계산(mark_salary_settlement_paid)은 greatest/least가 NULL을 무시해 계약기간이 없으면 그 달 전체를
--     기준으로 한다. 클라이언트 시급제 계산(teacher-work-minutes)도 같은 규칙이다.
--   - 두 검증 함수는 시그니처가 같아 create or replace로 교체하며 기존 grant가 유지된다.

alter table public.teachers
  alter column contract_start_on drop not null,
  alter column contract_end_on drop not null;

create or replace function private.validate_teacher_base_payload(
  p_name text,
  p_part text,
  p_contract_start_on date,
  p_contract_end_on date
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception '선생님명은 필수입니다.';
  end if;

  if nullif(btrim(coalesce(p_part, '')), '') is null then
    raise exception '담당 파트는 필수입니다.';
  end if;

  if p_contract_start_on is not null
    and p_contract_end_on is not null
    and p_contract_end_on < p_contract_start_on then
    raise exception '계약 종료일은 계약 시작일보다 빠를 수 없습니다.';
  end if;
end;
$$;

create or replace function private.validate_teacher_profile_payload(
  p_name text,
  p_part text,
  p_contract_start_on date,
  p_contract_end_on date,
  p_pay_type text,
  p_monthly_salary integer,
  p_hourly_rate integer,
  p_ratio_teacher_share integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception '선생님명은 필수입니다.';
  end if;

  if nullif(btrim(coalesce(p_part, '')), '') is null then
    raise exception '담당 파트는 필수입니다.';
  end if;

  if p_contract_start_on is not null
    and p_contract_end_on is not null
    and p_contract_end_on < p_contract_start_on then
    raise exception '계약 종료일은 계약 시작일보다 빠를 수 없습니다.';
  end if;

  if p_pay_type not in ('monthly', 'hourly', 'ratio') then
    raise exception '지원하지 않는 급여 형태입니다.';
  end if;

  if p_pay_type = 'monthly' and (p_monthly_salary is null or p_monthly_salary <= 0) then
    raise exception '월급제는 월급 금액이 필요합니다.';
  end if;

  if p_pay_type = 'hourly' and (p_hourly_rate is null or p_hourly_rate <= 0) then
    raise exception '시급제는 시급 금액이 필요합니다.';
  end if;

  if p_pay_type = 'ratio' and (
    p_ratio_teacher_share is null
    or p_ratio_teacher_share < 0
    or p_ratio_teacher_share > 100
  ) then
    raise exception '비율제는 선생님 몫 비율이 필요합니다.';
  end if;
end;
$$;

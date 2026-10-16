-- 선생님 등록·수정 RPC에서 급여 설정(급여 형태·금액·비율)을 원장만 쓰게 한다.
--
-- 배경: teacher_salary_settings RLS는 원장 전용인데 기존 register_teacher_with_profile / update_teacher_profile은
-- 데스크가 불러도 급여 설정을 항상 쓰려고 해서(security invoker) 데스크의 기본 정보 등록·수정이 실패할 수 있었다.
-- 제품 결정(2026-10-16): 데스크는 선생님 기본 정보(성명·담당 파트·연락처·등록일·계약기간·출근 요일/시간)만
-- 등록·수정하고, 급여 설정은 원장만 다룬다.
--
-- 동작 규칙(함수 시그니처는 그대로라 기존 grant와 호출부가 유지된다)
--   - 급여 인자(p_pay_type, p_monthly_salary, p_hourly_rate, p_ratio_teacher_share) 중 하나라도 있으면 원장만 허용한다.
--     원장이 아니면 한국어 예외로 전체를 거부한다(일부만 저장되지 않는다).
--   - 급여 인자가 모두 비어 있으면 급여 설정(teacher_salary_settings)과 teachers.salary_type을 건드리지 않는다.
--     등록 때는 teachers.salary_type이 not null이므로 임시로 'monthly'를 넣고, 활성 급여 설정 행은 만들지 않는다.
--     급여 화면은 활성 설정이 없는 선생님을 "설정 확인 필요" 행으로 보여 준다.
--   - 두 함수는 기존처럼 security invoker다. 급여 설정 쓰기는 teacher_salary_settings의 owner 전용 RLS가 한 번 더 막는다.

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

  if p_contract_start_on is null or p_contract_end_on is null then
    raise exception '계약 시작일과 종료일은 필수입니다.';
  end if;

  if p_contract_end_on < p_contract_start_on then
    raise exception '계약 종료일은 계약 시작일보다 빠를 수 없습니다.';
  end if;
end;
$$;

create or replace function public.register_teacher_with_profile(
  p_academy_id uuid,
  p_name text,
  p_part text,
  p_phone text,
  p_registered_on date,
  p_contract_start_on date,
  p_contract_end_on date,
  p_pay_type text,
  p_monthly_salary integer,
  p_hourly_rate integer,
  p_ratio_teacher_share integer,
  p_work_schedules jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_teacher_id uuid;
  v_has_salary boolean :=
    p_pay_type is not null
    or p_monthly_salary is not null
    or p_hourly_rate is not null
    or p_ratio_teacher_share is not null;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '선생님을 등록할 권한이 없습니다.';
  end if;

  if v_has_salary and not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '급여 설정은 원장만 등록할 수 있습니다. 급여 항목을 비우고 다시 저장해 주세요.';
  end if;

  if v_has_salary and p_pay_type is null then
    raise exception '급여 형태를 선택해 주세요.';
  end if;

  if v_has_salary then
    perform private.validate_teacher_profile_payload(
      p_name,
      p_part,
      p_contract_start_on,
      p_contract_end_on,
      p_pay_type,
      p_monthly_salary,
      p_hourly_rate,
      p_ratio_teacher_share
    );
  else
    perform private.validate_teacher_base_payload(
      p_name,
      p_part,
      p_contract_start_on,
      p_contract_end_on
    );
  end if;

  insert into public.teachers (
    academy_id,
    name,
    part,
    phone,
    registered_on,
    contract_start_on,
    contract_end_on,
    salary_type,
    status
  )
  values (
    p_academy_id,
    btrim(p_name),
    btrim(p_part),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_registered_on,
    p_contract_start_on,
    p_contract_end_on,
    coalesce(p_pay_type, 'monthly'),
    'employed'
  )
  returning id into v_teacher_id;

  if v_has_salary then
    perform private.replace_teacher_salary_setting(
      p_academy_id,
      v_teacher_id,
      p_pay_type,
      p_monthly_salary,
      p_hourly_rate,
      p_ratio_teacher_share
    );
  end if;

  perform private.replace_teacher_work_schedules(
    p_academy_id,
    v_teacher_id,
    coalesce(p_work_schedules, '[]'::jsonb)
  );

  return v_teacher_id;
end;
$$;

create or replace function public.update_teacher_profile(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_name text,
  p_part text,
  p_phone text,
  p_registered_on date,
  p_contract_start_on date,
  p_contract_end_on date,
  p_pay_type text,
  p_monthly_salary integer,
  p_hourly_rate integer,
  p_ratio_teacher_share integer,
  p_work_schedules jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_has_salary boolean :=
    p_pay_type is not null
    or p_monthly_salary is not null
    or p_hourly_rate is not null
    or p_ratio_teacher_share is not null;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '선생님 정보를 수정할 권한이 없습니다.';
  end if;

  if v_has_salary and not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '급여 설정은 원장만 수정할 수 있습니다. 급여 항목을 비우고 다시 저장해 주세요.';
  end if;

  if v_has_salary and p_pay_type is null then
    raise exception '급여 형태를 선택해 주세요.';
  end if;

  if v_has_salary then
    perform private.validate_teacher_profile_payload(
      p_name,
      p_part,
      p_contract_start_on,
      p_contract_end_on,
      p_pay_type,
      p_monthly_salary,
      p_hourly_rate,
      p_ratio_teacher_share
    );
  else
    perform private.validate_teacher_base_payload(
      p_name,
      p_part,
      p_contract_start_on,
      p_contract_end_on
    );
  end if;

  update public.teachers
  set
    name = btrim(p_name),
    part = btrim(p_part),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    registered_on = p_registered_on,
    contract_start_on = p_contract_start_on,
    contract_end_on = p_contract_end_on,
    salary_type = coalesce(p_pay_type, salary_type)
  where academy_id = p_academy_id
    and id = p_teacher_id;

  if not found then
    raise exception '수정할 선생님을 찾지 못했습니다.';
  end if;

  if v_has_salary then
    perform private.replace_teacher_salary_setting(
      p_academy_id,
      p_teacher_id,
      p_pay_type,
      p_monthly_salary,
      p_hourly_rate,
      p_ratio_teacher_share
    );
  end if;

  perform private.replace_teacher_work_schedules(
    p_academy_id,
    p_teacher_id,
    coalesce(p_work_schedules, '[]'::jsonb)
  );
end;
$$;

revoke all on function private.validate_teacher_base_payload(text, text, date, date) from public;
revoke all on function private.validate_teacher_base_payload(text, text, date, date) from anon;
grant execute on function private.validate_teacher_base_payload(text, text, date, date) to authenticated;

revoke all on function public.register_teacher_with_profile(
  uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from public;
revoke all on function public.register_teacher_with_profile(
  uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from anon;
grant execute on function public.register_teacher_with_profile(
  uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) to authenticated;

revoke all on function public.update_teacher_profile(
  uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from public;
revoke all on function public.update_teacher_profile(
  uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from anon;
grant execute on function public.update_teacher_profile(
  uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) to authenticated;

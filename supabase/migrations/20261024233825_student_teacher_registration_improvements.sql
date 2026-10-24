-- 원생 출생연도·개인레슨 설정과 선생님 정수 비율제 입력을 저장한다.
-- 기존 등록 RPC는 새 공개 wrapper 안에서만 호출해 출석 ID unique 충돌을 원자적으로 재시도한다.

alter table public.students
  add column if not exists birth_year integer;

update public.students
set birth_year = age_as_of_year - age + 1
where age is not null
  and age_as_of_year is not null
  and birth_year is null;

alter table public.students
  drop constraint if exists students_birth_year_check;

alter table public.students
  add constraint students_birth_year_check
  check (birth_year is null or birth_year between 1900 and 2200);

alter table public.student_instruments
  add column if not exists sessions_per_month integer,
  add column if not exists lesson_duration_minutes integer;

alter table public.student_instruments
  drop constraint if exists student_instruments_sessions_per_month_check,
  drop constraint if exists student_instruments_lesson_duration_minutes_check;

alter table public.student_instruments
  add constraint student_instruments_sessions_per_month_check
    check (sessions_per_month is null or sessions_per_month > 0),
  add constraint student_instruments_lesson_duration_minutes_check
    check (lesson_duration_minutes is null or lesson_duration_minutes in (40, 60));

-- 원생·수강 쓰기는 아래 공개 wrapper RPC만 거치게 해 교차 필드 검증을 우회하지 못하게 한다.
revoke insert, update on public.students from authenticated;
revoke insert, update on public.student_instruments from authenticated;

-- 상태 변경은 역할을 검사하는 공개 RPC만 허용한다. 직접 UPDATE 권한 회수 후에도 RPC가 동작하도록
-- 함수 소유자 권한으로 실행하되, 함수 내부의 학원 역할 검사를 보안 경계로 유지한다.
alter function public.update_student_status(uuid, uuid, text, timestamptz, text)
  security definer;
revoke all on function public.update_student_status(uuid, uuid, text, timestamptz, text)
  from public, anon;
grant execute on function public.update_student_status(uuid, uuid, text, timestamptz, text)
  to authenticated;

create or replace function private.validate_student_demographics(
  p_age integer,
  p_birth_year integer
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_current_year integer := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
begin
  if (p_age is null) <> (p_birth_year is null) then
    raise exception '나이와 출생연도는 함께 입력하거나 함께 비워 주세요.';
  end if;

  if p_age is null then
    return;
  end if;

  if p_age < 1 or p_age > 127 then
    raise exception '나이는 1세부터 127세 사이로 입력해 주세요.';
  end if;

  if p_birth_year <> v_current_year - p_age + 1 then
    raise exception '나이와 출생연도가 일치하지 않습니다. 다시 확인해 주세요.';
  end if;
end;
$$;

revoke all on function private.validate_student_demographics(integer, integer)
  from public, anon, authenticated;

create or replace function private.validate_private_lesson_settings(p_enrollment jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_sessions integer;
  v_duration integer;
  v_schedules jsonb := coalesce(p_enrollment -> 'weekly_schedules', '[]'::jsonb);
  v_weekday_count integer;
  v_schedule jsonb;
  v_start_time time;
  v_end_time time;
begin
  if coalesce(p_enrollment ->> 'lesson_type', '') <> 'private' then
    return;
  end if;

  begin
    v_sessions := nullif(p_enrollment ->> 'sessions_per_month', '')::integer;
    v_duration := nullif(p_enrollment ->> 'lesson_duration_minutes', '')::integer;
  exception when invalid_text_representation then
    raise exception '개인레슨 월 횟수와 수업 시간을 다시 확인해 주세요.';
  end;

  if v_sessions is null or v_sessions <= 0 then
    raise exception '개인레슨 월 횟수는 1회 이상이어야 합니다.';
  end if;

  if v_duration not in (40, 60) then
    raise exception '개인레슨 수업 시간은 40분 또는 60분이어야 합니다.';
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

revoke all on function private.validate_private_lesson_settings(jsonb)
  from public, anon, authenticated;

-- 새 공개 시그니처. 기존 11개 인자 함수는 이 함수만 호출한다.
create function public.register_student_with_contacts(
  p_academy_id uuid,
  p_name text,
  p_registered_on date,
  p_age integer,
  p_birth_year integer,
  p_grade text,
  p_school text,
  p_occupation text,
  p_contact_relationship text,
  p_contact_phone text,
  p_secondary_contact jsonb,
  p_enrollments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_student_id uuid;
  v_enrollment jsonb;
  v_attempt integer := 0;
  v_constraint_name text;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생을 등록할 권한이 없습니다.';
  end if;

  perform private.validate_student_demographics(p_age, p_birth_year);

  if jsonb_typeof(coalesce(p_enrollments, '[]'::jsonb)) <> 'array' then
    raise exception '수강 정보를 다시 확인해 주세요.';
  end if;

  for v_enrollment in select value from jsonb_array_elements(coalesce(p_enrollments, '[]'::jsonb))
  loop
    perform private.validate_private_lesson_settings(v_enrollment);
  end loop;

  loop
    v_attempt := v_attempt + 1;
    begin
      v_student_id := public.register_student_with_contacts(
        p_academy_id, p_name, p_registered_on, p_age, p_grade, p_school,
        p_occupation, p_contact_relationship, p_contact_phone,
        p_secondary_contact, p_enrollments
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name <> 'students_academy_attendance_code_key' or v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  update public.students
  set birth_year = p_birth_year
  where academy_id = p_academy_id and id = v_student_id;

  for v_enrollment in select value from jsonb_array_elements(p_enrollments)
  loop
    update public.student_instruments
    set
      sessions_per_month = case
        when v_enrollment ->> 'lesson_type' = 'private'
          then (v_enrollment ->> 'sessions_per_month')::integer
        else null
      end,
      lesson_duration_minutes = case
        when v_enrollment ->> 'lesson_type' = 'private'
          then (v_enrollment ->> 'lesson_duration_minutes')::integer
        else null
      end
    where academy_id = p_academy_id
      and student_id = v_student_id
      and instrument_id = v_enrollment ->> 'instrument_id'
      and lesson_type = v_enrollment ->> 'lesson_type'
      and active;
  end loop;

  return v_student_id;
end;
$$;

revoke all on function public.register_student_with_contacts(
  uuid, text, date, integer, text, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.register_student_with_contacts(
  uuid, text, date, integer, integer, text, text, text, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.register_student_with_contacts(
  uuid, text, date, integer, integer, text, text, text, text, text, jsonb, jsonb
) to authenticated;

-- 새 공개 wrapper를 거치지 않고 출생연도·개인레슨 검증을 우회하지 못하게 한다.
revoke all on function public.register_student_with_enrollments(
  uuid, text, date, integer, text, text, text, text, text, jsonb
) from public, anon, authenticated;

-- 기존 연락처 wrapper를 보관한 뒤, 새 데이터까지 같은 트랜잭션에서 저장하는 공개 함수를 다시 만든다.
alter function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)
  rename to update_student_with_contacts_legacy_20261024;

revoke all on function public.update_student_with_contacts_legacy_20261024(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

create function public.update_student_with_contacts(
  p_academy_id uuid,
  p_student_id uuid,
  p_name text,
  p_basic jsonb,
  p_instruments jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_result jsonb;
  v_item jsonb;
  v_age integer;
  v_birth_year integer;
  v_added_index integer := 0;
  v_added_id uuid;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 정보를 수정할 권한이 없습니다.';
  end if;

  if p_basic is not null then
    v_age := nullif(p_basic ->> 'age', '')::integer;
    v_birth_year := case
      when p_basic ? 'birth_year' then nullif(p_basic ->> 'birth_year', '')::integer
      when v_age is not null then extract(year from (now() at time zone 'Asia/Seoul'))::integer - v_age + 1
      else null
    end;
    perform private.validate_student_demographics(v_age, v_birth_year);
  end if;

  if jsonb_typeof(coalesce(p_instruments, '[]'::jsonb)) <> 'array' then
    raise exception '수강 변경 정보를 다시 확인해 주세요.';
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_instruments, '[]'::jsonb))
    where value ->> 'action' <> 'end'
  loop
    perform private.validate_private_lesson_settings(v_item);
  end loop;

  v_result := public.update_student_with_contacts_legacy_20261024(
    p_academy_id, p_student_id, p_name, p_basic, p_instruments
  );

  if p_basic is not null then
    update public.students
    set birth_year = v_birth_year
    where academy_id = p_academy_id and id = p_student_id;
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_instruments, '[]'::jsonb))
    where value ->> 'action' = 'update'
  loop
    update public.student_instruments
    set
      sessions_per_month = case
        when v_item ->> 'lesson_type' = 'private'
          then (v_item ->> 'sessions_per_month')::integer
        else null
      end,
      lesson_duration_minutes = case
        when v_item ->> 'lesson_type' = 'private'
          then (v_item ->> 'lesson_duration_minutes')::integer
        else null
      end
    where academy_id = p_academy_id
      and student_id = p_student_id
      and id = (v_item ->> 'student_instrument_id')::uuid;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_instruments, '[]'::jsonb))
    where value ->> 'action' = 'add'
  loop
    v_added_id := nullif(v_result -> 'added' -> v_added_index ->> 'student_instrument_id', '')::uuid;
    v_added_index := v_added_index + 1;

    update public.student_instruments
    set
      sessions_per_month = case
        when v_item ->> 'lesson_type' = 'private'
          then (v_item ->> 'sessions_per_month')::integer
        else null
      end,
      lesson_duration_minutes = case
        when v_item ->> 'lesson_type' = 'private'
          then (v_item ->> 'lesson_duration_minutes')::integer
        else null
      end
    where academy_id = p_academy_id
      and student_id = p_student_id
      and id = v_added_id;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_student_with_contacts(uuid, uuid, text, jsonb, jsonb)
  to authenticated;

revoke all on function public.update_student_with_enrollments(uuid, uuid, text, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_student_basic_info(
  uuid, uuid, date, integer, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text,
  integer, integer, integer, date, jsonb, text[], date, integer, text
) from public, anon, authenticated;

-- 비율제는 0~100% 중 10% 단위만 저장한다. 기존 값은 임의 보정하지 않는다.
do $$
begin
  if exists (
    select 1
    from public.teacher_salary_settings
    where ratio_teacher_share is not null
      and mod(ratio_teacher_share, 10) <> 0
  ) then
    raise exception '10%% 단위가 아닌 기존 선생님 비율제가 있어 migration을 중단합니다.';
  end if;
end;
$$;

alter table public.teacher_salary_settings
  drop constraint if exists teacher_salary_settings_ratio_step_check;

alter table public.teacher_salary_settings
  add constraint teacher_salary_settings_ratio_step_check
  check (ratio_teacher_share is null or mod(ratio_teacher_share, 10) = 0);

-- 데스크가 급여 정보 없이 등록할 때 호출하는 기본 검증도 계약기간을 선택 입력으로 유지한다.
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
    or mod(p_ratio_teacher_share, 10) <> 0
  ) then
    raise exception '비율제는 선생님 몫을 0부터 10까지 정수로 입력해 주세요.';
  end if;
end;
$$;

revoke all on function private.validate_teacher_profile_payload(
  text, text, date, date, text, integer, integer, integer
) from public, anon;
grant execute on function private.validate_teacher_profile_payload(
  text, text, date, date, text, integer, integer, integer
) to authenticated;
revoke all on function private.validate_teacher_base_payload(
  text, text, date, date
) from public, anon;
grant execute on function private.validate_teacher_base_payload(
  text, text, date, date
) to authenticated;

notify pgrst, 'reload schema';

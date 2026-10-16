-- 원생 레슨비 가격표·할인·나이 자동 증가 (2026-10-16 원생관리 명세 반영)
--
-- 1. students.age_as_of_year: 나이를 입력한 해(KST). 표시 나이는 앱이 올해와의 차이로 계산한다.
--    - 나이가 있는 기존 행은 created_at(KST)의 연도로 채운다.
--    - 등록·기본 정보 수정 RPC는 나이를 입력받으면 서버의 현재 KST 연도를 저장한다.
-- 2. student_instruments 할인 종류: discount_kinds, referral_discount_month, referral_discount_amount
--    - discount_total과 final_monthly_fee에는 매달 적용 할인(두 자녀·두 악기)만 반영한다.
--    - 지인 소개 할인은 referral_discount_month(소개한 달 1일)에만 월 snapshot에서 추가로 뺀다.
--    - 이미 생성된 월 snapshot은 바꾸지 않는다(앞으로 생성되는 달부터 적용).
-- 3. register_student_with_enrollments: 나이 기준 연도, 할인 종류, 최종 수강료 서버 검증 추가.
-- 4. update_student_profile_from_date: 할인 종류·소개 달·소개 할인액·할인 라벨 인자 4개 추가(시그니처 교체). 기존 호출은 인자를 생략해도 된다.
-- 5. update_student_basic_info(신규): 등록일·나이·학년·학교·직업·연락처 수정. 출석 코드는 바꾸지 않는다.
-- 6. ensure_monthly_fixed_income_snapshots: 소개한 달에만 소개 할인액을 amount에서 추가로 뺀다.

alter table public.students
  add column if not exists age_as_of_year integer;

update public.students
set age_as_of_year = extract(year from created_at at time zone 'Asia/Seoul')::integer
where age is not null
  and age_as_of_year is null;

alter table public.student_instruments
  add column if not exists discount_kinds text[] not null default '{}',
  add column if not exists referral_discount_month date,
  add column if not exists referral_discount_amount integer not null default 0
    check (referral_discount_amount >= 0);

alter table public.student_instruments
  drop constraint if exists student_instruments_discount_kinds_check,
  drop constraint if exists student_instruments_referral_month_first_day_check;

alter table public.student_instruments
  add constraint student_instruments_discount_kinds_check
    check (discount_kinds <@ array['sibling', 'multi_instrument', 'referral']::text[]),
  add constraint student_instruments_referral_month_first_day_check
    check (
      referral_discount_month is null
      or referral_discount_month = date_trunc('month', referral_discount_month)::date
    );

create or replace function public.register_student_with_enrollments(
  p_academy_id uuid,
  p_name text,
  p_registered_on date,
  p_age integer,
  p_grade text,
  p_school text,
  p_occupation text,
  p_contact_relationship text,
  p_contact_phone text,
  p_enrollments jsonb
)
returns uuid
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_student_instrument_id uuid;
  v_enrollment jsonb;
  v_schedule jsonb;
  v_phone_last4 text;
  v_attendance_code text;
  v_attempt integer := 0;
  v_current_year integer := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
  v_lesson_fee integer;
  v_discount_total integer;
  v_final_monthly_fee integer;
  v_discount_kinds text[];
  v_has_referral boolean;
  v_referral_month date;
  v_referral_amount integer;
begin
  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '원생을 등록할 권한이 없습니다.';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception '원생명은 필수입니다.';
  end if;

  if p_registered_on is null then
    raise exception '등록일을 입력해 주세요.';
  end if;

  if jsonb_array_length(coalesce(p_enrollments, '[]'::jsonb)) = 0 then
    raise exception '하나 이상의 수강 악기가 필요합니다.';
  end if;

  v_phone_last4 := right(regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g'), 4);

  loop
    v_attempt := v_attempt + 1;
    v_attendance_code := coalesce(nullif(v_phone_last4, ''), '0000') ||
      lpad(floor(random() * 10000)::integer::text, 4, '0');

    exit when not exists (
      select 1
      from public.students
      where academy_id = p_academy_id
        and attendance_code = v_attendance_code
    );

    if v_attempt > 20 then
      raise exception '출석 코드를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
    end if;
  end loop;

  insert into public.students (
    academy_id,
    name,
    status,
    registered_on,
    age,
    age_as_of_year,
    grade,
    school,
    occupation,
    attendance_code
  )
  values (
    p_academy_id,
    btrim(p_name),
    'enrolled',
    p_registered_on,
    p_age,
    case when p_age is null then null else v_current_year end,
    nullif(btrim(coalesce(p_grade, '')), ''),
    nullif(btrim(coalesce(p_school, '')), ''),
    nullif(btrim(coalesce(p_occupation, '')), ''),
    v_attendance_code
  )
  returning id into v_student_id;

  insert into public.student_contacts (
    academy_id,
    student_id,
    relationship,
    phone,
    phone_last4
  )
  values (
    p_academy_id,
    v_student_id,
    coalesce(nullif(btrim(p_contact_relationship), ''), '본인'),
    btrim(coalesce(p_contact_phone, '')),
    nullif(v_phone_last4, '')
  );

  for v_enrollment in select * from jsonb_array_elements(p_enrollments)
  loop
    if jsonb_typeof(coalesce(v_enrollment->'discount_kinds', '[]'::jsonb)) <> 'array' then
      raise exception '지원하지 않는 할인 종류입니다.';
    end if;

    v_discount_kinds := array(
      select jsonb_array_elements_text(coalesce(v_enrollment->'discount_kinds', '[]'::jsonb))
    );
    v_has_referral := 'referral' = any (v_discount_kinds);
    v_lesson_fee := coalesce((v_enrollment->>'lesson_fee')::integer, 0);
    v_discount_total := coalesce((v_enrollment->>'discount_total')::integer, 0);
    v_final_monthly_fee := coalesce((v_enrollment->>'final_monthly_fee')::integer, 0);
    v_referral_amount := coalesce((v_enrollment->>'referral_discount_amount')::integer, 0);
    v_referral_month := case
      when v_has_referral and nullif(v_enrollment->>'referral_discount_month', '') is not null
        then date_trunc('month', (v_enrollment->>'referral_discount_month')::date)::date
      else null
    end;

    if not (v_discount_kinds <@ array['sibling', 'multi_instrument', 'referral']::text[]) then
      raise exception '지원하지 않는 할인 종류입니다.';
    end if;

    if v_has_referral and v_referral_month is null then
      raise exception '지인 소개 할인은 소개한 달을 함께 선택해야 합니다.';
    end if;

    if not v_has_referral and v_referral_amount <> 0 then
      raise exception '지인 소개 할인을 선택하지 않았다면 소개 할인액은 0원이어야 합니다.';
    end if;

    if v_lesson_fee < 0 or v_discount_total < 0 or v_final_monthly_fee < 0 or v_referral_amount < 0 then
      raise exception '수강료와 할인액은 0 이상이어야 합니다.';
    end if;

    if v_final_monthly_fee <> greatest(v_lesson_fee - v_discount_total, 0) then
      raise exception '최종 수강료가 레슨비에서 할인액을 뺀 금액과 다릅니다. 금액을 다시 확인해 주세요.';
    end if;

    insert into public.student_instruments (
      academy_id,
      student_id,
      teacher_id,
      instrument_id,
      instrument_name,
      lesson_type,
      weekdays,
      start_time,
      end_time,
      progress,
      lesson_fee,
      discount_total,
      discount_label,
      discount_kinds,
      referral_discount_month,
      referral_discount_amount,
      final_monthly_fee,
      active
    )
    values (
      p_academy_id,
      v_student_id,
      nullif(v_enrollment->>'teacher_id', '')::uuid,
      v_enrollment->>'instrument_id',
      v_enrollment->>'instrument_name',
      v_enrollment->>'lesson_type',
      coalesce((
        select array_agg(schedule->>'weekday' order by schedule->>'weekday')
        from jsonb_array_elements(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb)) schedule
      ), '{}'),
      (
        select nullif(schedule->>'start_time', '')::time
        from jsonb_array_elements(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb)) schedule
        where nullif(schedule->>'start_time', '') is not null
          and nullif(schedule->>'end_time', '') is not null
        limit 1
      ),
      (
        select nullif(schedule->>'end_time', '')::time
        from jsonb_array_elements(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb)) schedule
        where nullif(schedule->>'start_time', '') is not null
          and nullif(schedule->>'end_time', '') is not null
        limit 1
      ),
      coalesce(v_enrollment->>'progress', ''),
      v_lesson_fee,
      v_discount_total,
      nullif(v_enrollment->>'discount_label', ''),
      v_discount_kinds,
      v_referral_month,
      v_referral_amount,
      v_final_monthly_fee,
      true
    )
    returning id into v_student_instrument_id;

    if nullif(v_enrollment->>'teacher_id', '') is not null then
      insert into public.student_teacher_assignments (
        academy_id,
        student_id,
        teacher_id,
        instrument_name,
        active
      )
      values (
        p_academy_id,
        v_student_id,
        (v_enrollment->>'teacher_id')::uuid,
        v_enrollment->>'instrument_name',
        true
      );
    end if;

    for v_schedule in
      select *
      from jsonb_array_elements(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb))
    loop
      insert into public.student_instrument_weekly_schedules (
        academy_id,
        student_id,
        student_instrument_id,
        weekday,
        start_time,
        end_time
      )
      values (
        p_academy_id,
        v_student_id,
        v_student_instrument_id,
        v_schedule->>'weekday',
        nullif(v_schedule->>'start_time', '')::time,
        nullif(v_schedule->>'end_time', '')::time
      );

      if v_enrollment->>'lesson_type' = 'academy'
        and nullif(v_schedule->>'start_time', '') is not null
        and nullif(v_schedule->>'end_time', '') is not null then
        insert into public.lesson_series (
          academy_id,
          student_id,
          student_instrument_id,
          teacher_id,
          lesson_kind,
          instrument_id,
          instrument_name,
          weekdays,
          start_time,
          end_time,
          effective_from,
          active
        )
        values (
          p_academy_id,
          v_student_id,
          v_student_instrument_id,
          nullif(v_enrollment->>'teacher_id', '')::uuid,
          'academy',
          v_enrollment->>'instrument_id',
          v_enrollment->>'instrument_name',
          array[v_schedule->>'weekday'],
          (v_schedule->>'start_time')::time,
          (v_schedule->>'end_time')::time,
          p_registered_on,
          true
        );
      end if;
    end loop;
  end loop;

  return v_student_id;
end;
$$;

revoke all on function public.register_student_with_enrollments(uuid, text, date, integer, text, text, text, text, text, jsonb) from public;
grant execute on function public.register_student_with_enrollments(uuid, text, date, integer, text, text, text, text, text, jsonb) to authenticated;

-- 이전 시그니처(요일별 시간까지 17개 인자)를 지워 이름 있는 인자 호출이 모호해지지 않게 한다.
drop function if exists public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb
);

create or replace function public.update_student_profile_from_date(
  p_academy_id uuid,
  p_student_id uuid,
  p_name text,
  p_student_instrument_id uuid default null,
  p_teacher_id uuid default null,
  p_instrument_id text default '',
  p_instrument_name text default '',
  p_lesson_type text default 'academy',
  p_weekdays text[] default '{}',
  p_start_time text default null,
  p_end_time text default null,
  p_progress text default '',
  p_lesson_fee integer default 0,
  p_discount_total integer default 0,
  p_final_monthly_fee integer default 0,
  p_effective_from date default (now() at time zone 'Asia/Seoul')::date,
  -- [{weekday: '월', start_time: '15:00', end_time: '15:50'}, ...]. 비우면 p_weekdays와 대표 시간을 쓴다.
  p_weekly_schedules jsonb default null,
  -- 비우면(null) 기존 할인 종류와 소개 달·소개 할인액을 그대로 둔다.
  p_discount_kinds text[] default null,
  p_referral_discount_month date default null,
  p_referral_discount_amount integer default null,
  -- 할인 종류를 보낸 호출에서만 표시용 할인 라벨(예: '두 자녀 할인, 지인 소개 할인')을 함께 갱신한다.
  p_discount_label text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_effective_from date := coalesce(p_effective_from, (now() at time zone 'Asia/Seoul')::date);
  v_existing_student_instrument_id uuid;
  v_existing_instrument_name text;
  v_student_status text;
  v_schedules jsonb;
  v_schedule jsonb;
  v_weekdays text[];
  v_start_time time;
  v_end_time time;
  v_old_series_ids uuid[] := array[]::uuid[];
  v_new_series_id uuid;
  v_first_new_series_id uuid;
  v_has_referral boolean := 'referral' = any (coalesce(p_discount_kinds, '{}'));
  v_referral_month date;
  v_referral_amount integer := coalesce(p_referral_discount_amount, 0);
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 정보를 수정할 권한이 없습니다.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception '원생명은 필수입니다.';
  end if;

  if p_lesson_type not in ('academy', 'private') then
    raise exception '수업 유형을 확인해 주세요.';
  end if;

  select status::text
  into v_student_status
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id
  for update;

  if not found then
    raise exception '원생을 찾지 못했습니다. 목록을 새로고침해 주세요.';
  end if;

  update public.students
  set name = trim(p_name)
  where academy_id = p_academy_id
    and id = p_student_id;

  if p_student_instrument_id is null then
    return;
  end if;

  if coalesce(p_final_monthly_fee, 0)
    <> greatest(coalesce(p_lesson_fee, 0) - coalesce(p_discount_total, 0), 0)
  then
    raise exception '최종 수강료가 레슨비에서 할인액을 뺀 금액과 다릅니다. 금액을 다시 확인해 주세요.';
  end if;

  if p_discount_kinds is not null then
    if not (p_discount_kinds <@ array['sibling', 'multi_instrument', 'referral']::text[]) then
      raise exception '지원하지 않는 할인 종류입니다.';
    end if;

    v_referral_month := case
      when v_has_referral and p_referral_discount_month is not null
        then date_trunc('month', p_referral_discount_month)::date
      else null
    end;

    if v_has_referral and v_referral_month is null then
      raise exception '지인 소개 할인은 소개한 달을 함께 선택해야 합니다.';
    end if;

    if not v_has_referral and v_referral_amount <> 0 then
      raise exception '지인 소개 할인을 선택하지 않았다면 소개 할인액은 0원이어야 합니다.';
    end if;

    if v_referral_amount < 0 then
      raise exception '수강료와 할인액은 0 이상이어야 합니다.';
    end if;
  end if;

  select id, instrument_name
  into v_existing_student_instrument_id, v_existing_instrument_name
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and id = p_student_instrument_id
  for update;

  if not found then
    raise exception '수정할 원생 수강 정보를 찾지 못했습니다.';
  end if;

  v_schedules := coalesce(
    p_weekly_schedules,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'weekday', weekday,
            'start_time', nullif(p_start_time, ''),
            'end_time', nullif(p_end_time, '')
          )
        ),
        '[]'::jsonb
      )
      from unnest(coalesce(p_weekdays, '{}')) as weekday
    )
  );

  if jsonb_typeof(v_schedules) <> 'array' then
    raise exception '수강 요일 정보를 확인해 주세요.';
  end if;

  for v_schedule in select value from jsonb_array_elements(v_schedules)
  loop
    if (v_schedule ->> 'weekday') not in ('월', '화', '수', '목', '금', '토', '일') then
      raise exception '수강 요일을 확인해 주세요.';
    end if;

    if (nullif(v_schedule ->> 'start_time', '') is null)
      <> (nullif(v_schedule ->> 'end_time', '') is null)
    then
      raise exception '시작 시간과 종료 시간을 함께 입력해 주세요.';
    end if;

    if nullif(v_schedule ->> 'start_time', '') is not null
      and (v_schedule ->> 'end_time')::time <= (v_schedule ->> 'start_time')::time
    then
      raise exception '종료 시간은 시작 시간보다 늦어야 합니다.';
    end if;

    if p_lesson_type = 'academy' and nullif(v_schedule ->> 'start_time', '') is null then
      raise exception '학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'weekday')
    from jsonb_array_elements(v_schedules)
  ) <> jsonb_array_length(v_schedules) then
    raise exception '같은 요일이 두 번 선택되었습니다.';
  end if;

  if p_lesson_type = 'academy'
    and (p_teacher_id is null or jsonb_array_length(v_schedules) = 0)
  then
    raise exception '학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.';
  end if;

  select
    coalesce(array_agg(value ->> 'weekday' order by value ->> 'weekday'), '{}'),
    (
      select nullif(item ->> 'start_time', '')::time
      from jsonb_array_elements(v_schedules) item
      where nullif(item ->> 'start_time', '') is not null
      limit 1
    ),
    (
      select nullif(item ->> 'end_time', '')::time
      from jsonb_array_elements(v_schedules) item
      where nullif(item ->> 'start_time', '') is not null
      limit 1
    )
  into v_weekdays, v_start_time, v_end_time
  from jsonb_array_elements(v_schedules);

  select coalesce(array_agg(id), array[]::uuid[])
  into v_old_series_ids
  from public.lesson_series
  where academy_id = p_academy_id
    and student_instrument_id = p_student_instrument_id
    and lesson_kind = 'academy'
    and active is true
    and (effective_until is null or effective_until >= v_effective_from);

  update public.lesson_series
  set
    active = false,
    effective_until = case
      when effective_from < v_effective_from then v_effective_from - 1
      else effective_from
    end
  where id = any (v_old_series_ids)
    and academy_id = p_academy_id;

  update public.lesson_events event
  set
    status = 'cancelled',
    deletion_reason = '정기 일정 변경으로 이후 미출석 일정 취소',
    deleted_at = now(),
    deleted_by = (select auth.uid())
  where event.academy_id = p_academy_id
    and event.series_id = any (v_old_series_ids)
    and event.generated_from_enrollment
    and event.origin = 'regular'
    and event.status = 'scheduled'
    and event.starts_at >= (v_effective_from::timestamp at time zone 'Asia/Seoul')
    and not exists (
      select 1
      from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
    );

  update public.student_instruments
  set
    teacher_id = p_teacher_id,
    instrument_id = p_instrument_id,
    instrument_name = p_instrument_name,
    lesson_type = p_lesson_type,
    weekdays = v_weekdays,
    start_time = v_start_time,
    end_time = v_end_time,
    progress = coalesce(p_progress, ''),
    lesson_fee = greatest(coalesce(p_lesson_fee, 0), 0),
    discount_total = greatest(coalesce(p_discount_total, 0), 0),
    discount_kinds = coalesce(p_discount_kinds, discount_kinds),
    discount_label = case
      when p_discount_kinds is null then discount_label
      else nullif(btrim(coalesce(p_discount_label, '')), '')
    end,
    referral_discount_month = case
      when p_discount_kinds is null then referral_discount_month
      else v_referral_month
    end,
    referral_discount_amount = case
      when p_discount_kinds is null then referral_discount_amount
      else v_referral_amount
    end,
    final_monthly_fee = greatest(coalesce(p_final_monthly_fee, 0), 0)
  where academy_id = p_academy_id
    and id = v_existing_student_instrument_id;

  delete from public.student_instrument_weekly_schedules
  where academy_id = p_academy_id
    and student_instrument_id = v_existing_student_instrument_id;

  insert into public.student_instrument_weekly_schedules (
    academy_id,
    student_id,
    student_instrument_id,
    weekday,
    start_time,
    end_time
  )
  select
    p_academy_id,
    p_student_id,
    v_existing_student_instrument_id,
    item ->> 'weekday',
    nullif(item ->> 'start_time', '')::time,
    nullif(item ->> 'end_time', '')::time
  from jsonb_array_elements(v_schedules) item;

  -- 배정은 수정 중인 악기 것만 바꾼다. 복수 악기 원생의 다른 악기 배정은 그대로 둔다.
  -- 같은 악기를 다른 수업 유형(학원·개인)으로 수강 중이면 그 수강의 담당 배정은 끄지 않는다.
  update public.student_teacher_assignments
  set active = false
  where academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_name = v_existing_instrument_name
    and active
    and (p_teacher_id is null or teacher_id <> p_teacher_id)
    and not exists (
      select 1
      from public.student_instruments other
      where other.academy_id = p_academy_id
        and other.student_id = p_student_id
        and other.id <> v_existing_student_instrument_id
        and other.active
        and other.instrument_name = v_existing_instrument_name
        and other.teacher_id = student_teacher_assignments.teacher_id
    );

  -- 담당을 A→B→A로 바꾸면 A의 비활성 배정이 남아 있으므로 새로 넣지 않고 다시 켠다(unique 위반 방지).
  if p_teacher_id is not null then
    insert into public.student_teacher_assignments (
      academy_id,
      student_id,
      teacher_id,
      instrument_name,
      active
    )
    values (
      p_academy_id,
      p_student_id,
      p_teacher_id,
      v_existing_instrument_name,
      true
    )
    on conflict (academy_id, student_id, teacher_id, instrument_name)
    do update set active = true;
  end if;

  -- 휴원·퇴원 원생은 정기 시리즈를 만들지 않는다. 재원으로 돌아올 때 update_student_status가 만든다.
  if p_lesson_type = 'academy' and v_student_status = 'enrolled' then
    for v_schedule in select value from jsonb_array_elements(v_schedules)
    loop
      insert into public.lesson_series (
        academy_id,
        student_id,
        student_instrument_id,
        teacher_id,
        lesson_kind,
        instrument_id,
        instrument_name,
        weekdays,
        start_time,
        end_time,
        effective_from,
        active
      )
      values (
        p_academy_id,
        p_student_id,
        v_existing_student_instrument_id,
        p_teacher_id,
        'academy',
        p_instrument_id,
        p_instrument_name,
        array[v_schedule ->> 'weekday'],
        (v_schedule ->> 'start_time')::time,
        (v_schedule ->> 'end_time')::time,
        v_effective_from,
        true
      )
      returning id into v_new_series_id;

      v_first_new_series_id := coalesce(v_first_new_series_id, v_new_series_id);
    end loop;

    if v_first_new_series_id is not null then
      update public.lesson_series
      set superseded_by = v_first_new_series_id
      where id = any (v_old_series_ids)
        and academy_id = p_academy_id;
    end if;

    perform public.ensure_monthly_academy_lesson_events(
      p_academy_id,
      to_char(v_effective_from, 'YYYY-MM')
    );
  end if;
end;
$$;

revoke all on function public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb, text[], date, integer, text
) from public, anon;
grant execute on function public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb, text[], date, integer, text
) to authenticated;

-- 등록일·나이·학년·학교·직업·대표 연락처를 수정한다. 이름·수강 정보는 update_student_profile_from_date가 맡고,
-- 출석 코드(attendance_code)는 바꾸지 않는다. 등록일을 바꿔도 이미 만든 일정과 월 snapshot은 그대로다.
create or replace function public.update_student_basic_info(
  p_academy_id uuid,
  p_student_id uuid,
  p_registered_on date,
  p_age integer,
  p_grade text,
  p_school text,
  p_occupation text,
  p_contact_relationship text,
  p_contact_phone text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_current_year integer := extract(year from (now() at time zone 'Asia/Seoul'))::integer;
  v_phone text := btrim(coalesce(p_contact_phone, ''));
  v_phone_last4 text := right(regexp_replace(btrim(coalesce(p_contact_phone, '')), '\D', '', 'g'), 4);
  v_relationship text := coalesce(nullif(btrim(coalesce(p_contact_relationship, '')), ''), '본인');
  v_contact_id uuid;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 기본 정보를 수정할 권한이 없습니다.';
  end if;

  if p_registered_on is null then
    raise exception '등록일을 입력해 주세요.';
  end if;

  if p_age is not null and p_age < 0 then
    raise exception '나이는 0 이상이어야 합니다.';
  end if;

  perform 1
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id
  for update;

  if not found then
    raise exception '원생을 찾지 못했습니다. 목록을 새로고침해 주세요.';
  end if;

  select id
  into v_contact_id
  from public.student_contacts
  where academy_id = p_academy_id
    and student_id = p_student_id
  order by created_at, id
  limit 1
  for update;

  if v_contact_id is not null and v_phone = '' then
    raise exception '연락처 번호를 입력해 주세요.';
  end if;

  update public.students
  set
    registered_on = p_registered_on,
    age = p_age,
    age_as_of_year = case when p_age is null then null else v_current_year end,
    grade = nullif(btrim(coalesce(p_grade, '')), ''),
    school = nullif(btrim(coalesce(p_school, '')), ''),
    occupation = nullif(btrim(coalesce(p_occupation, '')), '')
  where academy_id = p_academy_id
    and id = p_student_id;

  if v_contact_id is not null then
    update public.student_contacts
    set
      relationship = v_relationship,
      phone = v_phone,
      phone_last4 = nullif(v_phone_last4, '')
    where academy_id = p_academy_id
      and id = v_contact_id;
  elsif v_phone <> '' then
    insert into public.student_contacts (
      academy_id,
      student_id,
      relationship,
      phone,
      phone_last4
    )
    values (
      p_academy_id,
      p_student_id,
      v_relationship,
      v_phone,
      nullif(v_phone_last4, '')
    );
  end if;
end;
$$;

revoke all on function public.update_student_basic_info(uuid, uuid, date, integer, text, text, text, text, text) from public, anon;
grant execute on function public.update_student_basic_info(uuid, uuid, date, integer, text, text, text, text, text) to authenticated;

-- 월별 수강료 snapshot 생성. 20261015081610의 정의에서 amount·discount_total·discount_label 계산만 바꿨다.
-- 소개 달(referral_discount_month)과 같은 달에만 소개 할인액을 amount에서 추가로 빼고, 이미 만든 snapshot은 건드리지 않는다.
create or replace function public.ensure_monthly_fixed_income_snapshots(
  p_academy_id uuid,
  p_month text
)
returns setof public.fixed_income_snapshots
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  month_start date;
  month_end date;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '월별 수강료 조회 권한이 없습니다.';
  end if;

  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '월 형식은 YYYY-MM이어야 합니다.';
  end if;

  month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  month_end := (month_start + interval '1 month - 1 day')::date;

  insert into public.fixed_income_snapshots (
    academy_id, month, student_id, student_instrument_id, student_name,
    instrument_id, instrument_name, amount, due_on, lesson_fee,
    discount_total, discount_label, progress
  )
  select
    instrument.academy_id,
    p_month,
    student.id,
    instrument.id,
    student.name,
    instrument.instrument_id,
    instrument.instrument_name,
    instrument.final_monthly_fee - applied.referral_applied,
    case
      when extract(day from student.registered_on)::int <= extract(day from month_end)::int
        then make_date(
          extract(year from month_start)::int,
          extract(month from month_start)::int,
          extract(day from student.registered_on)::int
        )
      else month_end + 1
    end,
    instrument.lesson_fee,
    instrument.discount_total + applied.referral_applied,
    case
      when 'referral' = any (instrument.discount_kinds) and applied.referral_applied = 0
        then nullif(
          array_to_string(
            array_remove(string_to_array(instrument.discount_label, ', '), '지인 소개 할인'),
            ', '
          ),
          ''
        )
      else instrument.discount_label
    end,
    instrument.progress
  from public.student_instruments instrument
  join public.students student
    on student.academy_id = instrument.academy_id
   and student.id = instrument.student_id
  cross join lateral (
    select case
      when instrument.referral_discount_month = month_start
        then least(instrument.referral_discount_amount, instrument.final_monthly_fee)
      else 0
    end as referral_applied
  ) applied
  where instrument.academy_id = p_academy_id
    and instrument.lesson_type = 'academy'
    and instrument.active
    and student.status = 'enrolled'
    and student.registered_on <= month_end
    and instrument.final_monthly_fee >= 0
  on conflict (academy_id, month, student_id, instrument_id) do nothing;

  return query
  select *
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and month = p_month
  order by due_on, student_name, instrument_name;
end;
$$;

revoke all on function public.ensure_monthly_fixed_income_snapshots(uuid, text) from public;
grant execute on function public.ensure_monthly_fixed_income_snapshots(uuid, text) to authenticated;

notify pgrst, 'reload schema';

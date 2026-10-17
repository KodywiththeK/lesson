-- 원생 수정에서 악기 추가·종료와 한 트랜잭션 저장 (2026-10-17 원생 수정 후속)
--
-- 1. student_instruments.started_on / ended_on: 수강 시작·종료일. 둘 다 비어 있으면 기존처럼 원생 등록일부터 수강 중으로 본다.
-- 2. ensure_monthly_fixed_income_snapshots: 시작일이 속한 달부터, 종료일이 속한 달까지만 월 수강료를 만든다.
--    이미 만든 snapshot은 바꾸지 않는다(on conflict do nothing).
-- 3. 같은 악기·수업 형태의 unique를 '수강 중인(active) 행'끼리만으로 좁힌다. 종료한 수강은 그대로 남기고 같은 조합을
--    다시 추가하면 새 수강 행이 생긴다(기간마다 행이 따로라 이전 기간의 월 수강료·일정·이력이 덮어써지지 않는다).
--    private.insert_student_enrollment: 수강 한 건 추가(항상 새 행).
-- 4. private.end_student_enrollment: 수강 종료. 지우지 않고 비활성으로 바꾸고, 정기 시리즈를 닫고,
--    오늘 이후 출석 기록이 없는 정기 일정을 취소한다. 월 수강료·회차권·과거 일정은 그대로 둔다.
-- 5. public.update_student_with_enrollments: 이름·기본 정보·수강 변경(종료 → 수정 → 추가)을 한 함수로 처리한다.
--    PL/pgSQL 함수는 한 트랜잭션이므로 어느 단계든 실패하면 전부 되돌아간다.

alter table public.student_instruments
  add column if not exists started_on date,
  add column if not exists ended_on date;

-- 이전 unique(academy_id, student_id, instrument_id, lesson_type)는 종료한 수강까지 막아 재추가를 못 하게 한다.
-- PG가 63자로 줄여 붙인 이름이라 이름 대신 컬럼 집합으로 찾아 지운다.
do $$
declare
  v_constraint text;
begin
  for v_constraint in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.student_instruments'::regclass
      and constraint_row.contype = 'u'
      and (
        select array_agg(attribute.attname::text order by attribute.attname)
        from unnest(constraint_row.conkey) as column_key(attnum)
        join pg_attribute attribute
          on attribute.attrelid = constraint_row.conrelid
         and attribute.attnum = column_key.attnum
      ) = array['academy_id', 'instrument_id', 'lesson_type', 'student_id']
  loop
    execute format('alter table public.student_instruments drop constraint %I', v_constraint);
  end loop;
end
$$;

create unique index if not exists student_instruments_active_enrollment_key
  on public.student_instruments (academy_id, student_id, instrument_id, lesson_type)
  where active;

create or replace function private.insert_student_enrollment(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_status text,
  p_started_on date,
  p_enrollment jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_started_on date := coalesce(p_started_on, (now() at time zone 'Asia/Seoul')::date);
  v_lesson_type text := p_enrollment ->> 'lesson_type';
  v_teacher_id uuid := nullif(p_enrollment ->> 'teacher_id', '')::uuid;
  v_schedules jsonb := coalesce(p_enrollment -> 'weekly_schedules', '[]'::jsonb);
  v_schedule jsonb;
  v_weekdays text[];
  v_start_time time;
  v_end_time time;
  v_discount_kinds text[];
  v_has_referral boolean;
  v_referral_month date;
  v_referral_amount integer;
  v_lesson_fee integer;
  v_discount_total integer;
  v_final_monthly_fee integer;
  v_last_ended_on date;
  v_student_instrument_id uuid;
begin
  if coalesce(v_lesson_type, '') not in ('academy', 'private') then
    raise exception '수업 유형을 확인해 주세요.';
  end if;

  if nullif(btrim(coalesce(p_enrollment ->> 'instrument_id', '')), '') is null
    or nullif(btrim(coalesce(p_enrollment ->> 'instrument_name', '')), '') is null
  then
    raise exception '악기를 선택해 주세요.';
  end if;

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

    if v_lesson_type = 'academy' and nullif(v_schedule ->> 'start_time', '') is null then
      raise exception '학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'weekday')
    from jsonb_array_elements(v_schedules)
  ) <> jsonb_array_length(v_schedules) then
    raise exception '같은 요일이 두 번 선택되었습니다.';
  end if;

  if v_lesson_type = 'academy'
    and (v_teacher_id is null or jsonb_array_length(v_schedules) = 0)
  then
    raise exception '학원 수업은 담당 선생님과 모든 수강 요일의 시작·종료 시간이 필요합니다.';
  end if;

  if jsonb_typeof(coalesce(p_enrollment -> 'discount_kinds', '[]'::jsonb)) <> 'array' then
    raise exception '지원하지 않는 할인 종류입니다.';
  end if;

  v_discount_kinds := array(
    select jsonb_array_elements_text(coalesce(p_enrollment -> 'discount_kinds', '[]'::jsonb))
  );
  v_has_referral := 'referral' = any (v_discount_kinds);
  v_lesson_fee := coalesce((p_enrollment ->> 'lesson_fee')::integer, 0);
  v_discount_total := coalesce((p_enrollment ->> 'discount_total')::integer, 0);
  v_final_monthly_fee := coalesce((p_enrollment ->> 'final_monthly_fee')::integer, 0);
  v_referral_amount := coalesce((p_enrollment ->> 'referral_discount_amount')::integer, 0);
  v_referral_month := case
    when v_has_referral and nullif(p_enrollment ->> 'referral_discount_month', '') is not null
      then date_trunc('month', (p_enrollment ->> 'referral_discount_month')::date)::date
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

  -- 같은 악기·수업 형태를 수강 중이면 거부한다(종료한 수강은 충돌이 아니다).
  perform 1
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_id = p_enrollment ->> 'instrument_id'
    and lesson_type = p_enrollment ->> 'lesson_type'
    and active
  for update;

  if found then
    raise exception '이미 수강 중인 악기와 수업 형태입니다.';
  end if;

  -- 종료일 당일이나 그 전 날짜로 다시 추가하면 이전 시리즈가 만든 일정(오늘 출석 처리한 일정 포함)과 새 시리즈 일정이 겹친다.
  select max(ended_on)
  into v_last_ended_on
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and instrument_id = p_enrollment ->> 'instrument_id'
    and lesson_type = p_enrollment ->> 'lesson_type'
    and not active;

  if v_last_ended_on is not null
    and v_started_on <= v_last_ended_on
  then
    raise exception '종료한 수강은 종료일(%) 다음 날부터 다시 시작할 수 있습니다.',
      to_char(v_last_ended_on, 'YYYY-MM-DD');
  end if;

  insert into public.student_instruments (
    academy_id, student_id, teacher_id, instrument_id, instrument_name, lesson_type,
    weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label,
    discount_kinds, referral_discount_month, referral_discount_amount, final_monthly_fee,
    active, started_on
  )
  values (
    p_academy_id, p_student_id, v_teacher_id,
    p_enrollment ->> 'instrument_id', p_enrollment ->> 'instrument_name', v_lesson_type,
    v_weekdays, v_start_time, v_end_time, coalesce(p_enrollment ->> 'progress', ''),
    v_lesson_fee, v_discount_total, nullif(p_enrollment ->> 'discount_label', ''),
    v_discount_kinds, v_referral_month, v_referral_amount, v_final_monthly_fee,
    true, v_started_on
  )
  returning id into v_student_instrument_id;

  insert into public.student_instrument_weekly_schedules (
    academy_id, student_id, student_instrument_id, weekday, start_time, end_time
  )
  select
    p_academy_id,
    p_student_id,
    v_student_instrument_id,
    item ->> 'weekday',
    nullif(item ->> 'start_time', '')::time,
    nullif(item ->> 'end_time', '')::time
  from jsonb_array_elements(v_schedules) item;

  -- 담당을 A→B→A로 바꾸거나 종료한 악기를 다시 추가하면 비활성 배정이 남아 있으므로 새로 넣지 않고 다시 켠다(unique 위반 방지).
  if v_teacher_id is not null then
    insert into public.student_teacher_assignments (
      academy_id, student_id, teacher_id, instrument_name, active
    )
    values (
      p_academy_id, p_student_id, v_teacher_id, p_enrollment ->> 'instrument_name', true
    )
    on conflict (academy_id, student_id, teacher_id, instrument_name)
    do update set active = true;
  end if;

  -- 휴원·퇴원 원생은 정기 시리즈를 만들지 않는다. 재원으로 돌아올 때 update_student_status가 만든다.
  if v_lesson_type = 'academy' and p_student_status = 'enrolled' then
    for v_schedule in select value from jsonb_array_elements(v_schedules)
    loop
      insert into public.lesson_series (
        academy_id, student_id, student_instrument_id, teacher_id, lesson_kind,
        instrument_id, instrument_name, weekdays, start_time, end_time, effective_from, active
      )
      values (
        p_academy_id,
        p_student_id,
        v_student_instrument_id,
        v_teacher_id,
        'academy',
        p_enrollment ->> 'instrument_id',
        p_enrollment ->> 'instrument_name',
        array[v_schedule ->> 'weekday'],
        (v_schedule ->> 'start_time')::time,
        (v_schedule ->> 'end_time')::time,
        v_started_on,
        true
      );
    end loop;
  end if;

  return v_student_instrument_id;
end;
$$;

revoke all on function private.insert_student_enrollment(uuid, uuid, text, date, jsonb)
  from public, anon, authenticated;

create or replace function private.end_student_enrollment(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_instrument_id uuid,
  p_today date
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_instrument public.student_instruments%rowtype;
  v_remaining integer;
begin
  select *
  into v_instrument
  from public.student_instruments
  where academy_id = p_academy_id
    and student_id = p_student_id
    and id = p_student_instrument_id
  for update;

  if not found then
    raise exception '종료할 수강 정보를 찾지 못했습니다.';
  end if;

  if not v_instrument.active then
    raise exception '이미 종료된 수강입니다.';
  end if;

  update public.student_instruments
  set
    active = false,
    ended_on = p_today
  where academy_id = p_academy_id
    and id = p_student_instrument_id;

  update public.lesson_series
  set
    active = false,
    effective_until = greatest(
      effective_from,
      least(coalesce(effective_until, p_today - 1), p_today - 1)
    )
  where academy_id = p_academy_id
    and student_instrument_id = p_student_instrument_id
    and active = true;

  -- 오늘 이후의 출석 기록이 없는 정기 일정만 취소한다. 이동·보강·수동·개인레슨 일정은 그대로 둔다.
  update public.lesson_events event
  set
    status = 'cancelled',
    deletion_reason = '수강 종료로 이후 미출석 정기 일정 취소',
    deleted_at = coalesce(event.deleted_at, now()),
    deleted_by = (select auth.uid())
  where event.academy_id = p_academy_id
    and event.student_instrument_id = p_student_instrument_id
    and event.origin = 'regular'
    and event.status = 'scheduled'
    and (event.starts_at at time zone 'Asia/Seoul')::date >= p_today
    and not exists (
      select 1
      from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
    );

  -- 같은 선생님·악기의 다른 활성 수강이 남아 있으면 담당 배정은 유지한다.
  if v_instrument.teacher_id is not null then
    update public.student_teacher_assignments
    set active = false
    where academy_id = p_academy_id
      and student_id = p_student_id
      and teacher_id = v_instrument.teacher_id
      and instrument_name = v_instrument.instrument_name
      and active
      and not exists (
        select 1
        from public.student_instruments other
        where other.academy_id = p_academy_id
          and other.student_id = p_student_id
          and other.id <> p_student_instrument_id
          and other.active
          and other.instrument_name = v_instrument.instrument_name
          and other.teacher_id = v_instrument.teacher_id
      );
  end if;

  select count(*)
  into v_remaining
  from public.lesson_events event
  where event.academy_id = p_academy_id
    and event.student_instrument_id = p_student_instrument_id
    and event.status = 'scheduled'
    and (event.starts_at at time zone 'Asia/Seoul')::date >= p_today
    and not exists (
      select 1
      from public.attendance_records attendance
      where attendance.academy_id = event.academy_id
        and attendance.lesson_event_id = event.id
    );

  return v_remaining;
end;
$$;

revoke all on function private.end_student_enrollment(uuid, uuid, uuid, date)
  from public, anon, authenticated;

-- p_basic: {registered_on, age, grade, school, occupation, contact_relationship, contact_phone}. null이면 기본 정보는 그대로 둔다.
-- p_instruments 항목: {action: 'update' | 'add' | 'end', ...}.
--   update: student_instrument_id + update_student_profile_from_date 인자(teacher_id, instrument_id, instrument_name,
--           lesson_type, progress, lesson_fee, discount_total, final_monthly_fee, effective_from, weekly_schedules,
--           discount_kinds, referral_discount_month, referral_discount_amount, discount_label). 악기 코드는 바꿀 수 없다.
--   add:    started_on + 등록과 같은 수강 필드(teacher_id, instrument_id, instrument_name, lesson_type, weekly_schedules, ...)
--   end:    student_instrument_id
-- 반환: {added: [{student_instrument_id, instrument_id}], ended: [{student_instrument_id, remaining_event_count}]}
create or replace function public.update_student_with_enrollments(
  p_academy_id uuid,
  p_student_id uuid,
  p_name text,
  p_basic jsonb default null,
  p_instruments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_items jsonb := coalesce(p_instruments, '[]'::jsonb);
  v_item jsonb;
  v_student_status text;
  v_stored public.student_instruments%rowtype;
  v_added jsonb := '[]'::jsonb;
  v_ended jsonb := '[]'::jsonb;
  v_new_id uuid;
  v_remaining integer;
  v_added_month text;
  v_added_months text[] := '{}';
  v_active_count integer;
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

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception '원생명은 필수입니다.';
  end if;

  if jsonb_typeof(v_items) <> 'array' then
    raise exception '수강 변경 정보를 확인해 주세요.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_items) item
    where coalesce(item ->> 'action', '') not in ('update', 'add', 'end')
  ) then
    raise exception '지원하지 않는 수강 변경입니다.';
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
  set name = btrim(p_name)
  where academy_id = p_academy_id
    and id = p_student_id;

  if p_basic is not null then
    perform public.update_student_basic_info(
      p_academy_id,
      p_student_id,
      (p_basic ->> 'registered_on')::date,
      nullif(p_basic ->> 'age', '')::integer,
      p_basic ->> 'grade',
      p_basic ->> 'school',
      p_basic ->> 'occupation',
      p_basic ->> 'contact_relationship',
      p_basic ->> 'contact_phone'
    );
  end if;

  -- 종료를 먼저 처리해야 같은 호출에서 종료한 악기·수업 형태를 다시 추가할 수 있다.
  for v_item in select value from jsonb_array_elements(v_items) where value ->> 'action' = 'end'
  loop
    v_remaining := private.end_student_enrollment(
      p_academy_id,
      p_student_id,
      (v_item ->> 'student_instrument_id')::uuid,
      v_today
    );

    v_ended := v_ended || jsonb_build_array(jsonb_build_object(
      'student_instrument_id', v_item ->> 'student_instrument_id',
      'remaining_event_count', v_remaining
    ));
  end loop;

  for v_item in select value from jsonb_array_elements(v_items) where value ->> 'action' = 'update'
  loop
    select *
    into v_stored
    from public.student_instruments
    where academy_id = p_academy_id
      and student_id = p_student_id
      and id = (v_item ->> 'student_instrument_id')::uuid
    for update;

    if not found then
      raise exception '수정할 원생 수강 정보를 찾지 못했습니다.';
    end if;

    if not v_stored.active then
      raise exception '종료된 수강은 수정할 수 없습니다.';
    end if;

    -- 악기 코드는 월 수강료·회차권·급여의 키이므로 제자리에서 바꾸면 이중 청구와 잔액 분리가 생긴다.
    if v_stored.instrument_id <> coalesce(v_item ->> 'instrument_id', '') then
      raise exception '악기는 바꿀 수 없습니다. 기존 악기를 종료하고 새 악기를 추가해 주세요.';
    end if;

    if jsonb_typeof(v_item -> 'weekly_schedules') is distinct from 'array' then
      raise exception '수강 요일 정보를 확인해 주세요.';
    end if;

    if v_stored.lesson_type <> coalesce(v_item ->> 'lesson_type', '')
      and exists (
        select 1
        from public.student_instruments other
        where other.academy_id = p_academy_id
          and other.student_id = p_student_id
          and other.id <> v_stored.id
          and other.active
          and other.instrument_id = v_stored.instrument_id
          and other.lesson_type = v_item ->> 'lesson_type'
      )
    then
      raise exception '같은 악기·수업 형태의 수강 정보가 이미 있어 수업 형태를 바꿀 수 없습니다.';
    end if;

    perform public.update_student_profile_from_date(
      p_academy_id := p_academy_id,
      p_student_id := p_student_id,
      p_name := btrim(p_name),
      p_student_instrument_id := v_stored.id,
      p_teacher_id := nullif(v_item ->> 'teacher_id', '')::uuid,
      p_instrument_id := v_stored.instrument_id,
      p_instrument_name := v_stored.instrument_name,
      p_lesson_type := v_item ->> 'lesson_type',
      p_progress := coalesce(v_item ->> 'progress', ''),
      p_lesson_fee := coalesce((v_item ->> 'lesson_fee')::integer, 0),
      p_discount_total := coalesce((v_item ->> 'discount_total')::integer, 0),
      p_final_monthly_fee := coalesce((v_item ->> 'final_monthly_fee')::integer, 0),
      p_effective_from := coalesce(nullif(v_item ->> 'effective_from', '')::date, v_today),
      p_weekly_schedules := v_item -> 'weekly_schedules',
      p_discount_kinds := case
        when jsonb_typeof(v_item -> 'discount_kinds') = 'array'
          then array(select jsonb_array_elements_text(v_item -> 'discount_kinds'))
        else null
      end,
      p_referral_discount_month := nullif(v_item ->> 'referral_discount_month', '')::date,
      p_referral_discount_amount := nullif(v_item ->> 'referral_discount_amount', '')::integer,
      p_discount_label := v_item ->> 'discount_label'
    );
  end loop;

  for v_item in select value from jsonb_array_elements(v_items) where value ->> 'action' = 'add'
  loop
    v_new_id := private.insert_student_enrollment(
      p_academy_id,
      p_student_id,
      v_student_status,
      nullif(v_item ->> 'started_on', '')::date,
      v_item
    );

    v_added := v_added || jsonb_build_array(jsonb_build_object(
      'student_instrument_id', v_new_id,
      'instrument_id', v_item ->> 'instrument_id'
    ));

    if v_item ->> 'lesson_type' = 'academy' then
      v_added_month := to_char(coalesce(nullif(v_item ->> 'started_on', '')::date, v_today), 'YYYY-MM');
      if not (v_added_month = any (v_added_months)) then
        v_added_months := v_added_months || v_added_month;
      end if;
    end if;
  end loop;

  select count(*)
  into v_active_count
  from public.student_instruments instrument
  where instrument.academy_id = p_academy_id
    and instrument.student_id = p_student_id
    and instrument.active;

  -- 이름·기본 정보만 고치는 저장은 막지 않는다(활성 악기가 없는 이전 원생도 저장할 수 있어야 한다).
  if jsonb_array_length(v_ended) > 0 and v_active_count < 1 then
    raise exception '수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.';
  end if;

  if v_student_status = 'enrolled' then
    foreach v_added_month in array v_added_months
    loop
      perform public.ensure_monthly_academy_lesson_events(p_academy_id, v_added_month);
    end loop;
  end if;

  return jsonb_build_object('added', v_added, 'ended', v_ended);
end;
$$;

revoke all on function public.update_student_with_enrollments(uuid, uuid, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.update_student_with_enrollments(uuid, uuid, text, jsonb, jsonb)
  to authenticated;

-- 월별 수강료 snapshot 생성. 20261018110000의 정의에서 악기 선택 조건(시작·종료 달)만 바꿨다.
-- 시작일이 없는 기존 수강은 원생 등록일부터, 종료일이 있으면 종료한 달까지 만든다.
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
    and coalesce(instrument.ended_on >= month_start, instrument.active)
    and student.status = 'enrolled'
    and student.registered_on <= month_end
    and coalesce(instrument.started_on, student.registered_on) <= month_end
    -- 시작하기 전에 종료한 수강(종료일이 시작일보다 앞섬)은 어느 달에도 만들지 않는다.
    and coalesce(instrument.started_on, student.registered_on) <= coalesce(instrument.ended_on, month_end)
    and instrument.final_monthly_fee >= 0
  -- 같은 달에 같은 악기 수강이 둘이면(월 중간 종료 후 재추가) 늦게 시작한 수강이 그 달의 월 수강료 한 건을 정한다.
  order by coalesce(instrument.started_on, student.registered_on) desc, instrument.created_at desc, instrument.id desc
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

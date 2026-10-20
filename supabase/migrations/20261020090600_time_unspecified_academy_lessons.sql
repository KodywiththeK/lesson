-- 학원레슨은 요일·담당 선생님을 유지하면서 시작·종료 시간을 함께 비울 수 있다.
-- 시간 미정 이벤트는 해당 날짜 00:00~00:01을 정렬용 시각으로만 저장하고 별도 표식으로 화면에서 시간을 숨긴다.
alter table public.lesson_series
  alter column start_time drop not null,
  alter column end_time drop not null;

alter table public.lesson_series
  add constraint lesson_series_time_pair_check
  check ((start_time is null) = (end_time is null));

create or replace function public.ensure_monthly_academy_lesson_events(
  p_academy_id uuid,
  p_month text
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_month_start date;
  v_month_end date;
  v_inserted_count integer;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.is_active_academy_member(p_academy_id) then
    raise exception '학원 정기 일정을 생성할 권한이 없습니다.';
  end if;

  if p_month is null or p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception '월 형식은 YYYY-MM이어야 합니다.';
  end if;

  v_month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_month_end := (v_month_start + interval '1 month')::date;

  with calendar_days as (
    select generate_series(
      v_month_start::timestamp,
      (v_month_end - 1)::timestamp,
      interval '1 day'
    )::date as lesson_day
  ),
  scheduled_lessons as (
    select
      series.academy_id,
      series.student_id,
      series.student_instrument_id,
      series.id as series_id,
      series.teacher_id,
      series.instrument_id,
      series.instrument_name,
      ((calendar.lesson_day::timestamp + coalesce(series.start_time, time '00:00')) at time zone 'Asia/Seoul') as starts_at,
      ((calendar.lesson_day::timestamp + coalesce(series.end_time, time '00:01')) at time zone 'Asia/Seoul') as ends_at,
      series.start_time is null as time_unspecified
    from public.lesson_series series
    join public.students student
      on student.academy_id = series.academy_id
     and student.id = series.student_id
    join calendar_days calendar
      on case extract(dow from calendar.lesson_day)::int
           when 0 then '일'
           when 1 then '월'
           when 2 then '화'
           when 3 then '수'
           when 4 then '목'
           when 5 then '금'
           when 6 then '토'
         end = any (series.weekdays)
    where series.academy_id = p_academy_id
      and series.lesson_kind = 'academy'
      and series.active is true
      and series.teacher_id is not null
      and student.status = 'enrolled'
      and calendar.lesson_day >= greatest(v_month_start, student.registered_on)
      and calendar.lesson_day >= series.effective_from
      and (series.effective_until is null or calendar.lesson_day <= series.effective_until)
  ),
  inserted as (
    insert into public.lesson_events (
      academy_id,
      student_id,
      student_instrument_id,
      series_id,
      teacher_id,
      lesson_kind,
      origin,
      source_lesson_event_id,
      counts_for_ticket,
      instrument_id,
      instrument_name,
      starts_at,
      ends_at,
      time_unspecified,
      status,
      generated_from_enrollment
    )
    select
      academy_id,
      student_id,
      student_instrument_id,
      series_id,
      teacher_id,
      'academy',
      'regular',
      null,
      false,
      instrument_id,
      instrument_name,
      starts_at,
      ends_at,
      time_unspecified,
      'scheduled',
      true
    from scheduled_lessons
    on conflict (academy_id, series_id, starts_at)
      where generated_from_enrollment
        and origin = 'regular'
        and lesson_kind = 'academy'
        and series_id is not null
      do nothing
    returning 1
  )
  select count(*) into v_inserted_count
  from inserted;

  return v_inserted_count;
end;
$$;

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
    if v_enrollment->>'lesson_type' = 'academy' then
      if nullif(v_enrollment->>'teacher_id', '') is null
        or jsonb_typeof(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb)) <> 'array'
        or jsonb_array_length(coalesce(v_enrollment->'weekly_schedules', '[]'::jsonb)) = 0
      then
        raise exception '학원 수업은 담당 선생님과 수강 요일이 필요합니다.';
      end if;

      for v_schedule in select value from jsonb_array_elements(v_enrollment->'weekly_schedules')
      loop
        if v_schedule->>'weekday' not in ('월', '화', '수', '목', '금', '토', '일') then
          raise exception '수강 요일을 확인해 주세요.';
        end if;
        if (nullif(v_schedule->>'start_time', '') is null)
          <> (nullif(v_schedule->>'end_time', '') is null)
        then
          raise exception '시작 시간과 종료 시간을 함께 입력해 주세요.';
        end if;
        if nullif(v_schedule->>'start_time', '') is not null
          and (v_schedule->>'end_time')::time <= (v_schedule->>'start_time')::time
        then
          raise exception '종료 시간은 시작 시간보다 늦어야 합니다.';
        end if;
      end loop;
    end if;
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

      if v_enrollment->>'lesson_type' = 'academy' then
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
    raise exception '학원 수업은 담당 선생님과 수강 요일이 필요합니다.';
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
    raise exception '학원 수업은 담당 선생님과 수강 요일이 필요합니다.';
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

create or replace function public.update_student_status(
  p_academy_id uuid,
  p_student_id uuid,
  p_status text,
  -- 호환을 위해 인자는 남기지만 처리 시각은 서버 시각(now())만 쓴다.
  p_changed_at timestamptz default now(),
  p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_changed_at timestamptz := now();
  v_changed_date date := (v_changed_at at time zone 'Asia/Seoul')::date;
  v_previous_status public.student_status;
  v_instrument record;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '원생 상태를 변경할 권한이 없습니다.';
  end if;

  if p_status not in ('enrolled', 'suspended', 'withdrawn') then
    raise exception '지원하지 않는 원생 상태입니다.';
  end if;

  select status
  into v_previous_status
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id
  for update;

  if not found then
    raise exception '원생을 찾지 못했습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_previous_status::text = p_status then
    raise exception '이미 해당 상태입니다. 목록을 새로고침해 주세요.';
  end if;

  update public.students
  set
    status = p_status::public.student_status,
    suspended_at = case
      when p_status = 'suspended' then v_changed_at
      else null
    end,
    withdrawn_at = case
      when p_status = 'withdrawn' then v_changed_at
      else null
    end,
    retention_until = case
      when p_status = 'withdrawn' then v_changed_date + 30
      else null
    end,
    archived_at = null,
    archive_reason = null
  where academy_id = p_academy_id
    and id = p_student_id;

  insert into public.entity_status_transitions (
    academy_id,
    entity_type,
    entity_id,
    from_status,
    to_status,
    reason,
    changed_by,
    changed_at
  )
  values (
    p_academy_id,
    'student',
    p_student_id,
    v_previous_status::text,
    p_status,
    nullif(btrim(coalesce(p_reason, '')), ''),
    (select auth.uid()),
    v_changed_at
  );

  if p_status in ('suspended', 'withdrawn') then
    update public.lesson_series
    set
      active = false,
      effective_until = greatest(
        effective_from,
        least(coalesce(effective_until, v_changed_date - 1), v_changed_date - 1)
      )
    where academy_id = p_academy_id
      and student_id = p_student_id
      and active = true;

    update public.lesson_events event
    set
      status = 'cancelled',
      deletion_reason = case
        when p_status = 'suspended' then '원생 휴원'
        else '원생 퇴원'
      end,
      deleted_at = coalesce(event.deleted_at, v_changed_at)
    where event.academy_id = p_academy_id
      and event.student_id = p_student_id
      and event.origin = 'regular'
      and event.status = 'scheduled'
      and (event.starts_at at time zone 'Asia/Seoul')::date >= v_changed_date
      and not exists (
        select 1
        from public.attendance_records attendance
        where attendance.academy_id = event.academy_id
          and attendance.lesson_event_id = event.id
      );
  end if;

  -- 휴원·퇴원 때 닫은 정기 시리즈를 복귀일부터 다시 만든다. 복귀일 이전에 취소한 일정은 되살리지 않는다.
  if p_status = 'enrolled' then
    for v_instrument in
      select
        instrument.id,
        instrument.teacher_id,
        instrument.instrument_id,
        instrument.instrument_name,
        instrument.weekdays,
        instrument.start_time,
        instrument.end_time
      from public.student_instruments instrument
      where instrument.academy_id = p_academy_id
        and instrument.student_id = p_student_id
        and instrument.active = true
        and instrument.lesson_type = 'academy'
        and instrument.teacher_id is not null
        and not exists (
          select 1
          from public.lesson_series series
          where series.academy_id = instrument.academy_id
            and series.student_instrument_id = instrument.id
            and series.lesson_kind = 'academy'
            and series.active = true
        )
    loop
      if exists (
        select 1
        from public.student_instrument_weekly_schedules schedule
        where schedule.academy_id = p_academy_id
          and schedule.student_instrument_id = v_instrument.id
      ) then
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
        select
          p_academy_id,
          p_student_id,
          v_instrument.id,
          v_instrument.teacher_id,
          'academy',
          v_instrument.instrument_id,
          v_instrument.instrument_name,
          array[schedule.weekday],
          schedule.start_time,
          schedule.end_time,
          v_changed_date,
          true
        from public.student_instrument_weekly_schedules schedule
        where schedule.academy_id = p_academy_id
          and schedule.student_instrument_id = v_instrument.id;
      elsif cardinality(coalesce(v_instrument.weekdays, '{}')) > 0
        and (v_instrument.start_time is null) = (v_instrument.end_time is null)
      then
        -- 요일별 시간 행이 없는 이전 수강 정보는 대표 시간 하나로 시리즈를 만든다.
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
          v_instrument.id,
          v_instrument.teacher_id,
          'academy',
          v_instrument.instrument_id,
          v_instrument.instrument_name,
          v_instrument.weekdays,
          v_instrument.start_time,
          v_instrument.end_time,
          v_changed_date,
          true
        );
      end if;
    end loop;

    perform public.ensure_monthly_academy_lesson_events(
      p_academy_id,
      to_char(v_changed_date, 'YYYY-MM')
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';

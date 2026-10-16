-- 원생 휴원·퇴원·수정 보정 (2026-10-16 원생·선생님·거래처 명세 검토)
--
-- 1. update_student_status
--    - 재원 복귀 시 활성 수강 정보의 정기 레슨 시리즈를 다시 만들고 그 달 일정을 생성한다.
--    - 같은 상태로의 재처리를 거부하고, 처리 시각은 클라이언트가 아니라 서버 시각을 쓴다.
--    - 전환할 때 반대 상태의 처리 시각을 정리한다.
-- 2. update_student_profile_from_date
--    - 요일별 시간(p_weekly_schedules)을 student_instrument_weekly_schedules에 저장하고
--      시리즈를 요일 단위로 다시 만든다(등록과 같은 구조).
--    - 배정(student_teacher_assignments)은 수정 중인 악기 것만 바꾼다.
--    - 학원 수업의 선생님·시간과 최종 수강료를 서버에서도 검증한다.
-- 3. archive_expired_people은 pg_cron(postgres)만 실행한다.

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
          and schedule.start_time is not null
          and schedule.end_time is not null
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
          and schedule.student_instrument_id = v_instrument.id
          and schedule.start_time is not null
          and schedule.end_time is not null;
      elsif cardinality(coalesce(v_instrument.weekdays, '{}')) > 0
        and v_instrument.start_time is not null
        and v_instrument.end_time is not null
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

-- 예전 4인자 오버로드가 남아 있으면 새 규칙(이력, 서버 시각, 일정 복구)을 우회할 수 있어 지운다.
-- 앱은 항상 5인자 함수를 이름 있는 인자로 호출한다.
drop function if exists public.update_student_status(uuid, uuid, text, timestamptz);
drop function if exists public.update_teacher_status(uuid, uuid, text, timestamptz);

revoke all on function public.update_student_status(uuid, uuid, text, timestamptz, text) from public, anon;
grant execute on function public.update_student_status(uuid, uuid, text, timestamptz, text) to authenticated;

drop function if exists public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date
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
  p_weekly_schedules jsonb default null
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
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb
) from public, anon;
grant execute on function public.update_student_profile_from_date(
  uuid, uuid, text, uuid, uuid, text, text, text, text[], text, text, text, integer, integer, integer, date, jsonb
) to authenticated;

-- 만료 보관 처리는 pg_cron(postgres)이 실행한다. 앱 사용자가 직접 호출할 수 없게 한다.
revoke all on function public.archive_expired_people(timestamptz) from public, anon, authenticated;
grant execute on function public.archive_expired_people(timestamptz) to service_role;

notify pgrst, 'reload schema';

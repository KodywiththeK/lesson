-- 오늘 할 일(2026-11-19)
-- 1) 원천 데이터: 미처리 결석, 입금 전 수강료·회차권·교재, 오늘 레슨 변경, 최근 상담, 미입고 발주를 한 번에 돌려준다.
--    할 일 문구·정렬·역할 필터는 화면 밖 도메인(`src/domain/daily-tasks.ts`)이 정한다.
--    금액은 원장에게만 채우고 데스크·선생님에게는 null로 보낸다(브라우저에 금액이 가지 않게).
--    선생님은 담당 학생의 결석·레슨 변경만 받고 수납·상담·교재는 빈 목록이다.
-- 2) 공유 상태: '답변 대기'·'완료'를 학원 단위로 저장한다. 테이블은 RPC로만 읽고 쓰며, 바꾸는 것은 원장·데스크만 한다.
-- CLI v3는 파일을 트랜잭션으로 감싸지 않아, 중간에 실패하면 이 파일 전체가 되돌아가도록 직접 감싼다.

begin;

create table public.daily_task_states (
  academy_id uuid not null references public.academies (id) on delete cascade,
  task_key text not null check (length(task_key) between 1 and 200),
  state text not null check (state in ('waiting_reply', 'done')),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (academy_id, task_key)
);

alter table public.daily_task_states enable row level security;
revoke all on public.daily_task_states from anon, authenticated;

-- 레슨 변경 감사 기록 한 건을 풀어 쓴다. 오늘 할 일(원천)과 즉시 알림(트리거)이 같이 쓴다.
-- 학원 이동은 원래 일정·옮긴 일정의 시각을, 개인레슨 수정은 기록된 이전·새 시각·선생님을 쓴다.
-- teacher_ids는 이 레슨에 닿는 선생님(이전·새 담당) 전부다. entity_table = 'lesson_events'인 기록에만 부른다.
create or replace function private.lesson_change_facts(
  p_academy_id uuid,
  p_entity_id text,
  p_event_type text,
  p_metadata jsonb
)
returns table (
  student_id uuid,
  student_name text,
  lesson_kind text,
  change_type text,
  teacher_ids uuid[],
  previous_starts_at timestamptz,
  next_starts_at timestamptz,
  previous_teacher_name text,
  next_teacher_name text
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select
    source_event.student_id,
    student.name,
    case when source_event.lesson_kind = 'private' then 'private' else 'academy' end,
    case when p_event_type = 'lesson_event.deleted' then 'deleted' else 'rescheduled' end,
    array(
      select distinct teacher_id
      from unnest(array[
        (p_metadata->>'old_teacher_id')::uuid,
        (p_metadata->>'new_teacher_id')::uuid,
        source_event.teacher_id
      ]) as teacher_id
      where teacher_id is not null
    ),
    coalesce((p_metadata->>'old_starts_at')::timestamptz, (p_metadata->>'starts_at')::timestamptz, source_event.starts_at),
    case
      when p_event_type = 'lesson_event.deleted' then null
      else coalesce((p_metadata->>'new_starts_at')::timestamptz, moved_event.starts_at)
    end,
    old_teacher.name,
    new_teacher.name
  from public.lesson_events source_event
  join public.students student
    on student.academy_id = source_event.academy_id and student.id = source_event.student_id
  left join public.lesson_events moved_event
    on moved_event.academy_id = source_event.academy_id
   and moved_event.id = (p_metadata->>'moved_lesson_event_id')::uuid
  left join public.teachers old_teacher
    on old_teacher.academy_id = source_event.academy_id and old_teacher.id = (p_metadata->>'old_teacher_id')::uuid
  left join public.teachers new_teacher
    on new_teacher.academy_id = source_event.academy_id and new_teacher.id = (p_metadata->>'new_teacher_id')::uuid
  where source_event.academy_id = p_academy_id
    and source_event.id = p_entity_id::uuid;
$$;

revoke all on function private.lesson_change_facts(uuid, text, text, jsonb) from public, anon, authenticated;

-- 내부 원천 조회. p_scope: 'owner'(금액 포함) | 'desk'(금액 없음) | 'teacher'(담당 학생의 결석·레슨 변경만).
create or replace function private.daily_task_source(
  p_academy_id uuid,
  p_date date,
  p_scope text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_day_start timestamptz := p_date::timestamp at time zone 'Asia/Seoul';
  v_day_end timestamptz := (p_date + 1)::timestamp at time zone 'Asia/Seoul';
  v_with_amounts boolean := p_scope = 'owner';
  v_is_teacher boolean := p_scope = 'teacher';
  v_absences jsonb;
  v_tuitions jsonb := '[]'::jsonb;
  v_tickets jsonb := '[]'::jsonb;
  v_releases jsonb := '[]'::jsonb;
  v_changes jsonb;
  v_consultations jsonb := '[]'::jsonb;
  v_orders jsonb := '[]'::jsonb;
begin
  if p_scope not in ('owner', 'desk', 'teacher') then
    raise exception '할 일 범위를 확인해 주세요.';
  end if;

  -- 결석인데 보강·패스를 정하지 않은 학원 레슨(최근 60일, 오늘까지, 재원생만).
  select coalesce(jsonb_agg(jsonb_build_object(
      'attendanceId', record.id,
      'lessonDate', (event.starts_at at time zone 'Asia/Seoul')::date,
      'studentId', student.id,
      'studentName', student.name,
      'teacherIds', case when event.teacher_id is null then '[]'::jsonb else jsonb_build_array(event.teacher_id) end,
      'instrumentName', event.instrument_name
    ) order by event.starts_at, student.name), '[]'::jsonb)
  into v_absences
  from public.attendance_records record
  join public.lesson_events event
    on event.academy_id = record.academy_id and event.id = record.lesson_event_id
  join public.students student
    on student.academy_id = record.academy_id and student.id = record.student_id
  where record.academy_id = p_academy_id
    and record.status = 'absent'
    and event.lesson_kind in ('academy', 'makeup')
    and event.starts_at >= v_day_start - interval '60 days'
    and event.starts_at < v_day_end
    and student.status = 'enrolled'
    and not exists (
      select 1 from public.absence_resolutions resolution
      where resolution.academy_id = record.academy_id
        and resolution.attendance_record_id = record.id
    )
    and (not v_is_teacher or private.teacher_can_access_student(record.academy_id, record.student_id));

  -- 오늘 레슨의 이동·삭제·선생님 변경(최근 14일 안에 바뀐 것).
  select coalesce(jsonb_agg(jsonb_build_object(
      'auditEventId', audit.id,
      'changeType', facts.change_type,
      'lessonKind', facts.lesson_kind,
      'studentName', facts.student_name,
      'teacherIds', to_jsonb(facts.teacher_ids),
      'previousStartsAt', facts.previous_starts_at,
      'nextStartsAt', facts.next_starts_at,
      'previousTeacherName', facts.previous_teacher_name,
      'nextTeacherName', facts.next_teacher_name
    ) order by facts.previous_starts_at), '[]'::jsonb)
  into v_changes
  from public.audit_events audit
  cross join lateral private.lesson_change_facts(audit.academy_id, audit.entity_id, audit.event_type, audit.metadata) facts
  where audit.academy_id = p_academy_id
    and audit.entity_table = 'lesson_events'
    and audit.event_type in ('lesson_event.rescheduled', 'lesson_event.deleted')
    and audit.occurred_at >= v_day_start - interval '14 days'
    and (
      (facts.previous_starts_at >= v_day_start and facts.previous_starts_at < v_day_end)
      or (facts.next_starts_at >= v_day_start and facts.next_starts_at < v_day_end)
    )
    and (not v_is_teacher or private.teacher_can_access_student(p_academy_id, facts.student_id));

  if not v_is_teacher then
    -- 입금 전 수강료(미입금·미납). 납입일 기준은 도메인(`daily-tasks.ts`)이 정한다.
    select coalesce(jsonb_agg(jsonb_build_object(
        'snapshotId', snapshot.id,
        'studentName', snapshot.student_name,
        'instrumentName', snapshot.instrument_name,
        'month', snapshot.month,
        'dueOn', snapshot.due_on,
        'status', snapshot.status,
        'amount', case when v_with_amounts then snapshot.amount end
      ) order by snapshot.due_on, snapshot.student_name), '[]'::jsonb)
    into v_tuitions
    from public.fixed_income_snapshots snapshot
    where snapshot.academy_id = p_academy_id
      and snapshot.status in ('unpaid', 'overdue');

    -- 쓸 수 있는 회차권(환불·취소 제외, 잔여 있음, 만료 전). 입금 확인·재등록 기준은 도메인이 정한다.
    select coalesce(jsonb_agg(jsonb_build_object(
        'grantId', grant_row.id,
        'studentName', student.name,
        'instrumentName', grant_row.instrument_name,
        'paymentStatus', grant_row.payment_status,
        'dueOn', grant_row.due_on,
        'remainingCount', grant_row.remaining_count,
        'validUntil', grant_row.valid_until,
        'amount', case when v_with_amounts then grant_row.paid_amount end
      ) order by grant_row.valid_until, student.name), '[]'::jsonb)
    into v_tickets
    from public.lesson_ticket_grants grant_row
    join public.students student
      on student.academy_id = grant_row.academy_id and student.id = grant_row.student_id
    where grant_row.academy_id = p_academy_id
      and grant_row.payment_status not in ('refunded', 'cancelled')
      and grant_row.remaining_count > 0
      and grant_row.valid_until >= p_date
      and student.status = 'enrolled';

    select coalesce(jsonb_agg(jsonb_build_object(
        'releaseId', release.id,
        'studentName', release.student_name,
        'bookTitle', release.book_title,
        'shippedAt', release.shipped_at,
        'amount', case when v_with_amounts then release.price end
      ) order by release.shipped_at, release.student_name), '[]'::jsonb)
    into v_releases
    from public.book_releases release
    where release.academy_id = p_academy_id
      and release.status = 'payment-pending';

    select coalesce(jsonb_agg(jsonb_build_object(
        'consultationId', consultation.id,
        'name', consultation.name,
        'createdAt', consultation.created_at
      ) order by consultation.created_at desc), '[]'::jsonb)
    into v_consultations
    from public.consultations consultation
    where consultation.academy_id = p_academy_id
      -- 넓게 거르고 연락 기간(7일)은 도메인(`CONSULTATION_TASK_DAYS`)이 정한다.
      and consultation.created_at >= v_day_start - interval '30 days'
      and consultation.created_at < v_day_end;

    select coalesce(jsonb_agg(jsonb_build_object(
        'orderId', book_order.id,
        'vendorName', book_order.vendor_name,
        'orderedOn', book_order.ordered_on
      ) order by book_order.ordered_on), '[]'::jsonb)
    into v_orders
    from public.book_orders book_order
    where book_order.academy_id = p_academy_id
      and book_order.status = 'ordered';
  end if;

  return jsonb_build_object(
    'unresolvedAbsences', v_absences,
    'tuitions', v_tuitions,
    'lessonTickets', v_tickets,
    'unpaidBookReleases', v_releases,
    'lessonChanges', v_changes,
    'consultations', v_consultations,
    'pendingBookOrders', v_orders
  );
end;
$$;

revoke all on function private.daily_task_source(uuid, date, text) from public, anon, authenticated;

-- 화면용: 로그인한 사람의 역할로 범위를 정한다.
create or replace function public.get_daily_task_source(
  p_academy_id uuid,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_date is null then
    raise exception '날짜를 확인해 주세요.';
  end if;

  if private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    return private.daily_task_source(p_academy_id, p_date, 'owner');
  end if;

  if private.has_academy_role(p_academy_id, array['desk'::public.academy_member_role]) then
    return private.daily_task_source(p_academy_id, p_date, 'desk');
  end if;

  if private.has_academy_role(p_academy_id, array['teacher'::public.academy_member_role]) then
    return private.daily_task_source(p_academy_id, p_date, 'teacher');
  end if;

  raise exception '이 작업을 할 권한이 없습니다. 오늘 할 일은 학원 구성원만 볼 수 있습니다.';
end;
$$;

revoke all on function public.get_daily_task_source(uuid, date) from public, anon;
grant execute on function public.get_daily_task_source(uuid, date) to authenticated;

-- 서버(아침 메일)용: service_role만 부른다. 원장·데스크 범위만 받는다(데스크는 금액 없음).
-- 선생님 범위는 로그인 계정으로 담당 학생을 판단해 여기서는 쓰지 않는다(선생님 푸시는 원장 범위에서 도메인이 거른다).
create or replace function public.get_daily_task_source_for_service(
  p_academy_id uuid,
  p_date date,
  p_scope text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if p_scope not in ('owner', 'desk') then
    raise exception '할 일 범위를 확인해 주세요.';
  end if;

  return private.daily_task_source(p_academy_id, p_date, p_scope);
end;
$$;

revoke all on function public.get_daily_task_source_for_service(uuid, date, text) from public, anon, authenticated;
grant execute on function public.get_daily_task_source_for_service(uuid, date, text) to service_role;

create or replace function public.list_daily_task_states(p_academy_id uuid)
returns table (
  task_key text,
  state text,
  updated_by_name text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '이 작업을 할 권한이 없습니다. 오늘 할 일은 학원 구성원만 볼 수 있습니다.';
  end if;

  return query
  select task_state.task_key, task_state.state, profile.display_name, task_state.updated_at
  from public.daily_task_states task_state
  left join public.profiles profile on profile.id = task_state.updated_by
  where task_state.academy_id = p_academy_id;
end;
$$;

revoke all on function public.list_daily_task_states(uuid) from public, anon;
grant execute on function public.list_daily_task_states(uuid) to authenticated;

-- 상태 바꾸기. 학부모 연락은 원장·데스크가 맡아 선생님은 보기만 한다(사용자 결정 2026-11-26).
-- p_state가 null이면 상태를 지워 '할 일'로 되돌린다.
create or replace function public.set_daily_task_state(
  p_academy_id uuid,
  p_task_key text,
  p_state text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null
    or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '이 작업을 할 권한이 없습니다. 오늘 할 일 상태는 원장·데스크만 바꿀 수 있습니다.';
  end if;

  if p_task_key is null or length(btrim(p_task_key)) = 0 then
    raise exception '할 일을 확인해 주세요.';
  end if;

  if p_state is null then
    delete from public.daily_task_states
    where academy_id = p_academy_id and task_key = p_task_key;
    return;
  end if;

  if p_state not in ('waiting_reply', 'done') then
    raise exception '할 일 상태를 확인해 주세요.';
  end if;

  insert into public.daily_task_states (academy_id, task_key, state, updated_by, updated_at)
  values (p_academy_id, p_task_key, p_state, (select auth.uid()), now())
  on conflict (academy_id, task_key)
  do update set state = excluded.state, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.set_daily_task_state(uuid, text, text) from public, anon;
grant execute on function public.set_daily_task_state(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;

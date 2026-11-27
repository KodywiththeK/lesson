-- 오늘 할 일 모달 처리·연락처(2026-11-27)
-- 대시보드 칸을 누르면 뜨는 모달에서 바로 처리(입금·입고·보강·재등록)하고 학부모·상담 신청자에게 전화·문자할 수 있게
-- 할 일 원천(`private.daily_task_source`)에 처리에 필요한 id·시간과 대표 연락처를 더한다.
-- 연락처·상담 전화번호는 원장·데스크 범위에서만 채우고 선생님 범위는 null이다(금액과 같은 방식, 거르는 곳은 서버 한 곳).
-- 대표 연락처는 학생 연락처 중 가장 먼저 등록한 번호다.
-- CLI v3는 파일을 트랜잭션으로 감싸지 않아, 중간에 실패하면 이 파일 전체가 되돌아가도록 직접 감싼다.

begin;

create or replace function private.daily_task_student_contact(p_academy_id uuid, p_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object('relationship', contact.relationship, 'phone', contact.phone)
  from public.student_contacts contact
  where contact.academy_id = p_academy_id
    and contact.student_id = p_student_id
  order by contact.created_at, contact.id
  limit 1;
$$;

revoke all on function private.daily_task_student_contact(uuid, uuid) from public, anon, authenticated;

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
  -- 학생 연락처·상담 전화번호는 연락을 맡는 원장·데스크 범위에서만 채운다.
  v_with_contacts boolean := p_scope in ('owner', 'desk');
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
      'lessonEventId', event.id,
      'lessonDate', (event.starts_at at time zone 'Asia/Seoul')::date,
      'startsAt', event.starts_at,
      'endsAt', event.ends_at,
      'studentId', student.id,
      'studentName', student.name,
      'teacherIds', case when event.teacher_id is null then '[]'::jsonb else jsonb_build_array(event.teacher_id) end,
      'teacherName', teacher.name,
      'instrumentId', event.instrument_id,
      'instrumentName', event.instrument_name,
      'origin', event.origin,
      'absenceReason', record.absence_reason,
      -- 보강 추천에서 뺄 정규 등원 요일(결석일 앞뒤 4주의 정규 일정).
      'regularWeekdays', (
        select coalesce(jsonb_agg(distinct extract(dow from (regular.starts_at at time zone 'Asia/Seoul'))::int), '[]'::jsonb)
        from public.lesson_events regular
        where regular.academy_id = event.academy_id
          and regular.student_id = event.student_id
          and regular.lesson_kind = 'academy'
          and regular.status <> 'deleted'
          and (regular.origin is null or regular.origin = 'regular')
          and regular.starts_at >= event.starts_at - interval '28 days'
          and regular.starts_at < event.starts_at + interval '28 days'
      ),
      'contact', case when v_with_contacts then private.daily_task_student_contact(record.academy_id, student.id) end
    ) order by event.starts_at, student.name), '[]'::jsonb)
  into v_absences
  from public.attendance_records record
  join public.lesson_events event
    on event.academy_id = record.academy_id and event.id = record.lesson_event_id
  join public.students student
    on student.academy_id = record.academy_id and student.id = record.student_id
  left join public.teachers teacher
    on teacher.academy_id = event.academy_id and teacher.id = event.teacher_id
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
      'nextTeacherName', facts.next_teacher_name,
      'contact', case when v_with_contacts then private.daily_task_student_contact(p_academy_id, facts.student_id) end
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
        'amount', case when v_with_amounts then snapshot.amount end,
        'contact', case when v_with_contacts then private.daily_task_student_contact(p_academy_id, snapshot.student_id) end
      ) order by snapshot.due_on, snapshot.student_name), '[]'::jsonb)
    into v_tuitions
    from public.fixed_income_snapshots snapshot
    where snapshot.academy_id = p_academy_id
      and snapshot.status in ('unpaid', 'overdue');

    -- 쓸 수 있는 회차권(환불·취소 제외, 잔여 있음, 만료 전). 입금 확인·재등록 기준은 도메인이 정한다.
    select coalesce(jsonb_agg(jsonb_build_object(
        'grantId', grant_row.id,
        'studentId', student.id,
        'instrumentId', grant_row.instrument_id,
        'studentName', student.name,
        'instrumentName', grant_row.instrument_name,
        'paymentStatus', grant_row.payment_status,
        'dueOn', grant_row.due_on,
        'remainingCount', grant_row.remaining_count,
        'validUntil', grant_row.valid_until,
        'amount', case when v_with_amounts then grant_row.paid_amount end,
        'contact', case when v_with_contacts then private.daily_task_student_contact(p_academy_id, student.id) end
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
        'createdAt', consultation.created_at,
        'phone', case when v_with_contacts then consultation.phone end,
        'instrumentNames', to_jsonb(consultation.instrument_names)
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

notify pgrst, 'reload schema';

commit;

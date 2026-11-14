-- 급여 개인레슨 단가에서 취소된 회차권을 뺀다(2026-11-14 결정).
-- 취소는 한 번도 쓰지 않은 회차권만 가능하다. 환불 회차권은 환불 전에 수업한 회차를 원래 단가로 지급하도록 남기고,
-- 입금 전(등록·입금대기) 회차권도 등록 금액으로 단가에 넣는다. 화면 계산(toPrivateLessonFeeSources)과 같은 기준이다.
-- 함수 본문은 20261030020937과 같고 회차권 상태 조건 한 줄만 더했다.

create or replace function private.calculate_verified_payroll_breakdown(
  p_academy_id uuid, p_teacher_id uuid, p_month text, p_share integer
) returns table(expected_base integer, student_breakdown jsonb)
language sql volatile set search_path = public, private, pg_temp as $$
  with month_events as materialized (
    select event.id, event.student_id, event.teacher_id, event.instrument_name, event.lesson_kind,
      event.origin, event.starts_at,
      coalesce(nullif(btrim(student.name), ''), '이름 없음') as student_name,
      coalesce(attendance.status, 'scheduled') as attendance_status,
      coalesce(snapshot.amount, enrollment.final_monthly_fee, 0) as academy_fee,
      registration.original_paid_amount::numeric / nullif(registration.granted_count, 0) as private_fee
    from public.lesson_events event
    left join public.students student on student.academy_id = event.academy_id and student.id = event.student_id
    left join public.student_instruments enrollment on enrollment.academy_id = event.academy_id and enrollment.id = event.student_instrument_id
    left join public.attendance_records attendance on attendance.academy_id = event.academy_id
      and attendance.lesson_event_id = event.id and attendance.student_id = event.student_id
    left join lateral (
      select amount from public.fixed_income_snapshots snapshot_row
      where snapshot_row.academy_id = event.academy_id and snapshot_row.month = p_month
        and snapshot_row.student_id = event.student_id and snapshot_row.instrument_name = event.instrument_name
      order by snapshot_row.id desc limit 1
    ) snapshot on event.lesson_kind <> 'private'
    left join lateral (
      select registration_row.original_paid_amount, registration_row.granted_count
      from public.lesson_ticket_registrations registration_row
      join public.lesson_ticket_grants grant_row on grant_row.academy_id = registration_row.academy_id
        and grant_row.id = registration_row.lesson_ticket_grant_id
      where registration_row.academy_id = event.academy_id and grant_row.student_id = event.student_id
        and grant_row.instrument_name = event.instrument_name and registration_row.granted_count > 0
        and registration_row.original_paid_amount > 0
        and grant_row.payment_status <> 'cancelled'
        and registration_row.registered_at <= (event.starts_at at time zone 'Asia/Seoul')::date
        and registration_row.valid_until >= (event.starts_at at time zone 'Asia/Seoul')::date
      order by registration_row.registered_at desc, registration_row.id asc limit 1
    ) registration on event.lesson_kind = 'private'
    where event.academy_id = p_academy_id and event.status = 'scheduled'
      and event.starts_at >= (p_month || '-01')::date::timestamp at time zone 'Asia/Seoul'
      and event.starts_at < ((p_month || '-01')::date + interval '1 month') at time zone 'Asia/Seoul'
  ), denominators as (
    select student_id, instrument_name,
      greatest(count(*) filter (where lesson_kind = 'academy' and coalesce(origin, 'regular') in ('regular', 'rescheduled')),
        count(*) filter (where lesson_kind <> 'private' and attendance_status = 'present'), 1) as divisor
    from month_events where lesson_kind <> 'private' group by student_id, instrument_name
  ), teacher_lessons as (
    select event.*, case when event.lesson_kind = 'private' then event.private_fee
      else event.academy_fee::numeric / denominator.divisor end as lesson_revenue
    from month_events event left join denominators denominator using (student_id, instrument_name)
    where event.teacher_id = p_teacher_id and event.attendance_status = 'present'
  ), groups as (
    select student_id, instrument_name, min(student_name) as student_name, count(*)::integer as lesson_count,
      array_agg(to_char(starts_at at time zone 'Asia/Seoul', 'YYYY-MM-DD') order by starts_at, id) as dates,
      sum(coalesce(lesson_revenue, 0) * p_share / 100) as raw_amount,
      bool_or((lesson_kind = 'private' and private_fee is null) or (lesson_kind <> 'private' and academy_fee <= 0)) as missing_fee
    from teacher_lessons group by student_id, instrument_name
  ), totals as (
    select floor(round(coalesce(sum(raw_amount), 0), 6))::integer as base,
      coalesce(sum(floor(raw_amount)), 0)::integer as floors,
      coalesce(bool_or(missing_fee), false) as missing_fee from groups
  ), ranked as (
    select groups.*, row_number() over (order by raw_amount - floor(raw_amount) desc,
      student_id::text collate "C", instrument_name collate "C") as rank from groups
  )
  select totals.base,
    case when totals.missing_fee then null else coalesce((
      select jsonb_agg(jsonb_build_object('studentId', ranked.student_id, 'studentName', ranked.student_name,
        'instrumentName', ranked.instrument_name, 'count', ranked.lesson_count, 'dates', to_jsonb(ranked.dates),
        'amount', floor(ranked.raw_amount)::integer + case when ranked.rank <= totals.base - totals.floors then 1 else 0 end)
        order by ranked.student_id, ranked.instrument_name collate "C") from ranked
    ), '[]'::jsonb) end
  from totals;
$$;
revoke all on function private.calculate_verified_payroll_breakdown(uuid, uuid, text, integer) from public, anon, authenticated;

-- 과거 확정 건은 상세를 추측하지 않는다. 재지급 시에는 새로운 계산만 저장한다.
alter table public.salary_settlements add column student_breakdown jsonb;
alter table public.salary_settlements add constraint salary_settlements_student_breakdown_array
  check (student_breakdown is null or jsonb_typeof(student_breakdown) = 'array');

-- 급여가 읽는 원천 변경과 휴일 일정 생성은 학원 단위 잠금을 공유한다.
-- 행 잠금과 별도로 테이블 전체를 잠그지 않는다.
create function private.lock_payroll_source_academy() returns trigger
language plpgsql set search_path = public, private, pg_temp as $$
declare v_academy uuid;
begin
  if tg_op = 'UPDATE' and old.academy_id is distinct from new.academy_id then
    raise exception '학원 범위를 변경할 수 없습니다.';
  end if;
  v_academy := case when tg_op = 'DELETE' then old.academy_id else new.academy_id end;
  if not pg_try_advisory_xact_lock(hashtextextended(v_academy::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.lock_payroll_source_academy() from public, anon, authenticated;

create trigger payroll_source_academy_lock before insert or update or delete on public.lesson_events
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.attendance_records
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.fixed_income_snapshots
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.lesson_ticket_grants
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.lesson_ticket_registrations
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.student_instruments
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.students
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.teachers
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.teacher_salary_settings
  for each row execute function private.lock_payroll_source_academy();
create trigger payroll_source_academy_lock before insert or update or delete on public.teacher_work_schedules
  for each row execute function private.lock_payroll_source_academy();

-- 화면과 동일한 기준: 월 수강료 스냅샷 우선, 전체 선생님의 정규 예정/등원 수업 중 큰 수를 분모로 사용,
-- 개인레슨은 유효한 유료 등록 중 최신 등록일 우선. 그룹별 소수점 차이는 총액에 맞춰 배분한다.
create function private.calculate_verified_payroll_breakdown(
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

alter function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) set schema private;
alter function private.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date)
  rename to mark_salary_settlement_paid_without_breakdown;
revoke all on function private.mark_salary_settlement_paid_without_breakdown(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from public, anon, authenticated;

create function public.mark_salary_settlement_paid(
  p_academy_id uuid, p_teacher_id uuid, p_teacher_name text, p_month text, p_pay_type text,
  p_base_pay integer, p_withholding_tax integer, p_net_pay integer, p_lesson_event_ids uuid[], p_paid_at date
) returns public.salary_settlements language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_result public.salary_settlements%rowtype;
  v_share integer;
  v_expected integer;
  v_breakdown jsonb;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role]) then
    raise exception '급여 지급 확정 권한이 없습니다.';
  end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  if not public.academy_holiday_month_ready(p_academy_id, p_month) then
    raise exception '공휴일 일정을 준비한 뒤 지급을 확정해 주세요.';
  end if;
  perform public.ensure_monthly_academy_lesson_events(p_academy_id, p_month);
  if p_pay_type = 'ratio' then
    select ratio_teacher_share into v_share from public.teacher_salary_settings
      where academy_id = p_academy_id and teacher_id = p_teacher_id and pay_type = 'ratio' and active;
    if v_share is null then raise exception '급여 설정의 선생님 비율을 확인해 주세요.'; end if;
    select expected_base, student_breakdown into v_expected, v_breakdown
      from private.calculate_verified_payroll_breakdown(p_academy_id, p_teacher_id, p_month, v_share);
    if v_breakdown is null then
      raise exception '수업별 수강료를 확인한 뒤 급여를 확정해 주세요.';
    end if;
    if p_base_pay is distinct from v_expected then
      raise exception '급여 금액이 수업별 계산과 다릅니다. 화면을 새로고침한 뒤 다시 시도해 주세요.';
    end if;
  end if;
  select * into v_result from private.mark_salary_settlement_paid_without_breakdown(
    p_academy_id, p_teacher_id, p_teacher_name, p_month, p_pay_type,
    p_base_pay, p_withholding_tax, p_net_pay, p_lesson_event_ids, p_paid_at);
  update public.salary_settlements set student_breakdown = v_breakdown where id = v_result.id and academy_id = p_academy_id
    returning * into v_result;
  return v_result;
end;
$$;
revoke all on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) from public, anon;
grant execute on function public.mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date) to authenticated;
revoke insert, update, delete on public.salary_settlements from authenticated;
notify pgrst, 'reload schema';

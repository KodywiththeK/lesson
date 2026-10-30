-- 공휴일 자료는 서버 전용 자격 증명으로만 기록한다. 빈 달도 검증 완료 상태로 보관한다.
create table private.korean_holiday_months (
  month text primary key check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  holidays jsonb not null check (jsonb_typeof(holidays) = 'array'),
  verified_at timestamptz not null default now()
);
revoke all on private.korean_holiday_months from public, anon, authenticated;

create table public.academy_holiday_policies (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  exclude_public_holidays boolean not null default true,
  exclude_academy_closures boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.academy_holiday_policies enable row level security;
revoke all on public.academy_holiday_policies from public, anon, authenticated;
grant select on public.academy_holiday_policies to authenticated;
create policy academy_holiday_policy_read on public.academy_holiday_policies for select to authenticated
  using (private.is_active_academy_member(academy_id));

create function public.save_academy_holiday_policy(p_academy_id uuid, p_exclude_public_holidays boolean, p_exclude_academy_closures boolean)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_month text;
begin
  if (select auth.uid()) is null or not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception '쉬는 날 설정 권한이 없습니다.';
  end if;
  if p_exclude_public_holidays is null or p_exclude_academy_closures is null then raise exception '쉬는 날 설정을 확인해 주세요.'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  insert into public.academy_holiday_policies(academy_id, exclude_public_holidays, exclude_academy_closures)
    values (p_academy_id, p_exclude_public_holidays, p_exclude_academy_closures)
    on conflict (academy_id) do update set exclude_public_holidays = excluded.exclude_public_holidays,
      exclude_academy_closures = excluded.exclude_academy_closures, updated_at = now();
  insert into public.audit_events(academy_id, actor_id, event_type, entity_table, entity_id)
    values (p_academy_id, (select auth.uid()), 'academy_holiday_policy.updated', 'academy_holiday_policies', p_academy_id::text);
  for v_month in select distinct to_char(starts_at at time zone 'Asia/Seoul', 'YYYY-MM')
    from public.lesson_events where academy_id = p_academy_id and lesson_kind = 'academy' and generated_from_enrollment
    order by 1
  loop
    perform public.ensure_monthly_academy_lesson_events(p_academy_id, v_month);
  end loop;
end;
$$;
revoke all on function public.save_academy_holiday_policy(uuid, boolean, boolean) from public, anon;
grant execute on function public.save_academy_holiday_policy(uuid, boolean, boolean) to authenticated;

create function public.store_verified_korean_holidays(p_month text, p_holidays jsonb)
returns void language plpgsql security definer set search_path = public, private, pg_temp as $$
begin
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or jsonb_typeof(p_holidays) is distinct from 'array' then
    raise exception '공휴일 자료를 확인해 주세요.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_holidays) h where not coalesce(h->>'date' ~ ('^' || p_month || '-[0-9]{2}$'), false) or nullif(btrim(h->>'name'), '') is null) then
    raise exception '공휴일 자료를 확인해 주세요.';
  end if;
  insert into private.korean_holiday_months(month, holidays) values (p_month, p_holidays)
    on conflict (month) do update set holidays = excluded.holidays, verified_at = now();
end;
$$;
revoke all on function public.store_verified_korean_holidays(text, jsonb) from public, anon, authenticated;
grant execute on function public.store_verified_korean_holidays(text, jsonb) to service_role;

create function public.academy_holiday_month_ready(p_academy_id uuid, p_month text)
returns boolean language plpgsql security definer set search_path = public, private, pg_temp as $$
declare v_exclude boolean;
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '학원 쉬는 날을 확인할 권한이 없습니다.';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception '월 형식은 YYYY-MM이어야 합니다.'; end if;
  select exclude_public_holidays into v_exclude from public.academy_holiday_policies where academy_id = p_academy_id;
  return not coalesce(v_exclude, true) or exists (select 1 from private.korean_holiday_months where month = p_month and verified_at > now() - interval '24 hours');
end;
$$;
revoke all on function public.academy_holiday_month_ready(uuid, text) from public, anon;
grant execute on function public.academy_holiday_month_ready(uuid, text) to authenticated;

alter table public.lesson_events add column auto_excluded_for_closure boolean not null default false;

-- 출결 저장과 자동 제외가 같은 행 잠금을 공유해, 확인한 수업이 동시에 숨겨지지 않게 한다.
create function private.guard_automatic_closure_attendance() returns trigger language plpgsql
security definer set search_path = public, private, pg_temp as $$
declare v_excluded boolean;
begin
  if not pg_try_advisory_xact_lock(hashtextextended(new.academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  select auto_excluded_for_closure into v_excluded from public.lesson_events
    where academy_id = new.academy_id and id = new.lesson_event_id for update;
  if v_excluded and new.status <> 'pending' then raise exception '쉬는 날에 자동 제외된 일정입니다. 일정을 새로 확인해 주세요.'; end if;
  return new;
end;
$$;
create trigger attendance_automatic_closure_guard before insert or update on public.attendance_records
  for each row execute function private.guard_automatic_closure_attendance();

alter function public.ensure_monthly_academy_lesson_events(uuid, text) set schema private;
alter function private.ensure_monthly_academy_lesson_events(uuid, text) rename to ensure_monthly_academy_lesson_events_without_holidays;
revoke all on function private.ensure_monthly_academy_lesson_events_without_holidays(uuid, text) from public, anon, authenticated;

create function public.ensure_monthly_academy_lesson_events(p_academy_id uuid, p_month text)
returns integer language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_start date; v_end date; v_policy public.academy_holiday_policies%rowtype;
  v_holidays jsonb; v_count integer; v_event record; v_day date; v_closed boolean; v_public_unknown boolean;
begin
  if (select auth.uid()) is null or not private.is_active_academy_member(p_academy_id) then
    raise exception '학원 정기 일정을 생성할 권한이 없습니다.';
  end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception '월 형식은 YYYY-MM이어야 합니다.'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended(p_academy_id::text, 5320)) then
    raise exception '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.';
  end if;
  select * into v_policy from public.academy_holiday_policies where academy_id = p_academy_id;
  v_policy.exclude_public_holidays := coalesce(v_policy.exclude_public_holidays, true);
  v_policy.exclude_academy_closures := coalesce(v_policy.exclude_academy_closures, true);
  select holidays into v_holidays from private.korean_holiday_months where month = p_month and verified_at > now() - interval '24 hours';
  -- 확인되지 않은 달의 신규 배정은 보류하되, 확인된 학원 휴원은 기존 일정에 반영한다.
  v_public_unknown := v_policy.exclude_public_holidays and v_holidays is null;
  v_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month')::date;
  if v_public_unknown then
    v_count := 0;
  else
    v_count := private.ensure_monthly_academy_lesson_events_without_holidays(p_academy_id, p_month);
  end if;
  for v_event in select id, starts_at, status, auto_excluded_for_closure from public.lesson_events
    where academy_id = p_academy_id and lesson_kind = 'academy' and origin = 'regular'
      and generated_from_enrollment and starts_at >= (v_start::timestamp at time zone 'Asia/Seoul')
      and starts_at < (v_end::timestamp at time zone 'Asia/Seoul')
      and (status = 'scheduled' or auto_excluded_for_closure)
    order by id for update
  loop
    v_day := (v_event.starts_at at time zone 'Asia/Seoul')::date;
    v_closed := (v_policy.exclude_public_holidays and exists (select 1 from jsonb_array_elements(coalesce(v_holidays, '[]'::jsonb)) h where h->>'date' = v_day::text))
      or (v_policy.exclude_academy_closures and exists (select 1 from public.academy_closures c
        where c.academy_id = p_academy_id and c.active and v_day between c.starts_on and c.ends_on
          and (c.weekday is null or c.weekday = extract(dow from v_day)::integer)));
    if v_closed and v_event.status = 'scheduled' and not exists (select 1 from public.attendance_records a
      where a.academy_id = p_academy_id and a.lesson_event_id = v_event.id and a.status <> 'pending') then
      update public.lesson_events set status = 'cancelled', auto_excluded_for_closure = true where id = v_event.id;
    elsif not v_closed and not v_public_unknown and v_event.auto_excluded_for_closure and exists (
      select 1 from public.lesson_events e
      join public.lesson_series s on s.academy_id = e.academy_id and s.id = e.series_id
      join public.students student on student.academy_id = e.academy_id and student.id = e.student_id
      where e.id = v_event.id and s.active and student.status = 'enrolled'
        and e.student_id = s.student_id and e.student_instrument_id = s.student_instrument_id
        and e.teacher_id = s.teacher_id and e.instrument_id = s.instrument_id
        and (e.starts_at at time zone 'Asia/Seoul')::time = coalesce(s.start_time, time '00:00')
        and (e.ends_at at time zone 'Asia/Seoul')::time = coalesce(s.end_time, time '00:01')
        and v_day >= greatest(s.effective_from, student.registered_on)
        and (s.effective_until is null or v_day <= s.effective_until)
        and (array['일','월','화','수','목','금','토'])[extract(dow from v_day)::integer + 1] = any(s.weekdays)
    ) then
      update public.lesson_events set status = 'scheduled', auto_excluded_for_closure = false where id = v_event.id;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.ensure_monthly_academy_lesson_events(uuid, text) from public, anon;
grant execute on function public.ensure_monthly_academy_lesson_events(uuid, text) to authenticated;

create function private.reconcile_academy_closures() returns trigger language plpgsql security definer
set search_path = public, private, pg_temp as $$
declare v_month text;
begin
  for v_month in select distinct to_char(starts_at at time zone 'Asia/Seoul', 'YYYY-MM')
    from public.lesson_events where academy_id = new.academy_id and lesson_kind = 'academy' and generated_from_enrollment
    order by 1
  loop
    perform public.ensure_monthly_academy_lesson_events(new.academy_id, v_month);
  end loop;
  return new;
end;
$$;
create trigger academy_closures_reconcile after insert or update on public.academy_closures
  for each row execute function private.reconcile_academy_closures();
notify pgrst, 'reload schema';

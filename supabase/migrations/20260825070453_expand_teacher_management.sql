alter table public.teachers
  add column if not exists status text not null default 'employed',
  add column if not exists contract_start_on date,
  add column if not exists contract_end_on date,
  add column if not exists on_leave_at timestamptz,
  add column if not exists resigned_at timestamptz;

update public.teachers
set
  contract_start_on = coalesce(contract_start_on, registered_on),
  contract_end_on = coalesce(
    contract_end_on,
    (registered_on + interval '1 year' - interval '1 day')::date
  )
where contract_start_on is null or contract_end_on is null;

alter table public.teachers
  alter column contract_start_on set not null,
  alter column contract_end_on set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teachers_status_check'
      and conrelid = 'public.teachers'::regclass
  ) then
    alter table public.teachers
      add constraint teachers_status_check
      check (status in ('employed', 'on_leave', 'resigned'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'teachers_contract_period_check'
      and conrelid = 'public.teachers'::regclass
  ) then
    alter table public.teachers
      add constraint teachers_contract_period_check
      check (contract_end_on >= contract_start_on);
  end if;
end $$;

create table public.teacher_work_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  weekday text not null check (weekday in ('월', '화', '수', '목', '금', '토', '일')),
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, teacher_id, weekday),
  constraint teacher_work_schedules_time_pair_check
    check (
      (start_time is null and end_time is null)
      or (start_time is not null and end_time is not null and end_time > start_time)
    ),
  constraint teacher_work_schedules_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete cascade
);

create index if not exists teacher_work_schedules_teacher_idx
on public.teacher_work_schedules (academy_id, teacher_id, weekday);

alter table public.teacher_work_schedules
  add constraint teacher_work_schedules_academy_id_id_key unique (academy_id, id);

drop trigger if exists teacher_work_schedules_set_updated_at
on public.teacher_work_schedules;

create trigger teacher_work_schedules_set_updated_at
before update on public.teacher_work_schedules
for each row execute function private.set_updated_at();

alter table public.teacher_work_schedules enable row level security;

grant select, insert, update, delete on public.teacher_work_schedules to authenticated;
grant delete on public.teachers to authenticated;

create policy "teacher_work_schedules_select_owner_desk"
on public.teacher_work_schedules for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "teacher_work_schedules_write_owner_desk"
on public.teacher_work_schedules for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create or replace function public.register_teacher_with_profile(
  p_academy_id uuid,
  p_name text,
  p_part text,
  p_phone text,
  p_registered_on date,
  p_contract_start_on date,
  p_contract_end_on date,
  p_pay_type text,
  p_monthly_salary integer,
  p_hourly_rate integer,
  p_ratio_teacher_share integer,
  p_work_schedules jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_teacher_id uuid;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '선생님을 등록할 권한이 없습니다.';
  end if;

  perform private.validate_teacher_profile_payload(
    p_name,
    p_part,
    p_contract_start_on,
    p_contract_end_on,
    p_pay_type,
    p_monthly_salary,
    p_hourly_rate,
    p_ratio_teacher_share
  );

  insert into public.teachers (
    academy_id,
    name,
    part,
    phone,
    registered_on,
    contract_start_on,
    contract_end_on,
    salary_type,
    status
  )
  values (
    p_academy_id,
    btrim(p_name),
    btrim(p_part),
    nullif(btrim(coalesce(p_phone, '')), ''),
    p_registered_on,
    p_contract_start_on,
    p_contract_end_on,
    p_pay_type,
    'employed'
  )
  returning id into v_teacher_id;

  perform private.replace_teacher_salary_setting(
    p_academy_id,
    v_teacher_id,
    p_pay_type,
    p_monthly_salary,
    p_hourly_rate,
    p_ratio_teacher_share
  );

  perform private.replace_teacher_work_schedules(
    p_academy_id,
    v_teacher_id,
    coalesce(p_work_schedules, '[]'::jsonb)
  );

  return v_teacher_id;
end;
$$;

create or replace function public.update_teacher_profile(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_name text,
  p_part text,
  p_phone text,
  p_registered_on date,
  p_contract_start_on date,
  p_contract_end_on date,
  p_pay_type text,
  p_monthly_salary integer,
  p_hourly_rate integer,
  p_ratio_teacher_share integer,
  p_work_schedules jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '선생님 정보를 수정할 권한이 없습니다.';
  end if;

  perform private.validate_teacher_profile_payload(
    p_name,
    p_part,
    p_contract_start_on,
    p_contract_end_on,
    p_pay_type,
    p_monthly_salary,
    p_hourly_rate,
    p_ratio_teacher_share
  );

  update public.teachers
  set
    name = btrim(p_name),
    part = btrim(p_part),
    phone = nullif(btrim(coalesce(p_phone, '')), ''),
    registered_on = p_registered_on,
    contract_start_on = p_contract_start_on,
    contract_end_on = p_contract_end_on,
    salary_type = p_pay_type
  where academy_id = p_academy_id
    and id = p_teacher_id;

  if not found then
    raise exception '수정할 선생님을 찾지 못했습니다.';
  end if;

  perform private.replace_teacher_salary_setting(
    p_academy_id,
    p_teacher_id,
    p_pay_type,
    p_monthly_salary,
    p_hourly_rate,
    p_ratio_teacher_share
  );

  perform private.replace_teacher_work_schedules(
    p_academy_id,
    p_teacher_id,
    coalesce(p_work_schedules, '[]'::jsonb)
  );
end;
$$;

create or replace function public.update_teacher_status(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_status text,
  p_changed_at timestamptz default now()
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '선생님 상태를 변경할 권한이 없습니다.';
  end if;

  if p_status not in ('employed', 'on_leave', 'resigned') then
    raise exception '지원하지 않는 선생님 상태입니다.';
  end if;

  update public.teachers
  set
    status = p_status,
    on_leave_at = case
      when p_status = 'on_leave' then p_changed_at
      when p_status = 'employed' then null
      else on_leave_at
    end,
    resigned_at = case
      when p_status = 'resigned' then p_changed_at
      when p_status = 'employed' then null
      else resigned_at
    end
  where academy_id = p_academy_id
    and id = p_teacher_id;

  if not found then
    raise exception '상태를 변경할 선생님을 찾지 못했습니다.';
  end if;
end;
$$;

create or replace function public.delete_resigned_teacher(
  p_academy_id uuid,
  p_teacher_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '퇴사 선생님을 삭제할 권한이 없습니다.';
  end if;

  delete from public.teachers
  where academy_id = p_academy_id
    and id = p_teacher_id
    and status = 'resigned';

  if not found then
    raise exception '퇴사 상태의 선생님만 삭제할 수 있습니다.';
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

  if p_contract_start_on is null or p_contract_end_on is null then
    raise exception '계약 시작일과 종료일은 필수입니다.';
  end if;

  if p_contract_end_on < p_contract_start_on then
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
  ) then
    raise exception '비율제는 선생님 몫 비율이 필요합니다.';
  end if;
end;
$$;

create or replace function private.replace_teacher_salary_setting(
  p_academy_id uuid,
  p_teacher_id uuid,
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
  update public.teacher_salary_settings
  set active = false
  where academy_id = p_academy_id
    and teacher_id = p_teacher_id;

  insert into public.teacher_salary_settings (
    academy_id,
    teacher_id,
    pay_type,
    monthly_salary,
    hourly_rate,
    ratio_teacher_share,
    active
  )
  values (
    p_academy_id,
    p_teacher_id,
    p_pay_type,
    case when p_pay_type = 'monthly' then p_monthly_salary else null end,
    case when p_pay_type = 'hourly' then p_hourly_rate else null end,
    case when p_pay_type = 'ratio' then p_ratio_teacher_share else null end,
    true
  )
  on conflict (academy_id, teacher_id, pay_type)
  do update set
    monthly_salary = excluded.monthly_salary,
    hourly_rate = excluded.hourly_rate,
    ratio_teacher_share = excluded.ratio_teacher_share,
    active = true,
    updated_at = now();
end;
$$;

create or replace function private.replace_teacher_work_schedules(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_work_schedules jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_schedule jsonb;
  v_weekday text;
  v_start_time time;
  v_end_time time;
begin
  delete from public.teacher_work_schedules
  where academy_id = p_academy_id
    and teacher_id = p_teacher_id;

  for v_schedule in
    select value from jsonb_array_elements(coalesce(p_work_schedules, '[]'::jsonb))
  loop
    v_weekday := v_schedule ->> 'weekday';
    v_start_time := nullif(v_schedule ->> 'start_time', '')::time;
    v_end_time := nullif(v_schedule ->> 'end_time', '')::time;

    if v_weekday not in ('월', '화', '수', '목', '금', '토', '일') then
      raise exception '지원하지 않는 근무 요일입니다.';
    end if;

    if (v_start_time is null) <> (v_end_time is null) then
      raise exception '근무 시작 시간과 종료 시간은 함께 입력해야 합니다.';
    end if;

    if v_start_time is not null and v_end_time <= v_start_time then
      raise exception '근무 종료 시간은 시작 시간보다 늦어야 합니다.';
    end if;

    insert into public.teacher_work_schedules (
      academy_id,
      teacher_id,
      weekday,
      start_time,
      end_time
    )
    values (
      p_academy_id,
      p_teacher_id,
      v_weekday,
      v_start_time,
      v_end_time
    );
  end loop;
end;
$$;

revoke all on function public.register_teacher_with_profile(
  uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from public;
revoke all on function public.update_teacher_profile(
  uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) from public;
revoke all on function public.update_teacher_status(uuid, uuid, text, timestamptz) from public;
revoke all on function public.delete_resigned_teacher(uuid, uuid) from public;
revoke all on function private.validate_teacher_profile_payload(
  text, text, date, date, text, integer, integer, integer
) from public;
revoke all on function private.replace_teacher_salary_setting(
  uuid, uuid, text, integer, integer, integer
) from public;
revoke all on function private.replace_teacher_work_schedules(uuid, uuid, jsonb) from public;

grant execute on function private.validate_teacher_profile_payload(
  text, text, date, date, text, integer, integer, integer
) to authenticated;
grant execute on function private.replace_teacher_salary_setting(
  uuid, uuid, text, integer, integer, integer
) to authenticated;
grant execute on function private.replace_teacher_work_schedules(uuid, uuid, jsonb) to authenticated;

grant execute on function public.register_teacher_with_profile(
  uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) to authenticated;
grant execute on function public.update_teacher_profile(
  uuid, uuid, text, text, text, date, date, date, text, integer, integer, integer, jsonb
) to authenticated;
grant execute on function public.update_teacher_status(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.delete_resigned_teacher(uuid, uuid) to authenticated;

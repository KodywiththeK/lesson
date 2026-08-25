alter table public.students
  add column if not exists age integer check (age is null or age >= 0),
  add column if not exists grade text,
  add column if not exists school text,
  add column if not exists occupation text,
  add column if not exists attendance_code text;

create unique index if not exists students_academy_attendance_code_key
on public.students (academy_id, attendance_code)
where attendance_code is not null;

alter table public.student_contacts
  add column if not exists phone_last4 text;

update public.student_contacts
set phone_last4 = right(regexp_replace(phone, '\D', '', 'g'), 4)
where phone_last4 is null
  and phone is not null;

create index if not exists student_contacts_academy_phone_last4_idx
on public.student_contacts (academy_id, phone_last4);

alter table public.student_instruments
  add column if not exists discount_label text;

create table public.student_instrument_weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  student_instrument_id uuid not null references public.student_instruments (id) on delete cascade,
  weekday text not null,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (weekday in ('월', '화', '수', '목', '금', '토', '일')),
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  ),
  unique (academy_id, student_instrument_id, weekday)
);

create index if not exists student_instrument_weekly_schedules_student_idx
on public.student_instrument_weekly_schedules (academy_id, student_id);

create index if not exists student_instrument_weekly_schedules_instrument_idx
on public.student_instrument_weekly_schedules (academy_id, student_instrument_id);

alter table public.student_instrument_weekly_schedules
  add constraint student_instrument_weekly_schedules_academy_id_id_key unique (academy_id, id),
  add constraint student_instrument_weekly_schedules_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint student_iws_academy_instrument_fk
    foreign key (academy_id, student_instrument_id) references public.student_instruments (academy_id, id)
    on delete cascade;

create trigger student_instrument_weekly_schedules_set_updated_at
before update on public.student_instrument_weekly_schedules
for each row execute function private.set_updated_at();

alter table public.student_instrument_weekly_schedules enable row level security;

grant select, insert, update, delete on public.student_instrument_weekly_schedules to authenticated;

create policy "student_instrument_weekly_schedules_select_allowed_members"
on public.student_instrument_weekly_schedules for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "student_instrument_weekly_schedules_write_owner_desk"
on public.student_instrument_weekly_schedules for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

insert into public.student_instrument_weekly_schedules (
  academy_id,
  student_id,
  student_instrument_id,
  weekday,
  start_time,
  end_time
)
select
  instrument.academy_id,
  instrument.student_id,
  instrument.id,
  weekday,
  instrument.start_time,
  instrument.end_time
from public.student_instruments instrument
cross join lateral unnest(instrument.weekdays) as weekday
where not exists (
  select 1
  from public.student_instrument_weekly_schedules schedule
  where schedule.academy_id = instrument.academy_id
    and schedule.student_instrument_id = instrument.id
    and schedule.weekday = weekday
);

update public.student_instruments
set discount_label = '직접입력'
where discount_label is null
  and discount_total > 0;

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
begin
  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception 'not allowed';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception 'student name is required';
  end if;

  if jsonb_array_length(coalesce(p_enrollments, '[]'::jsonb)) = 0 then
    raise exception 'at least one enrollment is required';
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
      raise exception 'failed to generate attendance code';
    end if;
  end loop;

  insert into public.students (
    academy_id,
    name,
    status,
    registered_on,
    age,
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
      coalesce((v_enrollment->>'lesson_fee')::integer, 0),
      coalesce((v_enrollment->>'discount_total')::integer, 0),
      nullif(v_enrollment->>'discount_label', ''),
      coalesce((v_enrollment->>'final_monthly_fee')::integer, 0),
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

create or replace function public.update_student_status(
  p_academy_id uuid,
  p_student_id uuid,
  p_status text,
  p_changed_at timestamptz default now()
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_changed_date date := (p_changed_at at time zone 'Asia/Seoul')::date;
begin
  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception 'not allowed';
  end if;

  if p_status not in ('enrolled', 'suspended', 'withdrawn') then
    raise exception 'unsupported student status';
  end if;

  update public.students
  set
    status = p_status::public.student_status,
    suspended_at = case
      when p_status = 'suspended' then p_changed_at
      when p_status = 'enrolled' then null
      else suspended_at
    end,
    withdrawn_at = case
      when p_status = 'withdrawn' then p_changed_at
      when p_status = 'enrolled' then null
      else withdrawn_at
    end
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found then
    raise exception 'student not found';
  end if;

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
      deleted_at = coalesce(event.deleted_at, p_changed_at)
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
end;
$$;

revoke all on function public.update_student_status(uuid, uuid, text, timestamptz) from public;
grant execute on function public.update_student_status(uuid, uuid, text, timestamptz) to authenticated;

create or replace function public.delete_withdrawn_student(
  p_academy_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not private.has_academy_role(p_academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]) then
    raise exception 'not allowed';
  end if;

  delete from public.students
  where academy_id = p_academy_id
    and id = p_student_id
    and status = 'withdrawn';

  if not found then
    raise exception 'withdrawn student not found';
  end if;
end;
$$;

revoke all on function public.delete_withdrawn_student(uuid, uuid) from public;
grant execute on function public.delete_withdrawn_student(uuid, uuid) to authenticated;

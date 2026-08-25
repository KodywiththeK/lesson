create extension if not exists pg_cron with schema extensions;

alter table public.students
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists retention_until date;

alter table public.teachers
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists retention_until date;

create index if not exists students_status_management_idx
  on public.students (academy_id, status, retention_until)
  where archived_at is null;

create index if not exists teachers_status_management_idx
  on public.teachers (academy_id, status, retention_until)
  where archived_at is null;

create table public.entity_status_transitions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  entity_type text not null check (entity_type in ('student', 'teacher')),
  entity_id uuid not null,
  from_status text not null,
  to_status text not null,
  reason text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.entity_status_transitions
  add constraint entity_status_transitions_academy_id_id_key unique (academy_id, id);

alter table public.entity_status_transitions enable row level security;

grant select, insert on public.entity_status_transitions to authenticated;

create policy "entity_status_transitions_select_allowed_members"
on public.entity_status_transitions
for select
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array[
      'owner'::public.academy_member_role,
      'desk'::public.academy_member_role
    ]
  )
);

create policy "entity_status_transitions_insert_owner_desk"
on public.entity_status_transitions
for insert
to authenticated
with check (
  private.has_academy_role(
    academy_id,
    array[
      'owner'::public.academy_member_role,
      'desk'::public.academy_member_role
    ]
  )
);

create or replace function public.update_student_status(
  p_academy_id uuid,
  p_student_id uuid,
  p_status text,
  p_changed_at timestamptz default now(),
  p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_changed_date date := (p_changed_at at time zone 'Asia/Seoul')::date;
  v_previous_status public.student_status;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception 'not allowed';
  end if;

  if p_status not in ('enrolled', 'suspended', 'withdrawn') then
    raise exception 'unsupported student status';
  end if;

  select status
  into v_previous_status
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id
  for update;

  if not found then
    raise exception 'student not found';
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
    p_changed_at
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

create or replace function public.update_teacher_status(
  p_academy_id uuid,
  p_teacher_id uuid,
  p_status text,
  p_changed_at timestamptz default now(),
  p_reason text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_changed_date date := (p_changed_at at time zone 'Asia/Seoul')::date;
  v_previous_status text;
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

  select status
  into v_previous_status
  from public.teachers
  where academy_id = p_academy_id
    and id = p_teacher_id
  for update;

  if not found then
    raise exception '상태를 변경할 선생님을 찾지 못했습니다.';
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
    end,
    retention_until = case
      when p_status = 'resigned' then v_changed_date + 30
      else null
    end,
    archived_at = null,
    archive_reason = null
  where academy_id = p_academy_id
    and id = p_teacher_id;

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
    'teacher',
    p_teacher_id,
    coalesce(v_previous_status, 'employed'),
    p_status,
    nullif(btrim(coalesce(p_reason, '')), ''),
    (select auth.uid()),
    p_changed_at
  );
end;
$$;

create or replace function public.archive_expired_people(
  p_now timestamptz default now()
)
returns table(entity_type text, entity_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (p_now at time zone 'Asia/Seoul')::date;
begin
  return query
  with archived_students as (
    update public.students
    set
      archived_at = p_now,
      archive_reason = '30일 보관 기간 만료'
    where status = 'withdrawn'
      and archived_at is null
      and retention_until is not null
      and retention_until <= v_today
    returning id
  ),
  archived_teachers as (
    update public.teachers
    set
      archived_at = p_now,
      archive_reason = '30일 보관 기간 만료'
    where status = 'resigned'
      and archived_at is null
      and retention_until is not null
      and retention_until <= v_today
    returning id
  )
  select 'student'::text, id
  from archived_students
  union all
  select 'teacher'::text, id
  from archived_teachers;
end;
$$;

revoke all on function public.update_student_status(uuid, uuid, text, timestamptz, text) from public;
grant execute on function public.update_student_status(uuid, uuid, text, timestamptz, text) to authenticated;
revoke all on function public.update_teacher_status(uuid, uuid, text, timestamptz, text) from public;
grant execute on function public.update_teacher_status(uuid, uuid, text, timestamptz, text) to authenticated;
revoke all on function public.archive_expired_people(timestamptz) from public;
grant execute on function public.archive_expired_people(timestamptz) to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_namespace
    where nspname = 'cron'
  ) then
    if exists (
      select 1
      from cron.job
      where jobname = 'lesson-archive-expired-people'
    ) then
      perform cron.unschedule('lesson-archive-expired-people');
    end if;

    perform cron.schedule(
      'lesson-archive-expired-people',
      '0 18 * * *',
      'select public.archive_expired_people();'
    );
  end if;
end;
$$;

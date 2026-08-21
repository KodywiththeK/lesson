create extension if not exists pgcrypto with schema extensions;

revoke all on schema public from anon;

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

create type public.academy_member_role as enum ('owner', 'desk', 'teacher');
create type public.academy_member_status as enum ('active', 'invited', 'disabled');
create type public.student_status as enum ('enrolled', 'suspended', 'withdrawn');
create type public.ledger_entry_type as enum ('income', 'expense');
create type public.ledger_entry_source as enum ('tuition', 'book-sale', 'payroll', 'manual');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_members (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.academy_member_role not null,
  status public.academy_member_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  member_id uuid references public.academy_members (id) on delete set null,
  name text not null,
  part text not null,
  phone text,
  registered_on date not null,
  salary_type text not null check (salary_type in ('monthly', 'hourly', 'ratio')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null,
  status public.student_status not null default 'enrolled',
  registered_on date not null,
  suspended_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  instrument_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, student_id, teacher_id, instrument_name)
);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null,
  phone text,
  vendor_type text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  occurred_on date not null,
  entry_type public.ledger_entry_type not null,
  source public.ledger_entry_source not null,
  amount integer not null check (amount > 0),
  description text not null,
  ref_table text,
  ref_id text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index academy_members_user_id_idx on public.academy_members (user_id);
create index academy_members_academy_role_idx on public.academy_members (academy_id, role, status);
create index teachers_academy_id_idx on public.teachers (academy_id);
create index teachers_member_id_idx on public.teachers (member_id);
create index students_academy_id_idx on public.students (academy_id);
create index student_teacher_assignments_teacher_idx on public.student_teacher_assignments (academy_id, teacher_id, active);
create index student_teacher_assignments_student_idx on public.student_teacher_assignments (academy_id, student_id, active);
create index vendors_academy_id_idx on public.vendors (academy_id);
create index ledger_entries_academy_occurred_idx on public.ledger_entries (academy_id, occurred_on);

alter table public.academy_members
  add constraint academy_members_academy_id_id_key unique (academy_id, id);

alter table public.teachers
  add constraint teachers_academy_id_id_key unique (academy_id, id),
  add constraint teachers_academy_member_fk
    foreign key (academy_id, member_id) references public.academy_members (academy_id, id)
    on delete set null (member_id);

alter table public.students
  add constraint students_academy_id_id_key unique (academy_id, id);

alter table public.student_teacher_assignments
  add constraint student_teacher_assignments_academy_id_id_key unique (academy_id, id),
  add constraint student_teacher_assignments_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint student_teacher_assignments_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete cascade;

alter table public.vendors
  add constraint vendors_academy_id_id_key unique (academy_id, id);

alter table public.ledger_entries
  add constraint ledger_entries_academy_id_id_key unique (academy_id, id);

create schema private;
revoke all on schema private from public;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger academies_set_updated_at
before update on public.academies
for each row execute function private.set_updated_at();

create trigger academy_members_set_updated_at
before update on public.academy_members
for each row execute function private.set_updated_at();

create trigger teachers_set_updated_at
before update on public.teachers
for each row execute function private.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function private.set_updated_at();

create trigger student_teacher_assignments_set_updated_at
before update on public.student_teacher_assignments
for each row execute function private.set_updated_at();

create trigger vendors_set_updated_at
before update on public.vendors
for each row execute function private.set_updated_at();

create function private.is_active_academy_member(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academy_members member
    where member.academy_id = target_academy_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

create function private.has_academy_role(
  target_academy_id uuid,
  allowed_roles public.academy_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academy_members member
    where member.academy_id = target_academy_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role = any (allowed_roles)
  );
$$;

create function private.is_academy_creator(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academies academy
    where academy.id = target_academy_id
      and academy.created_by = (select auth.uid())
  );
$$;

create function private.is_teacher_record_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academy_members member
    where member.id = target_member_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role = 'teacher'
  );
$$;

create function private.teacher_can_access_student(target_academy_id uuid, target_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.academy_members member
    join public.teachers teacher
      on teacher.member_id = member.id
     and teacher.academy_id = member.academy_id
    join public.student_teacher_assignments assignment
      on assignment.teacher_id = teacher.id
     and assignment.academy_id = teacher.academy_id
    where member.academy_id = target_academy_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role = 'teacher'
      and assignment.student_id = target_student_id
      and assignment.active
  );
$$;

revoke all on function private.is_active_academy_member(uuid) from public;
revoke all on function private.has_academy_role(uuid, public.academy_member_role[]) from public;
revoke all on function private.is_academy_creator(uuid) from public;
revoke all on function private.is_teacher_record_member(uuid) from public;
revoke all on function private.teacher_can_access_student(uuid, uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_academy_member(uuid) to authenticated;
grant execute on function private.has_academy_role(uuid, public.academy_member_role[]) to authenticated;
grant execute on function private.is_academy_creator(uuid) to authenticated;
grant execute on function private.is_teacher_record_member(uuid) to authenticated;
grant execute on function private.teacher_can_access_student(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.academy_members enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.student_teacher_assignments enable row level security;
alter table public.vendors enable row level security;
alter table public.ledger_entries enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.academies to authenticated;
grant select, insert, update on public.academy_members to authenticated;
grant select, insert, update on public.teachers to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.student_teacher_assignments to authenticated;
grant select, insert, update on public.vendors to authenticated;
grant select, insert on public.ledger_entries to authenticated;

create policy "profiles_select_self"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "academies_select_active_members"
on public.academies for select
to authenticated
using (private.is_active_academy_member(id));

create policy "academies_insert_creator"
on public.academies for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "academies_update_owner"
on public.academies for update
to authenticated
using (private.has_academy_role(id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(id, array['owner'::public.academy_member_role]));

create policy "academy_members_select_same_academy"
on public.academy_members for select
to authenticated
using (private.is_active_academy_member(academy_id));

create policy "academy_members_insert_owner"
on public.academy_members for insert
to authenticated
with check (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role])
  or (
    role = 'owner'
    and user_id = (select auth.uid())
    and private.is_academy_creator(academy_id)
  )
);

create policy "academy_members_update_owner"
on public.academy_members for update
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "teachers_select_members"
on public.teachers for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.is_teacher_record_member(member_id)
);

create policy "teachers_write_owner_desk"
on public.teachers for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "students_select_allowed_members"
on public.students for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, id)
);

create policy "students_write_owner_desk"
on public.students for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "student_teacher_assignments_select_members"
on public.student_teacher_assignments for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "student_teacher_assignments_write_owner_desk"
on public.student_teacher_assignments for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "vendors_select_owner_desk"
on public.vendors for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "vendors_write_owner_desk"
on public.vendors for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "ledger_entries_select_owner_only"
on public.ledger_entries for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "ledger_entries_insert_owner_only"
on public.ledger_entries for insert
to authenticated
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

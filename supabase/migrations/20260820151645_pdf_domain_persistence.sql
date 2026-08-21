alter table public.teachers
  add column resident_registration_encrypted_ref text,
  add column resident_registration_masked text;

create table public.student_contacts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  relationship text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_instruments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete set null,
  instrument_id text not null,
  instrument_name text not null,
  lesson_type text not null check (lesson_type in ('academy', 'private')),
  weekdays text[] not null default '{}',
  start_time time,
  end_time time,
  progress text not null default '',
  lesson_fee integer not null default 0 check (lesson_fee >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  final_monthly_fee integer not null default 0 check (final_monthly_fee >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, student_id, instrument_id, lesson_type)
);

create table public.lesson_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  student_instrument_id uuid references public.student_instruments (id) on delete set null,
  teacher_id uuid references public.teachers (id) on delete set null,
  lesson_kind text not null check (lesson_kind in ('academy', 'private', 'makeup')),
  instrument_id text not null,
  instrument_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'deleted', 'cancelled')),
  deletion_reason text,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  generated_from_enrollment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_event_id uuid not null references public.lesson_events (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null check (status in ('pending', 'present', 'absent', 'cancelled', 'makeup', 'pass')),
  absence_reason text,
  marked_at timestamptz not null default now(),
  marked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (academy_id, lesson_event_id, student_id)
);

create table public.absence_resolutions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  attendance_record_id uuid not null references public.attendance_records (id) on delete cascade,
  lesson_event_id uuid not null references public.lesson_events (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  resolved_as text not null check (resolved_as in ('makeup', 'pass')),
  reason text not null,
  makeup_lesson_event_id uuid references public.lesson_events (id) on delete set null,
  confirmed_at timestamptz not null,
  confirmed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (academy_id, attendance_record_id)
);

create table public.monthly_memos (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  content text not null default '',
  unread boolean not null default true,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, month)
);

create table public.lesson_ticket_grants (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  instrument_id text not null,
  instrument_name text not null,
  total_granted_count integer not null check (total_granted_count > 0),
  remaining_count integer not null check (remaining_count >= 0),
  valid_from date not null,
  valid_until date not null,
  registered_at date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until >= valid_from)
);

create table public.lesson_ticket_adjustments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_ticket_grant_id uuid not null references public.lesson_ticket_grants (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  instrument_id text not null,
  previous_remaining_count integer not null check (previous_remaining_count >= 0),
  delta_count integer not null check (delta_count <> 0),
  next_remaining_count integer not null check (next_remaining_count >= 0),
  adjustment_reason text not null,
  adjusted_at timestamptz not null,
  adjusted_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.lesson_ticket_usages (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_ticket_grant_id uuid not null references public.lesson_ticket_grants (id) on delete cascade,
  lesson_event_id uuid not null references public.lesson_events (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  instrument_id text not null,
  used_count integer not null default 1 check (used_count = 1),
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (academy_id, lesson_event_id, student_id, instrument_id)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null,
  price integer not null check (price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_inventory_batches (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  quantity integer not null check (quantity >= 0),
  stocked_at date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.book_releases (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete cascade,
  student_name text not null,
  book_title text not null,
  price integer not null check (price > 0),
  shipped_at date not null,
  status text not null default 'payment-pending' check (status in ('payment-pending', 'paid')),
  paid_at date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fixed_income_snapshots (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  student_id uuid not null references public.students (id) on delete cascade,
  student_instrument_id uuid references public.student_instruments (id) on delete set null,
  student_name text not null,
  instrument_id text not null,
  instrument_name text not null,
  amount integer not null check (amount >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, month, student_id, instrument_id)
);

create table public.teacher_salary_settings (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  pay_type text not null check (pay_type in ('ratio', 'monthly', 'hourly')),
  ratio_teacher_share integer check (ratio_teacher_share between 0 and 100),
  monthly_salary integer check (monthly_salary is null or monthly_salary > 0),
  hourly_rate integer check (hourly_rate is null or hourly_rate > 0),
  withholding_tax_rate numeric(6, 5) not null default 0.033 check (withholding_tax_rate >= 0),
  rounding text not null default 'floor' check (rounding in ('floor', 'round', 'ceil')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, teacher_id, pay_type)
);

create table public.salary_settlements (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  teacher_name text not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  pay_type text not null check (pay_type in ('ratio', 'monthly', 'hourly')),
  base_pay integer not null check (base_pay >= 0),
  withholding_tax integer not null check (withholding_tax >= 0),
  net_pay integer not null check (net_pay >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at date,
  lesson_event_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, teacher_id, month, pay_type)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  entity_table text not null,
  entity_id text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index student_contacts_academy_student_idx on public.student_contacts (academy_id, student_id);
create index student_instruments_academy_student_idx on public.student_instruments (academy_id, student_id, active);
create index lesson_events_academy_starts_idx on public.lesson_events (academy_id, starts_at);
create index lesson_events_teacher_time_idx on public.lesson_events (academy_id, teacher_id, starts_at, ends_at);
create index attendance_records_lesson_idx on public.attendance_records (academy_id, lesson_event_id);
create index monthly_memos_academy_month_idx on public.monthly_memos (academy_id, month);
create index lesson_ticket_grants_scope_idx on public.lesson_ticket_grants (academy_id, student_id, instrument_id);
create index lesson_ticket_usages_lesson_idx on public.lesson_ticket_usages (academy_id, lesson_event_id);
create index books_academy_idx on public.books (academy_id, active);
create index book_releases_academy_shipped_idx on public.book_releases (academy_id, shipped_at);
create index fixed_income_snapshots_month_idx on public.fixed_income_snapshots (academy_id, month);
create index salary_settlements_month_idx on public.salary_settlements (academy_id, month, teacher_id);
create index audit_events_academy_occurred_idx on public.audit_events (academy_id, occurred_at);

alter table public.student_contacts
  add constraint student_contacts_academy_id_id_key unique (academy_id, id),
  add constraint student_contacts_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.student_instruments
  add constraint student_instruments_academy_id_id_key unique (academy_id, id),
  add constraint student_instruments_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint student_instruments_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete set null (teacher_id);

alter table public.lesson_events
  add constraint lesson_events_academy_id_id_key unique (academy_id, id),
  add constraint lesson_events_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint lesson_events_academy_student_instrument_fk
    foreign key (academy_id, student_instrument_id) references public.student_instruments (academy_id, id)
    on delete set null (student_instrument_id),
  add constraint lesson_events_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete set null (teacher_id);

alter table public.attendance_records
  add constraint attendance_records_academy_id_id_key unique (academy_id, id),
  add constraint attendance_records_academy_lesson_event_fk
    foreign key (academy_id, lesson_event_id) references public.lesson_events (academy_id, id)
    on delete cascade,
  add constraint attendance_records_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.absence_resolutions
  add constraint absence_resolutions_academy_id_id_key unique (academy_id, id),
  add constraint absence_resolutions_academy_attendance_record_fk
    foreign key (academy_id, attendance_record_id) references public.attendance_records (academy_id, id)
    on delete cascade,
  add constraint absence_resolutions_academy_lesson_event_fk
    foreign key (academy_id, lesson_event_id) references public.lesson_events (academy_id, id)
    on delete cascade,
  add constraint absence_resolutions_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint absence_resolutions_academy_makeup_lesson_event_fk
    foreign key (academy_id, makeup_lesson_event_id) references public.lesson_events (academy_id, id)
    on delete set null (makeup_lesson_event_id);

alter table public.monthly_memos
  add constraint monthly_memos_academy_id_id_key unique (academy_id, id);

alter table public.lesson_ticket_grants
  add constraint lesson_ticket_grants_academy_id_id_key unique (academy_id, id),
  add constraint lesson_ticket_grants_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.lesson_ticket_adjustments
  add constraint lesson_ticket_adjustments_academy_id_id_key unique (academy_id, id),
  add constraint lesson_ticket_adjustments_academy_lesson_ticket_grant_fk
    foreign key (academy_id, lesson_ticket_grant_id) references public.lesson_ticket_grants (academy_id, id)
    on delete cascade,
  add constraint lesson_ticket_adjustments_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.lesson_ticket_usages
  add constraint lesson_ticket_usages_academy_id_id_key unique (academy_id, id),
  add constraint lesson_ticket_usages_academy_lesson_ticket_grant_fk
    foreign key (academy_id, lesson_ticket_grant_id) references public.lesson_ticket_grants (academy_id, id)
    on delete cascade,
  add constraint lesson_ticket_usages_academy_lesson_event_fk
    foreign key (academy_id, lesson_event_id) references public.lesson_events (academy_id, id)
    on delete cascade,
  add constraint lesson_ticket_usages_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.books
  add constraint books_academy_id_id_key unique (academy_id, id);

alter table public.book_inventory_batches
  add constraint book_inventory_batches_academy_id_id_key unique (academy_id, id),
  add constraint book_inventory_batches_academy_book_fk
    foreign key (academy_id, book_id) references public.books (academy_id, id)
    on delete cascade;

alter table public.book_releases
  add constraint book_releases_academy_id_id_key unique (academy_id, id),
  add constraint book_releases_academy_book_fk
    foreign key (academy_id, book_id) references public.books (academy_id, id)
    on delete restrict,
  add constraint book_releases_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade;

alter table public.fixed_income_snapshots
  add constraint fixed_income_snapshots_academy_id_id_key unique (academy_id, id),
  add constraint fixed_income_snapshots_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint fixed_income_snapshots_academy_student_instrument_fk
    foreign key (academy_id, student_instrument_id) references public.student_instruments (academy_id, id)
    on delete set null (student_instrument_id);

alter table public.teacher_salary_settings
  add constraint teacher_salary_settings_academy_id_id_key unique (academy_id, id),
  add constraint teacher_salary_settings_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete cascade;

alter table public.salary_settlements
  add constraint salary_settlements_academy_id_id_key unique (academy_id, id),
  add constraint salary_settlements_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete cascade;

alter table public.audit_events
  add constraint audit_events_academy_id_id_key unique (academy_id, id);

create trigger student_contacts_set_updated_at
before update on public.student_contacts
for each row execute function private.set_updated_at();

create trigger student_instruments_set_updated_at
before update on public.student_instruments
for each row execute function private.set_updated_at();

create trigger lesson_events_set_updated_at
before update on public.lesson_events
for each row execute function private.set_updated_at();

create trigger monthly_memos_set_updated_at
before update on public.monthly_memos
for each row execute function private.set_updated_at();

create trigger lesson_ticket_grants_set_updated_at
before update on public.lesson_ticket_grants
for each row execute function private.set_updated_at();

create trigger books_set_updated_at
before update on public.books
for each row execute function private.set_updated_at();

create trigger book_releases_set_updated_at
before update on public.book_releases
for each row execute function private.set_updated_at();

create trigger fixed_income_snapshots_set_updated_at
before update on public.fixed_income_snapshots
for each row execute function private.set_updated_at();

create trigger teacher_salary_settings_set_updated_at
before update on public.teacher_salary_settings
for each row execute function private.set_updated_at();

create trigger salary_settlements_set_updated_at
before update on public.salary_settlements
for each row execute function private.set_updated_at();

alter table public.student_contacts enable row level security;
alter table public.student_instruments enable row level security;
alter table public.lesson_events enable row level security;
alter table public.attendance_records enable row level security;
alter table public.absence_resolutions enable row level security;
alter table public.monthly_memos enable row level security;
alter table public.lesson_ticket_grants enable row level security;
alter table public.lesson_ticket_adjustments enable row level security;
alter table public.lesson_ticket_usages enable row level security;
alter table public.books enable row level security;
alter table public.book_inventory_batches enable row level security;
alter table public.book_releases enable row level security;
alter table public.fixed_income_snapshots enable row level security;
alter table public.salary_settlements enable row level security;
alter table public.teacher_salary_settings enable row level security;
alter table public.audit_events enable row level security;

grant select, insert, update on public.student_contacts to authenticated;
grant select, insert, update on public.student_instruments to authenticated;
grant select, insert, update on public.lesson_events to authenticated;
grant select, insert, update on public.attendance_records to authenticated;
grant select, insert, update on public.absence_resolutions to authenticated;
grant select, insert, update on public.monthly_memos to authenticated;
grant select, insert, update on public.lesson_ticket_grants to authenticated;
grant select, insert on public.lesson_ticket_adjustments to authenticated;
grant select, insert on public.lesson_ticket_usages to authenticated;
grant select, insert, update on public.books to authenticated;
grant select, insert, update on public.book_inventory_batches to authenticated;
grant select, insert, update on public.book_releases to authenticated;
grant select, insert, update on public.fixed_income_snapshots to authenticated;
grant select, insert, update on public.teacher_salary_settings to authenticated;
grant select, insert, update on public.salary_settlements to authenticated;
grant select, insert on public.audit_events to authenticated;

create policy "student_contacts_select_allowed_members"
on public.student_contacts for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "student_contacts_write_owner_desk"
on public.student_contacts for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "student_instruments_select_allowed_members"
on public.student_instruments for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "student_instruments_write_owner_desk"
on public.student_instruments for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_events_select_allowed_members"
on public.lesson_events for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "lesson_events_write_owner_desk"
on public.lesson_events for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "attendance_records_select_allowed_members"
on public.attendance_records for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "attendance_records_write_owner_desk"
on public.attendance_records for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "absence_resolutions_select_allowed_members"
on public.absence_resolutions for select
to authenticated
using (
  private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role])
  or private.teacher_can_access_student(academy_id, student_id)
);

create policy "absence_resolutions_write_owner_desk"
on public.absence_resolutions for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "monthly_memos_select_owner_desk"
on public.monthly_memos for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "monthly_memos_write_owner_desk"
on public.monthly_memos for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_ticket_grants_select_owner_desk"
on public.lesson_ticket_grants for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_ticket_grants_write_owner_desk"
on public.lesson_ticket_grants for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_ticket_adjustments_owner_only"
on public.lesson_ticket_adjustments for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "lesson_ticket_usages_select_owner_desk"
on public.lesson_ticket_usages for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_ticket_usages_insert_owner_desk"
on public.lesson_ticket_usages for insert
to authenticated
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "books_select_owner_desk"
on public.books for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "books_write_owner_desk"
on public.books for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "book_inventory_batches_owner_desk"
on public.book_inventory_batches for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "book_releases_owner_desk"
on public.book_releases for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "fixed_income_snapshots_owner_only"
on public.fixed_income_snapshots for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "teacher_salary_settings_owner_only"
on public.teacher_salary_settings for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "salary_settlements_owner_only"
on public.salary_settlements for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "audit_events_owner_only"
on public.audit_events for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

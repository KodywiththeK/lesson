create table public.lesson_calendar_memos (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_kind text not null check (lesson_kind in ('academy', 'private')),
  memo_date date not null,
  content text not null default '',
  unread boolean not null default false,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, lesson_kind, memo_date)
);

create table public.entity_memos (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  target_type text not null check (target_type in ('student', 'teacher')),
  student_id uuid references public.students (id) on delete cascade,
  teacher_id uuid references public.teachers (id) on delete cascade,
  target_name text not null,
  content text not null,
  memo_date date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type = 'student' and student_id is not null and teacher_id is null)
    or (target_type = 'teacher' and teacher_id is not null and student_id is null)
  )
);

create index lesson_calendar_memos_month_idx
on public.lesson_calendar_memos (academy_id, memo_date, lesson_kind);

create index entity_memos_student_idx
on public.entity_memos (academy_id, student_id, memo_date desc)
where student_id is not null;

create index entity_memos_teacher_idx
on public.entity_memos (academy_id, teacher_id, memo_date desc)
where teacher_id is not null;

alter table public.lesson_calendar_memos
  add constraint lesson_calendar_memos_academy_id_id_key unique (academy_id, id);

alter table public.entity_memos
  add constraint entity_memos_academy_id_id_key unique (academy_id, id),
  add constraint entity_memos_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete cascade,
  add constraint entity_memos_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete cascade;

create trigger lesson_calendar_memos_set_updated_at
before update on public.lesson_calendar_memos
for each row execute function private.set_updated_at();

create trigger entity_memos_set_updated_at
before update on public.entity_memos
for each row execute function private.set_updated_at();

alter table public.lesson_calendar_memos enable row level security;
alter table public.entity_memos enable row level security;

grant select, insert, update on public.lesson_calendar_memos to authenticated;
grant select, insert, update on public.entity_memos to authenticated;

create policy "lesson_calendar_memos_select_owner_desk"
on public.lesson_calendar_memos for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "lesson_calendar_memos_write_owner_desk"
on public.lesson_calendar_memos for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "entity_memos_select_owner_desk"
on public.entity_memos for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "entity_memos_write_owner_desk"
on public.entity_memos for all
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

insert into public.lesson_calendar_memos (
  academy_id,
  lesson_kind,
  memo_date,
  content,
  unread,
  updated_by
)
select
  academy_id,
  'academy',
  to_date(month || '-01', 'YYYY-MM-DD'),
  content,
  unread,
  updated_by
from public.monthly_memos
where trim(content) <> ''
on conflict (academy_id, lesson_kind, memo_date) do nothing;

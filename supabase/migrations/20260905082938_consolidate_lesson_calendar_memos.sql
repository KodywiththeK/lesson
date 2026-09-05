alter table public.lesson_calendar_memos
  drop constraint if exists lesson_calendar_memos_academy_id_lesson_kind_memo_date_key;

alter table public.lesson_calendar_memos
  add column if not exists student_id uuid,
  add column if not exists teacher_id uuid,
  add column if not exists student_name text,
  add column if not exists teacher_name text;

alter table public.lesson_calendar_memos
  drop constraint if exists lesson_calendar_memos_academy_student_fk,
  drop constraint if exists lesson_calendar_memos_academy_teacher_fk,
  add constraint lesson_calendar_memos_academy_student_fk
    foreign key (academy_id, student_id) references public.students (academy_id, id)
    on delete set null (student_id),
  add constraint lesson_calendar_memos_academy_teacher_fk
    foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)
    on delete set null (teacher_id);

create index if not exists lesson_calendar_memos_student_idx
on public.lesson_calendar_memos (academy_id, student_id, memo_date desc)
where student_id is not null;

create index if not exists lesson_calendar_memos_teacher_idx
on public.lesson_calendar_memos (academy_id, teacher_id, memo_date desc)
where teacher_id is not null;

grant select, insert, update, delete on public.lesson_calendar_memos to authenticated;

drop table if exists public.entity_memos cascade;

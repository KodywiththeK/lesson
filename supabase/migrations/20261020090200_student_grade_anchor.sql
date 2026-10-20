alter table public.students
  add column if not exists grade_as_of_year integer;

-- 과거 학년의 작성 연도는 알 수 없다. 원문을 유지하고 이번 적용 연도부터 진급한다.
update public.students
set grade_as_of_year = extract(year from now() at time zone 'Asia/Seoul')::integer
where nullif(btrim(coalesce(grade, '')), '') is not null
  and grade_as_of_year is null;

create or replace function private.set_student_grade_anchor()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.grade is not distinct from old.grade then
      new.grade_as_of_year := old.grade_as_of_year;
      return new;
    end if;
  end if;

  new.grade_as_of_year := case
    when nullif(btrim(coalesce(new.grade, '')), '') is null then null
    else extract(year from now() at time zone 'Asia/Seoul')::integer
  end;
  return new;
end;
$$;

drop trigger if exists students_set_grade_anchor on public.students;
create trigger students_set_grade_anchor
before insert or update of grade on public.students
for each row execute function private.set_student_grade_anchor();

notify pgrst, 'reload schema';

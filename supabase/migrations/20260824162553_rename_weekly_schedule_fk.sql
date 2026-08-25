do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_instrument_weekly_schedules'::regclass
      and conname = 'student_instrument_weekly_schedules_academy_student_instrument_'
  ) and not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.student_instrument_weekly_schedules'::regclass
      and conname = 'student_iws_academy_instrument_fk'
  ) then
    alter table public.student_instrument_weekly_schedules
      rename constraint student_instrument_weekly_schedules_academy_student_instrument_
      to student_iws_academy_instrument_fk;
  end if;
end;
$$;

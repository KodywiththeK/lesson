drop policy if exists "ledger_entries_select_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_insert_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_update_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_delete_owner_desk_finance" on public.ledger_entries;

create policy "ledger_entries_select_owner_only"
on public.ledger_entries for select to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "ledger_entries_insert_owner_only"
on public.ledger_entries for insert to authenticated
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "ledger_entries_update_owner_only"
on public.ledger_entries for update to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create policy "ledger_entries_delete_owner_only"
on public.ledger_entries for delete to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role]));

create or replace function private.require_finance_owner_for_ledger()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_academy_id uuid := coalesce(new.academy_id, old.academy_id);
begin
  if (select auth.uid()) is not null and not private.has_academy_role(
    v_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '수입 관리 권한이 없습니다.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.require_finance_owner_for_ledger() from public;

create trigger ledger_entries_require_finance_owner
before insert or update or delete on public.ledger_entries
for each row execute function private.require_finance_owner_for_ledger();

create or replace function public.ensure_monthly_fixed_income_snapshots(
  p_academy_id uuid,
  p_month text
)
returns setof public.fixed_income_snapshots
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  month_start date;
  month_end date;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role]
  ) then
    raise exception '월별 수강료 조회 권한이 없습니다.';
  end if;

  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception '월 형식은 YYYY-MM이어야 합니다.';
  end if;

  month_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  month_end := (month_start + interval '1 month - 1 day')::date;

  insert into public.fixed_income_snapshots (
    academy_id, month, student_id, student_instrument_id, student_name,
    instrument_id, instrument_name, amount, due_on, lesson_fee,
    discount_total, discount_label, progress
  )
  select
    instrument.academy_id,
    p_month,
    student.id,
    instrument.id,
    student.name,
    instrument.instrument_id,
    instrument.instrument_name,
    instrument.final_monthly_fee,
    case
      when extract(day from student.registered_on)::int <= extract(day from month_end)::int
        then make_date(
          extract(year from month_start)::int,
          extract(month from month_start)::int,
          extract(day from student.registered_on)::int
        )
      else month_end + 1
    end,
    instrument.lesson_fee,
    instrument.discount_total,
    instrument.discount_label,
    instrument.progress
  from public.student_instruments instrument
  join public.students student
    on student.academy_id = instrument.academy_id
   and student.id = instrument.student_id
  where instrument.academy_id = p_academy_id
    and instrument.lesson_type = 'academy'
    and instrument.active
    and student.status = 'enrolled'
    and student.registered_on <= month_end
    and instrument.final_monthly_fee >= 0
  on conflict (academy_id, month, student_id, instrument_id) do nothing;

  return query
  select *
  from public.fixed_income_snapshots
  where academy_id = p_academy_id
    and month = p_month
  order by due_on, student_name, instrument_name;
end;
$$;

revoke all on function public.ensure_monthly_fixed_income_snapshots(uuid, text) from public;
grant execute on function public.ensure_monthly_fixed_income_snapshots(uuid, text) to authenticated;

alter table public.ledger_entries
  add column if not exists category text not null default 'other'
    check (
      category in (
        'tuition',
        'lesson-ticket',
        'book-sale',
        'payroll',
        'book-order',
        'rent',
        'utilities',
        'tuning-repair',
        'supplies',
        'tax',
        'other'
      )
    ),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles (id);

update public.ledger_entries
set category = case source::text
  when 'tuition' then 'tuition'
  when 'lesson-ticket' then 'lesson-ticket'
  when 'book-sale' then 'book-sale'
  when 'payroll' then 'payroll'
  else 'other'
end
where category = 'other';

create index if not exists ledger_entries_academy_category_idx
  on public.ledger_entries (academy_id, category, occurred_on);

create or replace function private.set_ledger_entry_update_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

revoke all on function private.set_ledger_entry_update_metadata() from public;

drop trigger if exists ledger_entries_set_updated_at on public.ledger_entries;

create trigger ledger_entries_set_updated_at
before update on public.ledger_entries
for each row execute function private.set_ledger_entry_update_metadata();

drop policy if exists "ledger_entries_select_owner_only" on public.ledger_entries;
drop policy if exists "ledger_entries_insert_owner_only" on public.ledger_entries;
drop policy if exists "ledger_entries_select_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_insert_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_update_owner_desk_finance" on public.ledger_entries;
drop policy if exists "ledger_entries_delete_owner_desk_finance" on public.ledger_entries;

grant select, insert, update, delete on public.ledger_entries to authenticated;

create policy "ledger_entries_select_owner_desk_finance"
on public.ledger_entries for select
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "ledger_entries_insert_owner_desk_finance"
on public.ledger_entries for insert
to authenticated
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "ledger_entries_update_owner_desk_finance"
on public.ledger_entries for update
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]))
with check (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create policy "ledger_entries_delete_owner_desk_finance"
on public.ledger_entries for delete
to authenticated
using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

create or replace function private.audit_ledger_entry_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_academy_id uuid := coalesce(new.academy_id, old.academy_id);
  event_entity_id text := coalesce(new.id, old.id)::text;
begin
  insert into public.audit_events (
    academy_id,
    actor_id,
    event_type,
    entity_table,
    entity_id,
    metadata
  )
  values (
    event_academy_id,
    (select auth.uid()),
    'ledger_entries.' || lower(tg_op),
    'ledger_entries',
    event_entity_id,
    jsonb_build_object(
      'old_row', case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
      'new_row', case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.audit_ledger_entry_changes() from public;

drop trigger if exists ledger_entries_audit_insert on public.ledger_entries;
drop trigger if exists ledger_entries_audit_update on public.ledger_entries;
drop trigger if exists ledger_entries_audit_delete on public.ledger_entries;

create trigger ledger_entries_audit_insert
after insert on public.ledger_entries
for each row execute function private.audit_ledger_entry_changes();

create trigger ledger_entries_audit_update
after update on public.ledger_entries
for each row execute function private.audit_ledger_entry_changes();

create trigger ledger_entries_audit_delete
after delete on public.ledger_entries
for each row execute function private.audit_ledger_entry_changes();

alter table public.fixed_income_snapshots
  add column if not exists due_on date,
  add column if not exists lesson_fee integer not null default 0
    check (lesson_fee >= 0),
  add column if not exists discount_total integer not null default 0
    check (discount_total >= 0),
  add column if not exists discount_label text,
  add column if not exists progress text not null default '',
  add column if not exists paid_ledger_entry_id uuid;

update public.fixed_income_snapshots
set due_on = to_date(month || '-01', 'YYYY-MM-DD')
where due_on is null;

alter table public.fixed_income_snapshots
  alter column due_on set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fixed_income_snapshots_paid_ledger_fk'
  ) then
    alter table public.fixed_income_snapshots
      add constraint fixed_income_snapshots_paid_ledger_fk
      foreign key (academy_id, paid_ledger_entry_id)
      references public.ledger_entries (academy_id, id)
      on delete set null (paid_ledger_entry_id);
  end if;
end;
$$;

create or replace function public.ensure_monthly_fixed_income_snapshots(
  p_academy_id uuid,
  p_month text
)
returns setof public.fixed_income_snapshots
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  month_start date := to_date(p_month || '-01', 'YYYY-MM-DD');
  month_end date := (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
begin
  if not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception 'not allowed to generate finance snapshots';
  end if;

  insert into public.fixed_income_snapshots (
    academy_id,
    month,
    student_id,
    student_instrument_id,
    student_name,
    instrument_id,
    instrument_name,
    amount,
    due_on,
    lesson_fee,
    discount_total,
    discount_label,
    progress
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
      else (month_end + interval '1 day')::date
    end,
    instrument.lesson_fee,
    instrument.discount_total,
    null,
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
  on conflict (academy_id, month, student_id, instrument_id)
  do update set
    student_instrument_id = excluded.student_instrument_id,
    student_name = excluded.student_name,
    instrument_name = excluded.instrument_name,
    amount = excluded.amount,
    due_on = excluded.due_on,
    lesson_fee = excluded.lesson_fee,
    discount_total = excluded.discount_total,
    discount_label = excluded.discount_label,
    progress = excluded.progress,
    updated_at = now();

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

alter table public.book_inventory_batches
  add column if not exists ordered_on date;

update public.book_inventory_batches
set ordered_on = stocked_at
where ordered_on is null;

alter table public.book_inventory_batches
  alter column ordered_on set not null;

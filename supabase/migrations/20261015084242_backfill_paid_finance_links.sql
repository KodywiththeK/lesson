insert into public.ledger_entries (
  academy_id, occurred_on, entry_type, source, category, amount,
  description, ref_table, ref_id
)
select
  b.academy_id, b.paid_at, 'income', 'book-sale', 'book-sale', b.price,
  '교재 판매: ' || b.book_title || ' / ' || b.student_name,
  'book_releases', b.id::text
from public.book_releases b
where b.status = 'paid'
  and b.paid_at is not null
  and not exists (
    select 1 from public.ledger_entries l
    where l.academy_id = b.academy_id
      and l.ref_table = 'book_releases'
      and l.ref_id = b.id::text
  );

update public.fixed_income_snapshots s
set paid_ledger_entry_id = l.id
from public.ledger_entries l
where s.status = 'paid'
  and s.paid_ledger_entry_id is null
  and l.academy_id = s.academy_id
  and l.ref_table = 'fixed_income_snapshots'
  and l.ref_id = s.id::text;

with inserted as (
  insert into public.ledger_entries (
    academy_id, occurred_on, entry_type, source, category, amount,
    description, ref_table, ref_id
  )
  select
    s.academy_id, s.paid_at, 'income', 'tuition', 'tuition', s.amount,
    '월수강료: ' || s.student_name || ' / ' || s.instrument_name || ' / ' || s.month,
    'fixed_income_snapshots', s.id::text
  from public.fixed_income_snapshots s
  where s.status = 'paid'
    and s.paid_at is not null
    and s.amount > 0
    and s.paid_ledger_entry_id is null
    and not exists (
      select 1 from public.ledger_entries l
      where l.academy_id = s.academy_id
        and l.ref_table = 'fixed_income_snapshots'
        and l.ref_id = s.id::text
    )
  returning id, academy_id, ref_id
)
update public.fixed_income_snapshots s
set paid_ledger_entry_id = inserted.id
from inserted
where s.academy_id = inserted.academy_id
  and s.id::text = inserted.ref_id;

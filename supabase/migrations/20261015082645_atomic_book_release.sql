create function public.register_book_release(
  p_academy_id uuid,
  p_student_id uuid,
  p_student_name text,
  p_book_title text,
  p_price integer,
  p_shipped_at date,
  p_status text
)
returns public.book_releases
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_book_id uuid;
  created_release public.book_releases;
begin
  if nullif(btrim(p_student_name), '') is null
    or nullif(btrim(p_book_title), '') is null
    or p_price is null or p_price <= 0
    or p_shipped_at is null
    or p_status not in ('payment-pending', 'paid') then
    raise exception '교재 출고 입력값을 확인해주세요.';
  end if;

  insert into public.books (academy_id, title, price)
  values (p_academy_id, btrim(p_book_title), p_price)
  returning id into created_book_id;

  insert into public.book_releases (
    academy_id, book_id, student_id, student_name, book_title,
    price, shipped_at, status, paid_at, created_by
  ) values (
    p_academy_id, created_book_id, p_student_id, btrim(p_student_name),
    btrim(p_book_title), p_price, p_shipped_at, p_status,
    case when p_status = 'paid' then p_shipped_at else null end, auth.uid()
  ) returning * into created_release;

  if p_status = 'paid' then
    insert into public.ledger_entries (
      academy_id, occurred_on, entry_type, source, category, amount,
      description, ref_table, ref_id, created_by
    ) values (
      p_academy_id, p_shipped_at, 'income', 'book-sale', 'book-sale', p_price,
      '교재 판매: ' || btrim(p_book_title) || ' / ' || btrim(p_student_name),
      'book_releases', created_release.id::text, auth.uid()
    );
  end if;

  return created_release;
end;
$$;

revoke all on function public.register_book_release(uuid, uuid, text, text, integer, date, text) from public;
grant execute on function public.register_book_release(uuid, uuid, text, text, integer, date, text) to authenticated;

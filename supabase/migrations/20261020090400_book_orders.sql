-- 교재 발주, 전량 입고, 지급. 운영 DB 적용 전 격리 DB에서 역할·동시성 검증이 필요하다.
create table public.book_orders (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  vendor_id uuid,
  vendor_name text not null,
  ordered_on date not null,
  received_on date,
  paid_on date,
  paid_ledger_entry_id uuid,
  status text not null default 'ordered' check (status in ('ordered', 'received', 'cancelled')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, id),
  constraint book_orders_vendor_fk foreign key (academy_id, vendor_id)
    references public.vendors (academy_id, id) on delete set null (vendor_id),
  constraint book_orders_paid_ledger_fk foreign key (academy_id, paid_ledger_entry_id)
    references public.ledger_entries (academy_id, id) on delete set null (paid_ledger_entry_id),
  constraint book_orders_received_state_check check (
    (status = 'received' and received_on is not null)
    or (status <> 'received' and received_on is null)
  ),
  constraint book_orders_payment_state_check check (paid_on is not null or paid_ledger_entry_id is null)
);

create table public.book_order_items (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null,
  order_id uuid not null,
  book_id uuid,
  title text not null,
  quantity integer not null check (quantity between 1 and 9999),
  purchase_price integer not null check (purchase_price between 1 and 9999999),
  sale_price integer check (sale_price between 1 and 9999999),
  prior_stocked_on date,
  created_book boolean not null default false,
  created_at timestamptz not null default now(),
  unique (academy_id, id),
  constraint book_order_items_order_fk foreign key (academy_id, order_id)
    references public.book_orders (academy_id, id) on delete cascade,
  constraint book_order_items_book_fk foreign key (academy_id, book_id)
    references public.books (academy_id, id)
);

create index book_orders_academy_ordered_idx on public.book_orders (academy_id, ordered_on desc, id);
create index book_order_items_order_idx on public.book_order_items (academy_id, order_id);

alter table public.book_inventory_batches
  add column if not exists order_item_id uuid,
  add column if not exists reversed_at timestamptz;

alter table public.book_inventory_batches
  add constraint book_inventory_batches_order_item_fk
  foreign key (academy_id, order_item_id)
  references public.book_order_items (academy_id, id);

create unique index book_inventory_batches_order_item_key
  on public.book_inventory_batches (order_item_id) where order_item_id is not null;

alter table public.book_orders enable row level security;
alter table public.book_order_items enable row level security;

create policy book_orders_owner_desk_read on public.book_orders for select to authenticated
  using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));
create policy book_order_items_owner_desk_read on public.book_order_items for select to authenticated
  using (private.has_academy_role(academy_id, array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]));

revoke all on public.book_orders from anon, authenticated;
revoke all on public.book_order_items from anon, authenticated;
grant select on public.book_orders, public.book_order_items to authenticated;
revoke insert, update, delete on public.book_inventory_batches from authenticated;

create or replace function private.book_order_payload(p_academy_id uuid, p_order_id uuid)
returns jsonb
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select jsonb_build_object(
    'id', o.id, 'academy_id', o.academy_id, 'vendor_id', o.vendor_id,
    'vendor_name', o.vendor_name, 'ordered_on', o.ordered_on,
    'received_on', o.received_on, 'paid_on', o.paid_on,
    'paid_ledger_entry_id', o.paid_ledger_entry_id, 'status', o.status,
    'ledger_mismatch', o.paid_on is not null and (
      l.id is null or l.entry_type is distinct from 'expense' or l.category is distinct from 'book-order'
      or l.ref_table is distinct from 'book_orders' or l.ref_id is distinct from o.id::text
      or l.amount is distinct from (
        select sum(i.purchase_price::bigint * i.quantity)
        from public.book_order_items i where i.academy_id = o.academy_id and i.order_id = o.id
      ) or l.occurred_on is distinct from o.paid_on
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'book_id', i.book_id, 'title', i.title,
        'quantity', i.quantity, 'purchase_price', i.purchase_price, 'sale_price', i.sale_price
      ) order by i.created_at, i.id)
      from public.book_order_items i where i.academy_id = o.academy_id and i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.book_orders o
  left join public.ledger_entries l on l.academy_id = o.academy_id and l.id = o.paid_ledger_entry_id
  where o.academy_id = p_academy_id and o.id = p_order_id;
$$;

create or replace function private.replace_book_order_items(
  p_academy_id uuid, p_order_id uuid, p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_item jsonb;
  v_book public.books%rowtype;
  v_book_id uuid;
  v_title text;
  v_quantity integer;
  v_purchase_price integer;
  v_total bigint := 0;
  v_keys text[] := '{}';
  v_key text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '발주할 교재를 추가해 주세요.';
  end if;

  delete from public.book_order_items
  where academy_id = p_academy_id and order_id = p_order_id;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_book_id := nullif(v_item->>'book_id', '')::uuid;
    v_title := btrim(regexp_replace(coalesce(v_item->>'title', ''), '[[:space:]]+', ' ', 'g'));
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    v_purchase_price := nullif(v_item->>'purchase_price', '')::integer;

    if v_book_id is not null then
      select * into v_book from public.books
      where academy_id = p_academy_id and id = v_book_id and active;
      if not found then raise exception '선택한 교재를 찾을 수 없습니다. 재고 목록을 새로고침해 주세요.'; end if;
      v_title := v_book.title;
    elsif v_title = '' or char_length(v_title) > 100 then
      raise exception '도서명은 1자 이상 100자 이하로 입력해 주세요.';
    end if;

    v_key := private.normalize_book_title(v_title);
    if v_key = any(v_keys) then raise exception '같은 교재를 한 발주에 두 번 넣을 수 없습니다.'; end if;
    v_keys := array_append(v_keys, v_key);

    if v_quantity is null or v_quantity not between 1 and 9999 then
      raise exception '발주 수량은 1권 이상 9,999권 이하로 입력해 주세요.';
    end if;
    if v_purchase_price is null or v_purchase_price not between 1 and 9999999 then
      raise exception '매입가는 1원 이상 9,999,999원 이하로 입력해 주세요.';
    end if;
    v_total := v_total + v_quantity::bigint * v_purchase_price;
    if v_total > 2147483647 then
      raise exception '발주 금액이 너무 큽니다. 품목의 수량이나 매입가를 줄여 주세요.';
    end if;

    insert into public.book_order_items (
      academy_id, order_id, book_id, title, quantity, purchase_price, sale_price
    ) values (
      p_academy_id, p_order_id, v_book_id, v_title, v_quantity, v_purchase_price, null
    );
  end loop;
end;
$$;

create or replace function public.list_book_orders(p_academy_id uuid)
returns setof jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_order_id uuid;
begin
  perform private.assert_book_role(p_academy_id, false, '교재 발주를 볼 권한이 없습니다.');
  for v_order_id in
    select id from public.book_orders
    where academy_id = p_academy_id
    order by ordered_on desc, id
  loop
    return next private.book_order_payload(p_academy_id, v_order_id);
  end loop;
end;
$$;

create or replace function public.create_book_order(
  p_academy_id uuid, p_vendor_id uuid, p_ordered_on date, p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_vendor_name text;
  v_order_id uuid;
begin
  perform private.assert_book_role(p_academy_id, false, '교재 발주를 등록할 권한이 없습니다.');
  if p_ordered_on is null then raise exception '발주일을 선택해 주세요.'; end if;
  select name into v_vendor_name from public.vendors
  where academy_id = p_academy_id and id = p_vendor_id;
  if not found then raise exception '거래처를 선택해 주세요.'; end if;

  insert into public.book_orders (academy_id, vendor_id, vendor_name, ordered_on, created_by)
  values (p_academy_id, p_vendor_id, v_vendor_name, p_ordered_on, (select auth.uid()))
  returning id into v_order_id;
  perform private.replace_book_order_items(p_academy_id, v_order_id, p_items);
  return private.book_order_payload(p_academy_id, v_order_id);
end;
$$;

create or replace function public.update_book_order(
  p_academy_id uuid, p_order_id uuid, p_vendor_id uuid, p_ordered_on date, p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.book_orders%rowtype;
  v_vendor_name text;
begin
  perform private.assert_book_role(p_academy_id, false, '교재 발주를 수정할 권한이 없습니다.');
  select * into v_order from public.book_orders
  where academy_id = p_academy_id and id = p_order_id for update;
  if not found then raise exception '발주를 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_order.status <> 'ordered' or v_order.paid_on is not null then
    raise exception '입고 또는 지급한 발주는 먼저 해당 처리를 취소해야 수정할 수 있습니다.';
  end if;
  if p_ordered_on is null then raise exception '발주일을 선택해 주세요.'; end if;
  select name into v_vendor_name from public.vendors
  where academy_id = p_academy_id and id = p_vendor_id;
  if not found then raise exception '거래처를 선택해 주세요.'; end if;

  update public.book_orders set vendor_id = p_vendor_id, vendor_name = v_vendor_name,
    ordered_on = p_ordered_on, updated_at = now()
  where academy_id = p_academy_id and id = p_order_id;
  perform private.replace_book_order_items(p_academy_id, p_order_id, p_items);
  return private.book_order_payload(p_academy_id, p_order_id);
end;
$$;

create or replace function public.receive_book_order(
  p_academy_id uuid, p_order_id uuid, p_received_on date, p_sale_prices jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.book_orders%rowtype;
  v_item public.book_order_items%rowtype;
  v_book_id uuid;
  v_book public.books%rowtype;
  v_sale_price integer;
begin
  perform private.assert_book_role(p_academy_id, false, '교재 입고를 처리할 권한이 없습니다.');
  select * into v_order from public.book_orders
  where academy_id = p_academy_id and id = p_order_id for update;
  if not found then raise exception '발주를 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_order.status <> 'ordered' then raise exception '이미 입고 또는 취소된 발주입니다.'; end if;
  if p_received_on is null then raise exception '입고일을 선택해 주세요.'; end if;

  for v_item in select * from public.book_order_items
    where academy_id = p_academy_id and order_id = p_order_id order by id
  loop
    if v_item.book_id is null then
      v_sale_price := nullif(p_sale_prices ->> v_item.id::text, '')::integer;
      if v_sale_price is null or v_sale_price not between 1 and 9999999 then
        raise exception '%의 판매가는 1원 이상 9,999,999원 이하로 입력해 주세요.', v_item.title;
      end if;
      begin
        insert into public.books (academy_id, title, title_key, price, quantity, stocked_on)
        values (p_academy_id, v_item.title, private.normalize_book_title(v_item.title),
          v_sale_price, v_item.quantity, p_received_on)
        returning id into v_book_id;
      exception when unique_violation then
        raise exception '같은 이름의 교재가 새로 등록되었습니다. 발주를 수정해 기존 교재를 선택해 주세요.';
      end;
      update public.book_order_items set book_id = v_book_id, sale_price = v_sale_price,
        created_book = true
      where academy_id = p_academy_id and id = v_item.id;
    else
      select * into v_book from public.books
      where academy_id = p_academy_id and id = v_item.book_id for update;
      if not found or not v_book.active then
        raise exception '보관되었거나 찾을 수 없는 교재가 있습니다. 발주를 수정해 주세요.';
      end if;
      if v_book.quantity + v_item.quantity > 9999 then
        raise exception '입고 후 재고가 9,999권을 넘습니다. 발주 수량을 수정해 주세요.';
      end if;
      update public.books set quantity = quantity + v_item.quantity, stocked_on = p_received_on
      where academy_id = p_academy_id and id = v_item.book_id;
      update public.book_order_items set prior_stocked_on = v_book.stocked_on
      where academy_id = p_academy_id and id = v_item.id;
      v_book_id := v_item.book_id;
    end if;

    insert into public.book_inventory_batches (
      academy_id, book_id, order_item_id, quantity, ordered_on, stocked_at, created_by, created_at
    ) values (
      p_academy_id, v_book_id, v_item.id, v_item.quantity, v_order.ordered_on,
      p_received_on, (select auth.uid()), clock_timestamp()
    );
  end loop;

  update public.book_orders set status = 'received', received_on = p_received_on,
    updated_at = now() where academy_id = p_academy_id and id = p_order_id;
  return private.book_order_payload(p_academy_id, p_order_id);
end;
$$;

create or replace function public.pay_book_order(
  p_academy_id uuid, p_order_id uuid, p_paid_on date
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.book_orders%rowtype;
  v_total bigint;
  v_ledger_id uuid;
begin
  perform private.assert_book_role(p_academy_id, true, '교재 발주 지급은 원장만 처리할 수 있습니다.');
  select * into v_order from public.book_orders
  where academy_id = p_academy_id and id = p_order_id for update;
  if not found then raise exception '발주를 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_order.status = 'cancelled' then raise exception '취소한 발주는 지급할 수 없습니다.'; end if;
  if v_order.paid_on is not null then raise exception '이미 지급한 발주입니다.'; end if;
  if p_paid_on is null then raise exception '지급일을 선택해 주세요.'; end if;

  select sum(quantity::bigint * purchase_price) into v_total from public.book_order_items
  where academy_id = p_academy_id and order_id = p_order_id;

  insert into public.ledger_entries (
    academy_id, occurred_on, entry_type, source, category, amount,
    description, ref_table, ref_id, created_by
  ) values (
    p_academy_id, p_paid_on, 'expense', 'book-order', 'book-order', v_total::integer,
    '교재 발주: ' || v_order.vendor_name, 'book_orders', p_order_id::text, (select auth.uid())
  ) returning id into v_ledger_id;

  update public.book_orders set paid_on = p_paid_on, paid_ledger_entry_id = v_ledger_id,
    updated_at = now() where academy_id = p_academy_id and id = p_order_id;
  return private.book_order_payload(p_academy_id, p_order_id);
end;
$$;

create or replace function public.undo_book_order_payment(
  p_academy_id uuid, p_order_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare v_order public.book_orders%rowtype;
begin
  perform private.assert_book_role(p_academy_id, true, '교재 발주 지급 취소는 원장만 처리할 수 있습니다.');
  if btrim(coalesce(p_reason, '')) = '' then raise exception '지급 취소 사유를 입력해 주세요.'; end if;
  select * into v_order from public.book_orders
  where academy_id = p_academy_id and id = p_order_id for update;
  if not found or v_order.paid_on is null then
    raise exception '지급 기록을 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;
  if v_order.status = 'cancelled' then raise exception '이미 취소한 발주입니다.'; end if;

  if coalesce((private.book_order_payload(p_academy_id, p_order_id)->>'ledger_mismatch')::boolean, true) then
    raise exception '연결 원장 내역을 정정한 뒤 지급 취소를 다시 시도해 주세요.';
  end if;

  update public.book_orders set paid_on = null, paid_ledger_entry_id = null, updated_at = now()
  where academy_id = p_academy_id and id = p_order_id;
  delete from public.ledger_entries where academy_id = p_academy_id and id = v_order.paid_ledger_entry_id;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata)
  values (p_academy_id, (select auth.uid()), 'book_order.payment_undone', 'book_orders', p_order_id::text,
    p_reason, jsonb_build_object('paid_on', v_order.paid_on, 'ledger_id', v_order.paid_ledger_entry_id));
  return private.book_order_payload(p_academy_id, p_order_id);
end;
$$;

create or replace function public.cancel_book_order(
  p_academy_id uuid, p_order_id uuid, p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_order public.book_orders%rowtype;
  v_item public.book_order_items%rowtype;
  v_stock integer;
begin
  perform private.assert_book_role(p_academy_id, false, '교재 발주를 취소할 권한이 없습니다.');
  if btrim(coalesce(p_reason, '')) = '' then raise exception '발주 취소 사유를 입력해 주세요.'; end if;
  select * into v_order from public.book_orders
  where academy_id = p_academy_id and id = p_order_id for update;
  if not found then raise exception '발주를 찾을 수 없습니다. 목록을 새로고침해 주세요.'; end if;
  if v_order.status = 'cancelled' then raise exception '이미 취소한 발주입니다.'; end if;
  if v_order.paid_on is not null then
    perform private.assert_book_role(p_academy_id, true, '지급한 발주의 취소는 원장만 처리할 수 있습니다.');
    if coalesce((private.book_order_payload(p_academy_id, p_order_id)->>'ledger_mismatch')::boolean, true) then
      raise exception '연결 원장 내역을 정정한 뒤 발주 취소를 다시 시도해 주세요.';
    end if;
  end if;

  if v_order.status = 'received' then
    for v_item in select * from public.book_order_items
      where academy_id = p_academy_id and order_id = p_order_id order by book_id
    loop
      select quantity into v_stock from public.books
      where academy_id = p_academy_id and id = v_item.book_id for update;
      if exists (
        select 1 from public.book_inventory_batches later_batch
        join public.book_inventory_batches current_batch
          on current_batch.academy_id = p_academy_id and current_batch.order_item_id = v_item.id
        where later_batch.academy_id = p_academy_id
          and later_batch.book_id = v_item.book_id
          and later_batch.reversed_at is null
          and later_batch.created_at > current_batch.created_at
      ) then
        raise exception '이 교재는 나중에 입고한 발주부터 역순으로 취소해 주세요.';
      end if;
      if exists (
        select 1
        from public.book_releases release
        join public.book_inventory_batches batch
          on batch.academy_id = p_academy_id and batch.order_item_id = v_item.id
        where release.academy_id = p_academy_id
          and release.book_id = v_item.book_id
          and release.created_at >= batch.created_at
      ) then
        raise exception '입고 이후 이 교재가 출고되어 발주 재고를 안전하게 되돌릴 수 없습니다. 출고 내역을 확인해 주세요.';
      end if;
      if v_stock is null or v_stock < v_item.quantity then
        raise exception '이미 판매된 교재가 있어 입고를 되돌릴 수 없습니다. 출고 내역을 먼저 확인해 주세요.';
      end if;
      if v_item.created_book and v_stock <> v_item.quantity then
        raise exception '처음 등록한 교재의 재고가 변경되었습니다. 재고 내역을 확인한 뒤 다시 시도해 주세요.';
      end if;
      if v_item.created_book then
        update public.books set quantity = 0, active = false, updated_at = now()
        where academy_id = p_academy_id and id = v_item.book_id;
      else
        update public.books set quantity = quantity - v_item.quantity,
          stocked_on = v_item.prior_stocked_on, updated_at = now()
        where academy_id = p_academy_id and id = v_item.book_id;
      end if;
      update public.book_inventory_batches set reversed_at = now()
      where academy_id = p_academy_id and order_item_id = v_item.id;
    end loop;
  end if;

  update public.book_orders set status = 'cancelled', received_on = null,
    paid_on = null, paid_ledger_entry_id = null, updated_at = now()
  where academy_id = p_academy_id and id = p_order_id;
  delete from public.ledger_entries where academy_id = p_academy_id and id = v_order.paid_ledger_entry_id;
  insert into public.audit_events (academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata)
  values (p_academy_id, (select auth.uid()), 'book_order.cancelled', 'book_orders', p_order_id::text,
    p_reason, jsonb_build_object('received_on', v_order.received_on, 'paid_on', v_order.paid_on));
  return private.book_order_payload(p_academy_id, p_order_id);
end;
$$;

revoke all on function private.book_order_payload(uuid, uuid) from public, anon, authenticated;
revoke all on function private.replace_book_order_items(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.list_book_orders(uuid) from public, anon;
revoke all on function public.create_book_order(uuid, uuid, date, jsonb) from public, anon;
revoke all on function public.update_book_order(uuid, uuid, uuid, date, jsonb) from public, anon;
revoke all on function public.receive_book_order(uuid, uuid, date, jsonb) from public, anon;
revoke all on function public.pay_book_order(uuid, uuid, date) from public, anon;
revoke all on function public.undo_book_order_payment(uuid, uuid, text) from public, anon;
revoke all on function public.cancel_book_order(uuid, uuid, text) from public, anon;
grant execute on function public.list_book_orders(uuid) to authenticated;
grant execute on function public.create_book_order(uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.update_book_order(uuid, uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.receive_book_order(uuid, uuid, date, jsonb) to authenticated;
grant execute on function public.pay_book_order(uuid, uuid, date) to authenticated;
grant execute on function public.undo_book_order_payment(uuid, uuid, text) to authenticated;
grant execute on function public.cancel_book_order(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

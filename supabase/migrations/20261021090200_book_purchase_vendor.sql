-- 교재 구입 거래처명(선택). 2026-10-22 제품 결정.
--
-- 교재를 어느 거래처에서 샀는지 자유 텍스트로 남긴다. vendors 테이블과 연결하지 않는 이유는
-- 거래처가 삭제되어도 구입 기록이 남아야 하고, 등록 때 거래처를 먼저 만들 필요가 없어야 하기 때문이다.
--
-- 규칙
--   - register_book_stock(재입고 포함): 입력하면 덮어쓰고, 비우면 기존 값을 유지한다.
--   - update_book(수정 폼): 폼 값 그대로 저장하므로 비우면 지운다.
--
-- PostgREST는 이름이 같고 인자가 다른 함수를 오버로드로 보고 호출을 모호하게 만들 수 있어 기존 시그니처를 지운다.

alter table public.books
  add column if not exists purchase_vendor_name text;

alter table public.books
  drop constraint if exists books_purchase_vendor_name_check,
  add constraint books_purchase_vendor_name_check
    check (purchase_vendor_name is null or char_length(purchase_vendor_name) <= 100);

drop function if exists public.register_book_stock(uuid, text, integer, integer, date);
drop function if exists public.update_book(uuid, uuid, text, integer, integer, date);

create or replace function public.register_book_stock(
  p_academy_id uuid,
  p_title text,
  p_price integer,
  p_quantity integer,
  p_stocked_on date,
  p_purchase_vendor_name text default null
)
returns public.books
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'));
  v_vendor text := nullif(btrim(coalesce(p_purchase_vendor_name, '')), '');
  v_book public.books%rowtype;
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  if v_title = '' then
    raise exception '도서명을 입력해 주세요.';
  end if;

  if char_length(v_title) > 100 then
    raise exception '도서명은 100자 이하로 입력해 주세요.';
  end if;

  if p_price is null or p_price < 1 or p_price > 9999999 then
    raise exception '가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.';
  end if;

  if p_quantity is null or p_quantity < 0 or p_quantity > 9999 then
    raise exception '권수는 0권 이상 9,999권 이하의 정수로 입력해 주세요.';
  end if;

  if p_stocked_on is null or p_stocked_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '입고일은 오늘 이후로 정할 수 없습니다.';
  end if;

  if v_vendor is not null and char_length(v_vendor) > 100 then
    raise exception '구입 거래처명은 100자 이하로 입력해 주세요.';
  end if;

  insert into public.books (academy_id, title, price, quantity, stocked_on, title_key, purchase_vendor_name)
  values (p_academy_id, v_title, p_price, p_quantity, p_stocked_on, private.normalize_book_title(v_title), v_vendor)
  on conflict (academy_id, title_key) where active
  do update set
    quantity = public.books.quantity + excluded.quantity,
    price = excluded.price,
    stocked_on = excluded.stocked_on,
    purchase_vendor_name = coalesce(excluded.purchase_vendor_name, public.books.purchase_vendor_name)
  returning * into v_book;

  if v_book.quantity > 9999 then
    raise exception '재고는 9,999권을 넘을 수 없습니다.';
  end if;

  return v_book;
end;
$$;

create or replace function public.update_book(
  p_academy_id uuid,
  p_book_id uuid,
  p_title text,
  p_price integer,
  p_quantity integer,
  p_stocked_on date,
  p_purchase_vendor_name text default null
)
returns public.books
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'));
  v_vendor text := nullif(btrim(coalesce(p_purchase_vendor_name, '')), '');
  v_book public.books%rowtype;
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  if v_title = '' then
    raise exception '도서명을 입력해 주세요.';
  end if;

  if char_length(v_title) > 100 then
    raise exception '도서명은 100자 이하로 입력해 주세요.';
  end if;

  if p_price is null or p_price < 1 or p_price > 9999999 then
    raise exception '가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.';
  end if;

  if p_quantity is null or p_quantity < 0 or p_quantity > 9999 then
    raise exception '권수는 0권 이상 9,999권 이하의 정수로 입력해 주세요.';
  end if;

  if p_stocked_on is null or p_stocked_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '입고일은 오늘 이후로 정할 수 없습니다.';
  end if;

  if v_vendor is not null and char_length(v_vendor) > 100 then
    raise exception '구입 거래처명은 100자 이하로 입력해 주세요.';
  end if;

  select *
  into v_book
  from public.books
  where academy_id = p_academy_id
    and id = p_book_id
    and active
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  begin
    update public.books
    set
      title = v_title,
      title_key = private.normalize_book_title(v_title),
      price = p_price,
      quantity = p_quantity,
      stocked_on = p_stocked_on,
      purchase_vendor_name = v_vendor
    where academy_id = p_academy_id
      and id = p_book_id
    returning * into v_book;
  exception
    when unique_violation then
      raise exception '이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.';
  end;

  return v_book;
end;
$$;

revoke all on function public.register_book_stock(uuid, text, integer, integer, date, text) from public, anon;
grant execute on function public.register_book_stock(uuid, text, integer, integer, date, text) to authenticated;
revoke all on function public.update_book(uuid, uuid, text, integer, integer, date, text) from public, anon;
grant execute on function public.update_book(uuid, uuid, text, integer, integer, date, text) to authenticated;

notify pgrst, 'reload schema';

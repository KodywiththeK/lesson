-- 교재 재고·출고 RPC (2026-10-17 교재 관리 명세, docs/product/book-management-spec.md)
--
-- 교재·출고는 이 RPC로만 바꾼다(브라우저 직접 쓰기 권한은 이전 migration에서 회수).
-- 권한: 교재·재고·출고(결제 전) 관리는 owner·desk, 결제 처리·결제 취소·바로 결제 완료는 owner.
-- 재고 변경은 모두 private.apply_book_stock_delta를 거치고, 결제 완료 원장 행 생성은 모두
-- private.mark_book_release_paid를 거친다(출고 등록의 바로 결제 완료와 결제 처리가 같은 코드를 쓴다).
-- 오류 문구는 docs/product/book-management-spec.md 8장과 같다.

-- 새 출고 등록 시그니처로 바꾸므로 이전 7인자 함수(교재명을 직접 받던 방식)를 지운다.
drop function if exists public.register_book_release(uuid, uuid, text, text, integer, date, text);

create or replace function private.assert_book_role(
  p_academy_id uuid,
  p_owner_only boolean,
  p_denied_message text
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if not private.has_academy_role(
    p_academy_id,
    case
      when p_owner_only then array['owner'::public.academy_member_role]
      else array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
    end
  ) then
    raise exception '%', p_denied_message;
  end if;
end;
$$;

-- 재고를 delta만큼 바꾼다. 교재 행을 잠그고 0 미만이 되면 한국어로 거부한다.
create or replace function private.apply_book_stock_delta(
  p_academy_id uuid,
  p_book_id uuid,
  p_delta integer
)
returns integer
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_quantity integer;
begin
  select quantity
  into v_quantity
  from public.books
  where academy_id = p_academy_id
    and id = p_book_id
  for update;

  if not found then
    raise exception '교재를 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_quantity + p_delta < 0 then
    if v_quantity = 0 then
      raise exception '재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.';
    end if;

    raise exception '재고가 부족합니다. 남은 재고는 %권입니다.', v_quantity;
  end if;

  update public.books
  set quantity = v_quantity + p_delta
  where academy_id = p_academy_id
    and id = p_book_id;

  return v_quantity + p_delta;
end;
$$;

-- 결제 완료 처리: 입출입내역 수입 행(금액 = 단가 × 수량, 발생일 = 입금일)을 만들고 출고와 연결한다.
create or replace function private.mark_book_release_paid(
  p_academy_id uuid,
  p_release_id uuid,
  p_paid_on date
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_release public.book_releases%rowtype;
  v_ledger_id uuid;
begin
  select *
  into v_release
  from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_release.status = 'paid' then
    raise exception '이미 결제 완료된 출고입니다.';
  end if;

  if p_paid_on < v_release.shipped_at then
    raise exception '입금일은 출고일(%) 이후여야 합니다.', to_char(v_release.shipped_at, 'YYYY-MM-DD');
  end if;

  insert into public.ledger_entries (
    academy_id, occurred_on, entry_type, source, category, amount,
    description, ref_table, ref_id, created_by
  )
  values (
    p_academy_id,
    p_paid_on,
    'income',
    'book-sale',
    'book-sale',
    v_release.price * v_release.quantity,
    '교재 판매: ' || v_release.book_title
      || case when v_release.quantity > 1 then ' × ' || v_release.quantity || '권' else '' end
      || ' / ' || v_release.student_name,
    'book_releases',
    v_release.id::text,
    (select auth.uid())
  )
  returning id into v_ledger_id;

  update public.book_releases
  set
    status = 'paid',
    paid_at = p_paid_on,
    paid_ledger_entry_id = v_ledger_id
  where academy_id = p_academy_id
    and id = p_release_id
  returning * into v_release;

  return v_release;
end;
$$;

-- 교재 등록 또는 재입고. 같은 도서명이면 기존 교재에 권수를 더하고 입고일·가격을 갱신한다.
create or replace function public.register_book_stock(
  p_academy_id uuid,
  p_title text,
  p_price integer,
  p_quantity integer,
  p_stocked_on date
)
returns public.books
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'));
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

  insert into public.books (academy_id, title, price, quantity, stocked_on, title_key)
  values (p_academy_id, v_title, p_price, p_quantity, p_stocked_on, private.normalize_book_title(v_title))
  on conflict (academy_id, title_key) where active
  do update set
    quantity = public.books.quantity + excluded.quantity,
    price = excluded.price,
    stocked_on = excluded.stocked_on
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
  p_stocked_on date
)
returns public.books
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_title text := btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'));
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
      stocked_on = p_stocked_on
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

-- 삭제는 보관 처리다. 재고 목록과 출고 선택지에서 사라지지만 판매 기록은 도서명·가격 스냅샷으로 남는다.
create or replace function public.delete_book(
  p_academy_id uuid,
  p_book_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  update public.books
  set active = false
  where academy_id = p_academy_id
    and id = p_book_id
    and active;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;
end;
$$;

-- 출고 등록. 재고를 수량만큼 차감하고, 원장은 바로 결제 완료(입금일 기본 출고일)로 등록할 수 있다.
create or replace function public.register_book_release(
  p_academy_id uuid,
  p_student_id uuid,
  p_book_id uuid,
  p_price integer,
  p_quantity integer,
  p_shipped_on date,
  p_status text default 'payment-pending',
  p_paid_on date default null
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_student_name text;
  v_student_status text;
  v_book public.books%rowtype;
  v_release public.book_releases%rowtype;
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  if p_status is null or p_status not in ('payment-pending', 'paid') then
    raise exception '교재 출고 입력값을 확인해 주세요.';
  end if;

  if p_status = 'paid' then
    perform private.assert_book_role(
      p_academy_id, true, '이 작업을 할 권한이 없습니다. 결제 확인과 취소는 원장만 할 수 있습니다.'
    );
  end if;

  if p_price is null or p_price < 1 or p_price > 9999999 then
    raise exception '가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception '수량은 1권 이상 999권 이하의 정수로 입력해 주세요.';
  end if;

  if p_price::bigint * p_quantity > 2147483647 then
    raise exception '금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.';
  end if;

  if p_shipped_on is null or p_shipped_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '출고일은 오늘 이후로 정할 수 없습니다.';
  end if;

  select name, status::text
  into v_student_name, v_student_status
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found or v_student_status <> 'enrolled' then
    raise exception '재원 중인 원생을 선택해 주세요.';
  end if;

  select *
  into v_book
  from public.books
  where academy_id = p_academy_id
    and id = p_book_id
    and active
  for update;

  if not found then
    raise exception '교재를 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  perform private.apply_book_stock_delta(p_academy_id, p_book_id, -p_quantity);

  insert into public.book_releases (
    academy_id, book_id, student_id, student_name, book_title,
    price, quantity, shipped_at, status, created_by
  )
  values (
    p_academy_id, p_book_id, p_student_id, v_student_name, v_book.title,
    p_price, p_quantity, p_shipped_on, 'payment-pending', (select auth.uid())
  )
  returning * into v_release;

  if p_status = 'paid' then
    v_release := private.mark_book_release_paid(
      p_academy_id,
      v_release.id,
      coalesce(p_paid_on, p_shipped_on)
    );
  end if;

  return v_release;
end;
$$;

-- 출고 수정(결제 대기만). 재고를 한 번에 복원·재차감한다.
create or replace function public.update_book_release(
  p_academy_id uuid,
  p_release_id uuid,
  p_student_id uuid,
  p_book_id uuid,
  p_price integer,
  p_quantity integer,
  p_shipped_on date
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_release public.book_releases%rowtype;
  v_student_name text;
  v_student_status text;
  v_book public.books%rowtype;
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  if p_price is null or p_price < 1 or p_price > 9999999 then
    raise exception '가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then
    raise exception '수량은 1권 이상 999권 이하의 정수로 입력해 주세요.';
  end if;

  if p_price::bigint * p_quantity > 2147483647 then
    raise exception '금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.';
  end if;

  if p_shipped_on is null or p_shipped_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '출고일은 오늘 이후로 정할 수 없습니다.';
  end if;

  select *
  into v_release
  from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_release.status = 'paid' then
    raise exception '결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.';
  end if;

  -- 원생을 바꿀 때만 재원 여부를 확인한다. 그대로 두면 그 사이 퇴원했어도 수정할 수 있다.
  v_student_name := v_release.student_name;

  if p_student_id is distinct from v_release.student_id then
    select name, status::text
    into v_student_name, v_student_status
    from public.students
    where academy_id = p_academy_id
      and id = p_student_id;

    if p_student_id is null or not found or v_student_status <> 'enrolled' then
      raise exception '재원 중인 원생을 선택해 주세요.';
    end if;
  end if;

  -- 도서를 바꿀 때 새 교재는 보관하지 않은 교재여야 한다(같은 교재를 유지하면 보관되어 있어도 된다).
  select *
  into v_book
  from public.books
  where academy_id = p_academy_id
    and id = p_book_id
    and (active or id = v_release.book_id);

  if not found then
    raise exception '교재를 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  -- 두 교재를 id 순서로 먼저 잠가 같은 교재를 동시에 바꾸는 요청끼리 교착이 생기지 않게 한다.
  perform 1
  from public.books
  where academy_id = p_academy_id
    and id in (v_release.book_id, p_book_id)
  order by id
  for update;

  -- 잠금 전에 읽은 값은 그 사이 바뀌었을 수 있으므로 도서명 스냅샷은 잠근 뒤 다시 읽은 값으로 만든다.
  select *
  into v_book
  from public.books
  where academy_id = p_academy_id
    and id = p_book_id;

  if p_book_id = v_release.book_id then
    if v_release.quantity - p_quantity <> 0 then
      perform private.apply_book_stock_delta(p_academy_id, p_book_id, v_release.quantity - p_quantity);
    end if;
  else
    perform private.apply_book_stock_delta(p_academy_id, v_release.book_id, v_release.quantity);
    perform private.apply_book_stock_delta(p_academy_id, p_book_id, -p_quantity);
  end if;

  update public.book_releases
  set
    student_id = p_student_id,
    student_name = v_student_name,
    book_id = p_book_id,
    book_title = case when p_book_id = v_release.book_id then v_release.book_title else v_book.title end,
    price = p_price,
    quantity = p_quantity,
    shipped_at = p_shipped_on
  where academy_id = p_academy_id
    and id = p_release_id
  returning * into v_release;

  return v_release;
end;
$$;

create or replace function public.delete_book_release(
  p_academy_id uuid,
  p_release_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_release public.book_releases%rowtype;
begin
  perform private.assert_book_role(
    p_academy_id, false, '이 작업을 할 권한이 없습니다. 교재 관리는 원장과 데스크만 할 수 있습니다.'
  );

  select *
  into v_release
  from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_release.status = 'paid' then
    raise exception '결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.';
  end if;

  perform private.apply_book_stock_delta(p_academy_id, v_release.book_id, v_release.quantity);

  delete from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'book.release_deleted',
    'book_releases',
    p_release_id::text,
    null,
    jsonb_build_object(
      'quantity', v_release.quantity,
      'price', v_release.price,
      'shipped_at', v_release.shipped_at
    )
  );
end;
$$;

-- 결제 처리(입금 확인). 같은 시그니처를 재정의해 입금일 ≥ 출고일 검증과 단가 × 수량 금액을 적용한다.
create or replace function public.complete_book_release_payment(
  p_academy_id uuid,
  p_release_id uuid,
  p_paid_at date
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.assert_book_role(
    p_academy_id, true, '이 작업을 할 권한이 없습니다. 결제 확인과 취소는 원장만 할 수 있습니다.'
  );

  if p_paid_at is null then
    raise exception '입금일을 입력해 주세요.';
  end if;

  return private.mark_book_release_paid(p_academy_id, p_release_id, p_paid_at);
end;
$$;

-- 결제 취소(결제 완료 → 결제 대기). 연결된 입출입내역 수입 행을 지우고 감사 기록을 남긴다.
-- 연결 행이 이미 지워져 있어도(원장 기록 없음) 대기로 되돌린다. 재고는 바꾸지 않는다.
create or replace function public.cancel_book_release_payment(
  p_academy_id uuid,
  p_release_id uuid,
  p_reason text
)
returns public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_release public.book_releases%rowtype;
  v_ledger public.ledger_entries%rowtype;
  v_ledger_deleted boolean := false;
begin
  perform private.assert_book_role(
    p_academy_id, true, '이 작업을 할 권한이 없습니다. 결제 확인과 취소는 원장만 할 수 있습니다.'
  );

  if v_reason = '' then
    raise exception '취소 사유를 입력해 주세요.';
  end if;

  select *
  into v_release
  from public.book_releases
  where academy_id = p_academy_id
    and id = p_release_id
  for update;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  if v_release.status <> 'paid' then
    raise exception '이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.';
  end if;

  -- 연결 id가 있으면 그 행, 없으면 ref(book_releases, 출고 id)로 찾는다.
  select *
  into v_ledger
  from public.ledger_entries
  where academy_id = p_academy_id
    and (
      id = v_release.paid_ledger_entry_id
      or (
        v_release.paid_ledger_entry_id is null
        and ref_table = 'book_releases'
        and ref_id = v_release.id::text
      )
    )
  order by created_at
  limit 1
  for update;

  if found then
    delete from public.ledger_entries
    where academy_id = p_academy_id
      and id = v_ledger.id;

    v_ledger_deleted := true;
  end if;

  update public.book_releases
  set
    status = 'payment-pending',
    paid_at = null,
    paid_ledger_entry_id = null
  where academy_id = p_academy_id
    and id = p_release_id
  returning * into v_release;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, reason, metadata
  )
  values (
    p_academy_id,
    (select auth.uid()),
    'book.payment_cancelled',
    'book_releases',
    p_release_id::text,
    v_reason,
    jsonb_build_object(
      'quantity', v_release.quantity,
      'price', v_release.price,
      'ledger_deleted', v_ledger_deleted,
      'ledger_amount', case when v_ledger_deleted then v_ledger.amount else null end,
      'ledger_occurred_on', case when v_ledger_deleted then v_ledger.occurred_on else null end
    )
  );

  return v_release;
end;
$$;

revoke all on function private.assert_book_role(uuid, boolean, text) from public, anon, authenticated;
revoke all on function private.apply_book_stock_delta(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function private.mark_book_release_paid(uuid, uuid, date) from public, anon, authenticated;

revoke all on function public.register_book_stock(uuid, text, integer, integer, date) from public, anon;
grant execute on function public.register_book_stock(uuid, text, integer, integer, date) to authenticated;
revoke all on function public.update_book(uuid, uuid, text, integer, integer, date) from public, anon;
grant execute on function public.update_book(uuid, uuid, text, integer, integer, date) to authenticated;
revoke all on function public.delete_book(uuid, uuid) from public, anon;
grant execute on function public.delete_book(uuid, uuid) to authenticated;
revoke all on function public.register_book_release(uuid, uuid, uuid, integer, integer, date, text, date) from public, anon;
grant execute on function public.register_book_release(uuid, uuid, uuid, integer, integer, date, text, date) to authenticated;
revoke all on function public.update_book_release(uuid, uuid, uuid, uuid, integer, integer, date) from public, anon;
grant execute on function public.update_book_release(uuid, uuid, uuid, uuid, integer, integer, date) to authenticated;
revoke all on function public.delete_book_release(uuid, uuid) from public, anon;
grant execute on function public.delete_book_release(uuid, uuid) to authenticated;
revoke all on function public.complete_book_release_payment(uuid, uuid, date) from public, anon;
grant execute on function public.complete_book_release_payment(uuid, uuid, date) to authenticated;
revoke all on function public.cancel_book_release_payment(uuid, uuid, text) from public, anon;
grant execute on function public.cancel_book_release_payment(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

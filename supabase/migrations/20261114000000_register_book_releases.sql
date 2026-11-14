-- 교재 일괄 출고: 원생 한 명에게 여러 도서를 한 번에 출고한다(2026-11-14 학원 피드백).
-- 한 함수가 한 트랜잭션이라 한 권이라도 재고가 부족하거나 입력이 잘못되면 전체가 등록되지 않는다.
-- 도서별 재고 차감과 결제 완료 원장 행 생성은 단건 출고(register_book_release)와 같은
-- private.apply_book_stock_delta / private.mark_book_release_paid를 재사용하고, 출고 건은 도서별로 한 건씩 만든다.
-- 결제 상태·입금일은 묶음 전체에 한 번 적용한다. 단건 RPC는 그대로 두어 옛 앱과 호환된다.
-- 오류 문구는 src/domain/book-stock.ts의 BOOK_MESSAGES와 같고, 도서가 둘 이상이면 'N번째 도서: '를 앞에 붙인다.

create or replace function public.register_book_releases(
  p_academy_id uuid,
  p_student_id uuid,
  p_shipped_on date,
  p_items jsonb,
  p_status text default 'payment-pending',
  p_paid_on date default null
)
returns setof public.book_releases
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_student_name text;
  v_student_status text;
  v_item jsonb;
  v_item_count integer;
  v_position integer := 0;
  v_prefix text;
  v_book_ids uuid[];
  v_book_id uuid;
  v_seen uuid[] := array[]::uuid[];
  v_price integer;
  v_quantity integer;
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

  if p_shipped_on is null or p_shipped_on > (now() at time zone 'Asia/Seoul')::date then
    raise exception '출고일은 오늘 이후로 정할 수 없습니다.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception '출고할 도서를 하나 이상 추가해 주세요.';
  end if;

  v_item_count := jsonb_array_length(p_items);

  select name, status::text
  into v_student_name, v_student_status
  from public.students
  where academy_id = p_academy_id
    and id = p_student_id;

  if not found or v_student_status <> 'enrolled' then
    raise exception '재원 중인 원생을 선택해 주세요.';
  end if;

  -- 담은 도서의 교재 행을 id 순으로 한 번에 잠가, 같은 도서를 겹쳐 출고하는 묶음끼리 교착하지 않게 한다.
  begin
    select array_agg((item ->> 'book_id')::uuid)
    into v_book_ids
    from jsonb_array_elements(p_items) as item;
  exception
    when invalid_text_representation then
      raise exception '교재 출고 입력값을 확인해 주세요.';
  end;

  perform 1
  from public.books
  where academy_id = p_academy_id
    and id = any(v_book_ids)
  order by id
  for update;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_prefix := case when v_item_count > 1 then format('%s번째 도서: ', v_position) else '' end;
    v_book_id := (v_item ->> 'book_id')::uuid;

    if v_book_id is null then
      raise exception '%', v_prefix || '도서를 선택해 주세요.';
    end if;

    if v_book_id = any(v_seen) then
      raise exception '같은 도서를 두 번 선택할 수 없습니다. 수량으로 입력해 주세요.';
    end if;

    v_seen := v_seen || v_book_id;

    begin
      v_price := (v_item ->> 'price')::integer;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception '%', v_prefix || '교재 출고 입력값을 확인해 주세요.';
    end;

    if v_price is null or v_price < 1 or v_price > 9999999 then
      raise exception '%', v_prefix || '가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.';
    end if;

    if v_quantity is null or v_quantity < 1 or v_quantity > 999 then
      raise exception '%', v_prefix || '수량은 1권 이상 999권 이하의 정수로 입력해 주세요.';
    end if;

    if v_price::bigint * v_quantity > 2147483647 then
      raise exception '%', v_prefix || '금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.';
    end if;

    select *
    into v_book
    from public.books
    where academy_id = p_academy_id
      and id = v_book_id
      and active;

    if not found then
      raise exception '%', v_prefix || '교재를 찾을 수 없습니다. 목록을 새로고침해 주세요.';
    end if;

    if v_book.quantity <= 0 then
      raise exception '%', v_prefix || '재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.';
    end if;

    if v_quantity > v_book.quantity then
      raise exception '%', v_prefix || format('재고가 부족합니다. 남은 재고는 %s권입니다.', v_book.quantity);
    end if;

    perform private.apply_book_stock_delta(p_academy_id, v_book_id, -v_quantity);

    insert into public.book_releases (
      academy_id, book_id, student_id, student_name, book_title,
      price, quantity, shipped_at, status, created_by
    )
    values (
      p_academy_id, v_book_id, p_student_id, v_student_name, v_book.title,
      v_price, v_quantity, p_shipped_on, 'payment-pending', (select auth.uid())
    )
    returning * into v_release;

    if p_status = 'paid' then
      v_release := private.mark_book_release_paid(
        p_academy_id,
        v_release.id,
        coalesce(p_paid_on, p_shipped_on)
      );
    end if;

    return next v_release;
  end loop;

  return;
end;
$$;

revoke all on function public.register_book_releases(uuid, uuid, date, jsonb, text, date) from public, anon;
grant execute on function public.register_book_releases(uuid, uuid, date, jsonb, text, date) to authenticated;

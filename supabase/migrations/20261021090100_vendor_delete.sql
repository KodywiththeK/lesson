-- 거래처 삭제 RPC.
--
-- 제품 결정(2026-10-22): 거래처는 확인 후 삭제한다(원장·데스크). 교재 발주(book_orders)에는 거래처 이름이
-- vendor_name 스냅샷으로 남고 vendor_id만 on delete set null로 끊어져(20261020090400) 과거 발주 내역은 보존된다.
-- 지출 원장(ledger_entries)에는 vendors FK가 없다.
--
-- vendors 테이블에는 브라우저 직접 DELETE 권한이 없다(20260820142318의 grant). 직접 grant를 열지 않고
-- 다른 삭제 기능(delete_book 등)처럼 권한 확인과 감사 기록을 한 곳에서 하는 RPC로만 연다.

create or replace function public.delete_vendor(
  p_academy_id uuid,
  p_vendor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_vendor public.vendors%rowtype;
begin
  if (select auth.uid()) is null or not private.has_academy_role(
    p_academy_id,
    array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]
  ) then
    raise exception '거래처를 삭제할 권한이 없습니다.';
  end if;

  delete from public.vendors
  where academy_id = p_academy_id
    and id = p_vendor_id
  returning * into v_vendor;

  if not found then
    raise exception '이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.';
  end if;

  insert into public.audit_events (
    academy_id, actor_id, event_type, entity_table, entity_id, metadata
  ) values (
    p_academy_id, (select auth.uid()), 'vendor.deleted', 'vendors', v_vendor.id::text,
    jsonb_build_object('name', v_vendor.name, 'vendor_type', v_vendor.vendor_type)
  );
end;
$$;

revoke all on function public.delete_vendor(uuid, uuid) from public, anon;
grant execute on function public.delete_vendor(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';

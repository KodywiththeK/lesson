import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261020090400_book_orders.sql"), "utf8");
const sourceSql = readFileSync(join(process.cwd(), "supabase/migrations/20261020090350_book_order_ledger_source.sql"), "utf8");

describe("교재 발주 스키마 계약", () => {
  it("발주·품목의 학원 범위와 직접 쓰기 차단을 정의한다", () => {
    expect(sql).toContain("create table public.book_orders");
    expect(sql).toContain("create table public.book_order_items");
    expect(sql).toContain("enable row level security");
    expect(sql).toMatch(/revoke all on public\.book_orders from anon, authenticated/);
    expect(sql).toMatch(/revoke all on public\.book_order_items from anon, authenticated/);
  });

  it("입고와 지급은 각 한 RPC에서 잠금·상태 확인·재고 또는 원장을 함께 처리한다", () => {
    expect(sql).toMatch(/create or replace function public\.receive_book_order[\s\S]*?for update[\s\S]*?status = 'received'/);
    expect(sql).toMatch(/create or replace function public\.pay_book_order[\s\S]*?for update[\s\S]*?insert into public\.ledger_entries/);
    expect(sql).toContain("paid_ledger_entry_id");
    expect(sourceSql).toContain("add value if not exists 'book-order'");
    expect(sql).toMatch(/p_paid_on, 'expense', 'book-order', 'book-order'/);
  });

  it("입고 취소 때 이미 판매한 수량을 막고, 원장 삭제에도 지급일을 보존한다", () => {
    expect(sql).toMatch(/create or replace function public\.cancel_book_order[\s\S]*?book_releases[\s\S]*?안전하게 되돌릴 수 없습니다/);
    expect(sql).toContain("on delete set null (paid_ledger_entry_id)");
    expect(sql).toMatch(/insert into public\.audit_events/);
  });

  it("원장의 nullable 참조 정보가 사라져도 불일치를 감지한다", () => {
    expect(sql).toContain("l.ref_table is distinct from 'book_orders'");
    expect(sql).toContain("l.ref_id is distinct from o.id::text");
  });

  it("불일치 원장 지급 취소를 막고 입고 취소 시 신규 교재와 이전 입고일을 복원한다", () => {
    expect(sql).toContain("prior_stocked_on date");
    expect(sql).toContain("created_book boolean");
    expect(sql).toMatch(/create or replace function public\.undo_book_order_payment[\s\S]*?ledger_mismatch[\s\S]*?원장 내역을 정정/);
    expect(sql).toMatch(/create or replace function public\.cancel_book_order[\s\S]*?ledger_mismatch[\s\S]*?원장 내역을 정정/);
    expect(sql).toContain("active = false");
    expect(sql).toContain("stocked_on = v_item.prior_stocked_on");
  });

  it("같은 교재의 뒤따른 입고가 남아 있으면 앞선 발주 취소를 막는다", () => {
    expect(sql).toMatch(/create or replace function public\.cancel_book_order[\s\S]*?book_inventory_batches later_batch[\s\S]*?later_batch\.created_at > [\s\S]*?나중에 입고한 발주부터 역순으로 취소/);
  });

  it("새 도서 판매가는 입고 날짜와 함께 확정한다", () => {
    expect(sql).toContain("p_sale_prices jsonb");
    expect(sql).toContain("p_sale_prices ->> v_item.id::text");
    expect(sql).not.toContain("book_order_items_sale_price_check");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261019090100_book_stock_rpcs.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("교재 재고·출고 RPC migration 계약", () => {
  it("이전 7인자 출고 등록 함수를 지워 오버로드가 남지 않게 한다", () => {
    expect(sql).toContain(
      "drop function if exists public.register_book_release(uuid, uuid, text, text, integer, date, text)",
    );
  });

  it("재고 변경은 교재 행을 잠그고 0 미만이면 한국어로 거부하는 한 곳을 거친다", () => {
    const fn = body("private.apply_book_stock_delta");

    expect(fn).toContain("for update");
    expect(fn).toContain("재고가 부족합니다. 남은 재고는 %권입니다.");
    expect(fn).toContain("재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.");
  });

  it("재입고 합산은 정규화 도서명 충돌을 on conflict로 합산하고 입고일·가격을 갱신한다", () => {
    const fn = body("public.register_book_stock");

    expect(fn).toContain("on conflict (academy_id, title_key) where active");
    expect(fn).toContain("quantity = public.books.quantity + excluded.quantity");
    expect(fn).toContain("stocked_on = excluded.stocked_on");
    expect(fn).toContain("price = excluded.price");
    expect(fn).toContain("재고는 9,999권을 넘을 수 없습니다.");
  });

  it("교재 수정은 다른 교재와 같은 도서명이 되면 거부하고 삭제는 보관 처리다", () => {
    expect(body("public.update_book")).toContain("이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.");
    expect(body("public.delete_book")).toContain("set active = false");
  });

  it("출고 등록은 재원 원생·보관하지 않은 교재만 받고 재고를 차감하며 결제 완료 선택은 원장만 허용한다", () => {
    const fn = body("public.register_book_release");

    expect(fn).toContain("v_student_status <> 'enrolled'");
    expect(fn).toContain("재원 중인 원생을 선택해 주세요.");
    expect(fn).toContain("private.apply_book_stock_delta(");
    expect(fn).toContain("결제 확인과 취소는 원장만 할 수 있습니다.");
    // 바로 결제 완료의 입금일 검증은 결제 처리와 같은 내부 함수가 맡는다.
    expect(fn).toContain("coalesce(p_paid_on, p_shipped_on)");
  });

  it("단가 × 수량이 입출입내역 금액 한도를 넘는 출고는 등록·수정에서 한국어로 거부한다", () => {
    for (const name of ["public.register_book_release", "public.update_book_release"]) {
      const fn = body(name);

      expect(fn).toContain("p_price::bigint * p_quantity > 2147483647");
      expect(fn).toContain("금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.");
    }
  });

  it("도서명 공백은 정규화 함수와 같은 방식으로 정리해 저장한다", () => {
    expect(body("public.register_book_stock")).toContain("btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'))");
    expect(body("public.update_book")).toContain("btrim(regexp_replace(coalesce(p_title, ''), '[[:space:]]+', ' ', 'g'))");
  });

  it("결제 처리에서 출고를 찾지 못하면 다른 변경 RPC와 같은 문구를 쓴다", () => {
    expect(body("private.mark_book_release_paid")).toContain("이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.");
  });

  it("출고 수정은 결제 대기만 받고 두 교재를 id 순서로 잠근 뒤 재고를 복원·재차감한다", () => {
    const fn = body("public.update_book_release");

    expect(fn).toContain("결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.");
    expect(fn).toMatch(/order by id\s+for update/);
    expect(fn).toContain("private.apply_book_stock_delta(");
    expect(fn).toContain("v_release.quantity - p_quantity");
  });

  it("출고 삭제는 결제 대기만 받고 재고를 수량만큼 되돌리며 감사 기록을 남긴다", () => {
    const fn = body("public.delete_book_release");

    expect(fn).toContain("결제 완료된 출고는 수정하거나 삭제할 수 없습니다");
    expect(fn).toContain("private.apply_book_stock_delta(");
    expect(fn).toContain("'book.release_deleted'");
  });

  it("결제 처리와 지름길이 같은 원장 행 생성 함수를 쓰고 금액은 단가 × 수량이다", () => {
    const helper = body("private.mark_book_release_paid");

    expect(helper).toContain("v_release.price * v_release.quantity");
    expect(helper).toContain("'교재 판매: '");
    expect(body("public.complete_book_release_payment")).toContain("private.mark_book_release_paid(");
    expect(body("public.register_book_release")).toContain("private.mark_book_release_paid(");
  });

  it("결제 처리는 원장만 하고 입금일은 출고일 이후여야 한다", () => {
    const fn = body("public.complete_book_release_payment");

    expect(fn).toMatch(/assert_book_role\(\s*p_academy_id, true,/);
    expect(body("private.mark_book_release_paid")).toContain("입금일은 출고일(");
    expect(body("private.mark_book_release_paid")).toContain("이미 결제 완료된 출고입니다.");
    expect(body("private.assert_book_role")).toContain("array['owner'::public.academy_member_role]");
  });

  it("결제 취소는 원장 전용·사유 필수이고 연결 원장 행이 없어도 대기로 되돌리며 감사 기록에 개인정보를 넣지 않는다", () => {
    const fn = body("public.cancel_book_release_payment");

    expect(fn).toMatch(/assert_book_role\(\s*p_academy_id, true,/);
    expect(fn).toContain("취소 사유를 입력해 주세요.");
    expect(fn).toContain("이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.");
    expect(fn).toContain("ref_table = 'book_releases'");
    expect(fn).toContain("paid_ledger_entry_id = null");
    expect(fn).toContain("'book.payment_cancelled'");
    expect(fn).not.toContain("student_name");
  });

  it("새 공개 함수는 anon 실행을 막고 앱 사용자에게만 열며 내부 함수는 외부에 열지 않는다", () => {
    for (const signature of [
      "public.register_book_stock(uuid, text, integer, integer, date)",
      "public.update_book(uuid, uuid, text, integer, integer, date)",
      "public.delete_book(uuid, uuid)",
      "public.register_book_release(uuid, uuid, uuid, integer, integer, date, text, date)",
      "public.update_book_release(uuid, uuid, uuid, uuid, integer, integer, date)",
      "public.delete_book_release(uuid, uuid)",
      "public.complete_book_release_payment(uuid, uuid, date)",
      "public.cancel_book_release_payment(uuid, uuid, text)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public, anon`);
      expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
    }

    expect(sql).toContain("revoke all on function private.apply_book_stock_delta(uuid, uuid, integer) from public, anon, authenticated");
    expect(sql).toContain("revoke all on function private.mark_book_release_paid(uuid, uuid, date) from public, anon, authenticated");
  });
});

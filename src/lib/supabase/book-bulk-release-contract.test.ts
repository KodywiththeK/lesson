import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000000_register_book_releases.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("\n$$;", start);

  return sql.slice(start, end);
}

describe("교재 일괄 출고 RPC migration 계약", () => {
  const fn = () => body("public.register_book_releases");

  it("원생 한 명과 도서 배열(jsonb)을 받아 출고 건들을 돌려준다", () => {
    expect(fn()).toContain("p_items jsonb");
    expect(fn()).toContain("returns setof public.book_releases");
    expect(fn()).toContain("return next");
    expect(fn()).toContain("출고할 도서를 하나 이상 추가해 주세요.");
  });

  it("한 함수 안에서 처리해 한 권이라도 실패하면 전체가 롤백된다(부분 저장 없음)", () => {
    // 도서별 재고 차감과 결제 완료 원장 생성은 단건 출고와 같은 내부 함수를 재사용한다.
    expect(fn()).toContain("private.apply_book_stock_delta(");
    expect(fn()).toContain("private.mark_book_release_paid(");
    // 브라우저가 항목별로 따로 호출하는 구조가 아님을 보장하려고 loop 안에서 insert한다.
    expect(fn()).toMatch(/for\s+\w+\s+in[\s\S]*insert into public\.book_releases/);
  });

  it("같은 도서를 두 번 담으면 거부하고 교재 행은 id 순으로 한 번에 잠가 교착을 피한다", () => {
    expect(fn()).toContain("같은 도서를 두 번 선택할 수 없습니다. 수량으로 입력해 주세요.");
    expect(fn()).toMatch(/order by[\s\S]*for update/);
  });

  it("도서가 둘 이상이면 문제가 있는 줄 번호를 앞에 붙여 화면 검증과 같은 문구를 쓴다", () => {
    expect(fn()).toContain("번째 도서: ");
    expect(fn()).toContain("재고가 부족합니다. 남은 재고는 %s권입니다.");
    expect(fn()).toContain("재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.");
  });

  it("권한·상태·가격·수량·금액·출고일 검증은 단건 출고 등록과 같다", () => {
    const text = fn();

    expect(text).toContain("private.assert_book_role(");
    expect(text).toContain("결제 확인과 취소는 원장만 할 수 있습니다.");
    expect(text).toContain("v_student_status <> 'enrolled'");
    expect(text).toContain("재원 중인 원생을 선택해 주세요.");
    expect(text).toContain("가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.");
    expect(text).toContain("수량은 1권 이상 999권 이하의 정수로 입력해 주세요.");
    expect(text).toContain("금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.");
    expect(text).toContain("출고일은 오늘 이후로 정할 수 없습니다.");
    expect(text).toContain("coalesce(p_paid_on, p_shipped_on)");
  });

  it("로그인 사용자에게만 실행 권한을 주고 anon·public은 회수한다", () => {
    expect(sql).toContain(
      "revoke all on function public.register_book_releases(uuid, uuid, date, jsonb, text, date) from public, anon;",
    );
    expect(sql).toContain(
      "grant execute on function public.register_book_releases(uuid, uuid, date, jsonb, text, date) to authenticated;",
    );
  });

  it("기존 단건 출고 RPC는 건드리지 않아 옛 앱과 호환된다", () => {
    expect(sql).not.toContain("drop function");
    expect(sql).not.toContain("public.register_book_release(");
  });
});

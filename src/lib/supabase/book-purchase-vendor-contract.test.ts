import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021090200_book_purchase_vendor.sql"),
  "utf8",
).toLocaleLowerCase();

function sliceFunction(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 10);

  return sql.slice(start, next === -1 ? undefined : next);
}

describe("교재 구입 거래처 (20261021090200)", () => {
  it("books에 선택 입력 텍스트 컬럼을 추가하고 길이를 제한한다", () => {
    expect(sql).toContain("add column if not exists purchase_vendor_name text");
    expect(sql).toContain("char_length(purchase_vendor_name) <= 100");
  });

  it("기존 시그니처를 지우고 거래처 인자가 있는 새 시그니처만 남긴다(PostgREST 오버로드 충돌 방지)", () => {
    expect(sql).toContain("drop function if exists public.register_book_stock(uuid, text, integer, integer, date)");
    expect(sql).toContain("drop function if exists public.update_book(uuid, uuid, text, integer, integer, date)");
    expect(sql).toContain("p_purchase_vendor_name text default null");
  });

  it("재입고는 입력하면 덮어쓰고 비우면 기존 값을 유지한다", () => {
    const register = sliceFunction("public.register_book_stock");

    expect(register).toContain("coalesce(excluded.purchase_vendor_name, public.books.purchase_vendor_name)");
  });

  it("수정은 입력한 값 그대로 저장해 비우면 지운다", () => {
    const update = sliceFunction("public.update_book");

    expect(update).toContain("purchase_vendor_name = v_vendor");
    expect(update).not.toContain("coalesce(v_vendor");
  });

  it("새 시그니처에 실행 권한을 다시 건다", () => {
    expect(sql).toContain(
      "revoke all on function public.register_book_stock(uuid, text, integer, integer, date, text) from public, anon",
    );
    expect(sql).toContain(
      "grant execute on function public.update_book(uuid, uuid, text, integer, integer, date, text) to authenticated",
    );
  });
});

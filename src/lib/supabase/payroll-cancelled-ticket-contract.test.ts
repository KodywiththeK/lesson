import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261114000500_payroll_exclude_cancelled_tickets.sql"),
  "utf8",
).toLocaleLowerCase();

describe("급여 개인레슨 단가 회차권 상태 migration 계약", () => {
  it("취소된 회차권만 단가 계산에서 빼고 환불·입금 전 회차권은 거르지 않는다", () => {
    expect(sql).toContain("create or replace function private.calculate_verified_payroll_breakdown(");
    expect(sql).toContain("and grant_row.payment_status <> 'cancelled'");
    expect(sql).not.toContain("'refunded'");
    expect(sql).not.toContain("payment_status = 'paid'");
  });

  it("브라우저 역할에는 실행 권한을 주지 않는다", () => {
    expect(sql).toContain(
      "revoke all on function private.calculate_verified_payroll_breakdown(uuid, uuid, text, integer) from public, anon, authenticated;",
    );
  });
});

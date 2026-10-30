import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("수강료 결제 방식 DB 경계", () => {
  it("결제 방식은 서버에서 검증하고 입금 취소 때 초기화한다", () => {
    const sql = readFileSync("supabase/migrations/20261029102928_tuition_payment_method.sql", "utf8");
    expect(sql).toContain("p_payment_method not in ('card', 'cash', 'transfer', 'remote')");
    expect(sql).toContain("payment_method = null");
    expect(sql).toContain("private.mark_fixed_income_snapshot_paid_without_method");
    expect(sql).toContain("revoke insert, update, delete on public.fixed_income_snapshots from authenticated");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("급여 지급 상세 migration", () => {
  it("지급 확정의 학생별 상세와 금액을 서버에서 검증하고 직접 쓰기를 막는다", () => {
    const sql = readFileSync("supabase/migrations/20261029151807_payroll_verified_breakdown.sql", "utf8");
    expect(sql).toContain("student_breakdown jsonb");
    expect(sql).toContain("private.calculate_verified_payroll_breakdown");
    expect(sql).toContain("급여 금액이 수업별 계산과 다릅니다");
    expect(sql).toContain("revoke insert, update, delete on public.salary_settlements");
    expect(sql).toContain("academy_holiday_month_ready");
  });

  it("행을 이미 잠근 쓰기는 학원 잠금을 기다리지 않고 재시도를 안내한다", () => {
    for (const file of ["20261029102928_tuition_payment_method.sql", "20261029151148_academy_holiday_assignment.sql", "20261029151605_student_discount_snapshot_sync.sql", "20261029151807_payroll_verified_breakdown.sql"]) {
      const sql = readFileSync(`supabase/migrations/${file}`, "utf8");
      expect(sql).not.toMatch(/perform pg_advisory_xact_lock\(hashtextextended\([^\n]*5320\)/);
      expect(sql).toContain("pg_try_advisory_xact_lock");
    }
  });
});

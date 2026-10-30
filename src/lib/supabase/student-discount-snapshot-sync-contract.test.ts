import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("원생 할인과 미입금 월 수강료 동기화", () => {
  it("입금된 기록은 보호하고 불명확한 과거 소개 할인은 알린다", () => {
    const sql = readFileSync("supabase/migrations/20261029151605_student_discount_snapshot_sync.sql", "utf8");
    expect(sql).toContain("student_discount_snapshot_sync");
    expect(sql).toContain("referral_discount_applied");
    expect(sql).toContain("status in ('unpaid', 'overdue')");
    expect(sql).toContain("discount_snapshot_warning");
    expect(sql).toContain("for update");
  });
});

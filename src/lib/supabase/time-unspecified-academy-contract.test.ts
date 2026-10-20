import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase/migrations/20261020090600_time_unspecified_academy_lessons.sql");

describe("시간 미정 학원레슨 DB 계약", () => {
  it("등록·수정·악기 추가·재원 복귀에서도 시간 미정 시리즈를 보존한다", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("alter column start_time drop not null");
    expect(sql).toContain("alter column end_time drop not null");
    for (const functionName of [
      "register_student_with_enrollments",
      "update_student_profile_from_date",
      "insert_student_enrollment",
      "update_student_status",
    ]) {
      expect(sql).toContain(`function ${functionName === "insert_student_enrollment" ? "private" : "public"}.${functionName}(`);
    }
    expect(sql).toContain("시작 시간과 종료 시간을 함께 입력해 주세요.");
  });

  it("월별 반복 일정에 시간 미정 표식을 저장해 출석 대상에서 빠지지 않게 한다", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("function public.ensure_monthly_academy_lesson_events(");
    expect(sql).toContain("time_unspecified");
    expect(sql).toContain("series.start_time is null");
  });
});

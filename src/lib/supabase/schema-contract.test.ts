import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort()
  .map((fileName) =>
    readFileSync(
      path.join(process.cwd(), "supabase/migrations", fileName),
      "utf8",
    ),
  )
  .join("\n")
  .toLocaleLowerCase();

const domainTables = [
  "student_contacts",
  "student_instruments",
  "lesson_events",
  "attendance_records",
  "absence_resolutions",
  "monthly_memos",
  "lesson_ticket_grants",
  "lesson_ticket_adjustments",
  "lesson_ticket_usages",
  "books",
  "book_inventory_batches",
  "book_releases",
  "fixed_income_snapshots",
  "salary_settlements",
  "teacher_salary_settings",
  "audit_events",
];

describe("Supabase schema contract", () => {
  it("PDF 도메인 persistence 테이블을 migration에 포함한다", () => {
    for (const tableName of domainTables) {
      expect(migrationSql).toContain(`create table public.${tableName}`);
    }
  });

  it("모든 PDF 도메인 테이블에 RLS를 활성화한다", () => {
    for (const tableName of domainTables) {
      expect(migrationSql).toContain(
        `alter table public.${tableName} enable row level security`,
      );
    }
  });

  it("Data API 노출을 위해 authenticated role grant를 명시한다", () => {
    for (const tableName of domainTables) {
      expect(migrationSql).toMatch(
        new RegExp(`grant (select|select, insert).* public\\.${tableName} to authenticated`),
      );
    }
  });

  it("Supabase RLS 정책에서 deprecated auth.role()을 사용하지 않는다", () => {
    expect(migrationSql).not.toContain("auth.role()");
  });

  it("선생님 주민등록번호는 원문 컬럼 없이 보안 참조와 마스킹 값만 둔다", () => {
    expect(migrationSql).toContain("resident_registration_encrypted_ref");
    expect(migrationSql).toContain("resident_registration_masked");
    expect(migrationSql).not.toMatch(
      /resident_registration_number\s+(text|varchar|character varying)/,
    );
  });

  it("민감 작업 감사 로그 테이블과 회차권 수동 수정 감사 테이블을 둔다", () => {
    expect(migrationSql).toContain("create table public.audit_events");
    expect(migrationSql).toContain("create table public.lesson_ticket_adjustments");
    expect(migrationSql).toContain("adjustment_reason text not null");
  });
});

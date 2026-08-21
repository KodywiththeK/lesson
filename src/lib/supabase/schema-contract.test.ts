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

const tenantScopedReferenceTables = [
  "academy_members",
  "teachers",
  "students",
  "student_instruments",
  "lesson_events",
  "attendance_records",
  "lesson_ticket_grants",
  "books",
];

const updatedAtTables = [
  "profiles",
  "academies",
  "academy_members",
  "teachers",
  "students",
  "vendors",
  "student_contacts",
  "student_instruments",
  "lesson_events",
  "monthly_memos",
  "lesson_ticket_grants",
  "books",
  "book_releases",
  "fixed_income_snapshots",
  "teacher_salary_settings",
  "salary_settlements",
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

  it("public schema 기본 권한은 닫고 명시 grant만 API 표면으로 사용한다", () => {
    expect(migrationSql).toContain(
      "alter default privileges for role postgres in schema public\n  revoke select, insert, update, delete on tables from anon, authenticated",
    );
    expect(migrationSql).toContain(
      "alter default privileges for role postgres in schema public\n  revoke execute on functions from public",
    );
  });

  it("tenant scope가 있는 참조 테이블은 academy_id와 id 복합 참조 기반을 가진다", () => {
    for (const tableName of tenantScopedReferenceTables) {
      expect(migrationSql).toContain(
        `alter table public.${tableName}\n  add constraint ${tableName}_academy_id_id_key unique (academy_id, id)`,
      );
    }
  });

  it("tenant scope child reference는 academy_id까지 함께 외래키로 묶는다", () => {
    const requiredCompositeFks = [
      "foreign key (academy_id, student_id) references public.students (academy_id, id)",
      "foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)",
      "foreign key (academy_id, lesson_event_id) references public.lesson_events (academy_id, id)",
      "foreign key (academy_id, lesson_ticket_grant_id) references public.lesson_ticket_grants (academy_id, id)",
      "foreign key (academy_id, book_id) references public.books (academy_id, id)",
    ];

    for (const requiredCompositeFk of requiredCompositeFks) {
      expect(migrationSql).toContain(requiredCompositeFk);
    }
  });

  it("updated_at 컬럼은 공통 trigger로 실제 수정 시각을 갱신한다", () => {
    expect(migrationSql).toContain("create function private.set_updated_at()");

    for (const tableName of updatedAtTables) {
      expect(migrationSql).toContain(
        `create trigger ${tableName}_set_updated_at`,
      );
      expect(migrationSql).toContain(`before update on public.${tableName}`);
    }
  });

  it("원생 보호자 연락처는 선생님에게 직접 노출하지 않는다", () => {
    const contactPolicy = migrationSql.match(
      /create policy "student_contacts_select_allowed_members"[\s\S]*?\);/,
    )?.[0];

    expect(contactPolicy).toBeDefined();
    expect(contactPolicy).not.toContain("teacher_can_access_student");
  });

  it("학원 생성 직후 owner 멤버십 생성 전에도 생성자가 학원 row를 조회할 수 있다", () => {
    const creatorSelectPolicy = migrationSql.match(
      /create policy "academies_select_creator"[\s\S]*?\);/,
    )?.[0];

    expect(creatorSelectPolicy).toBeDefined();
    expect(creatorSelectPolicy).toContain("created_by = (select auth.uid())");
  });

  it("회차권 구매 수입을 추적하기 위한 결제 컬럼과 장부 출처를 둔다", () => {
    expect(migrationSql).toContain(
      "alter type public.ledger_entry_source add value if not exists 'lesson-ticket'",
    );
    expect(migrationSql).toContain("add column if not exists paid_amount");
    expect(migrationSql).toContain("add column if not exists paid_at date");
  });
});

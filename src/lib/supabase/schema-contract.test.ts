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
  "student_instrument_weekly_schedules",
  "lesson_series",
  "lesson_events",
  "attendance_records",
  "absence_resolutions",
  "monthly_memos",
  "lesson_calendar_memos",
  "entity_memos",
  "lesson_ticket_grants",
  "lesson_ticket_adjustments",
  "lesson_ticket_usages",
  "books",
  "book_inventory_batches",
  "book_releases",
  "fixed_income_snapshots",
  "salary_settlements",
  "teacher_salary_settings",
  "teacher_work_schedules",
  "audit_events",
];

const tenantScopedReferenceTables = [
  "academy_members",
  "teachers",
  "teacher_work_schedules",
  "students",
  "student_instruments",
  "student_instrument_weekly_schedules",
  "lesson_series",
  "lesson_events",
  "attendance_records",
  "lesson_calendar_memos",
  "entity_memos",
  "lesson_ticket_grants",
  "books",
];

const updatedAtTables = [
  "profiles",
  "academies",
  "academy_members",
  "teachers",
  "teacher_work_schedules",
  "students",
  "vendors",
  "student_contacts",
  "student_instruments",
  "student_instrument_weekly_schedules",
  "lesson_series",
  "lesson_events",
  "monthly_memos",
  "lesson_calendar_memos",
  "entity_memos",
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

  it("개인레슨 출석과 회차권 차감은 public RPC 하나로 원자 처리한다", () => {
    expect(migrationSql).toContain(
      "create or replace function public.mark_private_lesson_attendance",
    );
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain(
      "on conflict (academy_id, lesson_event_id, student_id, instrument_id)",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.mark_private_lesson_attendance",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.mark_private_lesson_attendance",
    );
  });

  it("정기 학원 레슨은 조회 월 기준으로 중복 없이 materialize한다", () => {
    expect(migrationSql).toContain(
      "create or replace function public.ensure_monthly_academy_lesson_events",
    );
    expect(migrationSql).toContain(
      "create unique index if not exists lesson_events_generated_series_unique_idx",
    );
    expect(migrationSql).toContain(
      "on conflict (academy_id, series_id, starts_at)",
    );
    expect(migrationSql).toContain("from public.lesson_series series");
    expect(migrationSql).toContain("calendar.lesson_day >= series.effective_from");
    expect(migrationSql).toContain(
      "(series.effective_until is null or calendar.lesson_day <= series.effective_until)",
    );
    expect(migrationSql).toContain("student.status = 'enrolled'");
    expect(migrationSql).toContain(
      "grant execute on function public.ensure_monthly_academy_lesson_events",
    );
    expect(migrationSql).toContain(
      "revoke all on function public.ensure_monthly_academy_lesson_events",
    );
  });

  it("정기 반복 규칙과 실제 캘린더 이벤트를 분리한다", () => {
    expect(migrationSql).toContain("create table public.lesson_series");
    expect(migrationSql).toContain("effective_from date not null");
    expect(migrationSql).toContain("effective_until date");
    expect(migrationSql).toContain("superseded_by uuid");
    expect(migrationSql).toContain("add column if not exists series_id uuid");
    expect(migrationSql).toContain("add column if not exists origin text");
    expect(migrationSql).toContain("add column if not exists source_lesson_event_id uuid");
    expect(migrationSql).toContain("add column if not exists counts_for_ticket boolean");
  });

  it("원생 정기 정보 수정과 보강 일정 생성은 RPC로 원자 처리한다", () => {
    expect(migrationSql).toContain(
      "create or replace function public.update_student_profile_from_date",
    );
    expect(migrationSql).toContain(
      "when effective_from < v_effective_from then v_effective_from - 1",
    );
    expect(migrationSql).toContain("else effective_from");
    expect(migrationSql).toContain("status = 'cancelled'");
    expect(migrationSql).toContain(
      "not exists (\n      select 1\n      from public.attendance_records",
    );
    expect(migrationSql).toContain(
      "create or replace function public.create_makeup_lesson_event",
    );
    expect(migrationSql).toContain("insert into public.absence_resolutions");
    expect(migrationSql).toContain(
      "grant execute on function public.update_student_profile_from_date",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.create_makeup_lesson_event",
    );
  });

  it("원생 등록 확장은 복수 악기와 요일별 시간표를 RPC로 원자 처리한다", () => {
    expect(migrationSql).toContain("add column if not exists age integer");
    expect(migrationSql).toContain("add column if not exists attendance_code text");
    expect(migrationSql).toContain("add column if not exists phone_last4 text");
    expect(migrationSql).toContain("add column if not exists discount_label text");
    expect(migrationSql).toContain(
      "create table public.student_instrument_weekly_schedules",
    );
    expect(migrationSql).toContain(
      "create unique index if not exists students_academy_attendance_code_key",
    );
    expect(migrationSql).toContain(
      "create or replace function public.register_student_with_enrollments",
    );
    expect(migrationSql).toContain("jsonb_array_elements(p_enrollments)");
    expect(migrationSql).toContain("insert into public.lesson_series");
    expect(migrationSql).toContain(
      "grant execute on function public.register_student_with_enrollments",
    );
  });

  it("휴원/퇴원/삭제 정책은 RPC로 제한한다", () => {
    expect(migrationSql).toContain(
      "create or replace function public.update_student_status",
    );
    expect(migrationSql).toContain("status = 'cancelled'");
    expect(migrationSql).toContain("origin = 'regular'");
    expect(migrationSql).toContain(
      "create or replace function public.delete_withdrawn_student",
    );
    expect(migrationSql).toContain("and status = 'withdrawn'");
    expect(migrationSql).toContain(
      "grant execute on function public.update_student_status",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.delete_withdrawn_student",
    );
  });

  it("레슨표 메모는 일자와 레슨표 종류별로 저장하고 원생/선생님 메모는 대상 FK로 연결한다", () => {
    expect(migrationSql).toContain("create table public.lesson_calendar_memos");
    expect(migrationSql).toContain(
      "unique (academy_id, lesson_kind, memo_date)",
    );
    expect(migrationSql).toContain("create table public.entity_memos");
    expect(migrationSql).toContain(
      "foreign key (academy_id, student_id) references public.students (academy_id, id)",
    );
    expect(migrationSql).toContain(
      "foreign key (academy_id, teacher_id) references public.teachers (academy_id, id)",
    );
    expect(migrationSql).toContain(
      "alter table public.lesson_calendar_memos enable row level security",
    );
    expect(migrationSql).toContain(
      "alter table public.entity_memos enable row level security",
    );
  });

  it("선생님 관리는 계약기간, 상태, 근무시간, 급여 상세 RPC를 갖는다", () => {
    expect(migrationSql).toContain("add column if not exists status text");
    expect(migrationSql).toContain(
      "add column if not exists contract_start_on date",
    );
    expect(migrationSql).toContain(
      "add column if not exists contract_end_on date",
    );
    expect(migrationSql).toContain("create table public.teacher_work_schedules");
    expect(migrationSql).toContain(
      "constraint teacher_work_schedules_time_pair_check",
    );
    expect(migrationSql).toContain(
      "constraint teacher_work_schedules_academy_teacher_fk",
    );
    expect(migrationSql).toContain(
      "create or replace function public.register_teacher_with_profile",
    );
    expect(migrationSql).toContain(
      "create or replace function public.update_teacher_profile",
    );
    expect(migrationSql).toContain(
      "create or replace function public.update_teacher_status",
    );
    expect(migrationSql).toContain(
      "create or replace function public.delete_resigned_teacher",
    );
    expect(migrationSql).toContain("and status = 'resigned'");
    expect(migrationSql).toContain(
      "grant execute on function public.register_teacher_with_profile",
    );
  });
});

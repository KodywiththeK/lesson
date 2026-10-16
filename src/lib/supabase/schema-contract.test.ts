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
  "entity_status_transitions",
  "audit_events",
];

describe("교재 출고 원장 연동", () => {
  it("단일 트랜잭션에서 출고와 결제 수입을 기록한다", () => {
    expect(migrationSql).toContain("create function public.register_book_release");
    expect(migrationSql).toContain("insert into public.book_releases");
    expect(migrationSql).toContain("insert into public.ledger_entries");
    expect(migrationSql).toContain("grant execute on function public.register_book_release");
  });
});

describe("과거 완납 데이터 보정", () => {
  it("원천 ID로 중복을 막고 수강료 원장 연결을 복구한다", () => {
    expect(migrationSql).toContain("'book_releases', b.id::text");
    expect(migrationSql).toContain("'fixed_income_snapshots', s.id::text");
    expect(migrationSql).toContain("paid_ledger_entry_id = inserted.id");
    expect(migrationSql).toContain("and l.ref_id = b.id::text");
  });
});

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
  "lesson_ticket_grants",
  "books",
  "entity_status_transitions",
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
  "lesson_ticket_grants",
  "books",
  "book_releases",
  "fixed_income_snapshots",
  "teacher_salary_settings",
  "salary_settlements",
];

describe("Supabase schema contract", () => {
  it("수입 원장은 owner만 접근하고 월수강료 재조회는 기존 항목을 보존한다", () => {
    expect(migrationSql).toContain('create policy "ledger_entries_select_owner_only"');
    expect(migrationSql).toContain('create trigger ledger_entries_require_finance_owner');
    expect(migrationSql).toContain('create or replace function public.ensure_monthly_fixed_income_snapshots');
    expect(migrationSql).toContain('on conflict (academy_id, month, student_id, instrument_id) do nothing');
  });

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

  it("수입 관리 개편을 위해 ledger 수정/삭제, 고정 분류, 감사 기록을 지원한다", () => {
    expect(migrationSql).toContain("add column if not exists category text");
    expect(migrationSql).toContain("add column if not exists updated_by uuid");
    expect(migrationSql).toContain("grant select, insert, update, delete on public.ledger_entries to authenticated");
    expect(migrationSql).toContain("create or replace function private.set_ledger_entry_update_metadata");
    expect(migrationSql).toContain("new.updated_by = (select auth.uid())");
    expect(migrationSql).toContain("create policy \"ledger_entries_update_owner_desk_finance\"");
    expect(migrationSql).toContain("create policy \"ledger_entries_delete_owner_desk_finance\"");
    expect(migrationSql).toContain("create trigger ledger_entries_audit_insert");
    expect(migrationSql).toContain("create trigger ledger_entries_audit_update");
    expect(migrationSql).toContain("create trigger ledger_entries_audit_delete");
  });

  it("학원 레슨수입 월별 생성과 수납 상태 연결 컬럼을 둔다", () => {
    expect(migrationSql).toContain("alter table public.fixed_income_snapshots");
    expect(migrationSql).toContain("add column if not exists due_on date");
    expect(migrationSql).toContain("add column if not exists lesson_fee integer");
    expect(migrationSql).toContain("add column if not exists discount_total integer");
    expect(migrationSql).toContain("add column if not exists progress text");
    expect(migrationSql).toContain("add column if not exists paid_ledger_entry_id uuid");
    expect(migrationSql).toContain(
      "create or replace function public.ensure_monthly_fixed_income_snapshots",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.ensure_monthly_fixed_income_snapshots",
    );
  });

  it("수강료 수납/미수납과 급여 지급 확정은 원자 RPC로 처리한다", () => {
    expect(migrationSql).toContain(
      "create or replace function public.mark_fixed_income_snapshot_paid",
    );
    expect(migrationSql).toContain(
      "create or replace function public.mark_fixed_income_snapshot_unpaid",
    );
    expect(migrationSql).toContain(
      "create or replace function public.mark_salary_settlement_paid",
    );
    expect(migrationSql).toContain(
      "add column if not exists paid_ledger_entry_id uuid",
    );
    expect(migrationSql).toContain(
      "constraint salary_settlements_paid_ledger_fk",
    );
    expect(migrationSql).toContain("for update");
    expect(migrationSql).toContain(
      "grant execute on function public.mark_fixed_income_snapshot_paid",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.mark_fixed_income_snapshot_unpaid",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.mark_salary_settlement_paid",
    );
  });

  it("교재내역에서 발주일을 추적한다", () => {
    expect(migrationSql).toContain("alter table public.book_inventory_batches");
    expect(migrationSql).toContain("add column if not exists ordered_on date");
    expect(migrationSql).toContain("ordered_on = stocked_at");
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

  it("학원 레슨 1회 일정 이동과 출결 초기화는 RPC로 원자 처리한다", () => {
    expect(migrationSql).toContain(
      "drop constraint if exists lesson_events_origin_check",
    );
    expect(migrationSql).toContain("'rescheduled'");
    expect(migrationSql).toContain(
      "create or replace function public.move_academy_lesson_event",
    );
    expect(migrationSql).toContain(
      "create or replace function public.reset_academy_lesson_attendance",
    );
    expect(migrationSql).toContain("lesson_event.rescheduled");
    expect(migrationSql).toContain("attendance.reset");
    expect(migrationSql).toContain(
      "grant execute on function public.move_academy_lesson_event",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.reset_academy_lesson_attendance",
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

  it("레슨표 메모는 다건 날짜 메모로 저장하고 선택 대상 FK를 가진다", () => {
    expect(migrationSql).toContain("create table public.lesson_calendar_memos");
    expect(migrationSql).toContain(
      "drop constraint if exists lesson_calendar_memos_academy_id_lesson_kind_memo_date_key",
    );
    expect(migrationSql).toContain("add column if not exists student_id uuid");
    expect(migrationSql).toContain("add column if not exists teacher_id uuid");
    expect(migrationSql).toContain("add column if not exists student_name text");
    expect(migrationSql).toContain("add column if not exists teacher_name text");
    expect(migrationSql).toContain(
      "constraint lesson_calendar_memos_academy_student_fk",
    );
    expect(migrationSql).toContain(
      "constraint lesson_calendar_memos_academy_teacher_fk",
    );
    expect(migrationSql).toContain("grant select, insert, update, delete");
    expect(migrationSql).toContain("drop table if exists public.entity_memos");
    expect(migrationSql).toContain(
      "alter table public.lesson_calendar_memos enable row level security",
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

  it("휴원/퇴원 관리는 soft archive와 상태 전환 감사 로그를 둔다", () => {
    expect(migrationSql).toContain("add column if not exists archived_at timestamptz");
    expect(migrationSql).toContain("add column if not exists archive_reason text");
    expect(migrationSql).toContain("add column if not exists retention_until date");
    expect(migrationSql).toContain("create table public.entity_status_transitions");
    expect(migrationSql).toContain("entity_type text not null");
    expect(migrationSql).toContain("from_status text not null");
    expect(migrationSql).toContain("to_status text not null");
    expect(migrationSql).toContain("create or replace function public.archive_expired_people");
    expect(migrationSql).toContain("status = 'withdrawn'");
    expect(migrationSql).toContain("status = 'resigned'");
    expect(migrationSql).toContain("cron.schedule");
    expect(migrationSql).toContain("lesson-archive-expired-people");
  });
});

describe("레슨 시간표 명세 RPC 계약 (20261016090000·090100)", () => {
  const workflows = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261016090000_lesson_schedule_workflows.sql"),
    "utf8",
  ).toLocaleLowerCase();
  const tickets = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261016090100_lesson_ticket_registration_and_adjustment.sql"),
    "utf8",
  ).toLocaleLowerCase();

  it("결석 확정은 이미 처리된 결석을 거부하고 회차권을 건드리지 않으며 포스트잇에 기록한다", () => {
    expect(workflows).toContain("create or replace function public.resolve_academy_lesson_absence");
    expect(workflows).toContain("이미 보강 또는 패스로 처리된 결석입니다");
    expect(workflows).toContain("insert into public.absence_resolutions");
    expect(workflows).toContain("insert into public.monthly_memos");
    expect(workflows).toContain("unread = true");
    expect(workflows).toContain("time_unspecified");
    const resolveBody = workflows.slice(
      workflows.indexOf("create or replace function public.resolve_academy_lesson_absence"),
      workflows.indexOf("create or replace function public.delete_academy_lesson_event"),
    );
    expect(resolveBody).not.toContain("lesson_ticket_grants");
    expect(resolveBody).not.toContain("lesson_ticket_usages");
  });

  it("일정 삭제는 사유를 요구하고 출결 처리된 일정을 거부하며 audit을 남긴다", () => {
    expect(workflows).toContain("create or replace function public.delete_academy_lesson_event");
    expect(workflows).toContain("삭제 사유를 입력해 주세요");
    expect(workflows).toContain("이미 출결 처리된 일정은 삭제할 수 없습니다");
    expect(workflows).toContain("status = 'deleted'");
    expect(workflows).toContain("'lesson_event.deleted'");
  });

  it("일정 이동은 같은 달 안으로 제한한다", () => {
    expect(workflows).toContain("create or replace function public.move_academy_lesson_event");
    expect(workflows).toContain("일정은 같은 달 안에서만 이동할 수 있습니다");
  });

  it("개인레슨 등원 확인 취소는 차감한 회차를 복구하고 출결 기록을 지운다", () => {
    expect(workflows).toContain("create or replace function public.cancel_private_lesson_attendance");
    expect(workflows).toContain("remaining_count = least(total_granted_count, remaining_count + v_usage.used_count)");
    expect(workflows).toContain("delete from public.lesson_ticket_usages");
    expect(workflows).toContain("delete from public.attendance_records");
  });

  it("월별 포스트잇은 학원/개인레슨 구분으로 달마다 하나만 둔다", () => {
    expect(workflows).toContain("add column if not exists lesson_kind text not null default 'academy'");
    expect(workflows).toContain("unique (academy_id, lesson_kind, month)");
  });

  it("회차권 등록은 한 트랜잭션에서 합산·만료일 계산·결제 금액 원장 기록을 하고 결제는 원장만 허용한다", () => {
    expect(tickets).toContain("create or replace function public.register_lesson_ticket");
    expect(tickets).toContain("v_valid_until := p_registered_at + p_valid_days");
    expect(tickets).toContain("total_granted_count = v_existing.total_granted_count + p_granted_count");
    expect(tickets).toContain("paid_amount = v_existing.paid_amount + v_paid");
    expect(tickets).toContain("insert into public.ledger_entries");
    expect(tickets).toContain("결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다");
  });

  it("회차권 직접 수정은 사유를 요구하고 이력과 audit을 남긴다", () => {
    expect(tickets).toContain("create or replace function public.adjust_lesson_ticket");
    expect(tickets).toContain("수정 사유를 입력해 주세요");
    expect(tickets).toContain("insert into public.lesson_ticket_adjustments");
    expect(tickets).toContain("'lesson_ticket.adjusted'");
  });

  it.each([
    ["resolve_academy_lesson_absence(uuid, uuid, uuid, text, date, time, time, text)"],
    ["delete_academy_lesson_event(uuid, uuid, text)"],
    ["cancel_private_lesson_attendance(uuid, uuid, uuid, text)"],
  ])("%s는 anon을 막고 authenticated에만 실행을 허용한다", (signature) => {
    expect(workflows).toContain(`revoke all on function public.${signature} from anon`);
    expect(workflows).toContain(`grant execute on function public.${signature} to authenticated`);
  });

  it.each([
    ["register_lesson_ticket(uuid, uuid, text, text, integer, integer, date, integer)"],
    ["adjust_lesson_ticket(uuid, uuid, integer, integer, date, text)"],
  ])("%s는 anon을 막고 authenticated에만 실행을 허용한다", (signature) => {
    expect(tickets).toContain(`revoke all on function public.${signature} from anon`);
    expect(tickets).toContain(`grant execute on function public.${signature} to authenticated`);
  });
  it("월별 메모의 옛 (academy_id, month) unique 제약을 모두 제거한다", () => {
    expect(workflows).toContain("drop constraint if exists monthly_memos_academy_month_key");
    expect(workflows).toContain("drop constraint if exists monthly_memos_academy_id_month_key");
    // 이름이 달라도 (academy_id, month) 컬럼만으로 된 unique는 모두 찾아 지운다.
    expect(workflows).toContain("con.contype = 'u'");
    expect(workflows).toContain("array['academy_id', 'month']");
  });

  it("일정 이동은 보강 시간 미정 표시를 새 일정에 이어 준다", () => {
    const moveBody = workflows.slice(
      workflows.indexOf("create or replace function public.move_academy_lesson_event"),
      workflows.indexOf("create or replace function public.resolve_academy_lesson_absence"),
    );
    expect(moveBody).toContain("time_unspecified");
    expect(moveBody).toContain("v_source.time_unspecified");
  });

  it("회차권 사용 기한은 상한을 한국어로 검사한다", () => {
    expect(tickets).toContain("p_valid_days > 3650");
    expect(tickets).toContain("사용 기한은 3650일 이하로 입력해 주세요");
  });

  it("옛 보강 생성 RPC는 새 결석 확정 RPC로 우회되지 않도록 호출 권한을 회수한다", () => {
    expect(workflows).toContain("revoke execute on function public.create_makeup_lesson_event");
  });

  it("보강 일정을 삭제하면 결석 처리를 보강 없는 패스로 바꾸고 포스트잇에 기록한다", () => {
    const deleteBody = workflows.slice(
      workflows.indexOf("create or replace function public.delete_academy_lesson_event"),
      workflows.indexOf("create or replace function public.cancel_private_lesson_attendance"),
    );
    expect(deleteBody).toContain("update public.absence_resolutions");
    expect(deleteBody).toContain("resolved_as = 'pass'");
    expect(deleteBody).toContain("makeup_lesson_event_id = null");
    expect(deleteBody).toContain("insert into public.monthly_memos");
    expect(deleteBody).toContain("보강 삭제로 패스 처리");
  });

  it("보강 일정을 이동해도 결석 처리 연결과 보강 표시를 유지한다", () => {
    const moveBody = workflows.slice(
      workflows.indexOf("create or replace function public.move_academy_lesson_event"),
      workflows.indexOf("create or replace function public.resolve_academy_lesson_absence"),
    );
    expect(moveBody).toContain("update public.absence_resolutions");
    expect(moveBody).toContain("makeup_lesson_event_id = v_moved.id");
    expect(moveBody).toContain("case when v_source.origin = 'makeup' then 'makeup' else 'rescheduled' end");
    expect(moveBody).toContain("coalesce(v_source.source_lesson_event_id, v_source.id)");
  });

  it("처리된 결석의 출결은 직접 수정·삭제할 수 없도록 서버 trigger가 막는다", () => {
    expect(workflows).toContain("create or replace function private.guard_resolved_absence_attendance");
    expect(workflows).toContain("이미 보강 또는 패스로 처리된 결석은 변경할 수 없습니다");
    expect(workflows).toContain("before update or delete on public.attendance_records");
    expect(workflows).toContain("pg_trigger_depth() > 1");
  });

});

describe("수입 관리 명세 RPC 계약 (20261017090000)", () => {
  const finance = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20261017090000_finance_income_spec.sql"),
    "utf8",
  ).toLocaleLowerCase();

  const sliceFunction = (name: string) => {
    const start = finance.indexOf(`create or replace function public.${name}`);
    const next = finance.indexOf("create or replace function", start + 10);

    return finance.slice(start, next === -1 ? undefined : next);
  };
  const ownerOnly = "array['owner'::public.academy_member_role]";

  it("수강료 입금 상태에 미납(overdue)을 추가하고 모든 상태 변경은 원장 전용이다", () => {
    expect(finance).toContain("check (status in ('unpaid', 'paid', 'overdue'))");

    for (const name of [
      "mark_fixed_income_snapshot_paid",
      "mark_fixed_income_snapshot_unpaid",
      "mark_fixed_income_snapshot_overdue",
    ]) {
      expect(sliceFunction(name), name).toContain(ownerOnly);
    }
  });

  it("미납 처리는 입금 완료 건을 거부하고, 입금은 미입금·미납에서만 하며 0원은 거부한다", () => {
    const overdue = sliceFunction("mark_fixed_income_snapshot_overdue");
    expect(overdue).toContain("status = 'overdue'");
    expect(overdue).toContain("먼저 입금 취소를 해 주세요");

    const paid = sliceFunction("mark_fixed_income_snapshot_paid");
    expect(paid).toContain("이미 입금 완료된 수강료입니다");
    expect(paid).toContain("결제 금액이 0원인 수강료는 입금 처리할 수 없습니다");
    expect(paid).toContain("insert into public.ledger_entries");
  });

  it("입금 취소는 입금 완료 건만 받아 연결된 원장 행을 함께 삭제하고, 다른 상태는 거부한다", () => {
    const unpaid = sliceFunction("mark_fixed_income_snapshot_unpaid");
    expect(unpaid).toContain("status <> 'paid'");
    expect(unpaid).toContain("입금 완료된 수강료만 입금 취소할 수 있습니다");
    expect(unpaid).toContain("delete from public.ledger_entries");
    expect(unpaid).toContain("status = 'unpaid'");
  });

  it("미납 해제는 미납 건만 받아 원장을 건드리지 않고 미입금으로 돌린다", () => {
    const clear = sliceFunction("clear_fixed_income_snapshot_overdue");
    expect(clear).toContain(ownerOnly);
    expect(clear).toContain("status <> 'overdue'");
    expect(clear).toContain("미납 상태인 수강료만 미납 해제할 수 있습니다");
    expect(clear).toContain("status = 'unpaid'");
    expect(clear).not.toContain("delete from public.ledger_entries");
  });

  it("급여 지급은 선생님·월 단위로 잠그고 같은 달 어떤 유형이든 지급 완료면 거부한다", () => {
    const pay = sliceFunction("mark_salary_settlement_paid");
    expect(pay).toContain("pg_advisory_xact_lock");
    expect(pay).toContain("status = 'paid'");
    expect(pay).toContain("이미 지급 완료된 급여입니다");
    expect(pay).toContain("p_net_pay <> p_base_pay - p_withholding_tax");
    expect(pay).toContain("지급할 금액이 0원이어서");
    expect(pay).toContain(ownerOnly);
    // 선생님 이름은 화면이 보낸 값이 아니라 DB에서 읽는다.
    expect(pay).toContain("from public.teachers");
  });

  it("급여 지급 확정은 서버가 등원 수업 목록과 월급·시급·세금을 다시 확인한다", () => {
    const pay = sliceFunction("mark_salary_settlement_paid");
    // 형식·미래 월·NULL 입력
    expect(pay).toContain("급여 월 형식을 확인해 주세요");
    expect(pay).toContain("아직 시작하지 않은 달의 급여는 지급 확정할 수 없습니다");
    expect(pay).toContain("급여 지급 정보를 모두 입력해 주세요");
    // 그 선생님·그 달(한국 시간)의 실제 등원 수업 전체와 보낸 목록이 같아야 한다
    expect(pay).toContain("from public.lesson_events");
    expect(pay).toContain("attendance.status = 'present'");
    expect(pay).toContain("'asia/seoul'");
    expect(pay).toContain("p_lesson_event_ids");
    expect(pay).toContain("등원 기록이 바뀌어 급여 금액을 확정할 수 없습니다");
    // 설정 금액·시간으로 재계산
    expect(pay).toContain("from public.teacher_salary_settings");
    expect(pay).toContain("급여 설정을 확인해 주세요");
    expect(pay).toContain("v_setting.monthly_salary");
    expect(pay).toContain("v_setting.hourly_rate");
    expect(pay).toContain("v_worked_minutes");
    expect(pay).toContain("floor(");
    // 세금은 화면 정책(3.3% 내림)과 같은 값만 받는다
    expect(pay).toContain("* 33 / 1000");
    expect(pay).toContain("원천징수액이 계산과 다릅니다");
  });

  it("비율제는 등원 기록이 없으면 임의 금액을 받지 않고, 월급제는 수업 목록을 저장하지 않는다", () => {
    const pay = sliceFunction("mark_salary_settlement_paid");
    expect(pay).toContain("cardinality(v_expected_ids) = 0");
    expect(pay).toContain("등원 기록이 없어 비율제 급여를 확정할 수 없습니다");
    expect(pay).toContain("case when p_pay_type = 'monthly' then '{}'::uuid[] else v_provided_ids end");
    expect(pay).toContain("p_month < '2000-01'");
  });

  it("이미 미납인 항목을 다시 미납 처리하지 않는다", () => {
    const overdue = sliceFunction("mark_fixed_income_snapshot_overdue");
    expect(overdue).toContain("이미 미납으로 기록된 수강료입니다");
  });

  it("원장 연결 id가 비어 있는 지급·입금 건도 ref로 찾아 원장을 함께 지운다", () => {
    const cancel = sliceFunction("cancel_salary_settlement_paid");
    expect(cancel).toContain("ref_table = 'salary_settlements'");
    expect(cancel).toContain("ref_id = v_settlement.id::text");

    const unpaid = sliceFunction("mark_fixed_income_snapshot_unpaid");
    expect(unpaid).toContain("ref_table = 'fixed_income_snapshots'");
    expect(unpaid).toContain("ref_id = v_snapshot.id::text");
  });

  it("재정의한 기존 함수에도 anon 직접 실행 권한을 회수한다", () => {
    for (const signature of [
      "mark_fixed_income_snapshot_paid(uuid, uuid, date)",
      "mark_fixed_income_snapshot_unpaid(uuid, uuid)",
      "mark_salary_settlement_paid(uuid, uuid, text, text, text, integer, integer, integer, uuid[], date)",
      "register_book_release(uuid, uuid, text, text, integer, date, text)",
    ]) {
      expect(finance).toContain(`revoke all on function public.${signature} from anon`);
    }
  });

  it("급여 지급 취소는 같은 달에 지급 완료가 여러 건(레거시)이어도 모두 되돌린다", () => {
    const cancel = sliceFunction("cancel_salary_settlement_paid");
    expect(cancel).toContain("for v_settlement in");
    expect(cancel).toContain("end loop");
  });

  it("급여 지급 취소는 원장 행 삭제와 미지급 복귀를 같은 트랜잭션에서 하고 audit을 남긴다", () => {
    const cancel = sliceFunction("cancel_salary_settlement_paid");
    expect(cancel).toContain(ownerOnly);
    expect(cancel).toContain("pg_advisory_xact_lock");
    expect(cancel).toContain("delete from public.ledger_entries");
    expect(cancel).toContain("status = 'pending'");
    expect(cancel).toContain("insert into public.audit_events");
    expect(cancel).toContain("지급 완료된 급여를 찾지 못했습니다");
  });

  it("교재 결제 완료 전환은 원장 전용이며 상태 변경과 원장 등록을 한 트랜잭션에서 한다", () => {
    const complete = sliceFunction("complete_book_release_payment");
    expect(complete).toContain(ownerOnly);
    expect(complete).toContain("for update");
    expect(complete).toContain("이미 결제 완료된 교재입니다");
    expect(complete).toContain("insert into public.ledger_entries");
    expect(complete).toContain("'book-sale'");
    expect(complete).toContain("status = 'paid'");
  });

  it("교재 출고는 결제 완료 원장 행의 id를 함께 저장해 연결이 끊긴 것을 알아볼 수 있다", () => {
    expect(finance).toContain("alter table public.book_releases");
    expect(finance).toContain("add column if not exists paid_ledger_entry_id uuid");
    expect(finance).toContain("book_releases_paid_ledger_fk");
    expect(finance).toContain("on delete set null (paid_ledger_entry_id)");
    // 이미 결제 완료인 출고는 원장 ref로 연결을 채운다
    expect(finance).toContain("update public.book_releases release");
    expect(finance).toContain("ledger.ref_table = 'book_releases'");
    expect(finance).toContain("ledger.ref_id = release.id::text");

    const complete = sliceFunction("complete_book_release_payment");
    expect(complete).toContain("paid_ledger_entry_id = v_ledger_id");

    const register = sliceFunction("register_book_release");
    expect(register).toContain("security invoker");
    expect(register).toContain("set search_path = ''");
    expect(register).toContain("paid_ledger_entry_id = created_ledger_id");
  });

  it("새 RPC는 anon·public 실행 권한을 회수하고 authenticated에만 부여한다", () => {
    for (const signature of [
      "mark_fixed_income_snapshot_overdue(uuid, uuid)",
      "clear_fixed_income_snapshot_overdue(uuid, uuid)",
      "cancel_salary_settlement_paid(uuid, uuid, text)",
      "complete_book_release_payment(uuid, uuid, date)",
    ]) {
      expect(finance).toContain(`revoke all on function public.${signature} from public`);
      expect(finance).toContain(`grant execute on function public.${signature} to authenticated`);
    }
  });
});

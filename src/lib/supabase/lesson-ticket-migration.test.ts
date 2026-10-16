import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((file) => file.endsWith("_lesson_ticket_registration_history.sql"))
  .map((file) => readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8"))
  .join("\n")
  .toLowerCase();

const expiryMigration = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261016090300_preserve_lesson_ticket_expiry_on_reregistration.sql"),
  "utf8",
).toLowerCase();

describe("회차권 등록 이력 migration", () => {
  it("재등록 때 기존 만료일보다 유효 기간을 앞당기지 않는다", () => {
    expect(expiryMigration).toContain("greatest(v_existing.valid_until, v_valid_until)");
    expect(expiryMigration).toContain("v_ticket.valid_until, v_paid, v_ledger_id");
  });
  it("기존 중복·복원 불가능한 이력을 거부한 뒤 회차권 범위를 유일하게 만든다", () => {
    expect(migration).toContain("create table public.lesson_ticket_registrations");
    expect(migration).toContain("raise exception '회차권 이력을 안전하게 복원할 수 없습니다");
    expect(migration).toContain("unique (academy_id, student_id, instrument_id)");
  });

  it("등록 RPC가 범위 잠금과 등록 건별 원장 연결을 같은 트랜잭션에서 처리한다", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("insert into public.lesson_ticket_registrations");
    expect(migration).toContain("ledger_entry_id");
    expect(migration).toContain("p_registered_at < v_existing.registered_at");
  });

  it("출석은 등록 유효 구간에만 차감하고 취소는 실제 복구 여부를 돌려준다", () => {
    expect(migration).toContain("create function private.guard_private_ticket_attendance");
    expect(migration).toContain("from public.lesson_ticket_registrations registration");
    expect(migration).toContain("create function public.cancel_private_lesson_attendance");
    expect(migration).toContain("'restored_ticket'");
    expect(migration).toContain("v_restored := v_updated_count = 1");
  });

  it("직접 쓰기와 파괴적 삭제 RPC를 닫고 선생님에게 제한된 조회 RPC만 연다", () => {
    expect(migration).toContain("revoke insert, update, delete on public.lesson_ticket_grants from authenticated");
    expect(migration).toContain("revoke insert, update, delete on public.lesson_ticket_adjustments from authenticated");
    expect(migration).toContain("revoke insert, update, delete on public.lesson_ticket_usages from authenticated");
    expect(migration).toContain("revoke execute on function public.delete_withdrawn_student");
    expect(migration).toContain("revoke execute on function public.delete_resigned_teacher");
    expect(migration).toContain("create or replace function public.get_assigned_lesson_ticket_balances");
    expect(migration).toContain('create policy "lesson_ticket_registrations_select_owner"');
    expect(migration).toContain("revoke delete on public.teachers from authenticated");
    expect(migration).toContain("revoke select on public.lesson_ticket_grants from authenticated");
    expect(migration).toContain("grant select (id, academy_id, student_id, instrument_id");
    expect(migration).toContain("teacher.status <> 'resigned'");
  });

  it("개인레슨 출결 직접 쓰기를 막고 기존 RPC만 허용한다", () => {
    expect(migration).toContain("alter function public.mark_private_lesson_attendance");
    expect(migration).toContain("create function public.mark_private_lesson_attendance");
    expect(migration).toContain("current_setting('app.private_ticket_attendance', true)");
    expect(migration).toContain("before insert or update on public.attendance_records");
    expect(migration).toContain("old.lesson_event_id is distinct from new.lesson_event_id");
    expect(migration).toContain("old.student_id is distinct from new.student_id");
    expect(migration).toContain("old.academy_id is distinct from new.academy_id");
    expect(migration).toContain("before delete on public.attendance_records");
    expect(migration).toContain("create function private.guard_private_ticket_attendance_delete");
  });
});

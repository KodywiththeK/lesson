import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/20261020090500_lesson_audit_history.sql"), "utf8").toLowerCase();

describe("레슨 변경 이력 조회 권한 계약", () => {
  it("원장·데스크만 허용하며 감사 로그 전체 조회 권한을 열지 않는다", () => {
    expect(migration).toContain("create function public.list_lesson_change_history");
    expect(migration).toContain("create function private.list_lesson_change_history");
    expect(migration).toContain("security definer");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("private.has_academy_role");
    expect(migration).toContain("'owner'::public.academy_member_role");
    expect(migration).toContain("'desk'::public.academy_member_role");
    expect(migration).toContain("revoke all on function public.list_lesson_change_history(uuid, date, text) from public");
    expect(migration).toContain("revoke all on function public.list_lesson_change_history(uuid, date, text) from anon");
    expect(migration).toContain("grant execute on function public.list_lesson_change_history(uuid, date, text) to authenticated");
    expect(migration).toContain("revoke all on function private.list_lesson_change_history(uuid, date, text) from public");
    expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.audit_events\s+to\s+authenticated/);
  });

  it("레슨 전용 이벤트와 학원·날짜·종류를 제한하고 metadata를 반환하지 않는다", () => {
    expect(migration).toContain("event.event_type in (");
    expect(migration).toContain("event.academy_id = p_academy_id");
    expect(migration).toContain("at time zone 'asia/seoul'");
    expect(migration).toContain("p_lesson_kind not in ('academy', 'private')");
    expect(migration).toContain("event.metadata->>'source_lesson_event_id'");
    expect(migration).toContain("event.metadata->>'lesson_event_id'");
    expect(migration).toContain("event.metadata->>'target_date' = p_lesson_date::text");
    expect(migration).not.toMatch(/returns\s+table\s*\([^)]*metadata/);
  });

  it("최초 결석과 결석 사유 변경도 수업 이력에 남긴다", () => {
    expect(migration).toContain("create function private.audit_lesson_absence_change");
    expect(migration).toContain("after insert or update of status, absence_reason on public.attendance_records");
    expect(migration).toContain("'attendance.absent'");
    expect(migration).toContain("'attendance.absence_reason_changed'");
  });
});

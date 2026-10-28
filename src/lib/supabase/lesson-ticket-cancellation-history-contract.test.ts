import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("회차권 삭제 이력 마이그레이션", () => {
  it("삭제 결과를 같은 트랜잭션에 보존하고 학원별 읽기 권한을 제한한다", () => {
    const sql = readFileSync("supabase/migrations/20261028073720_lesson_ticket_cancellation_history.sql", "utf8");
    expect(sql).toContain("create table public.lesson_ticket_cancellation_history");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("private.has_academy_role");
    expect(sql).toContain("private.delete_lesson_ticket_without_history");
  });
  it("기존 이력 이관 중 쓰기를 막고 예약과 같은 순서로 잠근다", () => {
    const sql = readFileSync("supabase/migrations/20261028073720_lesson_ticket_cancellation_history.sql", "utf8");
    const backfill = sql.indexOf("insert into public.lesson_ticket_cancellation_history");
    expect(sql.indexOf("lock table public.lesson_ticket_grants in exclusive mode")).toBeGreaterThan(-1);
    expect(sql.indexOf("lock table public.lesson_ticket_grants in exclusive mode")).toBeLessThan(backfill);
    const wrapper = sql.slice(sql.indexOf("create function public.delete_lesson_ticket"));
    expect(wrapper.indexOf("pg_advisory_xact_lock")).toBeGreaterThan(-1);
    expect(wrapper.indexOf("pg_advisory_xact_lock")).toBeLessThan(wrapper.indexOf("for update"));
    expect(sql).toContain("references public.academies(id) on delete cascade");
    expect(sql).toContain("create trigger lesson_ticket_legacy_history_capture");
    expect(sql).toContain("private.adjust_lesson_ticket_without_scope_lock");
    expect(sql).toContain("private.revoke_service_lesson_ticket_without_scope_lock");
    expect(sql).toContain("as restrictive for insert to authenticated");
  });
});

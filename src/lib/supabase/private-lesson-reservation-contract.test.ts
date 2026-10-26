import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20261026130428_private_lesson_reservations_and_calendar_settings.sql",
  "utf8",
).toLowerCase();

describe("개인레슨 예약과 달력 설정 DB 계약", () => {
  it("일정 저장과 결석 취소를 서버에서 회차권 한도로 검증한다", () => {
    expect(sql).toContain("create function private.private_lesson_available_count");
    expect(sql).toContain("create trigger private_lesson_reservation_guard");
    expect(sql).toContain("create trigger private_absence_cancel_reservation_guard");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toMatch(/private_lesson_available_count\([\s\S]*?returns integer language sql volatile/);
    expect(sql).toMatch(/guard_private_lesson_reservation\([\s\S]*?from public\.teachers[\s\S]*?academy_id = new\.academy_id/);
  });

  it("일정 수정·삭제와 학원 공통 설정에 역할별 접근 경계를 둔다", () => {
    expect(sql).toContain("create function public.update_private_lesson_event");
    expect(sql).toContain("create function public.delete_private_lesson_event");
    expect(sql).toContain("create table public.academy_instrument_colors");
    expect(sql).toContain("create table public.academy_closures");
    expect(sql).toContain("enable row level security");
  });

  it("개인레슨 직접 삭제를 막고 반복 휴원일에 종료일을 요구한다", () => {
    expect(sql).toContain("before insert or update or delete on public.lesson_events");
    expect(sql).toMatch(/tg_op = 'delete'[\s\S]*?old\.lesson_kind = 'private'[\s\S]*?raise exception/);
    expect(sql).toContain("ends_on date not null");
  });
});

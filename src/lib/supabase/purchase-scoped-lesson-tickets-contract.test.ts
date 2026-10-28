import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const files = readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((name) => name.endsWith("_purchase_scoped_lesson_tickets.sql"));
const sql = files.map((name) => readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8"))
  .join("\n").toLowerCase();

describe("구매별 개인레슨 회차권 DB 계약", () => {
  it("기존 병합권은 남기고 새 구매와 레슨을 개별 권에 연결한다", () => {
    expect(files).toHaveLength(1);
    expect(sql).toContain("drop constraint lesson_ticket_grants_one_per_instrument");
    expect(sql).toContain("add column ticket_grant_id uuid");
    expect(sql).toContain("add column ticket_session_number integer");
    expect(sql).toContain("insert into public.lesson_ticket_grants");
    expect(sql).toContain("where event.ticket_grant_id is not null and event.status = 'scheduled'");
  });

  it("예약·출석·외상 정산에서 회차권별 잔여를 검증한다", () => {
    expect(sql).toContain("private.private_lesson_grant_available_count");
    expect(sql).toContain("new.ticket_grant_id");
    expect(sql).toContain("v_lesson.ticket_grant_id");
    expect(sql).toContain("private.settle_private_lesson_credits");
    expect(sql).toContain("pg_advisory_xact_lock");
  });

  it("원생 등록·수정 RPC의 수업 시간 검사도 5~240분으로 확장한다", () => {
    expect(sql).toContain("create or replace function private.validate_private_lesson_settings");
    expect(sql).toContain("v_duration < 5 or v_duration > 240");
    expect(sql).toContain("수업 시간에 맞는 레슨비를 직접 입력해 주세요.");
  });

  it("결석 당시 권이 삭제된 일정의 결석 취소를 막는다", () => {
    expect(sql).toContain("if v_lesson.ticket_grant_id is null then");
    expect(sql).toContain("결석 당시 회차권이 삭제되어 출결을 취소할 수 없습니다.");
  });
});

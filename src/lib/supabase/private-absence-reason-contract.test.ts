import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 이 migration의 계약만 확인한다(파일 하나만 읽는다).
const migrationSql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261020090100_private_absence_reason.sql"),
  "utf8",
).toLocaleLowerCase();

const oldSignature =
  "public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz)";
const newSignature =
  "public.mark_private_lesson_attendance(uuid, uuid, uuid, text, text, timestamptz, text)";

describe("개인레슨 결석 사유 migration 계약", () => {
  it("이전 6인자 시그니처를 지워 오버로드로 새 규칙을 우회하지 못하게 한다", () => {
    expect(migrationSql).toContain(`drop function if exists ${oldSignature}`);
  });

  it("사유 인자를 선택값으로 받고 기존 impl에 출결 처리를 맡긴다", () => {
    expect(migrationSql).toContain("p_reason text default null");
    expect(migrationSql).toContain("private.mark_private_lesson_attendance_impl(");
    expect(migrationSql).toContain("perform set_config('app.private_ticket_attendance', '1', true)");
    expect(migrationSql).toContain("perform set_config('app.private_ticket_attendance', '', true)");
  });

  it("사유가 비면 기본 문구를 쓰고 100자를 넘기면 거부한다", () => {
    expect(migrationSql).toContain("사유는 100자 이하로 입력해 주세요.");
    expect(migrationSql).toMatch(/char_length\(v_reason\) > 100/);
    expect(migrationSql).toMatch(/coalesce\(nullif\(btrim\(p_reason\), ''\), '결석 확인'\)/);
  });

  it("결석일 때만 impl 처리 뒤에 사유를 갱신하고 회차권 처리는 건드리지 않는다", () => {
    expect(migrationSql).toMatch(/if p_status = 'absent' then\s+update public\.attendance_records/);
    expect(migrationSql).toMatch(/set absence_reason = v_reason/);
    expect(migrationSql).not.toMatch(/lesson_ticket_grants|lesson_ticket_usages/);
  });

  it("anon·public 실행 권한은 없고 로그인 사용자만 실행한다", () => {
    expect(migrationSql).toContain(`revoke all on function ${newSignature}`);
    expect(migrationSql).toMatch(/from public, anon;/);
    expect(migrationSql).toContain(`grant execute on function ${newSignature}`);
    expect(migrationSql).toMatch(/to authenticated;/);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261127000000_daily_task_actions.sql"),
  "utf8",
).toLocaleLowerCase();

function body(name: string) {
  const start = sql.indexOf(`create or replace function ${name}(`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);

  return sql.slice(start, sql.indexOf("\n$$;", start));
}

describe("오늘 할 일 모달 처리·연락처 migration 계약", () => {
  it("파일 전체를 한 트랜잭션으로 감싼다", () => {
    expect(sql.trimStart().split("\n").filter((line) => !line.startsWith("--")).join("\n").trimStart()).toMatch(/^begin;/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
  });

  it("연락처는 원장·데스크 범위에서만 채우고, 연락처를 넣는 곳은 모두 같은 조건을 쓴다", () => {
    const source = body("private.daily_task_source");

    expect(source).toContain("v_with_contacts boolean := p_scope in ('owner', 'desk')");
    expect(source.match(/case when v_with_contacts then private.daily_task_student_contact/g)).toHaveLength(4);
    expect(source).toContain("'phone', case when v_with_contacts then consultation.phone end");
    expect(source).not.toMatch(/'phone', consultation\.phone/);
  });

  it("금액·선생님 범위 규칙은 그대로 둔다", () => {
    const source = body("private.daily_task_source");

    expect(source).toContain("v_with_amounts boolean := p_scope = 'owner'");
    expect(source.match(/case when v_with_amounts then/g)).toHaveLength(3);
    expect(source.match(/not v_is_teacher or private.teacher_can_access_student/g)).toHaveLength(2);
    expect(source).toContain("if not v_is_teacher then");
  });

  it("보강 창에 필요한 원본 일정 id·시간·악기·정규 요일과 재등록에 필요한 학생·악기 id를 보낸다", () => {
    const source = body("private.daily_task_source");

    for (const field of ["'lessoneventid'", "'startsat'", "'endsat'", "'instrumentid'", "'regularweekdays'", "'teachername'", "'absencereason'"]) {
      expect(source).toContain(field);
    }
    expect(source).toContain("'studentid', student.id,\n        'instrumentid', grant_row.instrument_id");
  });

  it("대표 연락처는 가장 먼저 등록한 번호 하나이고 브라우저에서 직접 부를 수 없다", () => {
    const contact = body("private.daily_task_student_contact");

    expect(contact).toContain("order by contact.created_at, contact.id");
    expect(contact).toContain("limit 1");
    expect(sql).toContain(
      "revoke all on function private.daily_task_student_contact(uuid, uuid) from public, anon, authenticated",
    );
  });
});

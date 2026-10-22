import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021090000_teacher_contract_optional.sql"),
  "utf8",
).toLocaleLowerCase();

function sliceFunction(name: string) {
  const start = sql.indexOf(`create or replace function ${name}`);
  expect(start, `${name} 정의가 있어야 한다`).toBeGreaterThanOrEqual(0);
  const next = sql.indexOf("create or replace function", start + 10);

  return sql.slice(start, next === -1 ? undefined : next);
}

describe("선생님 계약기간 선택 (20261021090000)", () => {
  it("계약 시작일·종료일 컬럼의 NOT NULL을 해제한다", () => {
    expect(sql).toContain("alter column contract_start_on drop not null");
    expect(sql).toContain("alter column contract_end_on drop not null");
  });

  it.each(["private.validate_teacher_base_payload", "private.validate_teacher_profile_payload"])(
    "%s는 계약기간 필수 검사를 없애고 둘 다 있을 때만 순서를 검사한다",
    (name) => {
      const body = sliceFunction(name);

      expect(body).not.toContain("계약 시작일과 종료일은 필수입니다");
      expect(body).toContain("p_contract_start_on is not null");
      expect(body).toContain("p_contract_end_on is not null");
      expect(body).toContain("계약 종료일은 계약 시작일보다 빠를 수 없습니다");
    },
  );
});

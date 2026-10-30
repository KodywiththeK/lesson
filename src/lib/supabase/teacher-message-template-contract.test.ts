import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("선생님 문자 템플릿 DB 경계", () => {
  it("원장만 템플릿을 읽고 변경하며 변경을 감사한다", () => {
    const sql = readFileSync("supabase/migrations/20261030020920_teacher_message_templates.sql", "utf8");
    expect(sql).toContain("create table public.teacher_message_templates");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("'owner'::public.academy_member_role");
    expect(sql).toContain("teacher_message_template.updated");
    expect(sql).toContain("지원하지 않는 변수");
  });
});

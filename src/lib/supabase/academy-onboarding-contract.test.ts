import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readdirSync(path.join(process.cwd(), "supabase/migrations"))
  .filter((name) => name.includes("academy_onboarding") && name.endsWith(".sql"))
  .map((name) => readFileSync(path.join(process.cwd(), "supabase/migrations", name), "utf8"))
  .join("\n")
  .toLowerCase();

describe("학원 가입 DB 계약", () => {
  it("신청과 멤버십을 분리하고 직접 멤버십 쓰기를 닫는다", () => {
    expect(sql).toContain("create table public.academy_join_requests");
    expect(sql).toContain("create table private.academy_join_secrets");
    expect(sql).toContain("revoke insert, update on public.academy_members from authenticated");
    expect(sql).toContain("create function public.review_academy_join_request");
  });

  it("선생님 기록 연결과 휴직 중지를 DB에서 검증한다", () => {
    expect(sql).toContain("create unique index teachers_member_id_unique");
    expect(sql).toContain("create trigger teachers_disable_member_on_leave");
    expect(sql).toContain("create function private.guard_teacher_member_link");
    expect(sql).toContain("before insert or update of member_id on public.teachers");
  });
});

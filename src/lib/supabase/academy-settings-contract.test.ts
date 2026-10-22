import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021090300_academy_settings.sql"),
  "utf8",
).toLocaleLowerCase();

describe("학원 설정과 회차권 환불 규정 (20261021090300)", () => {
  it("학원마다 한 행인 설정 테이블에 환불 규정을 세 값으로 제한하고 기본은 환불 불가다", () => {
    expect(sql).toContain("create table if not exists public.academy_settings");
    expect(sql).toContain("academy_id uuid primary key references public.academies (id) on delete cascade");
    expect(sql).toContain("lesson_ticket_refund_policy text not null default 'none'");
    expect(sql).toContain("in ('none', 'proportional_until_half', 'proportional_always')");
  });

  it("RLS를 켜고 원장만 읽을 수 있으며 브라우저 직접 쓰기 권한은 열지 않는다", () => {
    expect(sql).toContain("alter table public.academy_settings enable row level security");
    expect(sql).toContain("grant select on public.academy_settings to authenticated");
    expect(sql).toContain("for select to authenticated");
    expect(sql).toContain("array['owner'::public.academy_member_role]");
    expect(sql).not.toMatch(/grant (insert|update|delete)[^;]*on public\.academy_settings/);
  });

  it("규정은 원장만 RPC로 바꾸고 감사 기록을 남긴다", () => {
    expect(sql).toContain("create or replace function public.set_lesson_ticket_refund_policy(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("원장만");
    expect(sql).toContain("on conflict (academy_id) do update");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("'academy_settings.lesson_ticket_refund_policy_changed'");
  });

  it("지원하지 않는 규정은 한국어 안내로 거부한다", () => {
    expect(sql).toContain("지원하지 않는 환불 규정입니다.");
  });

  it("실행 권한은 로그인 사용자에게만 열고 서버 안에서 쓸 규정 조회 함수를 둔다", () => {
    expect(sql).toContain("revoke all on function public.set_lesson_ticket_refund_policy(uuid, text) from public, anon");
    expect(sql).toContain("grant execute on function public.set_lesson_ticket_refund_policy(uuid, text) to authenticated");
    expect(sql).toContain("create or replace function private.lesson_ticket_refund_policy(");
    expect(sql).toContain("coalesce(");
    expect(sql).toContain("'none'");
  });
});

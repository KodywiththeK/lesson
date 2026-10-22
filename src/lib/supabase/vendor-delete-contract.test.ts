import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20261021090100_vendor_delete.sql"),
  "utf8",
).toLocaleLowerCase();

describe("거래처 삭제 RPC (20261021090100)", () => {
  it("원장·데스크만 호출하는 security definer RPC로 거래처를 지운다", () => {
    expect(sql).toContain("create or replace function public.delete_vendor(");
    expect(sql).toContain("security definer");
    expect(sql).toContain("array['owner'::public.academy_member_role, 'desk'::public.academy_member_role]");
    expect(sql).toContain("delete from public.vendors");
    expect(sql).toContain("이미 삭제되었거나 찾을 수 없습니다");
  });

  it("삭제를 감사 기록에 남긴다", () => {
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("'vendor.deleted'");
  });

  it("함수 실행 권한만 열고 테이블 직접 삭제 권한은 열지 않는다", () => {
    expect(sql).toContain("revoke all on function public.delete_vendor(uuid, uuid) from public, anon");
    expect(sql).toContain("grant execute on function public.delete_vendor(uuid, uuid) to authenticated");
    expect(sql).not.toContain("grant delete on public.vendors");
  });
});

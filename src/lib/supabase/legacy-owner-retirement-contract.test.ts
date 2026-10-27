import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase/migrations");

describe("기존 원장 비밀번호 폐기 RPC", () => {
  it("카카오 재로그인과 원장 권한을 확인한 뒤 데모 원장 비밀번호 해시만 제거한다", () => {
    const files = readdirSync(migrationsDir).filter((file) => file.endsWith("_retire_legacy_owner_password.sql"));
    expect(files).toHaveLength(1);
    const sql = readFileSync(join(migrationsDir, files[0]), "utf8");

    expect(sql).toContain("public.retire_legacy_owner_password()");
    expect(sql).toContain("11111111-1111-1111-1111-111111111111");
    expect(sql).toContain("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(sql).toMatch(/auth\.uid\(\).*v_owner_id/s);
    expect(sql).toMatch(/provider\s*=\s*'kakao'/);
    expect(sql).toContain("auth.jwt() -> 'amr'");
    expect(sql).toContain('"method":"oauth"');
    expect(sql).toMatch(/role\s*=\s*'owner'/);
    expect(sql).toMatch(/status\s*=\s*'active'/);
    expect(sql).toMatch(/encrypted_password\s*=\s*null/i);
    expect(sql).toMatch(/revoke all on function public\.retire_legacy_owner_password\(\) from public/);
    expect(sql).toMatch(/grant execute on function public\.retire_legacy_owner_password\(\) to authenticated/);
    expect(sql).not.toMatch(/delete\s+from\s+auth\.users/i);
  });
});

import { describe, expect, it } from "vitest";

import { getSupabaseBrowserConfig } from "./env";

describe("getSupabaseBrowserConfig", () => {
  it("브라우저에 노출 가능한 Supabase 설정만 반환한다", () => {
    expect(
      getSupabaseBrowserConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://academy.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
      }),
    ).toEqual({
      url: "https://academy.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("필수 공개 환경변수가 없으면 명확한 오류를 낸다", () => {
    expect(() => getSupabaseBrowserConfig({})).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

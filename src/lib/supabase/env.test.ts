import { afterEach, describe, expect, it } from "vitest";

import { getSupabaseBrowserConfig } from "./env";

describe("getSupabaseBrowserConfig", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
  });

  it("브라우저에 노출 가능한 Supabase 설정만 반환한다", () => {
    expect(
      getSupabaseBrowserConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://academy.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
      }),
    ).toEqual({
      url: "https://academy.supabase.co",
      publishableKey: "publishable-key",
    });
  });

  it("기존 anon key 환경변수도 하위 호환으로 읽는다", () => {
    expect(
      getSupabaseBrowserConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://academy.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon-key",
      }),
    ).toEqual({
      url: "https://academy.supabase.co",
      publishableKey: "legacy-anon-key",
    });
  });

  it("명시적 env 인자가 없으면 Next가 치환하는 공개 process.env 값을 직접 읽는다", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://process-env.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "process-publishable-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(getSupabaseBrowserConfig()).toEqual({
      url: "https://process-env.supabase.co",
      publishableKey: "process-publishable-key",
    });
  });


  it("필수 공개 환경변수가 없으면 명확한 오류를 낸다", () => {
    expect(() => getSupabaseBrowserConfig({})).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
  });
});

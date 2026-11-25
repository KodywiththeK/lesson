import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/proxy", () => ({ updateSession: vi.fn() }));

import nextConfig from "../../next.config";
import { config as proxyConfig } from "../../proxy";

describe("PWA 배포 설정", () => {
  it("서비스 워커 파일은 캐시하지 않고 자바스크립트로 내려보내 새 버전이 바로 반영된다", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toContainEqual({
      source: "/sw.js",
      headers: [
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
      ],
    });
  });

  it("로그인 세션 갱신(proxy)은 서비스 워커·manifest 요청을 건너뛴다", () => {
    const matcher = new RegExp(`^${proxyConfig.matcher[0]}$`);

    expect(matcher.test("/sw.js")).toBe(false);
    expect(matcher.test("/manifest.webmanifest")).toBe(false);
    expect(matcher.test("/lessons/academy")).toBe(true);
  });
});

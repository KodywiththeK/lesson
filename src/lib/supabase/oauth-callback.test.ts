import { describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "@/app/auth/callback/route";

describe("카카오 OAuth callback", () => {
  it("코드를 세션으로 교환한 뒤 내부 경로로만 이동한다", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new Request("https://lesson.example/auth/callback?code=abc&next=%2Fsettings%2Fmembers"));
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://lesson.example/settings/members");
    const external = await GET(new Request("https://lesson.example/auth/callback?code=abc&next=%2F%2Fevil.example"));
    expect(external.headers.get("location")).toBe("https://lesson.example/");
  });

  it("코드가 없거나 교환에 실패하면 오류 화면으로 이동한다", async () => {
    const response = await GET(new Request("https://lesson.example/auth/callback"));
    expect(response.headers.get("location")).toBe("https://lesson.example/auth/error");
  });
});

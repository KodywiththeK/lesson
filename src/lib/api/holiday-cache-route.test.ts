import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { POST } from "../../app/api/holidays/route";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("공식 공휴일 자료 저장", () => {
  it("로그인하지 않은 요청은 서버 전용 저장을 실행하지 않는다", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const response = await POST(new Request("http://localhost/api/holidays?month=2026-10", { method: "POST" }));
    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("검증된 공식 자료만 서버 전용 RPC로 저장한다", async () => {
    vi.stubEnv("KASI_HOLIDAY_API_KEY", "test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret-key");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    mocks.rpc.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: {
      header: { resultCode: "00" }, body: { totalCount: 1, items: { item: { locdate: 20261009, dateName: "한글날", isHoliday: "Y" } } },
    } }) }));
    const response = await POST(new Request("http://localhost/api/holidays?month=2026-10", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("store_verified_korean_holidays", { p_month: "2026-10", p_holidays: [{ date: "2026-10-09", name: "한글날" }] });
  });
  it("불완전한 공식 응답은 검증된 빈 달로 저장하지 않는다", async () => {
    vi.stubEnv("KASI_HOLIDAY_API_KEY", "test-key");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: {
      header: { resultCode: "00" }, body: { totalCount: 2, items: { item: { locdate: 20261009, dateName: "한글날", isHoliday: "Y" } } },
    } }) }));
    const response = await POST(new Request("http://localhost/api/holidays?month=2026-10", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

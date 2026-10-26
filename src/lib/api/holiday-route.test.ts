import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../app/api/holidays/route";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("공휴일 조회 경로", () => {
  it("인증키가 없으면 공휴일 오류를 돌려주고 시간표 데이터에는 영향이 없다", async () => {
    vi.stubEnv("KASI_HOLIDAY_API_KEY", "");
    const response = await GET(new Request("http://localhost/api/holidays?month=2026-10"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "공휴일 자료를 불러오지 못했습니다. 다시 시도해 주세요." });
  });

  it("공식 API 응답을 월별 공휴일 목록으로 반환한다", async () => {
    vi.stubEnv("KASI_HOLIDAY_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: {
      header: { resultCode: "00" }, body: { items: { item: { locdate: 20261009, dateName: "한글날", isHoliday: "Y" } }, totalCount: 1 },
    } }) });
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(new Request("http://localhost/api/holidays?month=2026-10"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ holidays: [{ date: "2026-10-09", name: "한글날" }] });
  });
});

import { describe, expect, it, vi } from "vitest";
import { fetchAcademyHolidayPolicy, saveAcademyHolidayPolicy } from "./academy-holiday-policy";

describe("정기 수업 쉬는 날 설정", () => {
  it("설정이 없으면 공휴일과 학원 휴원일을 모두 적용한다", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) };
    expect(await fetchAcademyHolidayPolicy(client, "a")).toEqual({ excludePublicHolidays: true, excludeAcademyClosures: true });
  });

  it("변경은 학원 범위의 서버 RPC로 저장한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await saveAcademyHolidayPolicy({ rpc }, "a", { excludePublicHolidays: false, excludeAcademyClosures: true });
    expect(rpc).toHaveBeenCalledWith("save_academy_holiday_policy", {
      p_academy_id: "a", p_exclude_public_holidays: false, p_exclude_academy_closures: true,
    });
  });
});

import { describe, expect, it, vi } from "vitest";

import { fetchAcademyClosures, fetchAcademyInstrumentColors, saveAcademyClosure, saveAcademyInstrumentColor } from "./lesson-calendar-settings";

describe("레슨 달력 학원 설정 API", () => {
  it("학원 범위의 악기 색상과 휴원일을 읽는다", async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    await fetchAcademyInstrumentColors({ from }, "academy-1");
    await fetchAcademyClosures({ from }, "academy-1");
    expect(from).toHaveBeenCalledWith("academy_instrument_colors");
    expect(from).toHaveBeenCalledWith("academy_closures");
    expect(eq).toHaveBeenCalledWith("academy_id", "academy-1");
  });

  it("악기 색상은 학원과 악기 조합으로 저장한다", async () => {
    const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    await saveAcademyInstrumentColor({ from: () => ({ upsert, select: vi.fn(), insert: vi.fn(), update: vi.fn() }) }, "academy-1", "piano", "#6653a6");
    expect(upsert).toHaveBeenCalledWith({ academy_id: "academy-1", instrument_id: "piano", color_hex: "#6653a6" },
      { onConflict: "academy_id,instrument_id" });
  });

  it("매주 반복 휴원일에 종료일이 없으면 서버 저장을 요청하지 않는다", async () => {
    const from = vi.fn();
    await expect(saveAcademyClosure({ from }, {
      academyId: "academy-1", title: "월요일 휴원", startsOn: "2026-10-01",
      endsOn: null, weekday: 1,
    })).rejects.toThrow("종료일");
    expect(from).not.toHaveBeenCalled();
  });
});

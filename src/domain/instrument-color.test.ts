import { describe, expect, it } from "vitest";

import { INSTRUMENT_COLOR_PRESETS, getInstrumentColorStyle, getInstrumentColorTone, contrastRatio, resolveInstrumentColorPreset } from "./instrument-color";

describe("악기별 일정 색", () => {
  it("시간표에서 재사용할 배경·글자색을 만든다", () => {
    const style = getInstrumentColorStyle("#246bb2", "scheduled");
    expect(style.backgroundColor).toBe(getInstrumentColorTone("#246bb2", "scheduled").background);
    expect(style.color).toBe(getInstrumentColorTone("#246bb2", "scheduled").foreground);
  });
  it("8개 색상을 모두 연하게 합성하고 같은 계열의 진한 글자로 7:1 대비를 확보한다", () => {
    expect(INSTRUMENT_COLOR_PRESETS).toHaveLength(8);
    for (const preset of INSTRUMENT_COLOR_PRESETS) {
      const pending = getInstrumentColorTone(preset, "scheduled");
      const present = getInstrumentColorTone(preset, "present");
      expect(pending).toEqual(present);
      expect(contrastRatio(pending.background, "#ffffff")).toBeLessThan(1.8);
      expect(contrastRatio(present.background, "#ffffff")).toBeLessThan(1.8);
      expect(contrastRatio(pending.background, pending.foreground)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(present.background, present.foreground)).toBeGreaterThanOrEqual(7);
    }
    expect(getInstrumentColorTone("#246bb2", "scheduled").background).toBe("#cfdeee");
    expect(getInstrumentColorTone("#246bb2", "present").background).toBe("#cfdeee");
    expect(getInstrumentColorTone(INSTRUMENT_COLOR_PRESETS[0], "scheduled").foreground)
      .not.toBe(getInstrumentColorTone(INSTRUMENT_COLOR_PRESETS[1], "scheduled").foreground);
  });

  it("기존 직접 선택 색은 가장 가까운 프리셋으로 해석한다", () => {
    expect(resolveInstrumentColorPreset("#236bb3")).toBe("#246bb2");
    expect(resolveInstrumentColorPreset("#246BB2")).toBe("#246bb2");
  });
});

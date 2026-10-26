import { describe, expect, it } from "vitest";

import { INSTRUMENT_COLOR_PRESETS, getInstrumentColorStyle, getInstrumentColorTone, contrastRatio } from "./instrument-color";

describe("악기별 일정 색", () => {
  it("시간표에서 재사용할 배경·글자색을 만든다", () => {
    const style = getInstrumentColorStyle("#246bb2", "scheduled");
    expect(style.backgroundColor).toBe(getInstrumentColorTone("#246bb2", "scheduled").background);
    expect(style.color).toBe(getInstrumentColorTone("#246bb2", "scheduled").foreground);
  });
  it("기본 색 8개와 사용자 색의 예정·등원 톤을 제공한다", () => {
    expect(INSTRUMENT_COLOR_PRESETS).toHaveLength(8);
    const pending = getInstrumentColorTone("#f2c94c", "scheduled");
    const present = getInstrumentColorTone("#f2c94c", "present");
    expect(pending.background).not.toBe(present.background);
    expect(contrastRatio(pending.background, pending.foreground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(present.background, present.foreground)).toBeGreaterThanOrEqual(4.5);
  });
});

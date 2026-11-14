import { describe, expect, it } from "vitest";

import { INSTRUMENT_COLOR_PRESETS, getInstrumentColorStyle, getInstrumentColorTone, getInstrumentMarkerStyle, contrastRatio, resolveInstrumentColorPreset } from "./instrument-color";

describe("악기별 일정 색", () => {
  it("시간표에서 재사용할 배경·글자색을 만든다", () => {
    const style = getInstrumentColorStyle("#246bb2");
    expect(style.backgroundColor).toBe(getInstrumentColorTone("#246bb2").background);
    expect(style.color).toBe(getInstrumentColorTone("#246bb2").foreground);
  });
  it("8개 색상을 모두 연하게 합성하고 같은 계열의 진한 글자로 7:1 대비를 확보한다", () => {
    expect(INSTRUMENT_COLOR_PRESETS).toHaveLength(8);
    for (const preset of INSTRUMENT_COLOR_PRESETS) {
      const tone = getInstrumentColorTone(preset);
      expect(contrastRatio(tone.background, "#ffffff")).toBeLessThan(1.8);
      expect(contrastRatio(tone.background, tone.foreground)).toBeGreaterThanOrEqual(7);
    }
    expect(getInstrumentColorTone("#246bb2").background).toBe("#cfdeee");
    expect(getInstrumentColorTone(INSTRUMENT_COLOR_PRESETS[0]).foreground)
      .not.toBe(getInstrumentColorTone(INSTRUMENT_COLOR_PRESETS[1]).foreground);
  });

  it("기존 직접 선택 색은 가장 가까운 프리셋으로 해석한다", () => {
    expect(resolveInstrumentColorPreset("#236bb3")).toBe("#246bb2");
    expect(resolveInstrumentColorPreset("#246BB2")).toBe("#246bb2");
  });

  it("일정 칩의 악기 표시는 배경 없이 왼쪽 띠 색만 돌려준다", () => {
    expect(getInstrumentMarkerStyle("#246bb2")).toEqual({ borderLeftColor: "#246bb2" });
    expect(getInstrumentMarkerStyle("#236bb3")).toEqual({ borderLeftColor: "#246bb2" });
    expect(getInstrumentMarkerStyle(undefined)).toEqual({ borderLeftColor: INSTRUMENT_COLOR_PRESETS[0] });
  });
});

export const INSTRUMENT_COLOR_PRESETS = [
  "#6653a6", "#246bb2", "#16817d", "#62852b",
  "#bc7325", "#af4e61", "#9a59a9", "#526b81",
] as const;

/** 기본 색은 악기 ID만으로 정해 역할이나 조회 기간에 따라 달라지지 않는다. */
export function getDefaultInstrumentColor(instrumentId: string) {
  const hash = Array.from(instrumentId).reduce((value, char) => (Math.imul(value, 31) + char.codePointAt(0)!) >>> 0, 0);
  return INSTRUMENT_COLOR_PRESETS[hash % INSTRUMENT_COLOR_PRESETS.length];
}

const WHITE = "#ffffff";
const BLACK = "#000000";
const BACKGROUND_ALPHA = 0.22;
const MINIMUM_TEXT_CONTRAST = 7;

function channels(hex: string) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : INSTRUMENT_COLOR_PRESETS[0];
  return [1, 3, 5].map((start) => Number.parseInt(safe.slice(start, start + 2), 16));
}

function toHex(values: number[]) {
  return `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, target: string, amount: number) {
  const base = channels(hex);
  const other = channels(target);
  return toHex(base.map((value, index) => value * (1 - amount) + other[index] * amount));
}

export function resolveInstrumentColorPreset(color: string | undefined) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return INSTRUMENT_COLOR_PRESETS[0];
  const actual = channels(color);
  let closest: (typeof INSTRUMENT_COLOR_PRESETS)[number] = INSTRUMENT_COLOR_PRESETS[0];
  let smallestDistance = Number.POSITIVE_INFINITY;
  for (const preset of INSTRUMENT_COLOR_PRESETS) {
    const distance = channels(preset).reduce((sum, channel, index) =>
      sum + (channel - actual[index]) ** 2, 0);
    if (distance < smallestDistance) {
      closest = preset;
      smallestDistance = distance;
    }
  }
  return closest;
}

function luminance(hex: string) {
  const linear = channels(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(left: string, right: string) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/** 설정 화면 견본처럼 악기 색을 연한 배경과 진한 글자로 보여 줄 때 쓴다. 일정 상태 색과는 별개다. */
export function getInstrumentColorTone(color: string) {
  const preset = resolveInstrumentColorPreset(color);
  const background = mix(WHITE, preset, BACKGROUND_ALPHA);
  let foreground = mix(preset, BLACK, 0.66);
  for (let step = 0; step < 20 && contrastRatio(background, foreground) < MINIMUM_TEXT_CONTRAST; step += 1) {
    foreground = mix(foreground, BLACK, 0.12);
  }
  return { background, foreground };
}

export function getInstrumentColorStyle(color: string | undefined) {
  const tone = getInstrumentColorTone(color ?? INSTRUMENT_COLOR_PRESETS[0]);
  return { backgroundColor: tone.background, color: tone.foreground };
}

/** 일정 칩은 상태 색을 배경으로 쓰므로 악기 색은 칩 왼쪽 띠로만 보여 준다. */
export function getInstrumentMarkerStyle(color: string | undefined) {
  return { borderLeftColor: resolveInstrumentColorPreset(color) };
}

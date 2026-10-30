export type KoreanHoliday = { date: string; name: string };

/** 한국천문연구원 특일정보의 공휴일 응답을 화면에 필요한 값으로 제한한다. */
export function parseKoreanHolidayResponse(input: unknown): KoreanHoliday[] {
  if (!input || typeof input !== "object" || !("response" in input)) {
    throw new Error("공휴일 자료 형식을 확인할 수 없습니다.");
  }
  const response = input.response as { header?: { resultCode?: string }; body?: { totalCount?: number | string; items?: { item?: unknown } } };
  if (response.header?.resultCode !== "00") {
    throw new Error("공휴일 자료를 불러오지 못했습니다.");
  }
  const raw = response.body?.items?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const totalCount = response.body?.totalCount;
  if (totalCount === undefined || !/^\d+$/.test(String(totalCount)) || Number(totalCount) !== items.length) {
    throw new Error("공휴일 자료를 모두 확인할 수 없습니다.");
  }
  return items.flatMap((item): KoreanHoliday[] => {
    if (!item || typeof item !== "object") throw new Error("공휴일 자료 형식을 확인할 수 없습니다.");
    const value = item as { locdate?: number | string; dateName?: string; isHoliday?: string };
    const digits = String(value.locdate ?? "");
    if (!/^\d{8}$/.test(digits) || !value.dateName?.trim() || !["Y", "N"].includes(value.isHoliday ?? "")) {
      throw new Error("공휴일 자료 형식을 확인할 수 없습니다.");
    }
    const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error("공휴일 자료 형식을 확인할 수 없습니다.");
    }
    if (value.isHoliday !== "Y" || value.dateName === "일요일") return [];
    return [{ date, name: value.dateName.trim() }];
  });
}

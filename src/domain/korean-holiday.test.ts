import { describe, expect, it } from "vitest";

import { parseKoreanHolidayResponse } from "./korean-holiday";

describe("공식 공휴일 응답", () => {
  it("특별 공휴일만 날짜와 이름으로 정리하고 일반 일요일은 제외한다", () => {
    expect(parseKoreanHolidayResponse({ response: { header: { resultCode: "00" }, body: { items: { item: [
      { locdate: 20261009, dateName: "한글날", isHoliday: "Y" },
      { locdate: 20261011, dateName: "일요일", isHoliday: "Y" },
    ] }, totalCount: 2 } } })).toEqual([{ date: "2026-10-09", name: "한글날" }]);
  });

  it("공식 API 오류를 빈 공휴일 목록으로 오인하지 않는다", () => {
    expect(() => parseKoreanHolidayResponse({ response: { header: { resultCode: "30", resultMsg: "BAD KEY" } } }))
      .toThrow("공휴일 자료");
  });

  it("조회 건수와 자료가 맞지 않으면 빈 달로 오인하지 않는다", () => {
    expect(() => parseKoreanHolidayResponse({ response: { header: { resultCode: "00" } } })).toThrow("공휴일 자료");
    expect(() => parseKoreanHolidayResponse({ response: { header: { resultCode: "00" }, body: { totalCount: 2, items: { item: { locdate: 20261009, dateName: "한글날", isHoliday: "Y" } } } } })).toThrow("공휴일 자료");
    expect(parseKoreanHolidayResponse({ response: { header: { resultCode: "00" }, body: { totalCount: 0, items: "" } } })).toEqual([]);
    expect(() => parseKoreanHolidayResponse({ response: { header: { resultCode: "00" }, body: { totalCount: 1, items: { item: { locdate: 20260230, dateName: "잘못된 날짜", isHoliday: "Y" } } } } })).toThrow("공휴일 자료");
  });
});

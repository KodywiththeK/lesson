import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getFinanceCurrentMonth,
  getFinanceToday,
  toFinanceDate,
  toFinanceMonth,
  toMonthDateRange,
} from "./finance-date";

describe("finance-date", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("학원 기준(Asia/Seoul) 오늘과 이번 달을 돌려준다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-31T15:30:00Z"));

    expect(getFinanceToday()).toBe("2026-09-01");
    expect(getFinanceCurrentMonth()).toBe("2026-09");
  });

  it("UTC 시각도 한국 날짜로 바꿔 월을 판정한다", () => {
    expect(toFinanceDate("2026-08-31T15:00:00Z")).toBe("2026-09-01");
    expect(toFinanceDate("2026-08-31T14:59:00Z")).toBe("2026-08-31");
    expect(toFinanceDate("2026-08-31T23:30:00+09:00")).toBe("2026-08-31");
    expect(toFinanceMonth("2026-08-31T15:00:00Z")).toBe("2026-09");
  });

  it("날짜만 있는 값은 그대로 쓴다", () => {
    expect(toFinanceDate("2026-08-31")).toBe("2026-08-31");
    expect(toFinanceMonth("2026-08-31")).toBe("2026-08");
  });

  it("날짜로 읽을 수 없는 값은 오류로 알린다", () => {
    expect(() => toFinanceDate("not-a-date")).toThrow("날짜 형식을 확인해 주세요.");
  });

  it("월의 첫날과 마지막 날을 윤년까지 계산한다", () => {
    expect(toMonthDateRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(toMonthDateRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(toMonthDateRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

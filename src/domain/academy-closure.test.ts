import { describe, expect, it } from "vitest";

import { getClosuresOnDate } from "./academy-closure";

describe("학원 휴원일", () => {
  const closures = [
    { id: "one", title: "내부 행사", startsOn: "2026-10-20", endsOn: "2026-10-20", weekday: null, active: true },
    { id: "range", title: "추석 휴원", startsOn: "2026-10-21", endsOn: "2026-10-23", weekday: null, active: true },
    { id: "weekly", title: "월요일 휴원", startsOn: "2026-10-01", endsOn: "2026-10-31", weekday: 1, active: true },
  ];

  it("하루·기간·매주 반복 휴원을 날짜별로 찾는다", () => {
    expect(getClosuresOnDate(closures, "2026-10-20").map((item) => item.title)).toEqual(["내부 행사"]);
    expect(getClosuresOnDate(closures, "2026-10-22").map((item) => item.title)).toEqual(["추석 휴원"]);
    expect(getClosuresOnDate(closures, "2026-10-26").map((item) => item.title)).toEqual(["월요일 휴원"]);
    expect(getClosuresOnDate(closures, "2026-11-02")).toEqual([]);
  });
});

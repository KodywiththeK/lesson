import { describe, expect, it } from "vitest";

import {
  MAKEUP_RECOMMENDATION_LIMIT,
  findMakeupWindowMonths,
  findRegularWeekdays,
  formatMakeupDateLabel,
  recommendMakeupDates,
} from "./academy-makeup-recommendation";

const WEDNESDAY = 3;
const FRIDAY = 5;

describe("recommendMakeupDates", () => {
  it("결석일 다음 날부터 14일 이내 월~금 중 정규 등원 요일이 아닌 날만 후보로 삼는다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-08-12",
      regularWeekdays: [WEDNESDAY, FRIDAY],
      attendeeCountByDate: {},
    });

    // 8/12(수) 결석: 13(목) 17(월) 18(화) 20(목) 24(월) 25(화) 후보. 14·21(금), 19·26(수), 주말은 제외.
    expect(result.map((item) => item.date)).toEqual([
      "2026-08-13",
      "2026-08-17",
      "2026-08-18",
      "2026-08-20",
      "2026-08-24",
    ]);
    expect(result).toHaveLength(MAKEUP_RECOMMENDATION_LIMIT);
  });

  it("결석일 당일과 15일째 이후는 후보가 아니다", () => {
    // 결석일 8/12(수)로부터 14일째는 8/26(수), 15일째는 8/27(목)이다.
    expect(
      recommendMakeupDates({
        absentDate: "2026-08-12",
        regularWeekdays: [1, 2, 4, 5],
        attendeeCountByDate: {},
      }).map((item) => item.date),
    ).toEqual(["2026-08-19", "2026-08-26"]);
    expect(
      recommendMakeupDates({
        absentDate: "2026-08-12",
        regularWeekdays: [1, 2, 3, 5],
        attendeeCountByDate: {},
      }).map((item) => item.date),
    ).toEqual(["2026-08-13", "2026-08-20"]);
  });

  it("그날 등원 인원이 적은 날을 먼저 추천한다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-08-12",
      regularWeekdays: [WEDNESDAY],
      attendeeCountByDate: {
        "2026-08-13": 6,
        "2026-08-14": 1,
        "2026-08-17": 3,
        "2026-08-18": 0,
        "2026-08-20": 2,
        "2026-08-21": 4,
        "2026-08-24": 5,
        "2026-08-25": 7,
      },
    });

    expect(result.map((item) => [item.date, item.attendeeCount])).toEqual([
      ["2026-08-18", 0],
      ["2026-08-14", 1],
      ["2026-08-20", 2],
      ["2026-08-17", 3],
      ["2026-08-21", 4],
    ]);
  });

  it("인원이 같으면 결석일에 가까운 날을 먼저 추천하고 집계에 없는 날은 0명으로 본다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-08-12",
      regularWeekdays: [WEDNESDAY],
      attendeeCountByDate: {
        "2026-08-13": 2,
        "2026-08-14": 2,
        "2026-08-17": 2,
        "2026-08-24": 2,
        "2026-08-25": 2,
      },
    });

    expect(result.slice(0, 3).map((item) => item.date)).toEqual([
      "2026-08-18",
      "2026-08-20",
      "2026-08-21",
    ]);
    expect(result.slice(0, 3).map((item) => item.attendeeCount)).toEqual([0, 0, 0]);
    expect(result.slice(3).map((item) => item.date)).toEqual([
      "2026-08-13",
      "2026-08-14",
    ]);
  });

  it("후보가 5개보다 적으면 있는 만큼만 돌려준다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-08-12",
      regularWeekdays: [1, 2, 3, 4],
      attendeeCountByDate: {},
    });

    expect(result.map((item) => item.date)).toEqual(["2026-08-14", "2026-08-21"]);
  });

  it("후보가 하나도 없으면 빈 목록을 돌려준다", () => {
    expect(
      recommendMakeupDates({
        absentDate: "2026-08-12",
        regularWeekdays: [1, 2, 3, 4, 5],
        attendeeCountByDate: {},
      }),
    ).toEqual([]);
  });

  it("다음 달로 넘어가는 날짜도 후보에 포함하고 날짜·요일·인원을 표시 문구로 만든다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-08-28",
      regularWeekdays: [FRIDAY],
      attendeeCountByDate: { "2026-08-31": 4, "2026-09-01": 1 },
    });

    expect(result[0]).toEqual({
      date: "2026-09-02",
      weekdayLabel: "수",
      attendeeCount: 0,
      label: "9/2 (수) · 0명",
    });
    expect(result.map((item) => item.label)).toEqual([
      "9/2 (수) · 0명",
      "9/3 (목) · 0명",
      "9/7 (월) · 0명",
      "9/8 (화) · 0명",
      "9/9 (수) · 0명",
    ]);
  });

  it("연말을 넘겨도 날짜를 올바르게 계산한다", () => {
    const result = recommendMakeupDates({
      absentDate: "2026-12-30",
      regularWeekdays: [],
      attendeeCountByDate: {},
    });

    expect(result[0]?.date).toBe("2026-12-31");
    expect(result.map((item) => item.date)).toContain("2027-01-04");
  });
});

describe("findRegularWeekdays", () => {
  const rows = [
    { studentId: "student-1", date: "2026-08-12", origin: "regular" as const },
    { studentId: "student-1", date: "2026-08-14", origin: "regular" as const },
    { studentId: "student-1", date: "2026-08-17", origin: "makeup" as const },
    { studentId: "student-1", date: "2026-08-18", origin: "manual" as const },
    { studentId: "student-1", date: "2026-08-19", origin: "rescheduled" as const },
    { studentId: "student-2", date: "2026-08-13", origin: "regular" as const },
    { studentId: "student-1", date: "2026-08-20" },
  ];

  it("그 원생의 정규 일정에서 등원 요일을 모은다", () => {
    expect(findRegularWeekdays(rows, "student-1")).toEqual([3, 4, 5]);
  });

  it("정규 일정이 없는 원생은 빈 목록이다", () => {
    expect(findRegularWeekdays(rows, "student-9")).toEqual([]);
  });
});

describe("formatMakeupDateLabel", () => {
  it("날짜를 월/일 (요일) 형식으로 보여 준다", () => {
    expect(formatMakeupDateLabel("2026-08-25")).toBe("8/25 (화)");
    expect(formatMakeupDateLabel("2026-12-31")).toBe("12/31 (목)");
  });
});

describe("findMakeupWindowMonths", () => {
  it("결석일 뒤 14일이 같은 달 안이면 그 달만 돌려준다", () => {
    expect(findMakeupWindowMonths("2026-08-10")).toEqual(["2026-08"]);
    expect(findMakeupWindowMonths("2026-08-17")).toEqual(["2026-08"]);
  });

  it("결석일 뒤 14일이 다음 달로 넘어가면 다음 달도 함께 돌려준다", () => {
    expect(findMakeupWindowMonths("2026-08-18")).toEqual(["2026-08", "2026-09"]);
    expect(findMakeupWindowMonths("2026-12-30")).toEqual(["2026-12", "2027-01"]);
  });
});

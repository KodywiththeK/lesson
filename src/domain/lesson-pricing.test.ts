import { describe, expect, it } from "vitest";

import {
  calculateLessonFee,
  calculateStudentFee,
  getPrivateLessonSessionsForWeekdays,
  getProgressOptions,
  PRIVATE_LESSON_MINUTE_OPTIONS,
  PRIVATE_LESSON_SESSION_OPTIONS,
  STUDENT_DISCOUNT_AMOUNT,
} from "./lesson-pricing";

describe("getProgressOptions", () => {
  it("피아노 학원 레슨은 진도 5단계를 가격표 순서대로 준다", () => {
    expect(getProgressOptions("피아노", "academy")).toEqual([
      "바이엘",
      "체르니100",
      "체르니30",
      "체르니40",
      "작품반",
    ]);
  });

  it("피아노 개인 레슨은 단일 진도만 준다", () => {
    expect(getProgressOptions("피아노", "private")).toEqual(["피아노 개인 레슨"]);
  });

  it("바이올린과 첼로는 같은 스즈키 진도를, 플루트는 초급·중급·고급을 준다", () => {
    const suzuki = ["스즈키 1~3권", "스즈키 4~6권", "스즈키 7~10권"];

    expect(getProgressOptions("바이올린", "private")).toEqual(suzuki);
    expect(getProgressOptions("첼로", "private")).toEqual(suzuki);
    expect(getProgressOptions("플루트", "private")).toEqual(["초급", "중급", "고급"]);
  });

  it("가격표가 없는 악기는 빈 목록을 준다", () => {
    expect(getProgressOptions("드럼", "private")).toEqual([]);
  });

  it("개인 레슨 선택지는 월 4·8회와 30·40·60분이다", () => {
    expect(PRIVATE_LESSON_SESSION_OPTIONS).toEqual([4, 8]);
    expect(PRIVATE_LESSON_MINUTE_OPTIONS).toEqual([30, 40, 60]);
  });
});

describe("calculateLessonFee 피아노 학원 레슨", () => {
  const academy = (progress: string, weekdayCount: number) =>
    calculateLessonFee({ instrumentName: "피아노", lessonType: "academy", progress, weekdayCount });

  it.each([
    ["바이엘", 2, 140000],
    ["바이엘", 3, 150000],
    ["바이엘", 4, 160000],
    ["바이엘", 5, 160000],
    // 명세 그대로 주2회와 주3회가 같은 금액이다(확인 필요).
    ["체르니100", 2, 150000],
    ["체르니100", 3, 160000],
    ["체르니100", 4, 170000],
    ["체르니30", 2, 160000],
    ["체르니30", 3, 170000],
    ["체르니30", 5, 180000],
    ["체르니40", 2, 170000],
    ["체르니40", 3, 180000],
    ["체르니40", 4, 190000],
    ["작품반", 2, 180000],
    ["작품반", 3, 190000],
    ["작품반", 5, 200000],
  ])("%s %i개 요일은 %i원이다", (progress, weekdayCount, fee) => {
    expect(academy(progress, weekdayCount)).toEqual({ status: "priced", fee });
  });

  it("요일이 하나도 없으면 요일 선택을 기다리는 직접 입력 상태다", () => {
    expect(academy("바이엘", 0)).toEqual({ status: "manual", reason: "no-weekdays" });
  });

  it.each([1, 6, 7])("요일이 %i개면 가격표 구간이 없어 직접 입력해야 한다", (weekdayCount) => {
    expect(academy("바이엘", weekdayCount)).toEqual({
      status: "manual",
      reason: "no-weekday-tier",
    });
  });

  it("가격표에 없는 진도는 직접 입력해야 한다", () => {
    expect(academy("체르니 100", 2)).toEqual({ status: "manual", reason: "unknown-progress" });
  });

  it("개인레슨 주 1일은 월 4회, 주 2일은 월 8회로 계산한다", () => {
    expect(getPrivateLessonSessionsForWeekdays(1)).toEqual({ kind: "automatic", sessions: 4 });
    expect(getPrivateLessonSessionsForWeekdays(2)).toEqual({ kind: "automatic", sessions: 8 });
    expect(getPrivateLessonSessionsForWeekdays(3)).toEqual({ kind: "manual" });
  });
});

describe("calculateLessonFee 개인 레슨", () => {
  const priced = (
    instrumentName: string,
    progress: string,
    sessionsPerMonth: 4 | 8,
    minutes: 40 | 60,
  ) =>
    calculateLessonFee({
      instrumentName,
      lessonType: "private",
      progress,
      weekdayCount: 0,
      sessionsPerMonth,
      minutes,
    });

  it.each([
    [4, 40, 140000],
    [4, 60, 210000],
    [8, 40, 280000],
    [8, 60, 420000],
  ] as const)("피아노 개인 레슨 월 %i회 %i분은 %i원이다", (sessions, minutes, fee) => {
    expect(priced("피아노", "피아노 개인 레슨", sessions, minutes)).toEqual({
      status: "priced",
      fee,
    });
  });

  it.each([
    ["스즈키 1~3권", 140000, 210000, 280000, 420000],
    ["스즈키 4~6권", 150000, 220000, 300000, 440000],
    ["스즈키 7~10권", 160000, 230000, 320000, 460000],
  ])("바이올린·첼로 %s의 네 가지 조합 금액이 맞다", (progress, a, b, c, d) => {
    for (const instrument of ["바이올린", "첼로"]) {
      expect([
        priced(instrument, progress, 4, 40),
        priced(instrument, progress, 4, 60),
        priced(instrument, progress, 8, 40),
        priced(instrument, progress, 8, 60),
      ]).toEqual([a, b, c, d].map((fee) => ({ status: "priced", fee })));
    }
  });

  it.each([
    ["초급", 140000, 210000, 280000, 420000],
    ["중급", 150000, 220000, 300000, 440000],
    ["고급", 160000, 230000, 320000, 460000],
  ])("플루트 %s의 네 가지 조합 금액이 맞다", (progress, a, b, c, d) => {
    expect([
      priced("플루트", progress, 4, 40),
      priced("플루트", progress, 4, 60),
      priced("플루트", progress, 8, 40),
      priced("플루트", progress, 8, 60),
    ]).toEqual([a, b, c, d].map((fee) => ({ status: "priced", fee })));
  });

  it("개인 레슨은 요일 개수와 상관없이 같은 금액이다", () => {
    const base = {
      instrumentName: "바이올린",
      lessonType: "private" as const,
      progress: "스즈키 4~6권",
      sessionsPerMonth: 8 as const,
      minutes: 60 as const,
    };

    expect(calculateLessonFee({ ...base, weekdayCount: 0 })).toEqual(
      calculateLessonFee({ ...base, weekdayCount: 3 }),
    );
  });

  it("월 횟수나 수업 시간을 고르지 않았으면 직접 입력 상태다", () => {
    expect(
      calculateLessonFee({
        instrumentName: "플루트",
        lessonType: "private",
        progress: "초급",
        weekdayCount: 0,
      }),
    ).toEqual({ status: "manual", reason: "missing-private-option" });
  });

  it.each([30, 45, 240])("%i분 수업에는 40분 가격을 대입하지 않는다", (minutes) => {
    expect(calculateLessonFee({
      instrumentName: "피아노", lessonType: "private", progress: "피아노 개인 레슨",
      weekdayCount: 1, sessionsPerMonth: 4, minutes,
    })).toEqual({ status: "manual", reason: "no-private-minute-tier" });
  });

  it("가격표가 없는 악기는 직접 입력해야 한다", () => {
    expect(
      calculateLessonFee({
        instrumentName: "드럼",
        lessonType: "private",
        progress: "초급",
        weekdayCount: 0,
        sessionsPerMonth: 4,
        minutes: 40,
      }),
    ).toEqual({ status: "manual", reason: "no-price-table" });
  });

  it("가격표에 없는 진도는 직접 입력해야 한다", () => {
    expect(priced("바이올린", "스즈키 1권", 4, 40)).toEqual({
      status: "manual",
      reason: "unknown-progress",
    });
  });
});

describe("calculateStudentFee", () => {
  it("할인이 없으면 레슨비가 그대로 최종 수강료다", () => {
    expect(calculateStudentFee({ lessonFee: 150000, discountKinds: [] })).toEqual({
      monthlyDiscountTotal: 0,
      referralDiscountAmount: 0,
      finalMonthlyFee: 150000,
      discountLabel: undefined,
    });
  });

  it("두 자녀·두 악기 할인은 매달 1만원씩 합쳐서 빼고 지인 소개 할인은 매달 합계에 넣지 않는다", () => {
    const result = calculateStudentFee({
      lessonFee: 150000,
      discountKinds: ["sibling", "multi_instrument", "referral"],
    });

    expect(STUDENT_DISCOUNT_AMOUNT).toBe(10000);
    expect(result).toEqual({
      monthlyDiscountTotal: 20000,
      referralDiscountAmount: 10000,
      finalMonthlyFee: 130000,
      discountLabel: "두 자녀 할인, 두 악기 할인, 지인 소개 할인",
    });
  });

  it("지인 소개 할인만 선택하면 매달 수강료는 그대로이고 소개한 달 금액만 따로 남긴다", () => {
    expect(calculateStudentFee({ lessonFee: 150000, discountKinds: ["referral"] })).toMatchObject({
      monthlyDiscountTotal: 0,
      referralDiscountAmount: 10000,
      finalMonthlyFee: 150000,
      discountLabel: "지인 소개 할인",
    });
  });

  it("기존 임의 할인액은 매달 할인에 더하고 라벨을 붙인다", () => {
    expect(
      calculateStudentFee({
        lessonFee: 150000,
        discountKinds: ["sibling"],
        otherDiscount: { amount: 5000, label: "기존 할인" },
      }),
    ).toMatchObject({
      monthlyDiscountTotal: 15000,
      finalMonthlyFee: 135000,
      discountLabel: "두 자녀 할인, 기존 할인",
    });
  });

  it("할인이 레슨비보다 커도 최종 수강료는 0원 아래로 내려가지 않는다", () => {
    expect(
      calculateStudentFee({ lessonFee: 5000, discountKinds: ["sibling"] }).finalMonthlyFee,
    ).toBe(0);
  });
});

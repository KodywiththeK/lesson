import { describe, expect, it } from "vitest";

import type { StudentListInstrument } from "./student-list";

import {
  changeLessonFeeLessonType,
  createLessonFeeDraft,
  createLessonFeeDraftFromInstrument,
  describeManualLessonFee,
  getLessonFeeSubmission,
  repriceLessonFee,
  resetLessonFeeToPriceTable,
  setLessonFeeManually,
  updateLessonFeeWeekdayCount,
} from "./lesson-fee-draft";

const pianoAcademy = (weekdayCount: number) => ({
  instrumentName: "피아노",
  lessonType: "academy" as const,
  weekdayCount,
});

describe("createLessonFeeDraft", () => {
  it("진도는 목록 첫 항목으로 시작하고 요일이 없으면 레슨비는 0원이다", () => {
    expect(createLessonFeeDraft(pianoAcademy(0))).toMatchObject({
      progress: "바이엘",
      lessonFee: 0,
      feeSource: "auto",
      discountKinds: [],
    });
  });

  it("개인 레슨 계열은 월 4회 40분 가격표 금액으로 바로 시작한다", () => {
    expect(
      createLessonFeeDraft({ instrumentName: "바이올린", lessonType: "private", weekdayCount: 0 }),
    ).toMatchObject({ progress: "스즈키 1~3권", sessionsPerMonth: 4, minutes: 40, lessonFee: 140000 });
  });
});

describe("repriceLessonFee", () => {
  it("요일 개수가 바뀌면 구간 가격으로 다시 계산한다", () => {
    const draft = createLessonFeeDraft(pianoAcademy(2));

    expect(draft.lessonFee).toBe(140000);
    expect(repriceLessonFee(draft, pianoAcademy(3))).toMatchObject({ lessonFee: 150000, feeSource: "auto" });
    expect(repriceLessonFee(draft, pianoAcademy(5)).lessonFee).toBe(160000);
  });

  it("직전 자동 금액이 있던 상태에서 가격표 구간이 없어지면 잘못된 금액이 남지 않게 0원으로 비운다", () => {
    const draft = createLessonFeeDraft(pianoAcademy(2));

    expect(repriceLessonFee(draft, pianoAcademy(1))).toMatchObject({ lessonFee: 0, feeSource: "auto" });
    expect(repriceLessonFee(draft, pianoAcademy(6)).lessonFee).toBe(0);
  });

  it("직접 입력한 금액은 구간이 없는 동안 요일을 바꿔도 유지한다", () => {
    const manual = setLessonFeeManually(createLessonFeeDraft(pianoAcademy(1)), 135000);

    expect(manual).toMatchObject({ lessonFee: 135000, feeSource: "manual" });
    expect(repriceLessonFee(manual, pianoAcademy(6))).toMatchObject({ lessonFee: 135000, feeSource: "manual" });
  });

  it("직접 입력한 뒤 가격표 구간이 다시 생겨도 직접 입력한 금액을 유지한다", () => {
    const manual = setLessonFeeManually(createLessonFeeDraft(pianoAcademy(1)), 135000);

    expect(repriceLessonFee(manual, pianoAcademy(2))).toMatchObject({ lessonFee: 135000, feeSource: "manual" });
  });

  it("가격표로 재계산을 명시하면 직접 입력한 금액을 현재 가격표로 바꾼다", () => {
    const manual = setLessonFeeManually(createLessonFeeDraft(pianoAcademy(2)), 135000);

    expect(resetLessonFeeToPriceTable(manual, pianoAcademy(3))).toMatchObject({
      lessonFee: 150000,
      feeSource: "auto",
    });
  });
});

describe("changeLessonFeeLessonType", () => {
  it("요일 선택 전 개인레슨으로 바꾸면 월 4회·40분 기본 가격표로 초기화한다", () => {
    const draft = setLessonFeeManually(createLessonFeeDraft(pianoAcademy(0)), 175000);

    expect(
      changeLessonFeeLessonType(draft, {
        instrumentName: "피아노",
        lessonType: "private",
        weekdayCount: 0,
      }),
    ).toMatchObject({
      progress: "피아노 개인 레슨",
      sessionsPerMonth: 4,
      minutes: 40,
      lessonFee: 140000,
      feeSource: "auto",
    });
  });

  it("수업 형태를 바꾸면 그 형태의 첫 진도와 가격표로 다시 계산한다", () => {
    const draft = setLessonFeeManually(createLessonFeeDraft(pianoAcademy(2)), 175000);

    expect(
      changeLessonFeeLessonType(draft, { instrumentName: "피아노", lessonType: "private", weekdayCount: 2 }),
    ).toMatchObject({
      progress: "피아노 개인 레슨",
      sessionsPerMonth: 8,
      minutes: 40,
      lessonFee: 280000,
      feeSource: "auto",
    });
  });

  it("가격 설정이 없는 이전 학원레슨도 개인레슨으로 바꾸면 40분 기본값과 요일별 월 횟수를 적용한다", () => {
    const legacyAcademy = createLessonFeeDraftFromInstrument({
      studentInstrumentId: "si-legacy",
      teacherId: "teacher-1",
      teacherName: "박선생",
      instrumentId: "piano",
      instrumentName: "피아노",
      lessonType: "academy",
      weekdayLabels: ["월"],
      startTime: "15:00",
      endTime: "15:50",
      progress: "바이엘",
      lessonFee: 140000,
      discountTotal: 0,
      finalMonthlyFee: 140000,
      active: true,
    });

    expect(
      changeLessonFeeLessonType(legacyAcademy, {
        instrumentName: "피아노",
        lessonType: "private",
        weekdayCount: 1,
      }),
    ).toMatchObject({ sessionsPerMonth: 4, minutes: 40, lessonFee: 140000, feeSource: "auto" });
  });
});

describe("updateLessonFeeWeekdayCount", () => {
  it("개인레슨 요일 1·2개는 월 4·8회로 바꾸고 3개부터 직접 입력을 기다린다", () => {
    const draft = createLessonFeeDraft({ instrumentName: "피아노", lessonType: "private", weekdayCount: 1 });
    const twoDays = updateLessonFeeWeekdayCount(
      draft,
      { instrumentName: "피아노", lessonType: "private", weekdayCount: 2 },
      1,
    );
    const threeDays = updateLessonFeeWeekdayCount(
      twoDays,
      { instrumentName: "피아노", lessonType: "private", weekdayCount: 3 },
      2,
    );

    expect(twoDays).toMatchObject({ sessionsPerMonth: 8, lessonFee: 280000 });
    expect(threeDays).toMatchObject({ sessionsPerMonth: 0, lessonFee: 0 });
  });
});

describe("createLessonFeeDraftFromInstrument", () => {
  const stored: StudentListInstrument = {
    studentInstrumentId: "si-1",
    teacherId: "teacher-1",
    teacherName: "박선생",
    instrumentId: "piano",
    instrumentName: "피아노",
    lessonType: "academy",
    weekdayLabels: ["월", "수"],
    startTime: "15:00",
    endTime: "15:50",
    progress: "체르니 100",
    lessonFee: 150000,
    discountTotal: 10000,
    finalMonthlyFee: 140000,
    active: true,
  };

  it("저장된 진도·레슨비를 그대로 보여 주고 가격표로 덮어쓰지 않는다", () => {
    expect(createLessonFeeDraftFromInstrument(stored)).toMatchObject({
      progress: "체르니 100",
      lessonFee: 150000,
      feeSource: "manual",
    });
  });

  it("이전 개인레슨에 월 횟수와 수업 길이가 없으면 임의 기본값으로 채우지 않는다", () => {
    expect(
      createLessonFeeDraftFromInstrument({ ...stored, lessonType: "private" }),
    ).toMatchObject({ sessionsPerMonth: 0, minutes: 0, feeSource: "manual" });
  });

  it("할인 종류 없이 저장된 이전 할인액은 기존 할인으로 남기고 라벨을 유지한다", () => {
    expect(
      createLessonFeeDraftFromInstrument({ ...stored, discountLabel: "직접입력" }).otherDiscount,
    ).toEqual({ amount: 10000, label: "직접입력" });
    expect(createLessonFeeDraftFromInstrument(stored).otherDiscount).toEqual({
      amount: 10000,
      label: "기존 할인",
    });
  });

  it("저장된 할인 종류 합계를 뺀 나머지만 기존 할인으로 본다", () => {
    const draft = createLessonFeeDraftFromInstrument({
      ...stored,
      discountKinds: ["sibling", "referral"],
      referralDiscountMonth: "2026-10",
      referralDiscountAmount: 10000,
      discountTotal: 10000,
    });

    expect(draft).toMatchObject({
      discountKinds: ["sibling", "referral"],
      referralMonth: "2026-10",
      otherDiscount: { amount: 0 },
    });
  });
});

describe("getLessonFeeSubmission", () => {
  it("매달 할인과 소개 할인을 나누고 소개 달은 입력이 없으면 기준 월을 쓴다", () => {
    const draft = {
      ...createLessonFeeDraft(pianoAcademy(2)),
      discountKinds: ["sibling", "referral"] as const,
    };

    expect(getLessonFeeSubmission({ ...draft, discountKinds: [...draft.discountKinds] }, "2026-10")).toEqual({
      lessonFee: 140000,
      discountTotal: 10000,
      discountLabel: "두 자녀 할인, 지인 소개 할인",
      finalMonthlyFee: 130000,
      discountKinds: ["sibling", "referral"],
      referralDiscountMonth: "2026-10",
      referralDiscountAmount: 10000,
    });
  });

  it("지인 소개 할인을 고르지 않았으면 소개 달과 소개 할인액을 보내지 않는다", () => {
    const submission = getLessonFeeSubmission(
      { ...createLessonFeeDraft(pianoAcademy(2)), discountKinds: ["sibling"], referralMonth: "2026-09" },
      "2026-10",
    );

    expect(submission.referralDiscountMonth).toBeUndefined();
    expect(submission.referralDiscountAmount).toBe(0);
  });

  it("직접 고른 소개 달이 있으면 기준 월보다 우선한다", () => {
    expect(
      getLessonFeeSubmission(
        { ...createLessonFeeDraft(pianoAcademy(2)), discountKinds: ["referral"], referralMonth: "2026-11" },
        "2026-10",
      ).referralDiscountMonth,
    ).toBe("2026-11");
  });
});

describe("describeManualLessonFee", () => {
  it("직접 입력이 필요한 이유를 사용자 문구로 알려 준다", () => {
    expect(describeManualLessonFee("no-weekday-tier")).toBe(
      "요일 개수에 맞는 가격표가 없어 레슨비를 직접 입력해 주세요.",
    );
    expect(describeManualLessonFee("no-weekdays")).toBe("수강 요일을 선택하면 레슨비가 자동으로 계산됩니다.");
    expect(describeManualLessonFee("unknown-progress")).toContain("진도");
    expect(describeManualLessonFee("no-price-table")).toContain("가격표가 없어");
    expect(describeManualLessonFee("missing-private-option")).toContain("월 횟수");
  });
});

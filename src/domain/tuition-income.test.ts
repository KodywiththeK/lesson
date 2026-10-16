import { describe, expect, it } from "vitest";

import {
  createMonthlyTuitionSnapshot,
  formatTuitionStatus,
  getTuitionActions,
  selectOverdueTuitions,
  summarizeTuitionStatus,
  type TuitionRecord,
} from "./tuition-income";

describe("createMonthlyTuitionSnapshot", () => {
  it("고정 수입 source로 월별 미납 snapshot을 만든다", () => {
    const snapshot = createMonthlyTuitionSnapshot(
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          enrollmentId: "student-1:piano",
          instrumentId: "piano",
          instrumentName: "피아노",
        monthlyAmount: 150000,
        registeredOn: "2026-08-06",
        lessonFee: 160000,
        discountTotal: 10000,
        discountLabel: "형제 할인",
        progress: "체르니 100",
        effectiveFrom: "2026-08",
        active: true,
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(snapshot).toEqual([
      {
        academyId: "academy-1",
        tuitionId: "2026-08:student-1:piano",
        month: "2026-08",
        studentId: "student-1",
        studentName: "김민지",
        enrollmentId: "student-1:piano",
        instrumentId: "piano",
        instrumentName: "피아노",
        progress: "체르니 100",
        lessonFee: 160000,
        discountTotal: 10000,
        discountLabel: "형제 할인",
        amount: 150000,
        dueOn: "2026-08-06",
        status: "unpaid",
      },
    ]);
  });

  it("다른 학원, 비활성 source, 미래 시작 source는 snapshot에서 제외한다", () => {
    const snapshot = createMonthlyTuitionSnapshot(
      [
        {
          academyId: "academy-2",
          studentId: "student-1",
          studentName: "김민지",
          enrollmentId: "student-1:piano",
          instrumentId: "piano",
          instrumentName: "피아노",
          monthlyAmount: 150000,
          registeredOn: "2026-08-06",
          lessonFee: 150000,
          discountTotal: 0,
          progress: "바이엘",
          effectiveFrom: "2026-08",
          active: true,
        },
        {
          academyId: "academy-1",
          studentId: "student-2",
          studentName: "이서윤",
          enrollmentId: "student-2:piano",
          instrumentId: "piano",
          instrumentName: "피아노",
          monthlyAmount: 150000,
          registeredOn: "2026-08-06",
          lessonFee: 150000,
          discountTotal: 0,
          progress: "바이엘",
          effectiveFrom: "2026-08",
          active: false,
        },
        {
          academyId: "academy-1",
          studentId: "student-3",
          studentName: "박하준",
          enrollmentId: "student-3:piano",
          instrumentId: "piano",
          instrumentName: "피아노",
          monthlyAmount: 150000,
          registeredOn: "2026-09-06",
          lessonFee: 150000,
          discountTotal: 0,
          progress: "바이엘",
          effectiveFrom: "2026-09",
          active: true,
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(snapshot).toEqual([]);
  });

  it("31일 등록 원생의 2월 수강료 납부 발생일은 다음달 1일로 계산한다", () => {
    const snapshot = createMonthlyTuitionSnapshot(
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          enrollmentId: "student-1:piano",
          instrumentId: "piano",
          instrumentName: "피아노",
          monthlyAmount: 150000,
          registeredOn: "2026-01-31",
          lessonFee: 150000,
          discountTotal: 0,
          progress: "바이엘",
          effectiveFrom: "2026-01",
          active: true,
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-02",
      },
    );

    expect(snapshot[0].dueOn).toBe("2026-03-01");
  });
});

function tuition(overrides: Partial<TuitionRecord>): TuitionRecord {
  return {
    academyId: "academy-1",
    tuitionId: "2026-08:student-1:piano",
    month: "2026-08",
    studentId: "student-1",
    studentName: "김민지",
    enrollmentId: "student-1:piano",
    instrumentId: "piano",
    instrumentName: "피아노",
    progress: "바이엘 2",
    lessonFee: 150000,
    discountTotal: 0,
    amount: 150000,
    dueOn: "2026-08-06",
    status: "unpaid",
    ...overrides,
  };
}

describe("입금 상태 3상태", () => {
  it("상태 이름은 미입금·입금 완료·미납이다", () => {
    expect(formatTuitionStatus("unpaid")).toBe("미입금");
    expect(formatTuitionStatus("paid")).toBe("입금 완료");
    expect(formatTuitionStatus("overdue")).toBe("미납");
  });

  it("미납 인원은 미납을 누른 원생만이다(미입금은 아직 처리 전이라 포함하지 않는다)", () => {
    const records = [
      tuition({ tuitionId: "a", status: "unpaid" }),
      tuition({ tuitionId: "b", status: "overdue" }),
      tuition({ tuitionId: "c", status: "paid" }),
    ];

    expect(selectOverdueTuitions(records).map((record) => record.tuitionId)).toEqual(["b"]);
  });

  it("미입금은 입금·미납, 미납은 입금·미납 해제, 입금 완료는 입금 취소만 할 수 있다", () => {
    expect(getTuitionActions(tuition({ status: "unpaid" }))).toEqual([
      { action: "pay" },
      { action: "overdue" },
    ]);
    expect(getTuitionActions(tuition({ status: "overdue" }))).toEqual([
      { action: "pay" },
      { action: "clear-overdue" },
    ]);
    expect(getTuitionActions(tuition({ status: "paid" }))).toEqual([{ action: "cancel-payment" }]);
  });

  it("0원 수강료는 입금 처리할 수 없고 이유를 알려 준다", () => {
    expect(getTuitionActions(tuition({ amount: 0, status: "unpaid" }))).toEqual([
      { action: "pay", disabledReason: "결제 금액이 0원이어서 입금 처리할 수 없습니다." },
      { action: "overdue" },
    ]);
  });

  it("상태별 인원과 금액, 전체 합계를 센다", () => {
    const summary = summarizeTuitionStatus([
      tuition({ tuitionId: "a", status: "unpaid", amount: 100000 }),
      tuition({ tuitionId: "b", status: "overdue", amount: 150000 }),
      tuition({ tuitionId: "c", status: "paid", amount: 200000 }),
      tuition({ tuitionId: "d", status: "paid", amount: 50000 }),
    ]);

    expect(summary).toEqual({
      total: { count: 4, amount: 500000 },
      paid: { count: 2, amount: 250000 },
      unpaid: { count: 1, amount: 100000 },
      overdue: { count: 1, amount: 150000 },
    });
  });
});

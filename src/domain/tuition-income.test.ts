import { describe, expect, it } from "vitest";

import {
  createMonthlyTuitionSnapshot,
  markTuitionAsPaid,
  markTuitionAsUnpaid,
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
        amount: 150000,
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
});

describe("markTuitionAsPaid", () => {
  const unpaidRecord = {
    academyId: "academy-1",
    tuitionId: "2026-08:student-1:piano",
    month: "2026-08",
    studentId: "student-1",
    studentName: "김민지",
    enrollmentId: "student-1:piano",
    instrumentId: "piano",
    instrumentName: "피아노",
    amount: 150000,
    status: "unpaid" as const,
  };

  it("수납 완료 시 상태를 paid로 바꾸고 수강료 수입 ledger를 만든다", () => {
    const result = markTuitionAsPaid(unpaidRecord, {
      academyId: "academy-1",
      paidAt: "2026-08-25",
    });

    expect(result.record).toEqual({
      ...unpaidRecord,
      status: "paid",
      paidAt: "2026-08-25",
    });
    expect(result.ledgerEntry).toEqual({
      academyId: "academy-1",
      ledgerId: "tuition:2026-08:student-1:piano",
      occurredOn: "2026-08-25",
      type: "income",
      source: "tuition",
      amount: 150000,
      description: "수강료 수납: 2026-08 김민지 피아노",
      refId: "2026-08:student-1:piano",
    });
  });

  it("다른 학원의 수납 처리는 막는다", () => {
    expect(() =>
      markTuitionAsPaid(unpaidRecord, {
        academyId: "academy-2",
        paidAt: "2026-08-25",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });
});

describe("markTuitionAsUnpaid", () => {
  it("미납 버튼을 누르면 미납 목록 항목을 만든다", () => {
    const unpaid = markTuitionAsUnpaid(
      {
        academyId: "academy-1",
        tuitionId: "2026-08:student-1:piano",
        month: "2026-08",
        studentId: "student-1",
        studentName: "김민지",
        enrollmentId: "student-1:piano",
        instrumentId: "piano",
        instrumentName: "피아노",
        amount: 150000,
        status: "unpaid",
      },
      {
        academyId: "academy-1",
        markedAt: "2026-08-26",
      },
    );

    expect(unpaid).toEqual({
      academyId: "academy-1",
      tuitionId: "2026-08:student-1:piano",
      studentId: "student-1",
      studentName: "김민지",
      month: "2026-08",
      amount: 150000,
      markedAt: "2026-08-26",
      reason: "tuition-unpaid",
    });
  });
});

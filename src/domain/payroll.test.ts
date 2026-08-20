import { describe, expect, it } from "vitest";

import {
  calculateRatioPayroll,
  markPayrollAsPaid,
} from "./payroll";

describe("calculateRatioPayroll", () => {
  it("비율제 선생님의 완료 수업 수강료와 선생님 비율로 기본 급여를 계산한다", () => {
    const payroll = calculateRatioPayroll(
      {
        academyId: "academy-1",
        teacherId: "teacher-1",
        teacherName: "박선생",
        month: "2026-08",
        academyShareRatio: 50,
        teacherShareRatio: 50,
        withholdingTaxRate: 0.033,
        rounding: "floor",
      },
      [
        {
          academyId: "academy-1",
          lessonEventId: "lesson-1",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "피아노",
          lessonRevenue: 50000,
          completedOn: "2026-08-10",
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-2",
          teacherId: "teacher-1",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentName: "피아노",
          lessonRevenue: 70000,
          completedOn: "2026-08-17",
        },
      ],
    );

    expect(payroll).toEqual({
      academyId: "academy-1",
      payrollId: "2026-08:teacher-1",
      teacherId: "teacher-1",
      teacherName: "박선생",
      month: "2026-08",
      payType: "ratio",
      basePay: 60000,
      withholdingTax: 1980,
      netPay: 58020,
      status: "pending",
      lessonEventIds: ["lesson-1", "lesson-2"],
    });
  });

  it("다른 학원, 다른 선생님, 다른 월의 수업은 급여 계산에서 제외한다", () => {
    const payroll = calculateRatioPayroll(
      {
        academyId: "academy-1",
        teacherId: "teacher-1",
        teacherName: "박선생",
        month: "2026-08",
        academyShareRatio: 50,
        teacherShareRatio: 50,
        withholdingTaxRate: 0.033,
        rounding: "floor",
      },
      [
        {
          academyId: "academy-2",
          lessonEventId: "lesson-1",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "피아노",
          lessonRevenue: 50000,
          completedOn: "2026-08-10",
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-2",
          teacherId: "teacher-2",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentName: "피아노",
          lessonRevenue: 50000,
          completedOn: "2026-08-10",
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-3",
          teacherId: "teacher-1",
          studentId: "student-3",
          studentName: "박하준",
          instrumentName: "피아노",
          lessonRevenue: 50000,
          completedOn: "2026-09-01",
        },
      ],
    );

    expect(payroll.basePay).toBe(0);
    expect(payroll.lessonEventIds).toEqual([]);
  });

  it("원천징수 반올림 정책을 옵션으로 적용한다", () => {
    const payroll = calculateRatioPayroll(
      {
        academyId: "academy-1",
        teacherId: "teacher-1",
        teacherName: "박선생",
        month: "2026-08",
        academyShareRatio: 0,
        teacherShareRatio: 100,
        withholdingTaxRate: 0.033,
        rounding: "ceil",
      },
      [
        {
          academyId: "academy-1",
          lessonEventId: "lesson-1",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "피아노",
          lessonRevenue: 10001,
          completedOn: "2026-08-10",
        },
      ],
    );

    expect(payroll.withholdingTax).toBe(331);
    expect(payroll.netPay).toBe(9670);
  });
});

describe("markPayrollAsPaid", () => {
  it("급여 지급을 확정하면 지급 완료 상태와 지출 ledger를 만든다", () => {
    const result = markPayrollAsPaid(
      {
        academyId: "academy-1",
        payrollId: "2026-08:teacher-1",
        teacherId: "teacher-1",
        teacherName: "박선생",
        month: "2026-08",
        payType: "ratio",
        basePay: 60000,
        withholdingTax: 1980,
        netPay: 58020,
        status: "pending",
        lessonEventIds: ["lesson-1", "lesson-2"],
      },
      {
        academyId: "academy-1",
        paidAt: "2026-08-31",
      },
    );

    expect(result.payroll).toMatchObject({
      status: "paid",
      paidAt: "2026-08-31",
    });
    expect(result.ledgerEntry).toEqual({
      academyId: "academy-1",
      ledgerId: "payroll:2026-08:teacher-1",
      occurredOn: "2026-08-31",
      type: "expense",
      source: "payroll",
      amount: 58020,
      description: "급여 지급: 2026-08 박선생",
      refId: "2026-08:teacher-1",
    });
  });

  it("이미 지급 완료된 급여는 다시 지급 처리하지 않는다", () => {
    expect(() =>
      markPayrollAsPaid(
        {
          academyId: "academy-1",
          payrollId: "2026-08:teacher-1",
          teacherId: "teacher-1",
          teacherName: "박선생",
          month: "2026-08",
          payType: "ratio",
          basePay: 60000,
          withholdingTax: 1980,
          netPay: 58020,
          status: "paid",
          paidAt: "2026-08-31",
          lessonEventIds: ["lesson-1", "lesson-2"],
        },
        {
          academyId: "academy-1",
          paidAt: "2026-09-01",
        },
      ),
    ).toThrow("이미 지급 완료된 급여입니다.");
  });
});

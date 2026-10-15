import { describe, expect, it } from "vitest";

import {
  buildCompletedLessonRevenues,
  calculateHourlyPayroll,
  calculateMonthlyPayroll,
  calculateRatioPayroll,
  markPayrollAsPaid,
} from "./payroll";

describe("buildCompletedLessonRevenues", () => {
  it("출석 완료와 보강 완료 수업만 급여 계산용 수업 매출로 변환한다", () => {
    const revenues = buildCompletedLessonRevenues(
      [
        {
          academyId: "academy-1",
          lessonEventId: "lesson-1",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "바이올린",
          lessonKind: "academy",
          status: "present",
          startedAt: "2026-08-06T09:00:00+09:00",
          endedAt: "2026-08-06T10:00:00+09:00",
          monthlyLessonFee: 140000,
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-2",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "바이올린",
          lessonKind: "makeup",
          status: "present",
          startedAt: "2026-08-13T09:00:00+09:00",
          endedAt: "2026-08-13T10:00:00+09:00",
          monthlyLessonFee: 140000,
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-3",
          teacherId: "teacher-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "바이올린",
          lessonKind: "academy",
          status: "absent",
          startedAt: "2026-08-20T09:00:00+09:00",
          endedAt: "2026-08-20T10:00:00+09:00",
          monthlyLessonFee: 140000,
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(revenues).toEqual([
      {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        teacherId: "teacher-1",
        studentId: "student-1",
        studentName: "김민지",
        instrumentName: "바이올린",
        lessonRevenue: 70000,
        completedOn: "2026-08-06",
        durationHours: 1,
      },
      {
        academyId: "academy-1",
        lessonEventId: "lesson-2",
        teacherId: "teacher-1",
        studentId: "student-1",
        studentName: "김민지",
        instrumentName: "바이올린",
        lessonRevenue: 70000,
        completedOn: "2026-08-13",
        durationHours: 1,
      },
    ]);
  });
});

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

describe("calculateMonthlyPayroll", () => {
  it("월급제 급여는 월 고정 급여와 3.3% 원천징수로 계산한다", () => {
    const payroll = calculateMonthlyPayroll({
      academyId: "academy-1",
      teacherId: "teacher-2",
      teacherName: "이선생",
      month: "2026-08",
      monthlySalary: 2_000_000,
      withholdingTaxRate: 0.033,
      rounding: "floor",
    });

    expect(payroll).toMatchObject({
      payrollId: "2026-08:teacher-2",
      payType: "monthly",
      basePay: 2_000_000,
      withholdingTax: 66_000,
      netPay: 1_934_000,
      lessonEventIds: [],
    });
  });

  it("월급제는 월 고정 급여가 필요하다", () => {
    expect(() =>
      calculateMonthlyPayroll({
        academyId: "academy-1",
        teacherId: "teacher-2",
        teacherName: "이선생",
        month: "2026-08",
        monthlySalary: 0,
        withholdingTaxRate: 0.033,
        rounding: "floor",
      }),
    ).toThrow("월급제 급여는 1 이상의 월 고정 급여가 필요합니다.");
  });
});

describe("calculateHourlyPayroll", () => {
  it("시급제 근무시간은 완료 수업의 실제 시간 합산 값을 사용한다", () => {
    const completedLessons = buildCompletedLessonRevenues(
      [
        {
          academyId: "academy-1",
          lessonEventId: "lesson-1",
          teacherId: "teacher-3",
          studentId: "student-1",
          studentName: "김민지",
          instrumentName: "피아노",
          lessonKind: "academy",
          status: "present",
          startedAt: "2026-08-06T09:00:00+09:00",
          endedAt: "2026-08-06T10:30:00+09:00",
          monthlyLessonFee: 150000,
        },
        {
          academyId: "academy-1",
          lessonEventId: "lesson-2",
          teacherId: "teacher-3",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentName: "피아노",
          lessonKind: "makeup",
          status: "present",
          startedAt: "2026-08-07T09:00:00+09:00",
          endedAt: "2026-08-07T10:00:00+09:00",
          monthlyLessonFee: 150000,
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );
    const workedHours = completedLessons.reduce(
      (total, lesson) => total + (lesson.durationHours ?? 0),
      0,
    );

    expect(workedHours).toBe(2.5);
    expect(
      calculateHourlyPayroll({
        academyId: "academy-1",
        teacherId: "teacher-3",
        teacherName: "최선생",
        month: "2026-08",
        hourlyRate: 30_000,
        workedHours,
        withholdingTaxRate: 0.033,
        rounding: "floor",
      }).netPay,
    ).toBe(72_525);
  });

  it("시급제 급여는 월 근무 시간과 시급으로 계산한다", () => {
    const payroll = calculateHourlyPayroll({
      academyId: "academy-1",
      teacherId: "teacher-3",
      teacherName: "최선생",
      month: "2026-08",
      hourlyRate: 30_000,
      workedHours: 12.5,
      withholdingTaxRate: 0.033,
      rounding: "round",
    });

    expect(payroll).toMatchObject({
      payrollId: "2026-08:teacher-3",
      payType: "hourly",
      basePay: 375_000,
      withholdingTax: 12_375,
      netPay: 362_625,
      lessonEventIds: [],
    });
  });

  it("시급제는 시급과 근무 시간이 필요하다", () => {
    expect(() =>
      calculateHourlyPayroll({
        academyId: "academy-1",
        teacherId: "teacher-3",
        teacherName: "최선생",
        month: "2026-08",
        hourlyRate: 30_000,
        workedHours: 0,
        withholdingTaxRate: 0.033,
        rounding: "round",
      }),
    ).toThrow("시급제 급여는 0보다 큰 근무 시간이 필요합니다.");
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
      category: "payroll",
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

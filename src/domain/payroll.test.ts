import { describe, expect, it } from "vitest";

import type { PayrollLessonSource, PayrollTeacher } from "./payroll";
import {
  PAYROLL_POLICY,
  buildCompletedLessonRevenues,
  buildPayrollRows,
  calculateHourlyPayroll,
  calculateMonthlyPayroll,
  calculateRatioPayroll,
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
  const policy = {
    academyId: "academy-1",
    teacherId: "teacher-3",
    teacherName: "최선생",
    month: "2026-08",
    hourlyRate: 30_000,
    withholdingTaxRate: 0.033,
    rounding: "floor" as const,
  };

  it("시급제 급여는 시급 × 근무 분 ÷ 60(내림)과 3.3% 원천징수로 계산한다", () => {
    const payroll = calculateHourlyPayroll({ ...policy, workedMinutes: 750 });

    expect(payroll).toMatchObject({
      payrollId: "2026-08:teacher-3",
      payType: "hourly",
      basePay: 375_000,
      withholdingTax: 12_375,
      netPay: 362_625,
      lessonEventIds: [],
    });
  });

  it("분 단위 나머지는 금액에서 내림한다(25,000원 × 116분 ÷ 60 = 48,333.33원)", () => {
    expect(calculateHourlyPayroll({ ...policy, hourlyRate: 25_000, workedMinutes: 116 }).basePay).toBe(48_333);
  });

  it("부동소수점 오차로 1원 모자라게 계산하지 않는다(20,000원 × 240분 = 80,000원)", () => {
    expect(calculateHourlyPayroll({ ...policy, hourlyRate: 20_000, workedMinutes: 240 }).basePay).toBe(80_000);
  });

  it("시급은 1 이상의 정수여야 한다", () => {
    expect(() => calculateHourlyPayroll({ ...policy, hourlyRate: 0, workedMinutes: 60 })).toThrow(
      "시급제 급여는 1 이상의 시급이 필요합니다.",
    );
  });

  it("근무 시간은 0보다 큰 정수 분이어야 한다", () => {
    expect(() => calculateHourlyPayroll({ ...policy, workedMinutes: 0 })).toThrow(
      "시급제 급여는 0보다 큰 근무 시간이 필요합니다.",
    );
    expect(() => calculateHourlyPayroll({ ...policy, workedMinutes: 90.5 })).toThrow(
      "근무 시간은 분 단위 정수여야 합니다.",
    );
  });
});

const academyId = "academy-1";

function lesson(
  id: string,
  startedAt: string,
  overrides: Partial<PayrollLessonSource> = {},
): PayrollLessonSource {
  const start = new Date(startedAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000).toISOString();

  return {
    academyId,
    lessonEventId: id,
    teacherId: "teacher-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentName: "바이올린",
    lessonKind: "academy",
    status: "present",
    startedAt,
    endedAt: end,
    monthlyLessonFee: 140_000,
    ...overrides,
  };
}

const ratioTeacher = {
  academyId,
  teacherId: "teacher-1",
  name: "김동성",
  payType: "ratio" as const,
  ratioTeacherShare: 60,
};

const mondayShift = { weekday: "월", weekdayLabel: "월", startTime: "10:00", endTime: "18:00" };

function hourlyTeacher(overrides: Partial<PayrollTeacher> = {}): PayrollTeacher {
  return {
    academyId,
    teacherId: "teacher-1",
    name: "김동성",
    payType: "hourly",
    hourlyRate: 30_000,
    ...overrides,
  };
}

describe("buildCompletedLessonRevenues — 명세 공식", () => {
  it("1회 레슨비는 월 수강료를 그 달 예정 수업 수로 나눈다(등원 횟수가 아니다)", () => {
    const revenues = buildCompletedLessonRevenues(
      [
        lesson("l1", "2026-08-03T10:00:00+09:00"),
        lesson("l2", "2026-08-10T10:00:00+09:00"),
        lesson("l3", "2026-08-17T10:00:00+09:00", { status: "absent" }),
        lesson("l4", "2026-08-24T10:00:00+09:00", { status: "pending" }),
      ],
      { academyId, month: "2026-08" },
    );

    expect(revenues.map((revenue) => revenue.lessonRevenue)).toEqual([35_000, 35_000]);
  });

  it("취소된 수업은 예정 수업 수에서 빼고, 보강 수업은 예정 수업 수에 넣지 않는다", () => {
    const revenues = buildCompletedLessonRevenues(
      [
        lesson("l1", "2026-08-03T10:00:00+09:00"),
        lesson("l2", "2026-08-10T10:00:00+09:00"),
        lesson("l3", "2026-08-17T10:00:00+09:00", { status: "cancelled" }),
        lesson("l4", "2026-08-24T10:00:00+09:00", { status: "present", lessonKind: "makeup" }),
      ],
      { academyId, month: "2026-08" },
    );

    // 예정 2회(취소 제외), 등원 확인 3회(보강 포함) → 분모는 등원 횟수 이상으로 맞춰 월 수강료를 넘지 않는다.
    expect(revenues).toHaveLength(3);
    expect(revenues.reduce((total, revenue) => total + revenue.lessonRevenue, 0)).toBeCloseTo(140_000, 6);
  });

  it("개인레슨 등원은 회차권 결제 금액 ÷ 부여 회수를 1회 레슨비로 쓴다", () => {
    const revenues = buildCompletedLessonRevenues(
      [lesson("p1", "2026-08-05T10:00:00+09:00", { lessonKind: "private", monthlyLessonFee: 0 })],
      {
        academyId,
        month: "2026-08",
        privateLessonFees: [
          {
            studentId: "student-1",
            instrumentName: "바이올린",
            registeredAt: "2026-08-01",
            validUntil: "2026-08-31",
            grantedCount: 4,
            paidAmount: 140_000,
          },
        ],
      },
    );

    expect(revenues).toHaveLength(1);
    expect(revenues[0].lessonRevenue).toBe(35_000);
  });

  it("월 경계는 한국 시간으로 판정한다(UTC 8/31 15:00은 9월 1일)", () => {
    const revenues = buildCompletedLessonRevenues(
      [lesson("l1", "2026-08-31T15:00:00Z"), lesson("l2", "2026-08-31T14:00:00Z")],
      { academyId, month: "2026-09" },
    );

    expect(revenues.map((revenue) => revenue.lessonEventId)).toEqual(["l1"]);
  });
});

describe("buildPayrollRows", () => {
  it("명세 예시: 140,000원 4회 모두 등원, 선생님 비율 60% → 기본 84,000원, 세금 2,772원, 최종 81,228원", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: ["03", "10", "17", "24"].map((day) => lesson(`l${day}`, `2026-08-${day}T10:00:00+09:00`)),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      payType: "ratio",
      basePay: 84_000,
      withholdingTax: 2_772,
      netPay: 81_228,
      status: "pending",
    });
    expect(rows[0].basis).toBe("등원 4회 / 예정 4회");
  });

  it("4회 중 2회만 등원하면 월 전액이 아니라 등원한 횟수만큼만 계산한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: [
        lesson("l1", "2026-08-03T10:00:00+09:00"),
        lesson("l2", "2026-08-10T10:00:00+09:00"),
        lesson("l3", "2026-08-17T10:00:00+09:00", { status: "absent" }),
        lesson("l4", "2026-08-24T10:00:00+09:00", { status: "absent" }),
      ],
    });

    expect(rows[0].basePay).toBe(42_000);
  });

  it("개인레슨 등원도 비율제 급여에 포함하고 원생별로 계산해 합산한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: [
        lesson("a1", "2026-08-03T10:00:00+09:00", { monthlyLessonFee: 100_000 }),
        lesson("a2", "2026-08-10T10:00:00+09:00", { monthlyLessonFee: 100_000 }),
        lesson("p1", "2026-08-05T10:00:00+09:00", {
          lessonKind: "private",
          studentId: "student-2",
          studentName: "이서윤",
          monthlyLessonFee: 0,
        }),
      ],
      privateLessonFees: [
        {
          studentId: "student-2",
          instrumentName: "바이올린",
          registeredAt: "2026-08-01",
          validUntil: "2026-08-31",
          grantedCount: 4,
          paidAmount: 140_000,
        },
      ],
    });

    // 학원 레슨 100,000(2/2) + 개인레슨 35,000 = 135,000 × 0.6
    expect(rows[0].basePay).toBe(81_000);
  });

  it("개인레슨 결제 금액을 알 수 없으면 그 레슨은 0원으로 계산하고 안내를 남긴다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: [lesson("p1", "2026-08-05T10:00:00+09:00", { lessonKind: "private", monthlyLessonFee: 0 })],
    });

    expect(rows[0].basePay).toBe(0);
    expect(rows[0].note).toBe("회차권 결제 금액을 찾지 못한 개인레슨 1건은 계산에서 제외했습니다.");
  });

  it("시급제는 등원 확인 수업이 아니라 출근 요일·시간을 그 달에 펼친 합계로 계산한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [hourlyTeacher({ hourlyRate: 30_000, workSchedules: [mondayShift] })],
      // 등원 확인 수업이 있어도 시급 금액에는 영향이 없다.
      lessons: [lesson("a1", "2026-08-03T10:00:00+09:00"), lesson("m1", "2026-08-10T10:00:00+09:00", { lessonKind: "makeup" })],
    });

    // 월요일 5번(3·10·17·24·31) × 8시간 = 40시간 × 30,000원
    expect(rows[0]).toMatchObject({ payType: "hourly", basePay: 1_200_000, withholdingTax: 39_600, lessonEventIds: [] });
    expect(rows[0].basis).toBe("근무 40시간 (출근 일정 기준)");
    expect(rows[0].issue).toBeUndefined();
  });

  it("시급제는 등원 확인 수업이 하나도 없어도 출근 일정만으로 계산한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [hourlyTeacher({ hourlyRate: 10_000, workSchedules: [mondayShift] })],
      lessons: [],
    });

    expect(rows[0].basePay).toBe(400_000);
  });

  it("시급제는 계약 시작일·종료일 당일을 포함하고 그 밖의 출근 요일은 제외한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [
        hourlyTeacher({
          hourlyRate: 10_000,
          workSchedules: [mondayShift],
          contractStartOn: "2026-08-10",
          contractEndOn: "2026-08-24",
        }),
      ],
      lessons: [],
    });

    // 10·17·24일 3번 × 8시간
    expect(rows[0].basePay).toBe(240_000);
    expect(rows[0].basis).toBe("근무 24시간 (출근 일정 기준)");
  });

  it("시급제의 분 단위 금액은 총 분으로 곱한 뒤 한 번만 내린다(35분 × 5번 = 175분)", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [
        hourlyTeacher({
          hourlyRate: 25_000,
          workSchedules: [{ weekday: "월", weekdayLabel: "월", startTime: "10:00", endTime: "10:35" }],
        }),
      ],
      lessons: [],
    });

    // floor(25,000 × 175 / 60) = 72,916 (날짜마다 내리면 72,915)
    expect(rows[0].basePay).toBe(72_916);
    expect(rows[0].basis).toBe("근무 2시간 55분 (출근 일정 기준)");
  });

  it("시급제 계약 기간이 그 달과 겹치지 않으면 0원 행이며 설정 문제는 아니다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [
        hourlyTeacher({
          workSchedules: [mondayShift],
          contractStartOn: "2026-06-01",
          contractEndOn: "2026-07-31",
        }),
      ],
      lessons: [],
    });

    expect(rows[0]).toMatchObject({ basePay: 0, netPay: 0 });
    expect(rows[0].issue).toBeUndefined();
    expect(rows[0].basis).toBe("근무 0분 (출근 일정 기준)");
  });

  it("시급제 선생님의 출근 일정이 비어 있으면 출근 요일·시간 등록을 안내하는 설정 확인 행이 된다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [hourlyTeacher({ workSchedules: [] })],
      lessons: [],
    });

    expect(rows[0].issue).toBe(
      "출근 요일·시간을 설정해 주세요. 선생님 정보에서 출근 일정을 등록하면 시급을 계산할 수 있습니다.",
    );
    expect(rows[0]).toMatchObject({ basePay: 0, netPay: 0 });
  });

  it("출근 요일만 있고 시간이 비어 있으면 출근 시간 설정을 안내한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [hourlyTeacher({ workSchedules: [mondayShift, { weekday: "수", weekdayLabel: "수" }] })],
      lessons: [],
    });

    expect(rows[0].issue).toBe("출근 시간을 설정해 주세요. 수요일의 시작·종료 시간이 비어 있습니다.");
    expect(rows[0].netPay).toBe(0);
  });

  it("급여 설정이 비어 있으면 화면이 깨지지 않고 설정 확인 필요 행으로 돌려준다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [
        { academyId, teacherId: "t-monthly", name: "월급제", payType: "monthly" },
        { academyId, teacherId: "t-hourly", name: "시급제", payType: "hourly" },
        { academyId, teacherId: "t-ratio", name: "비율제", payType: "ratio" },
      ],
      lessons: [],
    });

    expect(rows.map((row) => row.issue)).toEqual([
      "월 급여 설정을 확인해 주세요.",
      "시급 설정을 확인해 주세요.",
      "비율 설정을 확인해 주세요.",
    ]);
    expect(rows.every((row) => row.netPay === 0)).toBe(true);
  });

  it("월급제는 설정 금액에서 3.3%를 공제한다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [{ academyId, teacherId: "teacher-1", name: "김동성", payType: "monthly", monthlySalary: 2_600_000 }],
      lessons: [],
    });

    expect(rows[0]).toMatchObject({ basePay: 2_600_000, withholdingTax: 85_800, netPay: 2_514_200 });
  });

  it("같은 달 지급 완료된 정산이 있으면 급여 형태가 바뀌었어도 그 정산을 보여 준다", () => {
    const settlement = {
      academyId,
      payrollId: "settlement-1",
      teacherId: "teacher-1",
      teacherName: "김동성",
      month: "2026-08",
      payType: "monthly" as const,
      basePay: 2_000_000,
      withholdingTax: 66_000,
      netPay: 1_934_000,
      status: "paid" as const,
      paidAt: "2026-09-01",
      lessonEventIds: [],
    };
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: [],
      settlements: [settlement],
    });

    expect(rows).toEqual([settlement]);
  });

  it("같은 원생·악기를 두 선생님이 한 달에 나눠 가르쳐도 월 수강료는 한 번만 배분된다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [
        ratioTeacher,
        { ...ratioTeacher, teacherId: "teacher-2", name: "박대타", ratioTeacherShare: 50 },
      ],
      lessons: [
        lesson("a1", "2026-08-03T10:00:00+09:00"),
        lesson("a2", "2026-08-10T10:00:00+09:00"),
        lesson("b1", "2026-08-17T10:00:00+09:00", { teacherId: "teacher-2" }),
        lesson("b2", "2026-08-24T10:00:00+09:00", { teacherId: "teacher-2" }),
      ],
    });

    // 월 140,000원 ÷ 예정 4회 = 35,000원. 선생님 A는 2회 × 60%, B는 2회 × 50%.
    expect(rows.map((row) => row.basePay)).toEqual([42_000, 35_000]);
  });

  it("대타 선생님이 1회만 가르쳐도 월 수강료 전액이 아니라 1회분만 계산된다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [{ ...ratioTeacher, teacherId: "teacher-2", name: "박대타", ratioTeacherShare: 100 }],
      lessons: [
        lesson("a1", "2026-08-03T10:00:00+09:00"),
        lesson("a2", "2026-08-10T10:00:00+09:00"),
        lesson("a3", "2026-08-17T10:00:00+09:00"),
        lesson("b1", "2026-08-24T10:00:00+09:00", { teacherId: "teacher-2" }),
      ],
    });

    expect(rows[0].basePay).toBe(35_000);
  });

  it("분모는 정규·이동 수업만 센다: 수동·특별 수업은 등원 횟수에는 들어가도 예정 수업 수에는 넣지 않는다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [{ ...ratioTeacher, ratioTeacherShare: 100 }],
      lessons: [
        lesson("r1", "2026-08-03T10:00:00+09:00", { origin: "regular" }),
        lesson("r2", "2026-08-10T10:00:00+09:00", { origin: "regular", status: "absent" }),
        lesson("r3", "2026-08-17T10:00:00+09:00", { origin: "rescheduled", status: "absent" }),
        lesson("r4", "2026-08-24T10:00:00+09:00", { origin: "regular", status: "absent" }),
        lesson("m1", "2026-08-25T10:00:00+09:00", { origin: "manual" }),
        lesson("s1", "2026-08-26T10:00:00+09:00", { origin: "special", status: "pending" }),
      ],
    });

    // 정규·이동 예정 4회 → 1회 35,000원, 등원은 정규 1회 + 수동 1회 = 2회
    expect(rows[0].basePay).toBe(70_000);
    expect(rows[0].basis).toBe("등원 2회 / 예정 4회");
  });

  it("월 수강료는 그 달 월 snapshot 금액을 우선하고 없으면 수업에 붙은 현재 금액을 쓴다", () => {
    const base = {
      academyId,
      month: "2026-08",
      teachers: [{ ...ratioTeacher, ratioTeacherShare: 100 }],
      lessons: ["03", "10"].map((day) => lesson(`l${day}`, `2026-08-${day}T10:00:00+09:00`)),
    };

    const withSnapshot = buildPayrollRows({
      ...base,
      tuitionFees: [{ studentId: "student-1", instrumentName: "바이올린", amount: 100_000 }],
    });
    const withoutSnapshot = buildPayrollRows(base);

    // 예정 2회 모두 등원: snapshot 100,000원 vs 수업에 붙은 현재 140,000원
    expect(withSnapshot[0].basePay).toBe(100_000);
    expect(withoutSnapshot[0].basePay).toBe(140_000);
  });

  it("월 snapshot 기록을 읽었는데 그 원생·악기 금액이 없으면 현재 수강료로 계산했다고 알린다", () => {
    const base = {
      academyId,
      month: "2026-08",
      teachers: [{ ...ratioTeacher, ratioTeacherShare: 100 }],
      lessons: [lesson("l1", "2026-08-03T10:00:00+09:00")],
    };

    const withoutMatch = buildPayrollRows({ ...base, tuitionFees: [] });
    const withMatch = buildPayrollRows({
      ...base,
      tuitionFees: [{ studentId: "student-1", instrumentName: "바이올린", amount: 140_000 }],
    });
    const notRead = buildPayrollRows(base);

    expect(withoutMatch[0].note).toBe(
      "이 달 월 수강료 기록(월 snapshot)이 없어 현재 수강료로 계산한 학원 레슨 1건이 있습니다.",
    );
    expect(withMatch[0].note).toBeUndefined();
    // snapshot을 읽지 않은 환경(데모)에서는 알 수 없으므로 안내하지 않는다.
    expect(notRead[0].note).toBeUndefined();
  });

  it("학원 레슨의 월 수강료를 찾지 못하면 조용히 0원으로 두지 않고 안내를 남긴다", () => {
    const rows = buildPayrollRows({
      academyId,
      month: "2026-08",
      teachers: [ratioTeacher],
      lessons: [lesson("l1", "2026-08-03T10:00:00+09:00", { monthlyLessonFee: 0 })],
    });

    expect(rows[0].basePay).toBe(0);
    expect(rows[0].note).toBe("월 수강료를 찾지 못한 학원 레슨 1건은 0원으로 계산했습니다.");
  });
});

describe("buildPayrollRows — 급여 대상 선생님", () => {
  const monthly = (overrides: Record<string, unknown>) => ({
    academyId,
    teacherId: "t",
    name: "선생님",
    payType: "monthly" as const,
    monthlySalary: 2_000_000,
    ...overrides,
  });
  const rowsFor = (
    teachers: ReturnType<typeof monthly>[],
    extra: { lessons?: PayrollLessonSource[]; settlements?: Parameters<typeof buildPayrollRows>[0]["settlements"] } = {},
    month = "2026-08",
  ) =>
    buildPayrollRows({ academyId, month, teachers, lessons: extra.lessons ?? [], settlements: extra.settlements }).map(
      (row) => row.teacherId,
    );

  it("재직 선생님은 입사(계약 시작)한 달부터 행이 생기고 입사 전 달에는 생기지 않는다", () => {
    const teachers = [
      monthly({ teacherId: "early", status: "employed", registeredAt: "2026-03-02" }),
      monthly({ teacherId: "late", status: "employed", registeredAt: "2026-09-10" }),
      monthly({ teacherId: "contract", status: "employed", registeredAt: "2026-01-01", contractStartOn: "2026-10-01" }),
    ];

    expect(rowsFor(teachers, {}, "2026-08")).toEqual(["early"]);
    expect(rowsFor(teachers, {}, "2026-09")).toEqual(["early", "late"]);
  });

  it("입사일 정보가 없으면 재직 선생님은 행을 만든다", () => {
    expect(rowsFor([monthly({ teacherId: "none", status: "employed" })])).toEqual(["none"]);
  });

  it("퇴사·휴직 선생님은 그 달에 등원 확인된 수업이나 정산 기록이 있을 때만 행을 보여 준다", () => {
    const teachers = [
      monthly({ teacherId: "resigned-active", status: "resigned", resignedAt: "2026-09-05" }),
      monthly({ teacherId: "resigned-idle", status: "resigned", resignedAt: "2026-09-05" }),
      monthly({ teacherId: "leave-idle", status: "on_leave" }),
      monthly({ teacherId: "leave-settled", status: "on_leave" }),
    ];
    const settlement = {
      academyId,
      payrollId: "settlement-1",
      teacherId: "leave-settled",
      teacherName: "휴직",
      month: "2026-08",
      payType: "monthly" as const,
      basePay: 2_000_000,
      withholdingTax: 66_000,
      netPay: 1_934_000,
      status: "paid" as const,
      paidAt: "2026-09-01",
      lessonEventIds: [],
    };

    expect(
      rowsFor(teachers, {
        lessons: [lesson("l1", "2026-08-03T10:00:00+09:00", { teacherId: "resigned-active" })],
        settlements: [settlement],
      }),
    ).toEqual(["resigned-active", "leave-settled"]);
  });

  it("미지급으로 되돌린 정산 기록도 그 달의 기록으로 본다", () => {
    const pending = {
      academyId,
      payrollId: "settlement-2",
      teacherId: "resigned-pending",
      teacherName: "퇴사",
      month: "2026-08",
      payType: "monthly" as const,
      basePay: 0,
      withholdingTax: 0,
      netPay: 0,
      status: "pending" as const,
      lessonEventIds: [],
    };

    expect(
      rowsFor([monthly({ teacherId: "resigned-pending", status: "resigned" })], { settlements: [pending] }),
    ).toEqual(["resigned-pending"]);
  });

  it("정책 상수: 원천징수율 3.3%, 내림", () => {
    expect(PAYROLL_POLICY).toEqual({ withholdingTaxRate: 0.033, rounding: "floor" });
  });
});

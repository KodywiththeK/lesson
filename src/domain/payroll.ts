import type { LedgerEntry } from "./book-sale";

export type PayrollRounding = "floor" | "round" | "ceil";

export type RatioPayrollPolicy = {
  academyId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  academyShareRatio: number;
  teacherShareRatio: number;
  withholdingTaxRate: number;
  rounding: PayrollRounding;
};

export type CompletedLessonRevenue = {
  academyId: string;
  lessonEventId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  instrumentName: string;
  lessonRevenue: number;
  completedOn: string;
};

export type PayrollStatus = "pending" | "paid";

export type PayrollRecord = {
  academyId: string;
  payrollId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  payType: "ratio";
  basePay: number;
  withholdingTax: number;
  netPay: number;
  status: PayrollStatus;
  paidAt?: string;
  lessonEventIds: string[];
};

export type MarkPayrollAsPaidInput = {
  academyId: string;
  paidAt: string;
};

export type MarkPayrollAsPaidResult = {
  payroll: PayrollRecord & {
    status: "paid";
    paidAt: string;
  };
  ledgerEntry: LedgerEntry;
};

export function calculateRatioPayroll(
  policy: RatioPayrollPolicy,
  lessons: CompletedLessonRevenue[],
): PayrollRecord {
  validateRatioPolicy(policy);

  const matchedLessons = lessons.filter(
    (lesson) =>
      lesson.academyId === policy.academyId &&
      lesson.teacherId === policy.teacherId &&
      toMonth(lesson.completedOn) === policy.month,
  );
  const totalRevenue = matchedLessons.reduce(
    (total, lesson) => total + lesson.lessonRevenue,
    0,
  );
  const basePay = applyRounding(
    totalRevenue * (policy.teacherShareRatio / 100),
    policy.rounding,
  );
  const withholdingTax = applyRounding(
    basePay * policy.withholdingTaxRate,
    policy.rounding,
  );

  return {
    academyId: policy.academyId,
    payrollId: `${policy.month}:${policy.teacherId}`,
    teacherId: policy.teacherId,
    teacherName: policy.teacherName,
    month: policy.month,
    payType: "ratio",
    basePay,
    withholdingTax,
    netPay: basePay - withholdingTax,
    status: "pending",
    lessonEventIds: matchedLessons.map((lesson) => lesson.lessonEventId),
  };
}

export function markPayrollAsPaid(
  payroll: PayrollRecord,
  input: MarkPayrollAsPaidInput,
): MarkPayrollAsPaidResult {
  assertSameAcademy(payroll.academyId, input.academyId);

  if (payroll.status === "paid") {
    throw new Error("이미 지급 완료된 급여입니다.");
  }

  return {
    payroll: {
      ...payroll,
      status: "paid",
      paidAt: input.paidAt,
    },
    ledgerEntry: {
      academyId: payroll.academyId,
      ledgerId: `payroll:${payroll.payrollId}`,
      occurredOn: input.paidAt,
      type: "expense",
      source: "payroll",
      amount: payroll.netPay,
      description: `급여 지급: ${payroll.month} ${payroll.teacherName}`,
      refId: payroll.payrollId,
    },
  };
}

function validateRatioPolicy(policy: RatioPayrollPolicy) {
  if (policy.academyShareRatio + policy.teacherShareRatio !== 100) {
    throw new Error("학원과 선생님 비율의 합은 100이어야 합니다.");
  }

  if (policy.withholdingTaxRate < 0) {
    throw new Error("원천징수율은 0 이상이어야 합니다.");
  }
}

function applyRounding(amount: number, rounding: PayrollRounding) {
  if (rounding === "ceil") {
    return Math.ceil(amount);
  }

  if (rounding === "round") {
    return Math.round(amount);
  }

  return Math.floor(amount);
}

function assertSameAcademy(leftAcademyId: string, rightAcademyId: string) {
  if (leftAcademyId !== rightAcademyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }
}

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

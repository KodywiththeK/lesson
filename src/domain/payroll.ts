import { toFinanceDate, toFinanceMonth } from "./finance-date";
import type { TeacherListRow } from "./teacher-list";
import { calculateScheduledWorkMinutes, formatWorkDuration } from "./teacher-work-minutes";
import { allocatePayrollAmounts } from "./payroll-message";

export type PayrollRounding = "floor" | "round" | "ceil";

const MINUTES_PER_HOUR = 60;

/** 급여 계산 정책. 세율과 반올림 방식은 학원 정책이 확정되기 전까지 이 한 곳에서만 정한다. */
export const PAYROLL_POLICY = {
  withholdingTaxRate: 0.033,
  rounding: "floor" as PayrollRounding,
};

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

export type MonthlyPayrollPolicy = {
  academyId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  monthlySalary: number;
  withholdingTaxRate: number;
  rounding: PayrollRounding;
};

export type HourlyPayrollPolicy = {
  academyId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  hourlyRate: number;
  /** 출근 일정 기준 그 달 근무 시간을 정수 분으로 센 값. */
  workedMinutes: number;
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

/** 개인레슨 1회 레슨비를 구하는 회차권 등록 기록(결제 금액 ÷ 부여 회수). */
export type PrivateLessonFeeSource = {
  studentId: string;
  instrumentName: string;
  registeredAt: string;
  validUntil: string;
  grantedCount: number;
  paidAmount: number;
};

export type PayrollTeacher = Pick<
  TeacherListRow,
  "academyId" | "teacherId" | "name" | "payType" | "monthlySalary" | "hourlyRate" | "ratioTeacherShare"
> &
  Partial<
    Pick<
      TeacherListRow,
      "status" | "registeredAt" | "contractStartOn" | "contractEndOn" | "resignedAt" | "workSchedules"
    >
  >;

/** 그 달 월 수강료 snapshot(없으면 수업에 붙은 현재 금액을 쓴다). */
export type PayrollTuitionFee = {
  studentId: string;
  instrumentName: string;
  amount: number;
};

export type PayrollLessonSource = {
  academyId: string;
  lessonEventId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  instrumentName: string;
  lessonKind: "academy" | "private" | "makeup";
  /** 수업이 생긴 경로(regular·rescheduled·manual·special·makeup…). 없으면 정규 수업으로 본다. */
  origin?: string;
  /** 월 수강료를 어디서 가져왔는지. `current`는 월 snapshot이 없어 현재 수강료를 쓴 것이다(snapshot을 읽은 환경에서만 채운다). */
  feeSource?: "snapshot" | "current";
  status:
    | "pending"
    | "scheduled"
    | "present"
    | "absent"
    | "cancelled"
    | "makeup"
    | "pass";
  startedAt: string;
  endedAt: string;
  monthlyLessonFee: number;
};

export type PayrollStatus = "pending" | "paid";

/** 지급 확정 당시 서버가 검증해 보존한 학생·악기별 상세. */
export type PayrollStudentBreakdown = {
  studentId: string;
  studentName: string;
  instrumentName: string;
  count: number;
  dates: string[];
  amount: number;
};

export type PayrollRecord = {
  academyId: string;
  payrollId: string;
  teacherId: string;
  teacherName: string;
  month: string;
  payType: "ratio" | "monthly" | "hourly";
  basePay: number;
  withholdingTax: number;
  netPay: number;
  status: PayrollStatus;
  paidAt?: string;
  lessonEventIds: string[];
  studentBreakdown?: PayrollStudentBreakdown[] | null;
  /** 지급 때 만든 입출입내역(원장) 행. DB에서 읽었는데 null이면 원장 기록이 사라진 지급 건이다. */
  ledgerEntryId?: string | null;
  /** 계산 근거를 사용자에게 보여 주는 한 줄(예: "등원 4회 / 예정 4회"). 지급 완료 정산에는 없다. */
  basis?: string;
  /** 급여 설정이 비어 계산할 수 없을 때의 안내. 있으면 지급 확정을 막는다. */
  issue?: string;
  /** 계산은 했지만 일부를 제외한 경우의 안내. */
  note?: string;
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
    roundPrecision(totalRevenue * (policy.teacherShareRatio / 100)),
    policy.rounding,
  );
  const withholdingTax = applyRounding(
    roundPrecision(basePay * policy.withholdingTaxRate),
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

export type BuildCompletedLessonRevenuesOptions = {
  academyId: string;
  month: string;
  privateLessonFees?: PrivateLessonFeeSource[];
};

type LessonRevenueAnalysis = {
  revenues: CompletedLessonRevenue[];
  scheduledCount: number;
  presentCount: number;
  privatePresentCount: number;
  missingPrivateFeeCount: number;
  missingAcademyFeeCount: number;
  currentFeeLessonCount: number;
};

/**
 * 등원 확인된 수업을 급여 계산용 수업 매출로 바꾼다.
 * - 학원 레슨 1회 레슨비 = 월 최종 수강료 ÷ 그 달 예정 수업 수(취소·보강 제외). 등원이 예정보다 많으면
 *   월 수강료를 넘지 않도록 분모를 등원 횟수로 맞춘다.
 * - 개인레슨 1회 레슨비 = 회차권 결제 금액 ÷ 부여 회수. 결제 금액을 모르면 그 레슨은 0원이다.
 */
export function buildCompletedLessonRevenues(
  lessons: PayrollLessonSource[],
  options: BuildCompletedLessonRevenuesOptions,
): CompletedLessonRevenue[] {
  return analyzeLessonRevenues(lessons, options).revenues;
}

/** 월 급여와 같은 수업별 매출과 분모를 사용해 비율제 선생님의 학생별 정산액을 만든다. */
export function buildPayrollStudentBreakdown(input: {
  academyId: string;
  month: string;
  teacherId: string;
  teacherShareRatio: number;
  basePay: number;
  lessons: PayrollLessonSource[];
  privateLessonFees?: PrivateLessonFeeSource[];
  tuitionFees?: PayrollTuitionFee[];
}) {
  if (!Number.isInteger(input.teacherShareRatio) || input.teacherShareRatio < 0 || input.teacherShareRatio > 100) {
    throw new Error("선생님 비율을 확인해 주세요.");
  }
  const lessons = applyTuitionFees(input.lessons, input.tuitionFees);
  const analysis = analyzeLessonRevenues(lessons.filter((lesson) => lesson.teacherId === input.teacherId), input, lessons);
  if (analysis.missingPrivateFeeCount || analysis.missingAcademyFeeCount) {
    throw new Error("수업별 수강료를 확인한 뒤 정산 내역을 작성해 주세요.");
  }
  const grouped = new Map<string, { studentId: string; studentName: string; instrumentName: string; count: number; dates: string[]; amount: number }>();
  for (const lesson of analysis.revenues) {
    const key = JSON.stringify([lesson.studentId, lesson.instrumentName]);
    const current = grouped.get(key) ?? { studentId: lesson.studentId, studentName: lesson.studentName, instrumentName: lesson.instrumentName, count: 0, dates: [], amount: 0 };
    current.count += 1;
    current.dates.push(lesson.completedOn);
    current.amount += lesson.lessonRevenue * input.teacherShareRatio / 100;
    grouped.set(key, current);
  }
  const allocations = allocatePayrollAmounts([...grouped].map(([id, row]) => ({ id, amount: row.amount })), input.basePay);
  return allocations.map(({ id, amount }) => ({ ...grouped.get(id)!, dates: [...grouped.get(id)!.dates].sort(), amount }));
}

/**
 * `lessons`는 급여를 받을 선생님의 수업이고, `denominatorLessons`는 1회 레슨비를 나누는 데 쓰는 같은 원생·악기의
 * 모든 선생님 수업이다. 한 원생을 두 선생님이 나눠 가르쳐도 월 수강료는 한 번만 배분된다.
 */
function analyzeLessonRevenues(
  lessons: PayrollLessonSource[],
  options: BuildCompletedLessonRevenuesOptions,
  denominatorLessons: PayrollLessonSource[] = lessons,
): LessonRevenueAnalysis {
  const inMonth = (lesson: PayrollLessonSource) =>
    lesson.academyId === options.academyId &&
    lesson.status !== "cancelled" &&
    readFinanceMonth(lesson.startedAt) === options.month;
  const monthLessons = lessons.filter(inMonth);
  const scheduledByEnrollment = new Map<string, number>();
  const presentByEnrollment = new Map<string, number>();

  for (const lesson of denominatorLessons.filter(inMonth)) {
    if (lesson.lessonKind === "private") {
      continue;
    }

    const key = toCompletedLessonRevenueKey(lesson);

    if (isRegularScheduledLesson(lesson)) {
      scheduledByEnrollment.set(key, (scheduledByEnrollment.get(key) ?? 0) + 1);
    }

    if (lesson.status === "present") {
      presentByEnrollment.set(key, (presentByEnrollment.get(key) ?? 0) + 1);
    }
  }

  const presentLessons = monthLessons.filter((lesson) => lesson.status === "present");
  let missingPrivateFeeCount = 0;
  let missingAcademyFeeCount = 0;
  let currentFeeLessonCount = 0;
  const revenues: CompletedLessonRevenue[] = [];

  for (const lesson of presentLessons) {
    const lessonRevenue = resolveLessonRevenue(lesson, {
      scheduledByEnrollment,
      presentByEnrollment,
      privateLessonFees: options.privateLessonFees ?? [],
    });

    if (lessonRevenue === undefined) {
      missingPrivateFeeCount += 1;
    } else if (lesson.lessonKind !== "private" && lesson.monthlyLessonFee <= 0) {
      missingAcademyFeeCount += 1;
    } else if (lesson.feeSource === "current") {
      currentFeeLessonCount += 1;
    }

    revenues.push({
      academyId: lesson.academyId,
      lessonEventId: lesson.lessonEventId,
      teacherId: lesson.teacherId,
      studentId: lesson.studentId,
      studentName: lesson.studentName,
      instrumentName: lesson.instrumentName,
      lessonRevenue: lessonRevenue ?? 0,
      completedOn: toFinanceDate(lesson.startedAt),
    });
  }

  return {
    revenues,
    scheduledCount: monthLessons.filter(isRegularScheduledLesson).length,
    presentCount: presentLessons.filter((lesson) => lesson.lessonKind !== "private").length,
    privatePresentCount: presentLessons.filter((lesson) => lesson.lessonKind === "private").length,
    missingPrivateFeeCount,
    missingAcademyFeeCount,
    currentFeeLessonCount,
  };
}

function resolveLessonRevenue(
  lesson: PayrollLessonSource,
  context: {
    scheduledByEnrollment: Map<string, number>;
    presentByEnrollment: Map<string, number>;
    privateLessonFees: PrivateLessonFeeSource[];
  },
): number | undefined {
  if (lesson.lessonKind === "private") {
    return findPrivateLessonUnitFee(lesson, context.privateLessonFees);
  }

  const key = toCompletedLessonRevenueKey(lesson);
  const divisor = Math.max(
    context.scheduledByEnrollment.get(key) ?? 0,
    context.presentByEnrollment.get(key) ?? 0,
    1,
  );

  return lesson.monthlyLessonFee / divisor;
}

function findPrivateLessonUnitFee(
  lesson: PayrollLessonSource,
  fees: PrivateLessonFeeSource[],
): number | undefined {
  const lessonDate = toFinanceDate(lesson.startedAt);
  const latest = fees
    .filter(
      (fee) =>
        fee.studentId === lesson.studentId &&
        fee.instrumentName === lesson.instrumentName &&
        fee.grantedCount > 0 &&
        fee.paidAmount > 0 &&
        fee.registeredAt <= lessonDate &&
        fee.validUntil >= lessonDate,
    )
    .sort((left, right) => right.registeredAt.localeCompare(left.registeredAt))[0];

  return latest ? latest.paidAmount / latest.grantedCount : undefined;
}

/**
 * 선생님별 월 급여 행을 만든다. 같은 달 지급 완료된 정산이 있으면(급여 형태가 바뀌었어도) 그 정산을 보여 주고,
 * 없으면 급여 형태별로 계산한다. 설정이 비어 계산할 수 없는 선생님은 예외 대신 `issue`가 있는 0원 행으로 돌려준다.
 */
export function buildPayrollRows(input: {
  academyId: string;
  month: string;
  teachers: PayrollTeacher[];
  lessons: PayrollLessonSource[];
  privateLessonFees?: PrivateLessonFeeSource[];
  tuitionFees?: PayrollTuitionFee[];
  settlements?: PayrollRecord[];
}): PayrollRecord[] {
  const lessons = applyTuitionFees(input.lessons, input.tuitionFees);
  const monthLessonTeacherIds = new Set(
    lessons
      .filter(
        (lesson) =>
          lesson.academyId === input.academyId &&
          lesson.status === "present" &&
          readFinanceMonth(lesson.startedAt) === input.month,
      )
      .map((lesson) => lesson.teacherId),
  );
  const settlementTeacherIds = new Set(
    (input.settlements ?? [])
      .filter((settlement) => settlement.academyId === input.academyId && settlement.month === input.month)
      .map((settlement) => settlement.teacherId),
  );

  return input.teachers
    .filter((teacher) => teacher.academyId === input.academyId)
    .filter((teacher) =>
      isPayrollTeacherForMonth(teacher, input.month, {
        hasLessons: monthLessonTeacherIds.has(teacher.teacherId),
        hasSettlement: settlementTeacherIds.has(teacher.teacherId),
      }),
    )
    .map((teacher) => {
      const paidSettlement = input.settlements?.find(
        (settlement) =>
          settlement.academyId === input.academyId &&
          settlement.teacherId === teacher.teacherId &&
          settlement.month === input.month &&
          settlement.status === "paid",
      );

      return paidSettlement ?? buildTeacherPayrollRow({ ...input, lessons, teacher });
    });
}

/**
 * 그 달에 급여 행을 보여 줄 선생님: 정산 기록이나 등원 확인된 수업이 있으면 퇴사·휴직이어도 보여 주고,
 * 기록이 없으면 재직 중이면서 입사(계약 시작)한 달 이후일 때만 보여 준다.
 */
function isPayrollTeacherForMonth(
  teacher: PayrollTeacher,
  month: string,
  activity: { hasLessons: boolean; hasSettlement: boolean },
) {
  if (activity.hasLessons || activity.hasSettlement) {
    return true;
  }

  if (teacher.status !== undefined && teacher.status !== "employed") {
    return false;
  }

  const startedOn = teacher.contractStartOn ?? teacher.registeredAt;

  return !startedOn || startedOn.slice(0, 7) <= month;
}

/** 그 달 월 snapshot 금액을 학원 레슨의 월 수강료로 쓴다. snapshot이 없는 원생·악기는 수업에 붙은 현재 금액을 그대로 둔다. */
function applyTuitionFees(lessons: PayrollLessonSource[], fees: PayrollTuitionFee[] | undefined) {
  // snapshot을 읽지 않은 환경(데모)에서는 출처를 알 수 없으므로 손대지 않는다.
  if (!fees) {
    return lessons;
  }

  const amountByEnrollment = new Map(
    fees.map((fee) => [`${fee.studentId}:${fee.instrumentName}`, fee.amount] as const),
  );

  return lessons.map((lesson) => {
    const amount =
      lesson.lessonKind === "private"
        ? undefined
        : amountByEnrollment.get(`${lesson.studentId}:${lesson.instrumentName}`);

    if (lesson.lessonKind === "private") {
      return lesson;
    }

    return amount === undefined
      ? { ...lesson, feeSource: "current" as const }
      : { ...lesson, monthlyLessonFee: amount, feeSource: "snapshot" as const };
  });
}

function buildTeacherPayrollRow({
  academyId,
  lessons,
  month,
  privateLessonFees,
  teacher,
}: {
  academyId: string;
  lessons: PayrollLessonSource[];
  month: string;
  privateLessonFees?: PrivateLessonFeeSource[];
  teacher: PayrollTeacher;
}): PayrollRecord {
  const { withholdingTaxRate, rounding } = PAYROLL_POLICY;
  const identity = {
    academyId,
    teacherId: teacher.teacherId,
    teacherName: teacher.name,
    month,
    withholdingTaxRate,
    rounding,
  };

  if (teacher.payType === "monthly") {
    if (!teacher.monthlySalary || teacher.monthlySalary <= 0) {
      return buildIssuePayrollRow(identity, "monthly", "월 급여 설정을 확인해 주세요.");
    }

    return {
      ...calculateMonthlyPayroll({ ...identity, monthlySalary: teacher.monthlySalary }),
      basis: "월 고정 급여",
    };
  }

  if (teacher.payType === "hourly") {
    return buildHourlyPayrollRow(identity, teacher);
  }

  const analysis = analyzeLessonRevenues(
    lessons.filter((lesson) => lesson.teacherId === teacher.teacherId),
    { academyId, month, privateLessonFees },
    lessons,
  );

  const share = teacher.ratioTeacherShare;

  if (share === undefined || !Number.isInteger(share) || share < 0 || share > 100) {
    return buildIssuePayrollRow(identity, "ratio", "비율 설정을 확인해 주세요.");
  }

  const privateSuffix =
    analysis.privatePresentCount > 0 ? ` · 개인레슨 ${analysis.privatePresentCount}회` : "";

  return {
    ...calculateRatioPayroll(
      { ...identity, academyShareRatio: 100 - share, teacherShareRatio: share },
      analysis.revenues,
    ),
    basis: `등원 ${analysis.presentCount}회 / 예정 ${analysis.scheduledCount}회${privateSuffix}`,
    note: buildFeeNote(analysis),
  };
}

/** 시급제: 시급 × 선생님 출근 요일·시간을 그 달(계약 기간 안)에 펼친 근무 시간. 등원 확인 수업은 보지 않는다. */
function buildHourlyPayrollRow(
  identity: Pick<RatioPayrollPolicy, "academyId" | "teacherId" | "teacherName" | "month" | "withholdingTaxRate" | "rounding">,
  teacher: PayrollTeacher,
): PayrollRecord {
  if (!teacher.hourlyRate || teacher.hourlyRate <= 0) {
    return buildIssuePayrollRow(identity, "hourly", "시급 설정을 확인해 주세요.");
  }

  const work = calculateScheduledWorkMinutes({
    month: identity.month,
    schedules: teacher.workSchedules,
    contractStartOn: teacher.contractStartOn,
    contractEndOn: teacher.contractEndOn,
  });

  if (!work.ok) {
    return buildIssuePayrollRow(identity, "hourly", work.reason);
  }

  const basis = `근무 ${formatWorkDuration(work.minutes)} (출근 일정 기준)`;

  if (work.minutes <= 0) {
    return { ...buildEmptyPayrollRecord(identity, "hourly"), basis };
  }

  return {
    ...calculateHourlyPayroll({ ...identity, hourlyRate: teacher.hourlyRate, workedMinutes: work.minutes }),
    basis,
  };
}

function buildFeeNote(analysis: LessonRevenueAnalysis) {
  const notes = [
    analysis.missingAcademyFeeCount > 0
      ? `월 수강료를 찾지 못한 학원 레슨 ${analysis.missingAcademyFeeCount}건은 0원으로 계산했습니다.`
      : undefined,
    analysis.currentFeeLessonCount > 0
      ? `이 달 월 수강료 기록(월 snapshot)이 없어 현재 수강료로 계산한 학원 레슨 ${analysis.currentFeeLessonCount}건이 있습니다.`
      : undefined,
    analysis.missingPrivateFeeCount > 0
      ? `회차권 결제 금액을 찾지 못한 개인레슨 ${analysis.missingPrivateFeeCount}건은 계산에서 제외했습니다.`
      : undefined,
  ].filter((note): note is string => note !== undefined);

  return notes.length > 0 ? notes.join(" ") : undefined;
}

function buildEmptyPayrollRecord(
  identity: Pick<RatioPayrollPolicy, "academyId" | "teacherId" | "teacherName" | "month">,
  payType: PayrollRecord["payType"],
): PayrollRecord {
  return {
    academyId: identity.academyId,
    payrollId: `${identity.month}:${identity.teacherId}`,
    teacherId: identity.teacherId,
    teacherName: identity.teacherName,
    month: identity.month,
    payType,
    basePay: 0,
    withholdingTax: 0,
    netPay: 0,
    status: "pending",
    lessonEventIds: [],
  };
}

function buildIssuePayrollRow(
  identity: Pick<RatioPayrollPolicy, "academyId" | "teacherId" | "teacherName" | "month">,
  payType: PayrollRecord["payType"],
  issue: string,
): PayrollRecord {
  return { ...buildEmptyPayrollRecord(identity, payType), issue };
}

export function formatPayType(payType: PayrollRecord["payType"]) {
  const labels: Record<PayrollRecord["payType"], string> = {
    monthly: "월급제",
    hourly: "시급제",
    ratio: "비율제",
  };

  return labels[payType];
}

function readFinanceMonth(value: string) {
  try {
    return toFinanceMonth(value);
  } catch {
    return undefined;
  }
}

export function calculateMonthlyPayroll(
  policy: MonthlyPayrollPolicy,
): PayrollRecord {
  validateBasePayrollPolicy(policy);

  if (!Number.isInteger(policy.monthlySalary) || policy.monthlySalary <= 0) {
    throw new Error("월급제 급여는 1 이상의 월 고정 급여가 필요합니다.");
  }

  return buildPayrollRecord(policy, {
    payType: "monthly",
    basePay: policy.monthlySalary,
    lessonEventIds: [],
  });
}

export function calculateHourlyPayroll(policy: HourlyPayrollPolicy): PayrollRecord {
  validateBasePayrollPolicy(policy);

  if (!Number.isInteger(policy.hourlyRate) || policy.hourlyRate <= 0) {
    throw new Error("시급제 급여는 1 이상의 시급이 필요합니다.");
  }

  if (policy.workedMinutes <= 0) {
    throw new Error("시급제 급여는 0보다 큰 근무 시간이 필요합니다.");
  }

  if (!Number.isInteger(policy.workedMinutes)) {
    throw new Error("근무 시간은 분 단위 정수여야 합니다.");
  }

  return buildPayrollRecord(policy, {
    payType: "hourly",
    basePay: applyRounding(roundPrecision((policy.hourlyRate * policy.workedMinutes) / MINUTES_PER_HOUR), policy.rounding),
    lessonEventIds: [],
  });
}

function buildPayrollRecord(
  policy: Pick<
    RatioPayrollPolicy,
    | "academyId"
    | "teacherId"
    | "teacherName"
    | "month"
    | "withholdingTaxRate"
    | "rounding"
  >,
  result: {
    payType: PayrollRecord["payType"];
    basePay: number;
    lessonEventIds: string[];
  },
): PayrollRecord {
  const withholdingTax = applyRounding(
    roundPrecision(result.basePay * policy.withholdingTaxRate),
    policy.rounding,
  );

  return {
    academyId: policy.academyId,
    payrollId: `${policy.month}:${policy.teacherId}`,
    teacherId: policy.teacherId,
    teacherName: policy.teacherName,
    month: policy.month,
    payType: result.payType,
    basePay: result.basePay,
    withholdingTax,
    netPay: result.basePay - withholdingTax,
    status: "pending",
    lessonEventIds: result.lessonEventIds,
  };
}

function validateRatioPolicy(policy: RatioPayrollPolicy) {
  if (policy.academyShareRatio + policy.teacherShareRatio !== 100) {
    throw new Error("학원과 선생님 비율의 합은 100이어야 합니다.");
  }

  validateBasePayrollPolicy(policy);
}

function validateBasePayrollPolicy(
  policy: Pick<RatioPayrollPolicy, "withholdingTaxRate">,
) {
  if (policy.withholdingTaxRate < 0) {
    throw new Error("원천징수율은 0 이상이어야 합니다.");
  }
}

/** 부동소수점 오차(84000.00000000001, 83999.99999999999)가 내림·올림 결과를 바꾸지 않게 소수 6자리로 맞춘다. */
function roundPrecision(amount: number) {
  return Math.round(amount * 1_000_000) / 1_000_000;
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

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

function toCompletedLessonRevenueKey(lesson: PayrollLessonSource) {
  return `${lesson.studentId}:${lesson.instrumentName}`;
}

/** 1회 레슨비를 나누는 "정규 예정 수업": 정규·이동 학원 수업. 수동·특별·보강 수업은 넣지 않는다. */
function isRegularScheduledLesson(lesson: PayrollLessonSource) {
  return (
    lesson.lessonKind === "academy" &&
    (lesson.origin === undefined || lesson.origin === "regular" || lesson.origin === "rescheduled")
  );
}

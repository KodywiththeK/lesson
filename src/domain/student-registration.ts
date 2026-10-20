import type {
  AcademyLessonEnrollment,
  Weekday,
} from "./academy-lesson-schedule";
import type { StudentDiscountKind } from "./lesson-pricing";

export type LessonType = "academy" | "private";

export type DiscountType = "sibling" | "multi-instrument" | "referral" | "manual";

export type StudentGuardianInput = {
  relationship: string;
  phone: string;
};

export type StudentInstrumentInput = {
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  lessonType: LessonType;
  weekdays: Weekday[];
  weeklySchedules?: StudentInstrumentWeeklyScheduleInput[];
  startTime?: string;
  endTime?: string;
  progress: string;
  lessonFee: number;
  discountLabel?: string;
  discounts: Array<{
    type: DiscountType;
    label: string;
    amount: number;
  }>;
  finalMonthlyFee: number;
};

/**
 * 악기별 할인 선택. 등록 폼 → API → 서버로만 전달하는 선택 필드이며, 데모 상태는 무시해도 동작한다.
 * `referralDiscountMonth`는 지인 소개 할인을 적용하는 달 `YYYY-MM`이다.
 */
export type StudentInstrumentDiscountSelection = {
  discountKinds?: StudentDiscountKind[];
  referralDiscountMonth?: string;
  referralDiscountAmount?: number;
};

export type StudentInstrumentWeeklyScheduleInput = {
  weekday: Weekday;
  startTime?: string;
  endTime?: string;
};

export function getAcademyScheduleValidationError(input: {
  lessonType: LessonType;
  teacherId?: string | null;
  weeklySchedules: ReadonlyArray<{ startTime?: string; endTime?: string }>;
}): string | null {
  if (input.lessonType !== "academy") {
    return null;
  }
  if (!input.teacherId?.trim()) {
    return "학원레슨 선생님을 선택해야 합니다.";
  }
  if (input.weeklySchedules.length === 0) {
    return "학원레슨 요일을 선택해야 합니다.";
  }
  if (input.weeklySchedules.some(({ startTime, endTime }) => Boolean(startTime) !== Boolean(endTime))) {
    return "시작 시간과 종료 시간을 함께 입력해 주세요.";
  }
  if (input.weeklySchedules.some(({ startTime, endTime }) =>
    Boolean(startTime && endTime && endTime <= startTime)
  )) {
    return "학원레슨 종료 시간은 시작 시간보다 늦어야 합니다.";
  }
  return null;
}

export type RegisterStudentInput = {
  academyId: string;
  studentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  attendanceCode?: string;
  registeredAt: string;
  guardians: StudentGuardianInput[];
  instruments: StudentInstrumentInput[];
};

export type StudentRecord = {
  academyId: string;
  studentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  attendanceCode?: string;
  registeredAt: string;
  status: "enrolled";
  guardians: StudentGuardianInput[];
};

export type StudentEnrollment = {
  academyId: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  registeredOn?: string;
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  lessonType: LessonType;
  active: true;
  weekdays: Weekday[];
  weeklySchedules: StudentInstrumentWeeklyScheduleInput[];
  startTime?: string;
  endTime?: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  finalMonthlyFee: number;
};

export type FixedIncomeSource = {
  academyId: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  instrumentId: string;
  instrumentName: string;
  monthlyAmount: number;
  registeredOn: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  progress: string;
  effectiveFrom: string;
};

export type RegisterStudentResult = {
  student: StudentRecord;
  enrollments: StudentEnrollment[];
  scheduleSources: AcademyLessonEnrollment[];
  fixedIncomeSources: FixedIncomeSource[];
};

export function registerStudent(input: RegisterStudentInput): RegisterStudentResult {
  if (input.instruments.length === 0) {
    throw new Error("하나 이상의 수강 악기가 필요합니다.");
  }

  const enrollments = input.instruments.map((instrument) =>
    createEnrollment(input, instrument),
  );

  return {
    student: {
      academyId: input.academyId,
      studentId: input.studentId,
      name: input.name,
      age: input.age,
      grade: input.grade,
      school: input.school,
      occupation: input.occupation,
      attendanceCode: input.attendanceCode,
      registeredAt: input.registeredAt,
      status: "enrolled",
      guardians: input.guardians,
    },
    enrollments,
    scheduleSources: enrollments
      .filter((enrollment) => enrollment.lessonType === "academy")
      .flatMap(toScheduleSource),
    fixedIncomeSources: enrollments
      .filter(
        (enrollment) =>
          enrollment.lessonType === "academy" && enrollment.finalMonthlyFee > 0,
      )
      .map((enrollment) => ({
        academyId: enrollment.academyId,
        studentId: enrollment.studentId,
        studentName: enrollment.studentName,
        enrollmentId: enrollment.enrollmentId,
        instrumentId: enrollment.instrumentId,
        instrumentName: enrollment.instrumentName,
        monthlyAmount: enrollment.finalMonthlyFee,
        registeredOn: input.registeredAt,
        lessonFee: enrollment.lessonFee,
        discountTotal: enrollment.discountTotal,
        discountLabel: enrollment.discountLabel,
        progress: enrollment.progress,
        effectiveFrom: toMonth(input.registeredAt),
      })),
  };
}

function createEnrollment(
  input: RegisterStudentInput,
  instrument: StudentInstrumentInput,
): StudentEnrollment {
  const weeklySchedules = normalizeWeeklySchedules(instrument);

  validateInstrument(instrument, weeklySchedules);

  const discountTotal = instrument.discounts.reduce(
    (total, discount) => total + discount.amount,
    0,
  );

  if (instrument.lessonFee - discountTotal !== instrument.finalMonthlyFee) {
    throw new Error("최종 수강료가 레슨비와 할인 합계와 일치하지 않습니다.");
  }

  return {
    academyId: input.academyId,
    enrollmentId: `${input.studentId}:${instrument.instrumentId}`,
    studentId: input.studentId,
    studentName: input.name,
    instrumentId: instrument.instrumentId,
    instrumentName: instrument.instrumentName,
    teacherId: instrument.teacherId,
    teacherName: instrument.teacherName,
    lessonType: instrument.lessonType,
    active: true,
    weekdays: weeklySchedules.map((schedule) => schedule.weekday),
    weeklySchedules,
    startTime: instrument.startTime,
    endTime: instrument.endTime,
    progress: instrument.progress,
    lessonFee: instrument.lessonFee,
    discountTotal,
    discountLabel: instrument.discountLabel,
    finalMonthlyFee: instrument.finalMonthlyFee,
  };
}

function validateInstrument(
  instrument: StudentInstrumentInput,
  weeklySchedules: StudentInstrumentWeeklyScheduleInput[],
) {
  if (instrument.lessonFee < 0 || instrument.finalMonthlyFee < 0) {
    throw new Error("수강료는 0 이상이어야 합니다.");
  }

  if (instrument.discounts.some((discount) => discount.amount < 0)) {
    throw new Error("할인 금액은 0 이상이어야 합니다.");
  }

  if (instrument.lessonType !== "academy") {
    return;
  }
  const scheduleError = getAcademyScheduleValidationError({
    lessonType: instrument.lessonType,
    teacherId: instrument.teacherId,
    weeklySchedules,
  });
  if (scheduleError) throw new Error(scheduleError);
}

function toScheduleSource(enrollment: StudentEnrollment): AcademyLessonEnrollment[] {
  return enrollment.weeklySchedules.map((schedule) => ({
    academyId: enrollment.academyId,
    enrollmentId: `${enrollment.enrollmentId}:${schedule.weekday}`,
    studentId: enrollment.studentId,
    studentName: enrollment.studentName,
    instrumentId: enrollment.instrumentId,
    instrumentName: enrollment.instrumentName,
    lessonType: "academy",
    active: true,
    weekdays: [schedule.weekday],
    startTime: schedule.startTime ?? "",
    endTime: schedule.endTime ?? "",
  }));
}

function normalizeWeeklySchedules(
  instrument: StudentInstrumentInput,
): StudentInstrumentWeeklyScheduleInput[] {
  const sourceSchedules =
    instrument.weeklySchedules && instrument.weeklySchedules.length > 0
      ? instrument.weeklySchedules
      : instrument.weekdays.map((weekday) => ({
          weekday,
          startTime: instrument.startTime,
          endTime: instrument.endTime,
        }));

  return sourceSchedules.map((schedule) => ({
    weekday: schedule.weekday,
    startTime: schedule.startTime?.trim() || undefined,
    endTime: schedule.endTime?.trim() || undefined,
  }));
}

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    throw new Error("등록일은 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

/** 홍길동a, 홍길동b처럼 이름 뒤에 붙이는 한 글자 영문 구분 접미사. 앞 글자가 영문이면 이름의 일부로 본다. */
const NAME_SUFFIX_PATTERN = /^(.*[^A-Za-z\s])([A-Za-z])$/;

/**
 * 같은 이름의 원생이 이미 있어 구분(홍길동a, 홍길동b)이 필요한지 판단한다.
 * 접미사를 뺀 이름이 같더라도 서로 다른 접미사로 이미 구분했으면 false다.
 */
export function hasSameStudentName(name: string, existingNames: readonly string[]): boolean {
  const target = splitNameSuffix(name);

  if (!target.base) {
    return false;
  }

  return existingNames.some((existingName) => {
    const existing = splitNameSuffix(existingName);
    const distinguished =
      target.suffix !== "" && existing.suffix !== "" && target.suffix !== existing.suffix;

    return existing.base === target.base && !distinguished;
  });
}

function splitNameSuffix(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
  const match = normalized.match(NAME_SUFFIX_PATTERN);

  return match ? { base: match[1].trim(), suffix: match[2] } : { base: normalized, suffix: "" };
}

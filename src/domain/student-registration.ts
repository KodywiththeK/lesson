import type {
  AcademyLessonEnrollment,
  Weekday,
} from "./academy-lesson-schedule";

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
  startTime?: string;
  endTime?: string;
  progress: string;
  lessonFee: number;
  discounts: Array<{
    type: DiscountType;
    label: string;
    amount: number;
  }>;
  finalMonthlyFee: number;
};

export type RegisterStudentInput = {
  academyId: string;
  studentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
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
  registeredAt: string;
  status: "enrolled";
  guardians: StudentGuardianInput[];
};

export type StudentEnrollment = {
  academyId: string;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  lessonType: LessonType;
  active: true;
  weekdays: Weekday[];
  startTime?: string;
  endTime?: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
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
      registeredAt: input.registeredAt,
      status: "enrolled",
      guardians: input.guardians,
    },
    enrollments,
    scheduleSources: enrollments
      .filter((enrollment) => enrollment.lessonType === "academy")
      .map(toScheduleSource),
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
        effectiveFrom: toMonth(input.registeredAt),
      })),
  };
}

function createEnrollment(
  input: RegisterStudentInput,
  instrument: StudentInstrumentInput,
): StudentEnrollment {
  validateInstrument(instrument);

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
    weekdays: instrument.weekdays,
    startTime: instrument.startTime,
    endTime: instrument.endTime,
    progress: instrument.progress,
    lessonFee: instrument.lessonFee,
    discountTotal,
    finalMonthlyFee: instrument.finalMonthlyFee,
  };
}

function validateInstrument(instrument: StudentInstrumentInput) {
  if (instrument.lessonFee < 0 || instrument.finalMonthlyFee < 0) {
    throw new Error("수강료는 0 이상이어야 합니다.");
  }

  if (instrument.discounts.some((discount) => discount.amount < 0)) {
    throw new Error("할인 금액은 0 이상이어야 합니다.");
  }

  if (instrument.lessonType !== "academy") {
    return;
  }

  if (instrument.weekdays.length === 0) {
    throw new Error("학원 수업은 하나 이상의 수업 요일이 필요합니다.");
  }

  if (!instrument.startTime || !instrument.endTime) {
    throw new Error("학원 수업은 시작 시간과 종료 시간이 필요합니다.");
  }
}

function toScheduleSource(enrollment: StudentEnrollment): AcademyLessonEnrollment {
  return {
    academyId: enrollment.academyId,
    enrollmentId: enrollment.enrollmentId,
    studentId: enrollment.studentId,
    studentName: enrollment.studentName,
    instrumentId: enrollment.instrumentId,
    instrumentName: enrollment.instrumentName,
    lessonType: "academy",
    active: true,
    weekdays: enrollment.weekdays,
    startTime: enrollment.startTime ?? "",
    endTime: enrollment.endTime ?? "",
  };
}

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})/);

  if (!match) {
    throw new Error("등록일은 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

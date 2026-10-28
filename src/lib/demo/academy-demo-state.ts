import {
  buildDailyAcademyAttendance,
  DEFAULT_ABSENCE_REASON,
  type DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import {
  generateAcademyLessonEvents,
  type Weekday,
} from "@/domain/academy-lesson-schedule";
import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import type { LessonTicketIncomeRegistration } from "@/domain/lesson-ticket-income";
import {
  DEFAULT_LESSON_TICKET_REFUND_POLICY,
  type LessonTicketRefundPolicy,
} from "@/domain/lesson-ticket-refund";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import {
  adjustLessonTicket,
  applyAttendanceToTicket,
  applyLessonTicketRegistration,
  type LessonTicketListItem,
  type LessonTicketUsage,
} from "@/domain/lesson-ticket";
import type { PrivateLesson, PrivateLessonStatus } from "@/domain/private-lesson";
import {
  registerStudent,
  type LessonType,
  type StudentEnrollment,
} from "@/domain/student-registration";
import type { StudentListRow } from "@/domain/student-list";
import type { TeacherListRow } from "@/domain/teacher-list";
import {
  formatTeacherSalarySummary,
  formatTeacherWorkScheduleSummary,
  type TeacherWorkSchedule,
} from "@/domain/teacher-list";
import type {
  TeacherPayType,
  TeacherStatus,
  TeacherWorkScheduleInput,
} from "@/domain/teacher";
import {
  buildTeacherSalarySetting,
  normalizeWorkSchedules,
} from "@/domain/teacher";
import type { ConsultationProfile } from "@/domain/consultation";
import type { ConsultationListRow } from "@/domain/consultation-list";
import { registerVendor } from "@/domain/vendor";
import type { VendorListRow } from "@/domain/vendor-list";
import type {
  AdjustLessonTicketInput,
  AdjustLessonTicketResult,
  RegisterLessonTicketInput,
  RegisterLessonTicketResult,
} from "@/lib/api/lesson-tickets";

import { demoLessonWorkspaceData } from "./lesson-demo-data";
import {
  demoAcademyId,
  demoBooks,
  demoBookSales,
  demoConsultations,
  demoLedgerEntries,
  demoStudents,
  demoTeachers,
  demoTickets,
  demoVendors,
  type DemoBook,
} from "./management-demo-data";

export type DemoAcademyState = {
  academyId: string;
  academyName: string;
  students: StudentListRow[];
  teachers: TeacherListRow[];
  enrollments: StudentEnrollment[];
  tickets: LessonTicketListItem[];
  ticketRegistrations: LessonTicketIncomeRegistration[];
  ticketUsages: LessonTicketUsage[];
  ledgerEntries: LedgerEntry[];
  academySheets: Record<string, DailyAcademyAttendanceSheet>;
  privateLessons: PrivateLesson[];
  vendors: VendorListRow[];
  consultations: ConsultationListRow[];
  books: DemoBook[];
  bookSales: typeof demoBookSales;
  /** 학원 설정. 회차권을 삭제(환불 처리)할 때 적용하는 규정이다. */
  lessonTicketRefundPolicy: LessonTicketRefundPolicy;
};

export type DemoStudentRegistrationInput = {
  name: string;
  registeredAt: string;
  age?: number;
  birthYear?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  contact: {
    relationship: string;
    phone: string;
  };
  secondaryContact?: { relationship: string; phone: string };
  instruments: DemoStudentRegistrationInstrumentInput[];
};

export type DemoStudentRegistrationInstrumentInput = {
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  lessonType: LessonType;
  sessionsPerMonth?: number;
  lessonDurationMinutes?: number;
  weeklySchedules: Array<{
    weekday: Weekday | string;
    startTime?: string;
    endTime?: string;
  }>;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  finalMonthlyFee: number;
};

export type DemoStudentStatusInput = {
  academyId: string;
  studentId: string;
  status: "enrolled" | "suspended" | "withdrawn";
  changedAt?: string;
  reason?: string;
};

export type DemoTeacherRegistrationInput = {
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  contractStartOn: string;
  contractEndOn: string;
  payType: TeacherPayType;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioAcademyShare?: number;
  ratioTeacherShare?: number;
  workSchedules?: TeacherWorkScheduleInput[];
};

export type DemoTeacherUpdateInput = DemoTeacherRegistrationInput & {
  academyId: string;
  teacherId: string;
};

export type DemoTeacherStatusInput = {
  academyId: string;
  teacherId: string;
  status: TeacherStatus;
  changedAt?: string;
  reason?: string;
};

export type MarkDemoPrivateLessonAttendanceInput = {
  lessonId: string;
  status: Exclude<PrivateLessonStatus, "scheduled" | "cancelled" | "makeup">;
  markedAt: string;
  /** 결석 사유(선택). 비우면 기본 문구(결석 확인). 출석 처리에서는 무시한다. */
  reason?: string;
};

export type DemoManualLedgerInput = {
  occurredOn: string;
  type: LedgerEntry["type"];
  category?: LedgerCategory;
  amount: number;
  description: string;
};

export type DemoVendorRegistrationInput = {
  name: string;
  contact: string;
  kind: string;
  memo: string;
};

export type DemoVendorUpdateInput = DemoVendorRegistrationInput & {
  vendorId: string;
};

export type DemoConsultationInput = ConsultationProfile;

export type DemoConsultationUpdateInput = DemoConsultationInput & {
  consultationId: string;
};

const initialEnrollments: StudentEnrollment[] = [
  {
    academyId: demoAcademyId,
    enrollmentId: "student-1:piano",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    teacherId: "teacher-1",
    teacherName: "김하늘",
    lessonType: "academy",
    active: true,
    weekdays: ["monday", "wednesday", "friday"],
    weeklySchedules: [
      { weekday: "monday", startTime: "15:00", endTime: "15:50" },
      { weekday: "wednesday", startTime: "15:00", endTime: "15:50" },
      { weekday: "friday", startTime: "15:00", endTime: "15:50" },
    ],
    startTime: "15:00",
    endTime: "15:50",
    progress: "체르니 100",
    lessonFee: 150000,
    discountTotal: 10000,
    finalMonthlyFee: 140000,
  },
  {
    academyId: demoAcademyId,
    enrollmentId: "student-2:piano",
    studentId: "student-2",
    studentName: "이서윤",
    instrumentId: "piano",
    instrumentName: "피아노",
    teacherId: "teacher-1",
    teacherName: "김하늘",
    lessonType: "academy",
    active: true,
    weekdays: ["tuesday", "friday"],
    weeklySchedules: [
      { weekday: "tuesday", startTime: "16:00", endTime: "16:50" },
      { weekday: "friday", startTime: "16:00", endTime: "16:50" },
    ],
    startTime: "16:00",
    endTime: "16:50",
    progress: "바이엘 하권",
    lessonFee: 150000,
    discountTotal: 0,
    finalMonthlyFee: 150000,
  },
  {
    academyId: demoAcademyId,
    enrollmentId: "student-3:piano",
    studentId: "student-3",
    studentName: "박지호",
    instrumentId: "piano",
    instrumentName: "피아노",
    teacherId: "teacher-1",
    teacherName: "김하늘",
    lessonType: "academy",
    active: true,
    weekdays: ["friday"],
    weeklySchedules: [
      { weekday: "friday", startTime: "17:00", endTime: "17:50" },
    ],
    startTime: "17:00",
    endTime: "17:50",
    progress: "소나티네",
    lessonFee: 150000,
    discountTotal: 0,
    finalMonthlyFee: 150000,
  },
  {
    academyId: demoAcademyId,
    enrollmentId: "student-4:violin",
    studentId: "student-4",
    studentName: "한서아",
    instrumentId: "violin",
    instrumentName: "바이올린",
    teacherId: "teacher-2",
    teacherName: "오유진",
    lessonType: "private",
    sessionsPerMonth: 4,
    lessonDurationMinutes: 40,
    active: true,
    weekdays: ["friday"],
    weeklySchedules: [
      { weekday: "friday", startTime: "18:00", endTime: "18:50" },
    ],
    startTime: "18:00",
    endTime: "18:50",
    progress: "스즈키 1권",
    lessonFee: 0,
    discountTotal: 0,
    finalMonthlyFee: 0,
  },
  {
    academyId: demoAcademyId,
    enrollmentId: "student-6:cello",
    studentId: "student-6",
    studentName: "최도윤",
    instrumentId: "cello",
    instrumentName: "첼로",
    teacherId: "teacher-3",
    teacherName: "문서준",
    lessonType: "private",
    sessionsPerMonth: 4,
    lessonDurationMinutes: 40,
    active: true,
    weekdays: ["saturday"],
    weeklySchedules: [
      { weekday: "saturday", startTime: "10:30", endTime: "11:20" },
    ],
    startTime: "10:30",
    endTime: "11:20",
    progress: "활쓰기 기초",
    lessonFee: 0,
    discountTotal: 0,
    finalMonthlyFee: 0,
  },
];

export function createInitialDemoAcademyState(): DemoAcademyState {
  const initialTicketRegistrations = demoTickets.map((ticket) => ({
    registrationId: `registration-${ticket.ticketId}`,
    academyId: ticket.academyId,
    ticketId: ticket.ticketId,
    registeredAt: ticket.registeredAt,
    grantedCount: ticket.totalGrantedCount,
    validUntil: ticket.validUntil,
    originalPaidAmount: ticket.paidAmount ?? 0,
    ledgerEntryId: ticket.paidAmount ? `ledger-${ticket.ticketId}` : null,
  }));
  const initialTicketLedgerEntries: LedgerEntry[] = demoTickets
    .filter((ticket) => (ticket.paidAmount ?? 0) > 0)
    .map((ticket) => ({
      academyId: ticket.academyId,
      ledgerId: `ledger-${ticket.ticketId}`,
      occurredOn: ticket.registeredAt,
      type: "income",
      source: "lesson-ticket",
      category: "lesson-ticket",
      amount: ticket.paidAmount!,
      description: `${ticket.studentName} ${ticket.instrumentName} 회차권`,
      refId: ticket.ticketId,
    }));
  return {
    academyId: demoAcademyId,
    academyName: "더 클래식",
    students: [...demoStudents],
    teachers: [...demoTeachers],
    enrollments: [...initialEnrollments],
    tickets: [...demoTickets],
    ticketRegistrations: initialTicketRegistrations,
    ticketUsages: [],
    ledgerEntries: [...demoLedgerEntries, ...initialTicketLedgerEntries],
    academySheets: mergeSheets(
      buildAcademySheets(initialEnrollments, demoAcademyId, "2026-08"),
      indexSheets(demoLessonWorkspaceData.academySheets),
    ),
    privateLessons: [...demoLessonWorkspaceData.privateLessons],
    vendors: [...demoVendors],
    consultations: [...demoConsultations],
    books: demoBooks.map((book) => ({ ...book })),
    bookSales: [...demoBookSales],
    lessonTicketRefundPolicy: DEFAULT_LESSON_TICKET_REFUND_POLICY,
  };
}

export function registerDemoAcademyStudent(
  state: DemoAcademyState,
  input: DemoStudentRegistrationInput,
): DemoAcademyState {
  const studentId = `student-demo-${state.students.length + 1}`;
  const attendanceCode = `${getPhoneLast4(input.contact.phone) ?? "0000"}${String(
    state.students.length + 1,
  ).padStart(4, "0")}`;
  const registration = registerStudent({
    academyId: state.academyId,
    studentId,
    name: input.name,
    age: input.age,
    birthYear: input.birthYear,
    grade: input.grade,
    school: input.school,
    occupation: input.occupation,
    attendanceCode,
    registeredAt: input.registeredAt,
    guardians: [
      {
        relationship: input.contact.relationship,
        phone: input.contact.phone,
      },
    ],
    instruments: input.instruments.map((instrument) => ({
      instrumentId: instrument.instrumentId,
      instrumentName: instrument.instrumentName,
      teacherId: instrument.teacherId,
      teacherName: instrument.teacherName,
      lessonType: instrument.lessonType,
      sessionsPerMonth: instrument.sessionsPerMonth,
      lessonDurationMinutes: instrument.lessonDurationMinutes,
      weekdays: instrument.weeklySchedules.map((schedule) =>
        toWeekdayValue(schedule.weekday),
      ),
      weeklySchedules: instrument.weeklySchedules.map((schedule) => ({
        weekday: toWeekdayValue(schedule.weekday),
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })),
      progress: instrument.progress,
      lessonFee: instrument.lessonFee,
      discountLabel: instrument.discountLabel,
      discounts:
        instrument.discountTotal > 0
          ? [
              {
                type: "manual",
                label: instrument.discountLabel || "직접입력",
                amount: instrument.discountTotal,
              },
            ]
          : [],
      finalMonthlyFee: instrument.finalMonthlyFee,
    })),
  });
  const enrollments = [...state.enrollments, ...registration.enrollments];
  const academySheets = mergeSheets(
    state.academySheets,
    buildAcademySheets(enrollments, state.academyId, input.registeredAt.slice(0, 7)),
  );

  return {
    ...state,
    students: [
      ...state.students,
      {
        academyId: state.academyId,
        studentId,
        name: input.name,
        age: input.age,
        birthYear: input.birthYear,
        grade: input.grade,
        school: input.school,
        occupation: input.occupation,
        registeredOn: input.registeredAt,
        status: "enrolled",
        attendanceCode,
        contacts: [
          {
            contactId: `contact-demo-${studentId}`,
            relationship: input.contact.relationship,
            phone: input.contact.phone,
            phoneLast4: getPhoneLast4(input.contact.phone),
          },
          ...(input.secondaryContact ? [{
            contactId: `contact-demo-${studentId}-secondary`,
            relationship: input.secondaryContact.relationship,
            phone: input.secondaryContact.phone,
            phoneLast4: getPhoneLast4(input.secondaryContact.phone),
          }] : []),
        ],
        teacherNames: uniqueNonEmpty(input.instruments.map((item) => item.teacherName)),
        instrumentNames: uniqueNonEmpty(input.instruments.map((item) => item.instrumentName)),
        weekdayLabels: uniqueNonEmpty(
          input.instruments.flatMap((item) =>
            item.weeklySchedules.map((schedule) => formatWeekday(schedule.weekday)),
          ),
        ),
        instruments: input.instruments.map((instrument, index) => ({
          studentInstrumentId: `${studentId}:${instrument.instrumentId}:${index}`,
          teacherId: instrument.teacherId,
          teacherName: instrument.teacherName,
          instrumentId: instrument.instrumentId,
          instrumentName: instrument.instrumentName,
          lessonType: instrument.lessonType,
          sessionsPerMonth: instrument.sessionsPerMonth,
          lessonDurationMinutes: instrument.lessonDurationMinutes,
          weekdayLabels: instrument.weeklySchedules.map((schedule) =>
            formatWeekday(schedule.weekday),
          ),
          startTime: instrument.weeklySchedules[0]?.startTime ?? "",
          endTime: instrument.weeklySchedules[0]?.endTime ?? "",
          progress: instrument.progress,
          lessonFee: instrument.lessonFee,
          discountTotal: instrument.discountTotal,
          discountLabel: instrument.discountLabel,
          finalMonthlyFee: instrument.finalMonthlyFee,
          active: true,
          weeklySchedules: instrument.weeklySchedules.map((schedule) => ({
            weekday: toWeekdayValue(schedule.weekday),
            weekdayLabel: formatWeekday(schedule.weekday),
            startTime: schedule.startTime ?? "",
            endTime: schedule.endTime ?? "",
          })),
        })),
      },
    ],
    enrollments,
    academySheets,
    ledgerEntries: [
      ...state.ledgerEntries,
      ...registration.fixedIncomeSources.map((source) => ({
        academyId: state.academyId,
        ledgerId: `ledger-demo-${source.studentId}-${source.instrumentId}`,
        occurredOn: `${source.effectiveFrom}-01`,
        type: "income" as const,
          source: "tuition" as const,
          category: "tuition" as const,
          amount: source.monthlyAmount,
        description: `${source.studentName} ${source.effectiveFrom} ${source.instrumentName} 수강료`,
        refId: source.enrollmentId,
      })),
    ],
  };
}

export function updateDemoStudentStatus(
  state: DemoAcademyState,
  input: DemoStudentStatusInput,
): DemoAcademyState {
  const changedAt = input.changedAt ?? new Date().toISOString();

  return {
    ...state,
    students: state.students.map((student) =>
      student.studentId === input.studentId
        ? {
            ...student,
            status: input.status,
            suspendedAt:
              input.status === "suspended" ? changedAt : undefined,
            withdrawnAt:
              input.status === "withdrawn" ? changedAt : undefined,
            retentionUntil:
              input.status === "withdrawn"
                ? calculateRetentionUntil(changedAt)
                : undefined,
            archivedAt: undefined,
            statusReason: input.reason?.trim() || undefined,
          }
        : student,
    ),
    enrollments: state.enrollments,
  };
}

export function registerDemoAcademyTeacher(
  state: DemoAcademyState,
  input: DemoTeacherRegistrationInput,
): DemoAcademyState {
  const teacherId = `teacher-demo-${state.teachers.length + 1}`;
  const row = buildDemoTeacherListRow(state.academyId, teacherId, input);

  return {
    ...state,
    teachers: [...state.teachers, row],
  };
}

export function updateDemoAcademyTeacher(
  state: DemoAcademyState,
  input: DemoTeacherUpdateInput,
): DemoAcademyState {
  return {
    ...state,
    teachers: state.teachers.map((teacher) =>
      teacher.teacherId === input.teacherId
        ? {
            ...buildDemoTeacherListRow(input.academyId, input.teacherId, input),
            status: teacher.status ?? "employed",
          }
        : teacher,
    ),
  };
}

export function updateDemoTeacherStatus(
  state: DemoAcademyState,
  input: DemoTeacherStatusInput,
): DemoAcademyState {
  const changedAt = input.changedAt ?? new Date().toISOString();

  return {
    ...state,
    teachers: state.teachers.map((teacher) =>
      teacher.academyId === input.academyId &&
      teacher.teacherId === input.teacherId
        ? {
            ...teacher,
            status: input.status,
            onLeaveAt:
              input.status === "on_leave" ? changedAt : undefined,
            resignedAt:
              input.status === "resigned" ? changedAt : undefined,
            retentionUntil:
              input.status === "resigned"
                ? calculateRetentionUntil(changedAt)
                : undefined,
            archivedAt: undefined,
            statusReason: input.reason?.trim() || undefined,
          }
        : teacher,
    ),
  };
}

function calculateRetentionUntil(changedAt: string) {
  const date = new Date(`${changedAt.slice(0, 10)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 30);

  return date.toISOString().slice(0, 10);
}

export function registerDemoLessonTicket(
  state: DemoAcademyState,
  input: RegisterLessonTicketInput,
): { state: DemoAcademyState; result: RegisterLessonTicketResult } {
  if (input.isService ? (input.paidAmount ?? 0) !== 0 : !input.paidAmount || input.paidAmount <= 0) {
    throw new Error("결제 금액을 입력하거나 서비스로 지급하기를 선택해 주세요.");
  }
  const existingTicket = state.tickets
    .filter((ticket) => ticket.studentId === input.studentId && ticket.instrumentId === input.instrumentId)
    .sort((left, right) => right.registeredAt.localeCompare(left.registeredAt))[0];
  const registered = applyLessonTicketRegistration(existingTicket, {
    academyId: state.academyId,
    studentId: input.studentId,
    instrumentId: input.instrumentId,
    grantedCount: input.grantedCount,
    validDays: input.validDays,
    registeredAt: input.registeredAt,
  });
  const studentName =
    existingTicket?.studentName ??
    state.students.find((student) => student.studentId === input.studentId)?.name ??
    "이름 없음";
  const paidAmount = input.paidAmount ?? 0;
  const ticket: LessonTicketListItem = {
    ...registered.ticket,
    ticketId: `ticket-demo-${crypto.randomUUID()}`,
    studentName,
    instrumentName: input.instrumentName,
    paidAmount,
    paidAt: paidAmount > 0 ? input.registeredAt : undefined,
    serviceTotalCount: input.isService ? input.grantedCount : 0,
    serviceRemainingCount: input.isService ? input.grantedCount : 0,
  };
  const tickets = [...state.tickets, ticket];
  const ledgerId = paidAmount > 0
    ? `ledger-ticket-${ticket.ticketId}-${state.ticketRegistrations.length + 1}`
    : null;
  const ledgerEntries =
    paidAmount > 0
      ? buildFinanceLedgerList(
          [
            ...state.ledgerEntries,
            {
              academyId: state.academyId,
              ledgerId: ledgerId!,
              occurredOn: input.registeredAt,
              type: "income",
              source: "lesson-ticket",
              category: "lesson-ticket",
              amount: paidAmount,
              description: `${studentName} ${input.instrumentName} 회차권 ${input.grantedCount}회 구매`,
              refId: ticket.ticketId,
            },
          ],
          { academyId: state.academyId },
        )
      : state.ledgerEntries;

  return {
    state: {
      ...state,
      tickets,
      ledgerEntries,
      ticketRegistrations: [
        ...state.ticketRegistrations,
        {
          registrationId: `registration-${ticket.ticketId}-${state.ticketRegistrations.length + 1}`,
          academyId: state.academyId,
          ticketId: ticket.ticketId,
          registeredAt: input.registeredAt,
          grantedCount: input.grantedCount,
          validUntil: ticket.validUntil,
          originalPaidAmount: paidAmount,
          ledgerEntryId: ledgerId,
        },
      ],
    },
    result: {
      ticketId: ticket.ticketId,
      merged: false,
      totalGrantedCount: ticket.totalGrantedCount,
      remainingCount: ticket.remainingCount,
      validFrom: ticket.validFrom,
      validUntil: ticket.validUntil,
    },
  };
}

export function adjustDemoLessonTicket(
  state: DemoAcademyState,
  input: AdjustLessonTicketInput,
): { state: DemoAcademyState; result: AdjustLessonTicketResult } {
  const existingTicket = state.tickets.find(
    (ticket) => ticket.ticketId === input.ticketId,
  );

  if (!existingTicket) {
    throw new Error("회차권을 찾지 못했습니다.");
  }

  const adjusted = adjustLessonTicket(existingTicket, input);

  return {
    state: {
      ...state,
      tickets: state.tickets.map((ticket) =>
        ticket.ticketId === input.ticketId ? { ...ticket, ...adjusted } : ticket,
      ),
    },
    result: {
      ticketId: input.ticketId,
      totalGrantedCount: adjusted.totalGrantedCount,
      remainingCount: adjusted.remainingCount,
      validUntil: adjusted.validUntil,
    },
  };
}

export function markDemoPrivateLessonAttendance(
  state: DemoAcademyState,
  input: MarkDemoPrivateLessonAttendanceInput,
): DemoAcademyState {
  const lesson = state.privateLessons.find((candidate) => candidate.id === input.lessonId);

  if (!lesson) {
    throw new Error("출석 처리할 개인레슨을 찾을 수 없습니다.");
  }

  const nextLessons = state.privateLessons.map((candidate) =>
    candidate.id === input.lessonId
      ? {
          ...candidate,
          status: input.status,
          absenceReason:
            input.status === "absent" ? input.reason?.trim() || DEFAULT_ABSENCE_REASON : undefined,
        }
      : candidate,
  );

  if (input.status !== "present") {
    return {
      ...state,
      privateLessons: nextLessons,
    };
  }

  const ticket = state.tickets.find(
    (candidate) =>
      candidate.academyId === lesson.academyId &&
      candidate.studentId === lesson.studentId &&
      candidate.instrumentId === lesson.instrumentId,
  );

  if (!ticket) {
    throw new Error("차감할 회차권을 찾을 수 없습니다.");
  }

  const deduction = applyAttendanceToTicket(ticket, {
    academyId: lesson.academyId,
    lessonEventId: lesson.id,
    studentId: lesson.studentId,
    instrumentId: lesson.instrumentId,
    status: "present",
  }, {
    alreadyDeductedLessonEventIds: state.ticketUsages.map((usage) => usage.lessonEventId),
  });

  return {
    ...state,
    privateLessons: nextLessons,
    tickets: state.tickets.map((candidate) =>
      candidate.ticketId === ticket.ticketId
        ? {
            ...candidate,
            remainingCount: deduction.ticket.remainingCount,
          }
        : candidate,
    ),
    ticketUsages: deduction.usage
      ? [...state.ticketUsages, deduction.usage]
      : state.ticketUsages,
  };
}

/** 등원 확인을 취소해 예정 상태로 되돌리고, 그 레슨으로 차감한 회차권 1회를 복구한다. */
export function cancelDemoPrivateLessonAttendance(
  state: DemoAcademyState,
  input: { lessonId: string },
): DemoAcademyState {
  const lesson = state.privateLessons.find((candidate) => candidate.id === input.lessonId);

  if (!lesson) {
    throw new Error("등원 확인을 취소할 개인레슨을 찾을 수 없습니다.");
  }

  const usage = state.ticketUsages.find(
    (candidate) => candidate.lessonEventId === input.lessonId,
  );

  return {
    ...state,
    privateLessons: state.privateLessons.map((candidate) =>
      candidate.id === input.lessonId ? { ...candidate, status: "scheduled" } : candidate,
    ),
    tickets: usage
      ? state.tickets.map((ticket) =>
          ticket.academyId === usage.academyId &&
          ticket.studentId === usage.studentId &&
          ticket.instrumentId === usage.instrumentId
            ? {
                ...ticket,
                remainingCount: Math.min(
                  ticket.totalGrantedCount,
                  ticket.remainingCount + usage.usedCount,
                ),
              }
            : ticket,
        )
      : state.tickets,
    ticketUsages: state.ticketUsages.filter(
      (candidate) => candidate.lessonEventId !== input.lessonId,
    ),
  };
}

export function registerDemoManualLedgerEntry(
  state: DemoAcademyState,
  input: DemoManualLedgerInput,
): DemoAcademyState {
  const description = input.description.trim();

  if (!description) {
    throw new Error("입출입 설명은 필수입니다.");
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("입출입 금액은 1 이상의 정수여야 합니다.");
  }

  return {
    ...state,
    ledgerEntries: buildFinanceLedgerList(
      [
        ...state.ledgerEntries,
        {
          academyId: state.academyId,
          ledgerId: `ledger-manual-${state.ledgerEntries.length + 1}`,
          occurredOn: input.occurredOn,
          type: input.type,
          source: "manual",
          category: input.category ?? "other",
          amount: input.amount,
          description,
          refId: `manual-${state.ledgerEntries.length + 1}`,
        },
      ],
      { academyId: state.academyId },
    ),
  };
}

export function registerDemoVendor(
  state: DemoAcademyState,
  input: DemoVendorRegistrationInput,
): DemoAcademyState {
  const vendor = registerVendor({
    academyId: state.academyId,
    vendorId: `vendor-demo-${state.vendors.length + 1}`,
    ...input,
  });

  return {
    ...state,
    vendors: [
      ...state.vendors,
      {
        academyId: vendor.academyId,
        vendorId: vendor.vendorId,
        name: vendor.name,
        contact: vendor.contact,
        kind: vendor.kind,
        memo: vendor.memo,
      },
    ],
  };
}

export function updateDemoVendor(
  state: DemoAcademyState,
  { vendorId, ...profile }: DemoVendorUpdateInput,
): DemoAcademyState {
  return {
    ...state,
    vendors: state.vendors.map((vendor) =>
      vendor.vendorId === vendorId ? { ...vendor, ...profile } : vendor,
    ),
  };
}

export function deleteDemoVendor(
  state: DemoAcademyState,
  { vendorId }: { vendorId: string },
): DemoAcademyState {
  return {
    ...state,
    vendors: state.vendors.filter((vendor) => vendor.vendorId !== vendorId),
  };
}

export function registerDemoConsultation(
  state: DemoAcademyState,
  input: DemoConsultationInput,
  receivedAt: string,
): DemoAcademyState {
  return {
    ...state,
    consultations: [
      ...state.consultations,
      {
        ...input,
        academyId: state.academyId,
        consultationId: `consultation-demo-${getNextConsultationNumber(state.consultations)}`,
        receivedAt,
      },
    ],
  };
}

export function updateDemoConsultation(
  state: DemoAcademyState,
  { consultationId, ...profile }: DemoConsultationUpdateInput,
): DemoAcademyState {
  return {
    ...state,
    consultations: state.consultations.map((consultation) =>
      consultation.consultationId === consultationId
        ? { ...consultation, ...profile }
        : consultation,
    ),
  };
}

export function deleteDemoConsultation(
  state: DemoAcademyState,
  { consultationId }: { consultationId: string },
): DemoAcademyState {
  return {
    ...state,
    consultations: state.consultations.filter(
      (consultation) => consultation.consultationId !== consultationId,
    ),
  };
}

/** 삭제 뒤에도 기존 id와 겹치지 않도록 남아 있는 id의 가장 큰 번호 다음 번호를 쓴다. */
function getNextConsultationNumber(consultations: ConsultationListRow[]) {
  const numbers = consultations.map(
    (consultation) => Number(/(\d+)$/.exec(consultation.consultationId)?.[1] ?? 0),
  );

  return Math.max(0, ...numbers) + 1;
}

export function updateDemoLedgerEntry(
  state: DemoAcademyState,
  input: LedgerEntry,
): DemoAcademyState {
  return {
    ...state,
    ledgerEntries: buildFinanceLedgerList(
      state.ledgerEntries.map((entry) =>
        entry.ledgerId === input.ledgerId &&
        entry.academyId === input.academyId
          ? {
              ...entry,
              occurredOn: input.occurredOn,
              type: input.type,
              source: input.source,
              category: input.category,
              amount: input.amount,
              description: input.description,
            }
          : entry,
      ),
      { academyId: state.academyId },
    ),
  };
}

export function deleteDemoLedgerEntry(
  state: DemoAcademyState,
  input: { ledgerId: string },
): DemoAcademyState {
  return {
    ...state,
    ledgerEntries: state.ledgerEntries.filter(
      (entry) => entry.ledgerId !== input.ledgerId,
    ),
  };
}

export function buildAcademySheets(
  enrollments: StudentEnrollment[],
  academyId: string,
  month: string,
) {
  const events = generateAcademyLessonEvents(
    enrollments.flatMap((enrollment) =>
      enrollment.weeklySchedules
        .filter((schedule) => schedule.startTime && schedule.endTime)
        .map((schedule) => ({
          academyId: enrollment.academyId,
          enrollmentId: `${enrollment.enrollmentId}:${schedule.weekday}`,
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          instrumentId: enrollment.instrumentId,
          instrumentName: enrollment.instrumentName,
          lessonType: enrollment.lessonType,
          active: enrollment.active,
          weekdays: [schedule.weekday],
          startTime: schedule.startTime ?? "",
          endTime: schedule.endTime ?? "",
        })),
    ),
    { academyId, month },
  );
  const dates = [...new Set(events.map((event) => event.date))];

  return Object.fromEntries(
    dates.map((date) => [
      date,
      buildDailyAcademyAttendance(events, { academyId, date }),
    ]),
  );
}

function indexSheets(sheets: DailyAcademyAttendanceSheet[]) {
  return Object.fromEntries(sheets.map((sheet) => [sheet.date, sheet]));
}

export function mergeSheets(
  left: Record<string, DailyAcademyAttendanceSheet>,
  right: Record<string, DailyAcademyAttendanceSheet>,
) {
  return {
    ...left,
    ...right,
  };
}

function buildDemoTeacherListRow(
  academyId: string,
  teacherId: string,
  input: DemoTeacherRegistrationInput,
): TeacherListRow {
  const salary = buildTeacherSalarySetting(input);
  const workSchedules: TeacherWorkSchedule[] = normalizeWorkSchedules(
    input.workSchedules ?? [],
  ).map((schedule, index) => ({
    scheduleId: `teacher-schedule-demo-${teacherId}-${index}`,
    weekday: schedule.weekday,
    weekdayLabel: formatWeekday(schedule.weekday),
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  }));
  const row: TeacherListRow = {
    academyId,
    teacherId,
    name: input.name,
    part: input.part,
    contact: input.contact,
    registeredAt: input.registeredAt,
    contractStartOn: input.contractStartOn,
    contractEndOn: input.contractEndOn,
    payType: input.payType,
    status: "employed",
    monthlySalary: salary.payType === "monthly" ? salary.monthlySalary : undefined,
    hourlyRate: salary.payType === "hourly" ? salary.hourlyRate : undefined,
    ratioTeacherShare:
      salary.payType === "ratio" ? salary.ratioTeacherShare : undefined,
    workSchedules,
  };

  return {
    ...row,
    salarySummary: formatTeacherSalarySummary(row),
    workScheduleSummary: formatTeacherWorkScheduleSummary(workSchedules),
  };
}

function formatWeekday(weekday: Weekday | string) {
  const labels: Record<Weekday, string> = {
    sunday: "일",
    monday: "월",
    tuesday: "화",
    wednesday: "수",
    thursday: "목",
    friday: "금",
    saturday: "토",
  };

  return labels[toWeekdayValue(weekday)] ?? weekday;
}

export function toWeekdayValue(value: string): Weekday {
  const weekdays: Record<string, Weekday> = {
    일: "sunday",
    월: "monday",
    화: "tuesday",
    수: "wednesday",
    목: "thursday",
    금: "friday",
    토: "saturday",
    sunday: "sunday",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
  };

  return weekdays[value] ?? "monday";
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.flatMap((value) => {
        const trimmedValue = value?.trim();

        return trimmedValue ? [trimmedValue] : [];
      }),
    ),
  ];
}

function getPhoneLast4(phone: string) {
  return phone.replace(/\D/g, "").slice(-4) || undefined;
}

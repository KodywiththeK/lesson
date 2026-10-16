import {
  buildDailyAcademyAttendance,
  type DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import {
  generateAcademyLessonEvents,
  type Weekday,
} from "@/domain/academy-lesson-schedule";
import type { BookSale, LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import type { LessonTicketIncomeRegistration } from "@/domain/lesson-ticket-income";
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
import { registerVendor } from "@/domain/vendor";
import type { VendorListRow } from "@/domain/vendor-list";
import type {
  AdjustLessonTicketInput,
  AdjustLessonTicketResult,
  RegisterLessonTicketInput,
  RegisterLessonTicketResult,
} from "@/lib/api/lesson-tickets";
import type { UpdateStudentProfileInput } from "@/lib/api/students";

import { demoLessonWorkspaceData } from "./lesson-demo-data";
import {
  demoAcademyId,
  demoBookSales,
  demoLedgerEntries,
  demoStudents,
  demoTeachers,
  demoTickets,
  demoVendors,
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
  bookSales: typeof demoBookSales;
};

export type DemoStudentRegistrationInput = {
  name: string;
  registeredAt: string;
  age?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  contact: {
    relationship: string;
    phone: string;
  };
  instruments: DemoStudentRegistrationInstrumentInput[];
};

export type DemoStudentRegistrationInstrumentInput = {
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  lessonType: LessonType;
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

export type DemoStudentUpdateInput = UpdateStudentProfileInput;

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

export type DemoBookReleaseInput = {
  studentId: string;
  studentName: string;
  bookTitle: string;
  price: number;
  shippedAt: string;
  status: BookSale["status"];
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
    bookSales: [...demoBookSales],
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

export function updateDemoAcademyStudent(
  state: DemoAcademyState,
  input: DemoStudentUpdateInput,
): DemoAcademyState {
  const updatedStudent: StudentListRow = {
    academyId: input.academyId,
    studentId: input.studentId,
    name: input.name,
    teacherNames: input.teacherName ? [input.teacherName] : [],
    instrumentNames: input.instrumentName ? [input.instrumentName] : [],
    weekdayLabels: input.weekdayLabels ?? [],
    instruments: input.studentInstrumentId
      ? [
          {
            studentInstrumentId: input.studentInstrumentId,
            teacherId: input.teacherId ?? null,
            teacherName: input.teacherName ?? "",
            instrumentId: input.instrumentId ?? "",
            instrumentName: input.instrumentName ?? "",
            lessonType: input.lessonType ?? "academy",
            weekdayLabels: input.weekdayLabels ?? [],
            startTime: input.startTime ?? "",
            endTime: input.endTime ?? "",
            progress: input.progress ?? "",
            lessonFee: input.lessonFee ?? 0,
            discountTotal: input.discountTotal ?? 0,
            finalMonthlyFee: input.finalMonthlyFee ?? 0,
            active: true,
            weeklySchedules: (input.weekdayLabels ?? []).map((weekdayLabel) => ({
              weekday: toWeekdayValue(weekdayLabel),
              weekdayLabel,
              startTime: input.startTime ?? "",
              endTime: input.endTime ?? "",
            })),
          },
        ]
      : [],
  };
  const students = state.students.map((student) =>
    student.studentId === input.studentId
      ? {
          ...student,
          ...updatedStudent,
          registeredOn: student.registeredOn,
          status: student.status,
        }
      : student,
  );
  const enrollments = state.enrollments.map((enrollment) =>
    enrollment.studentId === input.studentId &&
    (!input.studentInstrumentId ||
      enrollment.enrollmentId === input.studentInstrumentId)
      ? {
          ...enrollment,
          studentName: input.name,
          teacherId: input.teacherId ?? enrollment.teacherId,
          teacherName: input.teacherName ?? enrollment.teacherName,
          instrumentId: input.instrumentId ?? enrollment.instrumentId,
          instrumentName: input.instrumentName ?? enrollment.instrumentName,
          lessonType: (input.lessonType as LessonType | undefined) ?? enrollment.lessonType,
          weekdays: (input.weekdayLabels ?? enrollment.weekdays).map(toWeekdayValue),
          startTime: input.startTime ?? enrollment.startTime,
          endTime: input.endTime ?? enrollment.endTime,
          progress: input.progress ?? enrollment.progress,
          lessonFee: input.lessonFee ?? enrollment.lessonFee,
          discountTotal: input.discountTotal ?? enrollment.discountTotal,
          finalMonthlyFee: input.finalMonthlyFee ?? enrollment.finalMonthlyFee,
        }
      : enrollment,
  );

  return {
    ...state,
    students,
    enrollments,
    tickets: state.tickets.map((ticket) =>
      ticket.studentId === input.studentId
        ? {
            ...ticket,
            studentName: input.name,
            instrumentName: input.instrumentName ?? ticket.instrumentName,
          }
        : ticket,
    ),
    privateLessons: state.privateLessons.map((lesson) =>
      lesson.studentId === input.studentId
        ? {
            ...lesson,
            studentName: input.name,
            teacherId: input.teacherId ?? lesson.teacherId,
            teacherName: input.teacherName ?? lesson.teacherName,
            instrumentId: input.instrumentId ?? lesson.instrumentId,
            instrumentName: input.instrumentName ?? lesson.instrumentName,
          }
        : lesson,
    ),
    academySheets: Object.fromEntries(
      Object.entries(state.academySheets).map(([date, sheet]) => [
        date,
        {
          ...sheet,
          rows: sheet.rows.map((row) =>
            row.studentId === input.studentId
              ? {
                  ...row,
                  studentName: input.name,
                  teacherId: input.teacherId ?? row.teacherId,
                  teacherName: input.teacherName ?? row.teacherName,
                  instrumentId: input.instrumentId ?? row.instrumentId,
                  instrumentName: input.instrumentName ?? row.instrumentName,
                  startTime: input.startTime ?? row.startTime,
                  endTime: input.endTime ?? row.endTime,
                }
              : row,
          ),
        },
      ]),
    ),
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
  const existingTicket = state.tickets.find(
    (ticket) =>
      ticket.studentId === input.studentId &&
      ticket.instrumentId === input.instrumentId,
  );
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
    ticketId: existingTicket?.ticketId ?? `ticket-demo-${state.tickets.length + 1}`,
    studentName,
    instrumentName: input.instrumentName,
    paidAmount: (existingTicket?.paidAmount ?? 0) + paidAmount,
    paidAt: paidAmount > 0 ? input.registeredAt : existingTicket?.paidAt,
  };
  const tickets = existingTicket
    ? state.tickets.map((candidate) =>
        candidate.ticketId === existingTicket.ticketId ? ticket : candidate,
      )
    : [...state.tickets, ticket];
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
      merged: Boolean(existingTicket),
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

export function registerDemoBookRelease(
  state: DemoAcademyState,
  input: DemoBookReleaseInput,
): DemoAcademyState {
  const bookTitle = input.bookTitle.trim();

  if (!bookTitle) {
    throw new Error("교재명은 필수입니다.");
  }

  if (!Number.isInteger(input.price) || input.price <= 0) {
    throw new Error("교재 금액은 1 이상의 정수여야 합니다.");
  }

  const saleId = `book-sale-demo-${state.bookSales.length + 1}`;
  const sale: BookSale =
    input.status === "paid"
      ? {
          academyId: state.academyId,
          saleId,
          bookId: `book-demo-${state.bookSales.length + 1}`,
          bookTitle,
          studentId: input.studentId,
          studentName: input.studentName,
          price: input.price,
          shippedAt: input.shippedAt,
          status: "paid",
          paidAt: input.shippedAt,
          permanent: true,
        }
      : {
          academyId: state.academyId,
          saleId,
          bookId: `book-demo-${state.bookSales.length + 1}`,
          bookTitle,
          studentId: input.studentId,
          studentName: input.studentName,
          price: input.price,
          shippedAt: input.shippedAt,
          status: "payment-pending",
        };

  return {
    ...state,
    bookSales: [...state.bookSales, sale],
    ledgerEntries:
      sale.status === "paid"
        ? buildFinanceLedgerList(
            [
              ...state.ledgerEntries,
              {
                academyId: state.academyId,
                ledgerId: `ledger-book-${sale.saleId}`,
                occurredOn: sale.paidAt,
                type: "income",
                source: "book-sale",
                category: "book-sale",
                amount: sale.price,
                description: `교재 판매: ${sale.bookTitle} / ${sale.studentName}`,
                refId: sale.saleId,
              },
            ],
            { academyId: state.academyId },
          )
        : state.ledgerEntries,
  };
}

/** 결제 대기 교재를 결제 완료로 바꾸고 수입 ledger를 만든다(DB `complete_book_release_payment`와 같은 규칙). */
export function completeDemoBookRelease(
  state: DemoAcademyState,
  input: { releaseId: string; paidAt: string },
): DemoAcademyState {
  const sale = state.bookSales.find((candidate) => candidate.saleId === input.releaseId);

  if (!sale) {
    throw new Error("결제 완료 처리할 교재 출고를 찾지 못했습니다.");
  }

  if (sale.status === "paid") {
    throw new Error("이미 결제 완료된 교재입니다.");
  }

  const paidSale: BookSale = {
    ...sale,
    status: "paid",
    paidAt: input.paidAt,
    permanent: true,
  };

  return {
    ...state,
    bookSales: state.bookSales.map((candidate) =>
      candidate.saleId === sale.saleId ? paidSale : candidate,
    ),
    ledgerEntries: buildFinanceLedgerList(
      [
        ...state.ledgerEntries,
        {
          academyId: state.academyId,
          ledgerId: `ledger-book-${sale.saleId}`,
          occurredOn: input.paidAt,
          type: "income",
          source: "book-sale",
          category: "book-sale",
          amount: sale.price,
          description: `교재 판매: ${sale.bookTitle} / ${sale.studentName}`,
          refId: sale.saleId,
        },
      ],
      { academyId: state.academyId },
    ),
  };
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

function buildAcademySheets(
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

function mergeSheets(
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

function toWeekdayValue(value: string): Weekday {
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

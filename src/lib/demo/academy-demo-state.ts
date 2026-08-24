import {
  buildDailyAcademyAttendance,
  type DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import {
  generateAcademyLessonEvents,
  type Weekday,
} from "@/domain/academy-lesson-schedule";
import type { BookSale, LedgerEntry } from "@/domain/book-sale";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import {
  applyAttendanceToTicket,
  registerLessonTicket,
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
import { registerVendor } from "@/domain/vendor";
import type { VendorListRow } from "@/domain/vendor-list";
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
  discountTotal: number;
  finalMonthlyFee: number;
};

export type DemoStudentUpdateInput = UpdateStudentProfileInput;

export type DemoTeacherRegistrationInput = {
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  payType: TeacherListRow["payType"];
};

export type DemoLessonTicketPurchaseInput = {
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  grantedCount: number;
  validFrom: string;
  validUntil: string;
  registeredAt: string;
  paidAmount: number;
};

export type MarkDemoPrivateLessonAttendanceInput = {
  lessonId: string;
  status: Exclude<PrivateLessonStatus, "scheduled" | "cancelled" | "makeup">;
  markedAt: string;
};

export type DemoManualLedgerInput = {
  occurredOn: string;
  type: LedgerEntry["type"];
  amount: number;
  description: string;
};

export type DemoVendorRegistrationInput = {
  name: string;
  contact: string;
  kind: string;
  memo: string;
  registeredAt: string;
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
    startTime: "10:30",
    endTime: "11:20",
    progress: "활쓰기 기초",
    lessonFee: 0,
    discountTotal: 0,
    finalMonthlyFee: 0,
  },
];

export function createInitialDemoAcademyState(): DemoAcademyState {
  return {
    academyId: demoAcademyId,
    academyName: "더 클래식",
    students: [...demoStudents],
    teachers: [...demoTeachers],
    enrollments: [...initialEnrollments],
    tickets: [...demoTickets],
    ticketUsages: [],
    ledgerEntries: [...demoLedgerEntries],
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
  const registration = registerStudent({
    academyId: state.academyId,
    studentId,
    name: input.name,
    registeredAt: input.registeredAt,
    guardians: [],
    instruments: [
      {
        instrumentId: input.instrumentId,
        instrumentName: input.instrumentName,
        teacherId: input.teacherId,
        teacherName: input.teacherName,
        lessonType: input.lessonType,
        weekdays: input.weekdays,
        startTime: input.startTime,
        endTime: input.endTime,
        progress: input.progress,
        lessonFee: input.lessonFee,
        discounts:
          input.discountTotal > 0
            ? [
                {
                  type: "manual",
                  label: "직접 할인",
                  amount: input.discountTotal,
                },
              ]
            : [],
        finalMonthlyFee: input.finalMonthlyFee,
      },
    ],
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
        teacherNames: [input.teacherName],
        instrumentNames: [input.instrumentName],
        weekdayLabels: input.weekdays.map(formatWeekday),
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

export function registerDemoAcademyTeacher(
  state: DemoAcademyState,
  input: DemoTeacherRegistrationInput,
): DemoAcademyState {
  const teacherId = `teacher-demo-${state.teachers.length + 1}`;

  return {
    ...state,
    teachers: [
      ...state.teachers,
      {
        academyId: state.academyId,
        teacherId,
        name: input.name,
        part: input.part,
        contact: input.contact,
        registeredAt: input.registeredAt,
        payType: input.payType,
      },
    ],
  };
}

export function registerDemoLessonTicketPurchase(
  state: DemoAcademyState,
  input: DemoLessonTicketPurchaseInput,
): DemoAcademyState {
  const existingTicket = state.tickets.find(
    (ticket) =>
      ticket.studentId === input.studentId &&
      ticket.instrumentId === input.instrumentId,
  );
  const registered = registerLessonTicket(existingTicket, {
    academyId: state.academyId,
    studentId: input.studentId,
    instrumentId: input.instrumentId,
    grantedCount: input.grantedCount,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    registeredAt: input.registeredAt,
  });
  const ticket: LessonTicketListItem = {
    ...registered.ticket,
    ticketId: existingTicket?.ticketId ?? `ticket-demo-${state.tickets.length + 1}`,
    studentName: input.studentName,
    instrumentName: input.instrumentName,
  };
  const tickets = existingTicket
    ? state.tickets.map((candidate) =>
        candidate.ticketId === existingTicket.ticketId ? ticket : candidate,
      )
    : [...state.tickets, ticket];

  return {
    ...state,
    tickets,
    ledgerEntries: buildFinanceLedgerList(
      [
        ...state.ledgerEntries,
        {
          academyId: state.academyId,
          ledgerId: `ledger-ticket-${ticket.ticketId}-${input.registeredAt}`,
          occurredOn: input.registeredAt,
          type: "income",
          source: "lesson-ticket",
          amount: input.paidAmount,
          description: `${input.studentName} ${input.instrumentName} 회차권 ${input.grantedCount}회 구매`,
          refId: ticket.ticketId,
        },
      ],
      { academyId: state.academyId },
    ),
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

function buildAcademySheets(
  enrollments: StudentEnrollment[],
  academyId: string,
  month: string,
) {
  const events = generateAcademyLessonEvents(
    enrollments.map((enrollment) => ({
      academyId: enrollment.academyId,
      enrollmentId: enrollment.enrollmentId,
      studentId: enrollment.studentId,
      studentName: enrollment.studentName,
      instrumentId: enrollment.instrumentId,
      instrumentName: enrollment.instrumentName,
      lessonType: enrollment.lessonType,
      active: enrollment.active,
      weekdays: enrollment.weekdays,
      startTime: enrollment.startTime ?? "",
      endTime: enrollment.endTime ?? "",
    })),
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

function formatWeekday(weekday: Weekday) {
  const labels: Record<Weekday, string> = {
    sunday: "일",
    monday: "월",
    tuesday: "화",
    wednesday: "수",
    thursday: "목",
    friday: "금",
    saturday: "토",
  };

  return labels[weekday];
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

import type { LedgerEntry } from "@/domain/book-sale";
import { buildBookPurchaseList, type BookSale } from "@/domain/book-sale";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import {
  buildLessonTicketList,
  registerLessonTicket,
  type LessonTicketListItem,
} from "@/domain/lesson-ticket";
import { buildStudentList, type StudentListRow } from "@/domain/student-list";
import { buildTeacherList, type TeacherListRow } from "@/domain/teacher-list";
import { buildVendorList, type VendorListRow } from "@/domain/vendor-list";
import type {
  RegisterLessonTicketGrantInput,
  RegisterLessonTicketGrantResult,
} from "@/lib/api/lesson-tickets";

import { queryKeys } from "../api/query-keys";

export const demoAcademyId = "academy-demo";
const academyId = demoAcademyId;

export const demoStudents: StudentListRow[] = [
  {
    academyId,
    studentId: "student-1",
    name: "김민지",
    teacherNames: ["김하늘"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월", "수"],
  },
  {
    academyId,
    studentId: "student-2",
    name: "이서윤",
    teacherNames: ["김하늘"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["화", "금"],
  },
  {
    academyId,
    studentId: "student-4",
    name: "한서아",
    teacherNames: ["오유진"],
    instrumentNames: ["바이올린"],
    weekdayLabels: ["금"],
  },
  {
    academyId,
    studentId: "student-6",
    name: "최도윤",
    teacherNames: ["문서준"],
    instrumentNames: ["첼로"],
    weekdayLabels: ["토"],
  },
];

export const demoTeachers: TeacherListRow[] = [
  {
    academyId,
    teacherId: "teacher-1",
    name: "김하늘",
    part: "피아노",
    contact: "010-1111-2222",
    registeredAt: "2026-03-02",
    payType: "monthly",
  },
  {
    academyId,
    teacherId: "teacher-2",
    name: "오유진",
    part: "바이올린",
    contact: "010-3333-4444",
    registeredAt: "2026-04-01",
    payType: "ratio",
  },
  {
    academyId,
    teacherId: "teacher-3",
    name: "문서준",
    part: "첼로",
    contact: "010-5555-6666",
    registeredAt: "2026-05-10",
    payType: "hourly",
  },
];

export const demoTickets: LessonTicketListItem[] = [
  {
    academyId,
    ticketId: "ticket-1",
    studentId: "student-4",
    studentName: "한서아",
    instrumentId: "violin",
    instrumentName: "바이올린",
    totalGrantedCount: 8,
    remainingCount: 2,
    validFrom: "2026-08-01",
    validUntil: "2026-08-28",
    registeredAt: "2026-08-01",
  },
  {
    academyId,
    ticketId: "ticket-2",
    studentId: "student-6",
    studentName: "최도윤",
    instrumentId: "cello",
    instrumentName: "첼로",
    totalGrantedCount: 4,
    remainingCount: 1,
    validFrom: "2026-08-10",
    validUntil: "2026-08-24",
    registeredAt: "2026-08-10",
  },
];

export const demoVendors: VendorListRow[] = [
  {
    academyId,
    vendorId: "vendor-1",
    name: "클래식 악기사",
    contact: "02-1000-2000",
    kind: "악기",
    memo: "피아노 조율, 현 교체",
  },
  {
    academyId,
    vendorId: "vendor-2",
    name: "뮤직북 유통",
    contact: "02-3000-4000",
    kind: "교재",
    memo: "바이엘, 체르니 정기 입고",
  },
];

export const demoBookSales: BookSale[] = [
  {
    academyId,
    saleId: "book-sale-1",
    bookId: "book-1",
    bookTitle: "바이엘 상",
    studentId: "student-1",
    studentName: "김민지",
    price: 12000,
    shippedAt: "2026-08-18",
    status: "payment-pending",
  },
  {
    academyId,
    saleId: "book-sale-2",
    bookId: "book-2",
    bookTitle: "스즈키 바이올린 1",
    studentId: "student-4",
    studentName: "한서아",
    price: 18000,
    shippedAt: "2026-08-12",
    status: "paid",
    paidAt: "2026-08-14",
    permanent: true,
  },
];

export const demoLedgerEntries: LedgerEntry[] = [
  {
    academyId,
    ledgerId: "ledger-1",
    occurredOn: "2026-08-05",
    type: "income",
    source: "tuition",
    amount: 140000,
    description: "김민지 8월 피아노 수강료",
    refId: "fixed-income-1",
  },
  {
    academyId,
    ledgerId: "ledger-2",
    occurredOn: "2026-08-14",
    type: "income",
    source: "book-sale",
    amount: 18000,
    description: "교재 판매: 스즈키 바이올린 1 / 한서아",
    refId: "book-sale-2",
  },
  {
    academyId,
    ledgerId: "ledger-3",
    occurredOn: "2026-08-20",
    type: "expense",
    source: "manual",
    amount: 70000,
    description: "피아노 조율비",
    refId: "manual-1",
  },
];

export function createDemoStudentListQueryOptions(
  options: Parameters<typeof buildStudentList>[1],
) {
  return {
    queryKey: queryKeys.students.list(options.academyId, {
      q: options.search,
      teacherName: options.filters?.teacherName,
      instrumentName: options.filters?.instrumentName,
      weekdayLabel: options.filters?.weekdayLabel,
    }),
    queryFn: async () => buildStudentList(demoStudents, options),
  };
}

export function createDemoTeacherListQueryOptions(
  options: Parameters<typeof buildTeacherList>[1],
) {
  return {
    queryKey: queryKeys.teachers.list(options.academyId, {
      q: options.search,
      part: options.filters?.part,
      payType: options.filters?.payType,
    }),
    queryFn: async () => buildTeacherList(demoTeachers, options),
  };
}

export function createDemoLessonTicketListQueryOptions(
  options: Parameters<typeof buildLessonTicketList>[1],
) {
  return {
    queryKey: queryKeys.lessonTickets.list(options.academyId, {
      q: options.search,
      status: options.filters?.status,
    }),
    queryFn: async () => buildLessonTicketList(demoTickets, options),
  };
}

export function createDemoLessonTicketRegistrationOptionsQueryOptions(
  targetAcademyId: string,
) {
  return {
    queryKey: queryKeys.lessonTickets.registrationOptions(targetAcademyId),
    queryFn: async () => [
      {
        studentId: "student-4",
        studentName: "한서아",
        instruments: [
          {
            instrumentId: "violin",
            instrumentName: "바이올린",
          },
        ],
      },
      {
        studentId: "student-6",
        studentName: "최도윤",
        instruments: [
          {
            instrumentId: "cello",
            instrumentName: "첼로",
          },
        ],
      },
    ],
  };
}

export async function registerDemoLessonTicket(
  input: RegisterLessonTicketGrantInput,
): Promise<RegisterLessonTicketGrantResult> {
  const result = registerLessonTicket(undefined, input);

  return {
    event: result.event,
    ticket: {
      ...result.ticket,
      ticketId: `ticket-demo-${Date.now()}`,
      studentName: input.studentName,
      instrumentName: input.instrumentName,
    },
  };
}

export function createDemoVendorListQueryOptions(
  options: Parameters<typeof buildVendorList>[1],
) {
  return {
    queryKey: queryKeys.vendors.list(options.academyId, {
      q: options.search,
      kind: options.filters?.kind,
    }),
    queryFn: async () => buildVendorList(demoVendors, options),
  };
}

export function createDemoBookPurchaseListQueryOptions(
  options: Parameters<typeof buildBookPurchaseList>[1],
) {
  return {
    queryKey: queryKeys.books.purchaseList(options.academyId, {
      q: options.search,
      status: options.filters?.status,
    }),
    queryFn: async () => buildBookPurchaseList(demoBookSales, options),
  };
}

export function createDemoFinanceLedgerListQueryOptions(
  options: Parameters<typeof buildFinanceLedgerList>[1],
) {
  return {
    queryKey: queryKeys.finance.ledgerList(options.academyId, {
      q: options.search,
      type: options.filters?.type,
      source: options.filters?.source,
    }),
    queryFn: async () => buildFinanceLedgerList(demoLedgerEntries, options),
  };
}

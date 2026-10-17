"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QueryKey } from "@tanstack/react-query";

import {
  buildBookPaidList,
  buildBookShipmentList,
  type BuildBookPaidListOptions,
  type BuildBookShipmentListOptions,
  type LedgerEntry,
} from "@/domain/book-sale";
import {
  buildBookStockList,
  type BookStockRow,
  type BuildBookStockListOptions,
} from "@/domain/book-stock";
import { buildConsultationList } from "@/domain/consultation-list";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import {
  buildLessonTicketList,
  type BuildLessonTicketListOptions,
} from "@/domain/lesson-ticket";
import type {
  StudentEnrollmentSaveResult,
  UpdateStudentEnrollmentsInput,
} from "@/domain/student-enrollment-edit";
import { buildStudentList } from "@/domain/student-list";
import {
  buildStatusManagementList,
  type StatusManagementFetchOptions,
} from "@/domain/status-management";
import { buildTeacherList } from "@/domain/teacher-list";
import { buildVendorList } from "@/domain/vendor-list";
import { createConsultationListQueryKey } from "@/lib/api/consultations";
import {
  createLessonTicketListQueryKey,
  type AdjustLessonTicketInput,
  type AdjustLessonTicketResult,
  type RegisterLessonTicketInput,
  type RegisterLessonTicketResult,
} from "@/lib/api/lesson-tickets";
import type { RegisterPrivateLessonEventInput } from "@/lib/api/private-lessons";

import { updateDemoStudentEnrollments } from "./academy-demo-student-edit";
import {
  adjustDemoLessonTicket,
  createInitialDemoAcademyState,
  deleteDemoLedgerEntry,
  cancelDemoPrivateLessonAttendance,
  deleteDemoConsultation,
  markDemoPrivateLessonAttendance,
  registerDemoAcademyStudent,
  registerDemoAcademyTeacher,
  registerDemoConsultation,
  registerDemoLessonTicket,
  registerDemoManualLedgerEntry,
  registerDemoVendor,
  updateDemoAcademyTeacher,
  updateDemoConsultation,
  updateDemoLedgerEntry,
  updateDemoStudentStatus,
  updateDemoTeacherStatus,
  updateDemoVendor,
  type DemoAcademyState,
  type DemoConsultationInput,
  type DemoConsultationUpdateInput,
  type DemoManualLedgerInput,
  type DemoStudentRegistrationInput,
  type DemoStudentStatusInput,
  type DemoTeacherRegistrationInput,
  type DemoTeacherStatusInput,
  type DemoTeacherUpdateInput,
  type DemoVendorRegistrationInput,
  type DemoVendorUpdateInput,
} from "./academy-demo-state";
import {
  cancelDemoBookPayment,
  completeDemoBookRelease,
  deleteDemoBook,
  deleteDemoBookRelease,
  registerDemoBookRelease,
  registerDemoBookStock,
  updateDemoBook,
  updateDemoBookRelease,
} from "./academy-demo-books";
import { queryKeys } from "../api/query-keys";
import { createVendorListQueryKey } from "../api/vendors";

type DemoAcademyContextValue = {
  state: DemoAcademyState;
  registerStudent: (input: DemoStudentRegistrationInput) => void;
  /** 원생 수정(이름·기본 정보·악기 수정/추가/종료). 규칙에 어긋나면 서버 RPC와 같은 한국어 오류를 던진다. */
  updateStudentEnrollments: (input: UpdateStudentEnrollmentsInput) => StudentEnrollmentSaveResult;
  updateStudentStatus: (input: DemoStudentStatusInput) => void;
  registerTeacher: (input: DemoTeacherRegistrationInput) => void;
  updateTeacher: (input: DemoTeacherUpdateInput) => void;
  updateTeacherStatus: (input: DemoTeacherStatusInput) => void;
  registerLessonTicket: (input: RegisterLessonTicketInput) => Promise<RegisterLessonTicketResult>;
  adjustLessonTicket: (input: AdjustLessonTicketInput) => Promise<AdjustLessonTicketResult>;
  registerPrivateLesson: (input: RegisterPrivateLessonEventInput) => Promise<void>;
  markPrivateLessonAttendance: (
    lessonId: string,
    status: "present" | "absent",
    /** 결석 사유(선택). 비우면 기본 문구(결석 확인). */
    reason?: string,
  ) => void;
  cancelPrivateLessonAttendance: (lessonId: string) => void;
  registerManualLedgerEntry: (input: DemoManualLedgerInput) => void;
  updateLedgerEntry: (input: LedgerEntry) => void;
  deleteLedgerEntry: (input: { ledgerId: string }) => void;
  registerVendor: (input: DemoVendorRegistrationInput) => void;
  updateVendor: (input: DemoVendorUpdateInput) => void;
  registerConsultation: (input: DemoConsultationInput) => void;
  updateConsultation: (input: DemoConsultationUpdateInput) => void;
  deleteConsultation: (input: { consultationId: string }) => void;
  /** 교재·출고 변경은 서버 RPC와 같은 규칙으로 검사하고, 규칙에 어긋나면 한국어 오류를 던진다. */
  registerBookStock: (input: DemoBookStockInput) => void;
  updateBook: (input: DemoBookStockInput & { bookId: string }) => void;
  deleteBook: (input: { bookId: string }) => void;
  registerBookRelease: (input: DemoBookReleaseRegisterInput) => void;
  updateBookRelease: (input: DemoBookReleaseUpdateInput) => void;
  deleteBookRelease: (input: { releaseId: string }) => void;
  completeBookPayment: (input: { releaseId: string; paidAt: string }) => void;
  cancelBookPayment: (input: { releaseId: string; reason: string }) => void;
  createStudentListQueryOptions: (options: Parameters<typeof buildStudentList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildStudentList>>;
  };
  createStudentStatusManagementQueryOptions: (
    options: StatusManagementFetchOptions<"suspended" | "withdrawn">,
  ) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildStatusManagementList>>;
  };
  createTeacherListQueryOptions: (options: Parameters<typeof buildTeacherList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildTeacherList>>;
  };
  createTeacherStatusManagementQueryOptions: (
    options: StatusManagementFetchOptions<"on_leave" | "resigned">,
  ) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildStatusManagementList>>;
  };
  createLessonTicketListQueryOptions: (options: BuildLessonTicketListOptions) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildLessonTicketList>>;
  };
  createLessonTicketRegistrationOptionsQueryOptions: (academyId: string) => {
    queryKey: QueryKey;
    queryFn: () => Promise<Array<{
      studentId: string;
      studentName: string;
      instruments: Array<{ instrumentId: string; instrumentName: string }>;
    }>>;
  };
  createFinanceLedgerListQueryOptions: (options: Parameters<typeof buildFinanceLedgerList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildFinanceLedgerList>>;
  };
  createVendorListQueryOptions: (options: Parameters<typeof buildVendorList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildVendorList>>;
  };
  createConsultationListQueryOptions: (options: Parameters<typeof buildConsultationList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildConsultationList>>;
  };
  createBookStockListQueryOptions: (options: BuildBookStockListOptions) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildBookStockList>>;
  };
  createBookOptionsQueryOptions: () => {
    queryKey: QueryKey;
    queryFn: () => Promise<BookStockRow[]>;
  };
  createPendingBookReleasesQueryOptions: (options: BuildBookShipmentListOptions) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildBookShipmentList>>;
  };
  createPaidBookReleasesQueryOptions: (options: BuildBookPaidListOptions) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildBookPaidList>>;
  };
};

const DemoAcademyContext = createContext<DemoAcademyContextValue | null>(null);

export type DemoBookStockInput = {
  title: string;
  price: number;
  quantity: number;
  stockedOn: string;
};

export type DemoBookReleaseUpdateInput = {
  releaseId: string;
  studentId: string;
  bookId: string;
  price: number;
  quantity: number;
  shippedOn: string;
};

export type DemoBookReleaseRegisterInput = Omit<DemoBookReleaseUpdateInput, "releaseId"> & {
  status: "payment-pending" | "paid";
  paidOn?: string;
};

export function DemoAcademyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(createInitialDemoAcademyState);
  const [revision, setRevision] = useState(0);
  const commitState = useCallback(
    (updater: (current: DemoAcademyState) => DemoAcademyState) => {
      setState((current) => updater(current));
      setRevision((current) => current + 1);
    },
    [],
  );

  /** 현재 상태로 먼저 규칙을 검사해 오류를 호출한 쪽에 던지고, 통과하면 상태를 바꾼다(updater 안에서 던지면 화면이 깨진다). */
  const commitBookChange = useCallback(
    (apply: (current: DemoAcademyState) => DemoAcademyState) => {
      apply(state);
      commitState(apply);
    },
    [commitState, state],
  );

  const value = useMemo<DemoAcademyContextValue>(
    () => ({
      state,
      registerStudent(input) {
        commitState((current) => registerDemoAcademyStudent(current, input));
      },
      updateStudentEnrollments(input) {
        const { result } = updateDemoStudentEnrollments(state, input);

        commitState((current) => updateDemoStudentEnrollments(current, input).state);

        return result;
      },
      updateStudentStatus(input) {
        commitState((current) => updateDemoStudentStatus(current, input));
      },
      registerTeacher(input) {
        commitState((current) => registerDemoAcademyTeacher(current, input));
      },
      updateTeacher(input) {
        commitState((current) => updateDemoAcademyTeacher(current, input));
      },
      updateTeacherStatus(input) {
        commitState((current) => updateDemoTeacherStatus(current, input));
      },
      async registerLessonTicket(input) {
        // 결과는 화면에 보이는 현재 상태로 먼저 계산하고(검증 실패면 여기서 던진다), 저장은 최신 상태에 적용한다.
        const { result } = registerDemoLessonTicket(state, input);
        commitState((current) => registerDemoLessonTicket(current, input).state);

        return result;
      },
      async adjustLessonTicket(input) {
        const { result } = adjustDemoLessonTicket(state, input);
        commitState((current) => adjustDemoLessonTicket(current, input).state);

        return result;
      },
      async registerPrivateLesson(input) {
        commitState((current) => ({
          ...current,
          privateLessons: [
            ...current.privateLessons,
            {
              id: `private-lesson-demo-${current.privateLessons.length + 1}`,
              academyId: input.academyId,
              studentId: input.studentId,
              studentName: input.studentName,
              instrumentId: input.instrumentId,
              instrumentName: input.instrumentName,
              teacherId: input.teacherId,
              teacherName: input.teacherName,
              startAt: input.startAt,
              endAt: input.endAt,
              status: "scheduled",
            },
          ],
        }));
      },
      markPrivateLessonAttendance(lessonId, status, reason) {
        commitState((current) =>
          markDemoPrivateLessonAttendance(current, {
            lessonId,
            status,
            reason,
            markedAt: new Date().toISOString(),
          }),
        );
      },
      cancelPrivateLessonAttendance(lessonId) {
        commitState((current) =>
          cancelDemoPrivateLessonAttendance(current, { lessonId }),
        );
      },
      registerManualLedgerEntry(input) {
        commitState((current) => registerDemoManualLedgerEntry(current, input));
      },
      updateLedgerEntry(input) {
        commitState((current) => updateDemoLedgerEntry(current, input));
      },
      deleteLedgerEntry(input) {
        commitState((current) => deleteDemoLedgerEntry(current, input));
      },
      registerVendor(input) {
        commitState((current) => registerDemoVendor(current, input));
      },
      updateVendor(input) {
        commitState((current) => updateDemoVendor(current, input));
      },
      registerConsultation(input) {
        const receivedAt = new Date().toISOString();
        commitState((current) => registerDemoConsultation(current, input, receivedAt));
      },
      updateConsultation(input) {
        commitState((current) => updateDemoConsultation(current, input));
      },
      deleteConsultation(input) {
        commitState((current) => deleteDemoConsultation(current, input));
      },
      registerBookStock(input) {
        commitBookChange((current) => registerDemoBookStock(current, input));
      },
      updateBook(input) {
        commitBookChange((current) => updateDemoBook(current, input));
      },
      deleteBook(input) {
        commitBookChange((current) => deleteDemoBook(current, input));
      },
      registerBookRelease(input) {
        commitBookChange((current) => registerDemoBookRelease(current, input));
      },
      updateBookRelease(input) {
        commitBookChange((current) => updateDemoBookRelease(current, input));
      },
      deleteBookRelease(input) {
        commitBookChange((current) => deleteDemoBookRelease(current, input));
      },
      completeBookPayment(input) {
        commitBookChange((current) => completeDemoBookRelease(current, input));
      },
      cancelBookPayment(input) {
        commitBookChange((current) => cancelDemoBookPayment(current, input));
      },
      createStudentListQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.students.list(options.academyId, {
              q: options.search,
              teacherName: options.filters?.teacherName,
              instrumentName: options.filters?.instrumentName,
              weekdayLabel: options.filters?.weekdayLabel,
              page: String(options.page ?? 1),
              pageSize: String(options.pageSize ?? ""),
            }),
            "demo",
            revision,
          ],
          queryFn: async () =>
            buildStudentList(
              state.students.filter(
                (student) =>
                  (student.status ?? "enrolled") === "enrolled" &&
                  !student.archivedAt,
              ),
              options,
            ),
        };
      },
      createStudentStatusManagementQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.statusManagement.list(options.academyId, {
              entityType: "student",
              status: options.status,
              q: options.search,
              page: String(options.page ?? 1),
              pageSize: String(options.pageSize ?? ""),
            }),
            "demo",
            revision,
          ],
          queryFn: async () =>
            buildStatusManagementList(
              state.students.map((student) => ({
                academyId: student.academyId,
                entityType: "student",
                entityId: student.studentId,
                name: student.name,
                status: (student.status ?? "enrolled") as
                  | "suspended"
                  | "withdrawn",
                changedAt:
                  student.status === "withdrawn"
                    ? student.withdrawnAt
                    : student.suspendedAt,
                retentionUntil: student.retentionUntil,
                archivedAt: student.archivedAt,
                primaryInfo: student.instrumentNames.join(", "),
                secondaryInfo: student.teacherNames.join(", "),
                detailSummary: student.weekdayLabels.join(", "),
                statusReason: student.statusReason,
              })),
              { ...options, entityType: "student" },
            ),
        };
      },
      createTeacherListQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.teachers.list(options.academyId, {
              q: options.search,
              part: options.filters?.part,
              payType: options.filters?.payType,
              status: options.filters?.status,
              page: String(options.page ?? 1),
              pageSize: String(options.pageSize ?? ""),
            }),
            "demo",
            revision,
          ],
          queryFn: async () =>
            buildTeacherList(
              state.teachers.filter(
                (teacher) =>
                  (teacher.status ?? "employed") === "employed" &&
                  !teacher.archivedAt,
              ),
              options,
            ),
        };
      },
      createTeacherStatusManagementQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.statusManagement.list(options.academyId, {
              entityType: "teacher",
              status: options.status,
              q: options.search,
              page: String(options.page ?? 1),
              pageSize: String(options.pageSize ?? ""),
            }),
            "demo",
            revision,
          ],
          queryFn: async () =>
            buildStatusManagementList(
              state.teachers.map((teacher) => ({
                academyId: teacher.academyId,
                entityType: "teacher",
                entityId: teacher.teacherId,
                name: teacher.name,
                status: (teacher.status ?? "employed") as
                  | "on_leave"
                  | "resigned",
                changedAt:
                  teacher.status === "resigned"
                    ? teacher.resignedAt
                    : teacher.onLeaveAt,
                retentionUntil: teacher.retentionUntil,
                archivedAt: teacher.archivedAt,
                primaryInfo: teacher.part,
                secondaryInfo: teacher.contact,
                detailSummary: teacher.workScheduleSummary,
                statusReason: teacher.statusReason,
              })),
              { ...options, entityType: "teacher" },
            ),
        };
      },
      createLessonTicketListQueryOptions(options) {
        return {
          queryKey: [
            ...createLessonTicketListQueryKey(options),
            "demo",
            revision,
          ],
          queryFn: async () => buildLessonTicketList(state.tickets, options),
        };
      },
      createLessonTicketRegistrationOptionsQueryOptions(academyId) {
        return {
          queryKey: [
            ...queryKeys.lessonTickets.registrationOptions(academyId),
            "demo",
            revision,
          ],
          queryFn: async () =>
            state.students
              .filter((student) => student.academyId === academyId)
              .map((student) => ({
                studentId: student.studentId,
                studentName: student.name,
                instruments: state.enrollments
                  .filter(
                    (enrollment) =>
                      enrollment.academyId === academyId &&
                      enrollment.studentId === student.studentId &&
                      enrollment.lessonType === "private" &&
                      enrollment.active,
                  )
                  .map((enrollment) => ({
                    instrumentId: enrollment.instrumentId,
                    instrumentName: enrollment.instrumentName,
                  })),
              })),
        };
      },
      createFinanceLedgerListQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.finance.ledgerList(options.academyId, {
              q: options.search,
              type: options.filters?.type,
              source: options.filters?.source,
              category: options.filters?.category,
              from: options.dateRange?.from,
              to: options.dateRange?.to,
              sort: options.sort
                ? `${options.sort.field}-${options.sort.direction}`
                : undefined,
            }),
            "demo",
            revision,
          ],
          queryFn: async () => buildFinanceLedgerList(state.ledgerEntries, options),
        };
      },
      createVendorListQueryOptions(options) {
        return {
          queryKey: [...createVendorListQueryKey(options), "demo", revision],
          queryFn: async () => buildVendorList(state.vendors, options),
        };
      },
      createConsultationListQueryOptions(options) {
        return {
          queryKey: [...createConsultationListQueryKey(options), "demo", revision],
          queryFn: async () => buildConsultationList(state.consultations, options),
        };
      },
      createBookStockListQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.books.stockList(options.academyId, {
              q: options.search,
              sort: options.sortOrder,
              page: options.page?.toString(),
              pageSize: options.pageSize?.toString(),
            }),
            "demo",
            revision,
          ],
          queryFn: async () =>
            buildBookStockList(
              state.books.filter((book) => book.active),
              options,
            ),
        };
      },
      createBookOptionsQueryOptions() {
        return {
          queryKey: [...queryKeys.books.options(state.academyId), "demo", revision],
          queryFn: async () => state.books.filter((book) => book.active),
        };
      },
      createPendingBookReleasesQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.books.pendingList(options.academyId, {
              q: options.search,
              page: options.page?.toString(),
              pageSize: options.pageSize?.toString(),
            }),
            "demo",
            revision,
          ],
          queryFn: async () => buildBookShipmentList(state.bookSales, options),
        };
      },
      createPaidBookReleasesQueryOptions(options) {
        return {
          queryKey: [
            ...queryKeys.books.paidList(options.academyId, {
              month: options.month,
              q: options.search,
              page: options.page?.toString(),
              pageSize: options.pageSize?.toString(),
            }),
            "demo",
            revision,
          ],
          queryFn: async () => buildBookPaidList(state.bookSales, options),
        };
      },
    }),
    [commitBookChange, commitState, revision, state],
  );

  return (
    <DemoAcademyContext.Provider value={value}>
      {children}
    </DemoAcademyContext.Provider>
  );
}

export function useDemoAcademy() {
  const context = useContext(DemoAcademyContext);

  if (!context) {
    throw new Error("DemoAcademyProvider 안에서만 사용할 수 있습니다.");
  }

  return context;
}

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

import { buildBookPurchaseList, type LedgerEntry } from "@/domain/book-sale";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import {
  buildLessonTicketList,
  type BuildLessonTicketListOptions,
} from "@/domain/lesson-ticket";
import { buildStudentList } from "@/domain/student-list";
import {
  buildStatusManagementList,
  type StatusManagementFetchOptions,
} from "@/domain/status-management";
import { buildTeacherList } from "@/domain/teacher-list";
import { buildVendorList } from "@/domain/vendor-list";
import { createBookPurchaseListQueryKey } from "@/lib/api/books";
import { createLessonTicketListQueryKey } from "@/lib/api/lesson-tickets";
import type { RegisterPrivateLessonEventInput } from "@/lib/api/private-lessons";

import {
  createInitialDemoAcademyState,
  deleteDemoLedgerEntry,
  markDemoPrivateLessonAttendance,
  registerDemoAcademyStudent,
  registerDemoAcademyTeacher,
  registerDemoBookRelease,
  registerDemoLessonTicketPurchase,
  registerDemoManualLedgerEntry,
  registerDemoVendor,
  updateDemoAcademyStudent,
  updateDemoAcademyTeacher,
  updateDemoLedgerEntry,
  updateDemoStudentStatus,
  updateDemoTeacherStatus,
  updateDemoVendor,
  type DemoAcademyState,
  type DemoBookReleaseInput,
  type DemoLessonTicketPurchaseInput,
  type DemoManualLedgerInput,
  type DemoStudentRegistrationInput,
  type DemoStudentUpdateInput,
  type DemoStudentStatusInput,
  type DemoTeacherRegistrationInput,
  type DemoTeacherStatusInput,
  type DemoTeacherUpdateInput,
  type DemoVendorRegistrationInput,
  type DemoVendorUpdateInput,
} from "./academy-demo-state";
import { queryKeys } from "../api/query-keys";
import { createVendorListQueryKey } from "../api/vendors";

type DemoAcademyContextValue = {
  state: DemoAcademyState;
  registerStudent: (input: DemoStudentRegistrationInput) => void;
  updateStudent: (input: DemoStudentUpdateInput) => void;
  updateStudentStatus: (input: DemoStudentStatusInput) => void;
  registerTeacher: (input: DemoTeacherRegistrationInput) => void;
  updateTeacher: (input: DemoTeacherUpdateInput) => void;
  updateTeacherStatus: (input: DemoTeacherStatusInput) => void;
  registerLessonTicketPurchase: (
    input: Omit<DemoLessonTicketPurchaseInput, "studentName" | "instrumentName"> & {
      studentName?: string;
      instrumentName?: string;
    },
  ) => Promise<void>;
  registerPrivateLesson: (input: RegisterPrivateLessonEventInput) => Promise<void>;
  markPrivateLessonAttendance: (
    lessonId: string,
    status: "present" | "absent",
  ) => void;
  registerManualLedgerEntry: (input: DemoManualLedgerInput) => void;
  updateLedgerEntry: (input: LedgerEntry) => void;
  deleteLedgerEntry: (input: { ledgerId: string }) => void;
  registerVendor: (input: DemoVendorRegistrationInput) => void;
  updateVendor: (input: DemoVendorUpdateInput) => void;
  registerBookRelease: (
    input: Omit<DemoBookReleaseInput, "studentName"> & {
      studentName?: string;
    },
  ) => void;
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
  createBookPurchaseListQueryOptions: (options: Parameters<typeof buildBookPurchaseList>[1]) => {
    queryKey: QueryKey;
    queryFn: () => Promise<ReturnType<typeof buildBookPurchaseList>>;
  };
};

const DemoAcademyContext = createContext<DemoAcademyContextValue | null>(null);

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

  const value = useMemo<DemoAcademyContextValue>(
    () => ({
      state,
      registerStudent(input) {
        commitState((current) => registerDemoAcademyStudent(current, input));
      },
      updateStudent(input) {
        commitState((current) => updateDemoAcademyStudent(current, input));
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
      async registerLessonTicketPurchase(input) {
        commitState((current) =>
          registerDemoLessonTicketPurchase(current, {
            ...input,
            studentName:
              input.studentName ??
              current.students.find((student) => student.studentId === input.studentId)
                ?.name ??
              "이름 없음",
            instrumentName:
              input.instrumentName ??
              current.enrollments.find(
                (enrollment) =>
                  enrollment.studentId === input.studentId &&
                  enrollment.instrumentId === input.instrumentId,
              )?.instrumentName ??
              "악기 없음",
          }),
        );
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
      markPrivateLessonAttendance(lessonId, status) {
        commitState((current) =>
          markDemoPrivateLessonAttendance(current, {
            lessonId,
            status,
            markedAt: new Date().toISOString(),
          }),
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
      registerBookRelease(input) {
        commitState((current) =>
          registerDemoBookRelease(current, {
            ...input,
            studentName:
              input.studentName ??
              current.students.find((student) => student.studentId === input.studentId)
                ?.name ??
              "이름 없음",
          }),
        );
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
      createBookPurchaseListQueryOptions(options) {
        return {
          queryKey: [
            ...createBookPurchaseListQueryKey(options),
            "demo",
            revision,
          ],
          queryFn: async () => buildBookPurchaseList(state.bookSales, options),
        };
      },
    }),
    [commitState, revision, state],
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

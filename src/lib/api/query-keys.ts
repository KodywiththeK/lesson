type StudentListFilters = {
  status?: "active" | "suspended" | "withdrawn";
  q?: string;
  teacherName?: string;
  instrumentName?: string;
  weekdayLabel?: string;
  page?: string;
  pageSize?: string;
};

type TeacherListFilters = {
  q?: string;
  part?: string;
  payType?: string;
  status?: string;
};

type VendorListFilters = {
  q?: string;
  kind?: string;
};

type BookPurchaseListFilters = {
  q?: string;
  status?: string;
};

type FinanceLedgerListFilters = {
  q?: string;
  type?: string;
  source?: string;
  category?: string;
  from?: string;
  to?: string;
  sort?: string;
};

type LessonTicketListFilters = {
  q?: string;
  status?: string;
};

type StatusManagementListFilters = {
  entityType: "student" | "teacher";
  status: "suspended" | "withdrawn" | "on_leave" | "resigned";
};

export const queryKeys = {
  academy: (academyId: string) => ["academy", academyId] as const,
  students: {
    list: (academyId: string, filters: StudentListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "students",
        "list",
        filters.status ?? "all",
        filters.q ?? "",
        filters.teacherName ?? "",
        filters.instrumentName ?? "",
        filters.weekdayLabel ?? "",
        filters.page ?? "",
        filters.pageSize ?? "",
      ] as const,
  },
  teachers: {
    list: (academyId: string, filters: TeacherListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "teachers",
        "list",
        filters.q ?? "",
        filters.part ?? "",
        filters.payType ?? "",
        filters.status ?? "",
      ] as const,
  },
  statusManagement: {
    list: (academyId: string, filters: StatusManagementListFilters) =>
      [
        ...queryKeys.academy(academyId),
        "status-management",
        filters.entityType,
        filters.status,
      ] as const,
  },
  vendors: {
    list: (academyId: string, filters: VendorListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "vendors",
        "list",
        filters.q ?? "",
        filters.kind ?? "",
      ] as const,
  },
  books: {
    purchaseList: (
      academyId: string,
      filters: BookPurchaseListFilters = {},
    ) =>
      [
        ...queryKeys.academy(academyId),
        "books",
        "purchase-list",
        filters.q ?? "",
        filters.status ?? "",
      ] as const,
  },
  finance: {
    all: (academyId: string) =>
      [...queryKeys.academy(academyId), "finance"] as const,
    ledgerList: (academyId: string, filters: FinanceLedgerListFilters = {}) =>
      [
        ...queryKeys.finance.all(academyId),
        "ledger-list",
        filters.q ?? "",
        filters.type ?? "",
        filters.source ?? "",
        filters.category ?? "",
        filters.from ?? "",
        filters.to ?? "",
        filters.sort ?? "",
      ] as const,
  },
  lessonTickets: {
    list: (academyId: string, filters: LessonTicketListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "lesson-tickets",
        "list",
        filters.q ?? "",
        filters.status ?? "",
      ] as const,
    registrationOptions: (academyId: string) =>
      [
        ...queryKeys.academy(academyId),
        "lesson-tickets",
        "registration-options",
      ] as const,
    summary: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "summary"] as const,
  },
  privateLessons: {
    registrationOptions: (academyId: string) =>
      [
        ...queryKeys.academy(academyId),
        "private-lessons",
        "registration-options",
      ] as const,
  },
  academyLessons: {
    dailyAttendance: (academyId: string, date: string) =>
      [
        ...queryKeys.academy(academyId),
        "academy-lessons",
        "daily-attendance",
        date,
      ] as const,
  },
  lessonWorkspace: {
    month: (academyId: string, month: string) =>
      [...queryKeys.academy(academyId), "lesson-workspace", month] as const,
  },
};

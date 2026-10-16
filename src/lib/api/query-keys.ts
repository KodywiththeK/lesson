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
  page?: string;
  pageSize?: string;
  q?: string;
  part?: string;
  payType?: string;
  status?: string;
};

type VendorListFilters = {
  page?: string;
  pageSize?: string;
  q?: string;
  kind?: string;
};

type ConsultationListFilters = {
  page?: string;
  pageSize?: string;
  q?: string;
  instrumentName?: string;
};

type BookPurchaseListFilters = {
  page?: string;
  pageSize?: string;
  q?: string;
  status?: string;
};

type FinanceLedgerListFilters = {
  page?: string;
  pageSize?: string;
  q?: string;
  type?: string;
  source?: string;
  category?: string;
  from?: string;
  to?: string;
  sort?: string;
};

type LessonTicketListFilters = {
  today?: string;
  page?: string;
  pageSize?: string;
  q?: string;
  status?: string;
};

type StatusManagementListFilters = {
  entityType: "student" | "teacher";
  status: "suspended" | "withdrawn" | "on_leave" | "resigned";
  q?: string;
  page?: string;
  pageSize?: string;
};

export const queryKeys = {
  academy: (academyId: string) => ["academy", academyId] as const,
  students: {
    options: (academyId: string) =>
      [...queryKeys.academy(academyId), "students", "options"] as const,
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
    options: (academyId: string) =>
      [...queryKeys.academy(academyId), "teachers", "options"] as const,
    list: (academyId: string, filters: TeacherListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "teachers",
        "list",
        filters.q ?? "",
        filters.part ?? "",
        filters.payType ?? "",
        filters.status ?? "",
        filters.page ?? "",
        filters.pageSize ?? "",
      ] as const,
  },
  statusManagement: {
    list: (academyId: string, filters: StatusManagementListFilters) =>
      [
        ...queryKeys.academy(academyId),
        "status-management",
        filters.entityType,
        filters.status,
        filters.q ?? "",
        filters.page ?? "",
        filters.pageSize ?? "",
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
        filters.page ?? "",
        filters.pageSize ?? "",
      ] as const,
  },
  consultations: {
    all: (academyId: string) =>
      [...queryKeys.academy(academyId), "consultations"] as const,
    list: (academyId: string, filters: ConsultationListFilters = {}) =>
      [
        ...queryKeys.consultations.all(academyId),
        "list",
        filters.q ?? "",
        filters.instrumentName ?? "",
        filters.page ?? "",
        filters.pageSize ?? "",
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
        filters.page ?? "",
        filters.pageSize ?? "",
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
        filters.page ?? "",
        filters.pageSize ?? "",
      ] as const,
  },
  lessonTickets: {
    list: (academyId: string, filters: LessonTicketListFilters = {}) =>
      [
        ...queryKeys.academy(academyId),
        "lesson-tickets",
        "list",
        filters.today ?? "",
        filters.q ?? "",
        filters.status ?? "",
        filters.page ?? "",
        filters.pageSize ?? "",
      ] as const,
    registrationOptions: (academyId: string) =>
      [
        ...queryKeys.academy(academyId),
        "lesson-tickets",
        "registration-options",
      ] as const,
    summary: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "summary"] as const,
    assignedBalances: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "assigned-balances"] as const,
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

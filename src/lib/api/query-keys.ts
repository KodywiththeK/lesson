type StudentListFilters = {
  status?: "active" | "suspended" | "withdrawn";
  q?: string;
  teacherName?: string;
  instrumentName?: string;
  weekdayLabel?: string;
};

type TeacherListFilters = {
  q?: string;
  part?: string;
  payType?: string;
};

type VendorListFilters = {
  q?: string;
  kind?: string;
};

type BookPurchaseListFilters = {
  q?: string;
  status?: string;
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
  lessonTickets: {
    summary: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "summary"] as const,
  },
};

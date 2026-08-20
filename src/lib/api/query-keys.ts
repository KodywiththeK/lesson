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
  lessonTickets: {
    summary: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "summary"] as const,
  },
};

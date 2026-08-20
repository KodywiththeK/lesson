type StudentListFilters = {
  status?: "active" | "suspended" | "withdrawn";
  q?: string;
  teacherName?: string;
  instrumentName?: string;
  weekdayLabel?: string;
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
  lessonTickets: {
    summary: (academyId: string) =>
      [...queryKeys.academy(academyId), "lesson-tickets", "summary"] as const,
  },
};

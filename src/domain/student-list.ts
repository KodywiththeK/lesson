import {
  buildListView,
  compareKoreanNames,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type StudentListRow = {
  academyId: string;
  studentId: string;
  name: string;
  age?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  attendanceCode?: string;
  registeredOn?: string;
  status?: string;
  suspendedAt?: string;
  withdrawnAt?: string;
  retentionUntil?: string;
  archivedAt?: string;
  statusReason?: string;
  contacts?: StudentListContact[];
  teacherNames: string[];
  instrumentNames: string[];
  weekdayLabels: string[];
  instruments?: StudentListInstrument[];
};

export type StudentListContact = {
  contactId: string;
  relationship: string;
  phone: string;
  phoneLast4?: string;
};

export type StudentInstrumentWeeklySchedule = {
  scheduleId?: string;
  weekday: string;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
};

export type StudentListInstrument = {
  studentInstrumentId: string;
  teacherId: string | null;
  teacherName: string;
  instrumentId: string;
  instrumentName: string;
  lessonType: "academy" | "private" | string;
  weekdayLabels: string[];
  startTime: string;
  endTime: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  finalMonthlyFee: number;
  active: boolean;
  weeklySchedules?: StudentInstrumentWeeklySchedule[];
};

export type StudentListFilters = {
  teacherName?: string;
  instrumentName?: string;
  weekdayLabel?: string;
};

export type BuildStudentListOptions = {
  academyId: string;
  search?: string;
  filters?: StudentListFilters;
  page?: number;
  pageSize?: PageSizeOption;
};

export function buildStudentList(
  students: StudentListRow[],
  options: BuildStudentListOptions,
): ListView<StudentListRow> {
  const scopedStudents = students
    .filter((student) => student.academyId === options.academyId)
    .filter((student) => matchesStudentFilters(student, options.filters));

  return buildListView(scopedStudents, {
    getName: (student) => student.name,
    search: options.search,
    searchFields: [
      (student) => student.name,
      (student) => student.attendanceCode,
      (student) => student.contacts?.map((contact) => contact.phone).join(" "),
      (student) => student.teacherNames.join(" "),
      (student) => student.instrumentNames.join(" "),
      (student) => student.weekdayLabels.join(" "),
    ],
    getTieBreaker: (student) => student.studentId,
    page: options.page,
    pageSize: options.pageSize,
  });
}

/** 요일 필터 선택지. 원생 데이터와 상관없이 항상 이 순서로 보여준다. */
export const STUDENT_WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export type StudentFilterOptions = {
  teacherNames: string[];
  instrumentNames: string[];
  weekdayLabels: string[];
};

/**
 * 필터 선택지를 전체 원생 기준으로 만든다. 현재 페이지나 이미 적용된 필터 결과로 계산하면
 * 필터를 하나 거는 순간 다른 값으로 바꿀 수 없으므로, 호출부는 필터가 적용되지 않은 원생 전체를 넘긴다.
 */
export function buildStudentFilterOptions(
  allStudents: StudentListRow[],
  knownOptions: { teacherNames?: string[]; instrumentNames?: string[] } = {},
): StudentFilterOptions {
  return {
    teacherNames: uniqueSortedNames([
      ...(knownOptions.teacherNames ?? []),
      ...allStudents.flatMap((student) => student.teacherNames),
    ]),
    instrumentNames: uniqueSortedNames([
      ...(knownOptions.instrumentNames ?? []),
      ...allStudents.flatMap((student) => student.instrumentNames),
    ]),
    weekdayLabels: [...STUDENT_WEEKDAY_LABELS],
  };
}

function uniqueSortedNames(names: string[]) {
  return [...new Set(names)].sort(compareKoreanNames);
}

function matchesStudentFilters(
  student: StudentListRow,
  filters: StudentListFilters | undefined,
) {
  if (!filters) {
    return true;
  }

  return (
    matchesOptionalValue(student.teacherNames, filters.teacherName) &&
    matchesOptionalValue(student.instrumentNames, filters.instrumentName) &&
    matchesOptionalValue(student.weekdayLabels, filters.weekdayLabel)
  );
}

function matchesOptionalValue(values: string[], expected: string | undefined) {
  return !expected || values.includes(expected);
}

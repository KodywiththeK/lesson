import {
  buildListView,
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
    page: options.page,
    pageSize: options.pageSize,
  });
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

import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type StudentListRow = {
  academyId: string;
  studentId: string;
  name: string;
  teacherNames: string[];
  instrumentNames: string[];
  weekdayLabels: string[];
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

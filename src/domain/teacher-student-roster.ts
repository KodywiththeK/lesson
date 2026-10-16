import { buildListView, type ListView, type PageSizeOption } from "./common-list";

/** 선생님이 보는 담당 원생 명단 한 줄. 연락처·학교·수강료 같은 민감 정보는 담지 않는다. */
export type TeacherStudentRosterRow = {
  academyId: string;
  studentId: string;
  name: string;
  instrumentNames: string[];
  weekdayLabels: string[];
};

export type BuildTeacherStudentRosterOptions = {
  academyId: string;
  search?: string;
  page?: number;
  pageSize?: PageSizeOption;
};

export function buildTeacherStudentRoster(
  rows: TeacherStudentRosterRow[],
  options: BuildTeacherStudentRosterOptions,
): ListView<TeacherStudentRosterRow> {
  return buildListView(
    rows.filter((row) => row.academyId === options.academyId),
    {
      getName: (row) => row.name,
      getTieBreaker: (row) => row.studentId,
      search: options.search,
      searchFields: [
        (row) => row.name,
        (row) => row.instrumentNames.join(" "),
        (row) => row.weekdayLabels.join(" "),
      ],
      page: options.page,
      pageSize: options.pageSize,
    },
  );
}

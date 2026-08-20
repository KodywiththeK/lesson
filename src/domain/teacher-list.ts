import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";
import type { TeacherPayType } from "./teacher";

export type TeacherListRow = {
  academyId: string;
  teacherId: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  payType: TeacherPayType;
};

export type TeacherListFilters = {
  part?: string;
  payType?: TeacherPayType;
};

export type BuildTeacherListOptions = {
  academyId: string;
  search?: string;
  filters?: TeacherListFilters;
  page?: number;
  pageSize?: PageSizeOption;
};

const TEACHER_PAY_TYPE_LABELS: Record<TeacherPayType, string> = {
  monthly: "월급제",
  hourly: "시급제",
  ratio: "비율제",
};

export function buildTeacherList(
  teachers: TeacherListRow[],
  options: BuildTeacherListOptions,
): ListView<TeacherListRow> {
  const scopedTeachers = teachers
    .filter((teacher) => teacher.academyId === options.academyId)
    .filter((teacher) => matchesTeacherFilters(teacher, options.filters));

  return buildListView(scopedTeachers, {
    getName: (teacher) => teacher.name,
    search: options.search,
    searchFields: [
      (teacher) => teacher.name,
      (teacher) => teacher.part,
      (teacher) => teacher.contact,
      (teacher) => formatTeacherPayType(teacher.payType),
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export function formatTeacherPayType(payType: TeacherPayType) {
  return TEACHER_PAY_TYPE_LABELS[payType];
}

function matchesTeacherFilters(
  teacher: TeacherListRow,
  filters: TeacherListFilters | undefined,
) {
  if (!filters) {
    return true;
  }

  return (
    (!filters.part || teacher.part === filters.part) &&
    (!filters.payType || teacher.payType === filters.payType)
  );
}

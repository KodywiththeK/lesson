import {
  buildListView,
  compareKoreanNames,
  type ListSortDirection,
  type ListView,
  type PageSizeOption,
} from "./common-list";
import { getFinanceToday } from "./finance-date";
import type { StudentDiscountKind } from "./lesson-pricing";

export type StudentListRow = {
  academyId: string;
  studentId: string;
  name: string;
  age?: number;
  /** `age`를 입력한 해(KST). 표시 나이는 `getStudentDisplayAge`로 계산한다. */
  ageAsOfYear?: number;
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
  /** 선택한 할인 종류. 종류 없이 저장된 이전 금액은 `discountTotal`에만 남아 있다. */
  discountKinds?: StudentDiscountKind[];
  /** 지인 소개 할인을 적용하는 달 `YYYY-MM`. */
  referralDiscountMonth?: string;
  referralDiscountAmount?: number;
  finalMonthlyFee: number;
  active: boolean;
  weeklySchedules?: StudentInstrumentWeeklySchedule[];
};

export type StudentListFilters = {
  teacherName?: string;
  instrumentName?: string;
  weekdayLabel?: string;
};

export type StudentSortKey = "name" | "teacher" | "instrument" | "weekday";

export type StudentSort = {
  key: StudentSortKey;
  direction: ListSortDirection;
};

export const DEFAULT_STUDENT_SORT: StudentSort = { key: "name", direction: "asc" };

export const STUDENT_SORT_OPTIONS: ReadonlyArray<{ key: StudentSortKey; label: string }> = [
  { key: "name", label: "이름" },
  { key: "teacher", label: "담당 선생님" },
  { key: "instrument", label: "악기" },
  { key: "weekday", label: "정기 요일" },
];

export type BuildStudentListOptions = {
  academyId: string;
  search?: string;
  filters?: StudentListFilters;
  /** 없으면 이름 가나다순. 같은 값은 이름, 원생 ID 순으로 고정한다. */
  sort?: StudentSort;
  page?: number;
  pageSize?: PageSizeOption;
};

export function buildStudentList(
  students: StudentListRow[],
  options: BuildStudentListOptions,
): ListView<StudentListRow> {
  const sort = options.sort ?? DEFAULT_STUDENT_SORT;
  const scopedStudents = students
    .filter((student) => student.academyId === options.academyId)
    .filter((student) => matchesStudentFilters(student, options.filters));

  return buildListView(scopedStudents, {
    getName: (student) => student.name,
    getSortValue: (student) => getStudentSortValue(student, sort.key),
    sortDirection: sort.direction,
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

function getStudentSortValue(student: StudentListRow, key: StudentSortKey) {
  switch (key) {
    case "name":
      return student.name;
    case "teacher":
      return student.teacherNames.join(", ");
    case "instrument":
      return student.instrumentNames.join(", ");
    case "weekday":
      return toWeekdaySortKey(student.weekdayLabels);
  }
}

/** 요일 목록을 이른 요일부터 비교할 수 있는 문자열로 바꾼다. 월→a … 일→g. */
function toWeekdaySortKey(weekdayLabels: string[]) {
  return weekdayLabels
    .map((label) => STUDENT_WEEKDAY_LABELS.indexOf(label as (typeof STUDENT_WEEKDAY_LABELS)[number]))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)
    .map((index) => String.fromCharCode("a".charCodeAt(0) + index))
    .join("");
}

/**
 * 표시할 나이. 입력한 나이는 `ageAsOfYear` 이후 해가 바뀔 때마다(매년 1월 1일 기준) 1살씩 늘어난다.
 * `today`는 학원 기준(Asia/Seoul) 날짜 `YYYY-MM-DD`다.
 */
export function getStudentDisplayAge(
  student: Pick<StudentListRow, "age" | "ageAsOfYear">,
  today: string = getFinanceToday(),
): number | undefined {
  if (student.age === undefined) {
    return undefined;
  }
  if (student.ageAsOfYear === undefined) {
    return student.age;
  }

  const currentYear = Number(today.slice(0, 4));

  return student.age + Math.max(0, currentYear - student.ageAsOfYear);
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

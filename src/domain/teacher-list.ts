import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";
import type { TeacherPayType, TeacherStatus } from "./teacher";

export type TeacherWorkSchedule = {
  scheduleId?: string;
  weekday: string;
  weekdayLabel: string;
  startTime?: string;
  endTime?: string;
};

export type TeacherListRow = {
  academyId: string;
  teacherId: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  payType: TeacherPayType;
  status?: TeacherStatus;
  contractStartOn?: string;
  contractEndOn?: string;
  onLeaveAt?: string;
  resignedAt?: string;
  retentionUntil?: string;
  archivedAt?: string;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioTeacherShare?: number;
  salarySummary?: string;
  workSchedules?: TeacherWorkSchedule[];
  workScheduleSummary?: string;
};

export type TeacherListFilters = {
  part?: string;
  payType?: TeacherPayType;
  status?: TeacherStatus;
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

const TEACHER_STATUS_LABELS: Record<TeacherStatus, string> = {
  employed: "재직",
  on_leave: "휴직",
  resigned: "퇴사",
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
      (teacher) => formatTeacherStatus(teacher.status ?? "employed"),
      (teacher) => teacher.salarySummary ?? "",
      (teacher) => teacher.workScheduleSummary ?? "",
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export function formatTeacherPayType(payType: TeacherPayType) {
  return TEACHER_PAY_TYPE_LABELS[payType];
}

export function formatTeacherStatus(status: TeacherStatus) {
  return TEACHER_STATUS_LABELS[status];
}

export function formatTeacherSalarySummary(
  row: Pick<
    TeacherListRow,
    "payType" | "monthlySalary" | "hourlyRate" | "ratioTeacherShare"
  >,
) {
  if (row.payType === "monthly") {
    return `월급제 ${formatWon(row.monthlySalary ?? 0)}`;
  }

  if (row.payType === "hourly") {
    return `시급제 ${formatWon(row.hourlyRate ?? 0)}`;
  }

  return `비율제 ${row.ratioTeacherShare ?? 0}%`;
}

export function formatTeacherWorkScheduleSummary(
  schedules: TeacherWorkSchedule[] | undefined,
) {
  if (!schedules || schedules.length === 0) {
    return "-";
  }

  return schedules
    .map((schedule) =>
      schedule.startTime && schedule.endTime
        ? `${schedule.weekdayLabel} ${schedule.startTime}-${schedule.endTime}`
        : schedule.weekdayLabel,
    )
    .join(", ");
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
    (!filters.payType || teacher.payType === filters.payType) &&
    (!filters.status || (teacher.status ?? "employed") === filters.status)
  );
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

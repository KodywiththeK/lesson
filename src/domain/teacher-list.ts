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
  statusReason?: string;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioTeacherShare?: number;
  salarySummary?: string;
  workSchedules?: TeacherWorkSchedule[];
  workScheduleSummary?: string;
  /** 마스킹된 주민등록번호(`900101-1******`). 원문과 암호문은 목록 행에 싣지 않는다. */
  residentRegistrationMasked?: string;
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

/** 담당 파트 선택 목록. 목록 밖 값은 기존 데이터를 유지할 때만 `buildTeacherPartFormOptions`가 더한다. */
export const TEACHER_PARTS = ["피아노", "바이올린", "첼로", "플루트", "원장"];

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
    getTieBreaker: (teacher) => teacher.teacherId,
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

/** 등록·수정 폼의 담당 파트 선택지. 기존 선생님의 파트가 목록 밖이어도 사라지지 않게 마지막에 더한다. */
export function buildTeacherPartFormOptions(currentPart: string | undefined) {
  const part = currentPart?.trim();

  return part && !TEACHER_PARTS.includes(part) ? [...TEACHER_PARTS, part] : TEACHER_PARTS;
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

  return sortTeacherWorkSchedules(schedules)
    .map((schedule) =>
      schedule.startTime && schedule.endTime
        ? `${schedule.weekdayLabel} ${schedule.startTime}-${schedule.endTime}`
        : schedule.weekdayLabel,
    )
    .join(", ");
}

export function sortTeacherWorkSchedules<T extends Pick<TeacherWorkSchedule, "weekdayLabel">>(
  schedules: readonly T[],
): T[] {
  return [...schedules].sort(
    (left, right) => getWeekdayOrder(left.weekdayLabel) - getWeekdayOrder(right.weekdayLabel),
  );
}

export function formatTeacherContractPeriod(startOn?: string, endOn?: string) {
  if (startOn && endOn) return `${startOn}~${endOn}`;
  if (startOn) return `${startOn}~`;
  if (endOn) return `~${endOn}`;
  return "-";
}

const WEEKDAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];

function getWeekdayOrder(weekdayLabel: string) {
  const index = WEEKDAY_ORDER.indexOf(weekdayLabel);
  return index < 0 ? WEEKDAY_ORDER.length : index;
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

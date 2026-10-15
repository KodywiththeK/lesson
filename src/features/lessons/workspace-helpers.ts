import { type Dispatch, type SetStateAction } from "react";

import {
  formatAcademyLessonOriginLabel,
  type DailyAcademyAttendanceRow,
} from "@/domain/academy-lesson-attendance";
import type { MakeupLessonTimes } from "@/domain/academy-lesson-absence";
import { compareKoreanNames } from "@/domain/common-list";
import {
  formatKoreanTimeLabel,
  type PrivateLesson,
  type PrivateLessonStudentSearchResult,
} from "@/domain/private-lesson";
import type { RegisterPrivateLessonEventInput } from "@/lib/api/private-lessons";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import type {
  CalendarEvent,
  MoveLessonDraft,
  LessonView,
} from "@/features/lessons/workspace-types";

export {
  appendAcademyAttendanceRow,
  compareAcademyAttendanceRows,
  createEmptySheet,
  indexSheets,
  removeAcademyAttendanceRow,
  resetAttendanceSheets,
  updateAttendanceSheets,
} from "@/domain/academy-lesson-sheets";

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourMinuteFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toMovedAcademyAttendanceRow(
  draft: MoveLessonDraft,
): DailyAcademyAttendanceRow {
  // 보강 일정을 옮겨도 보강 표시와 원래 결석 연결을 유지하고, 시간을 바꾸지 않았으면 시간 미정도 유지한다.
  const isMakeup = draft.row.origin === "makeup";
  const origin = isMakeup ? "makeup" : "rescheduled";
  const keepsTime =
    draft.startTime === draft.row.startTime && draft.endTime === draft.row.endTime;

  return {
    ...draft.row,
    lessonEventId: `rescheduled-${draft.row.lessonEventId}-${draft.targetDate}-${draft.startTime}`,
    date: draft.targetDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    status: "pending",
    origin,
    originLabel: formatAcademyLessonOriginLabel(origin),
    absenceReason: undefined,
    absenceResolution: undefined,
    timeUnspecified: isMakeup && keepsTime ? draft.row.timeUnspecified : undefined,
    sourceLessonEventId: isMakeup ? draft.row.sourceLessonEventId : undefined,
    markedAt: undefined,
  };
}

/** 보강 확정 시 보강일에 새로 생기는 [보강 수업] 일정. 원본 결석 일정은 그대로 남는다. */
export function toMakeupAttendanceRow({
  source,
  lessonEventId,
  targetDate,
  times,
}: {
  source: DailyAcademyAttendanceRow;
  lessonEventId: string;
  targetDate: string;
  times: Extract<MakeupLessonTimes, { ok: true }>;
}): DailyAcademyAttendanceRow {
  return {
    academyId: source.academyId,
    lessonEventId,
    studentId: source.studentId,
    studentName: source.studentName,
    instrumentId: source.instrumentId,
    instrumentName: source.instrumentName,
    teacherId: source.teacherId,
    teacherName: source.teacherName,
    date: targetDate,
    startTime: times.startTime,
    endTime: times.endTime,
    status: "pending",
    origin: "makeup",
    originLabel: formatAcademyLessonOriginLabel("makeup"),
    timeUnspecified: times.timeUnspecified || undefined,
  };
}

export function updateSelectedDate(
  nextDate: string,
  options: {
    selectedMonth: string;
    setSelectedDate: Dispatch<SetStateAction<string>>;
    resetOverrides: () => void;
  },
) {
  if (nextDate.slice(0, 7) !== options.selectedMonth) {
    options.resetOverrides();
  }

  options.setSelectedDate(nextDate);
}

export function updateSelectedMonth(
  nextMonth: string,
  options: {
    selectedDate: string;
    setSelectedDate: Dispatch<SetStateAction<string>>;
    resetOverrides: () => void;
  },
) {
  if (!nextMonth) {
    return;
  }

  const selectedDay = Number(options.selectedDate.slice(8, 10));
  const nextDate = `${nextMonth}-${pad2(
    Math.min(selectedDay, getLastDayOfMonth(nextMonth)),
  )}`;

  if (nextMonth !== options.selectedDate.slice(0, 7)) {
    options.resetOverrides();
  }

  options.setSelectedDate(nextDate);
}

export function createEmptyWorkspaceData(): LessonWorkspaceDemoData {
  return {
    academySheets: [],
    privateLessons: [],
    ticketBalances: [],
    registrationOptions: {
      students: [],
      teachers: [],
    },
    privateRegistrationOptions: {
      students: [],
      teachers: [],
    },
    calendarMemos: [],
    academyMemo: "",
    privateMemo: "",
  };
}

export function toAcademyCalendarEvent(row: DailyAcademyAttendanceRow): CalendarEvent {
  return {
    id: row.lessonEventId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.studentName,
    subtitle: row.instrumentName,
    status: row.status,
    origin: row.origin,
    originLabel: row.originLabel,
    timeUnspecified: row.timeUnspecified,
    movable: row.status === "pending",
  };
}

export function toPrivateCalendarEvent(
  lesson: PrivateLesson,
  sessionLabel?: string,
): CalendarEvent {
  const startTime = toSeoulHourMinute(lesson.startAt);

  return {
    id: lesson.id,
    date: toSeoulDate(lesson.startAt),
    startTime,
    timeLabel: formatKoreanTimeLabel(startTime),
    detailLabel: `${lesson.studentName} (${lesson.instrumentName}) - ${lesson.teacherName} 선생님`,
    sessionLabel,
    endTime: toSeoulHourMinute(lesson.endAt),
    title: lesson.studentName,
    subtitle: lesson.teacherName,
    status:
      lesson.status === "present" || lesson.status === "absent"
        ? lesson.status
        : "scheduled",
    origin: lesson.origin,
    originLabel: lesson.originLabel,
  };
}

export function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.title, right.title)
  );
}

export function comparePrivateLessonsByTime(left: PrivateLesson, right: PrivateLesson) {
  return (
    left.startAt.localeCompare(right.startAt) ||
    compareKoreanNames(left.studentName, right.studentName) ||
    compareKoreanNames(left.id, right.id)
  );
}

/** 시간순처럼 이미 정해진 순서를 바꾸지 않고 현재 페이지만 자른다. 이름순 목록은 buildListView를 쓴다. */
export function toRegisteredPrivateLesson(
  input: RegisterPrivateLessonEventInput,
): PrivateLesson {
  return {
    id: `private-lesson-${Date.now()}`,
    academyId: input.academyId,
    studentId: input.studentId,
    studentName: input.studentName,
    instrumentId: input.instrumentId,
    instrumentName: input.instrumentName,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    startAt: input.startAt,
    endAt: input.endAt,
    status: "scheduled",
    origin: "private",
    originLabel: "개인레슨",
  };
}

export function buildCalendarDates(selectedDate: string) {
  const [year, month] = selectedDate.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const dates: string[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    dates.push(toDateInputValue(date));
  }

  return dates;
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));

  return `${nextDate.getUTCFullYear()}-${pad2(nextDate.getUTCMonth() + 1)}`;
}

function getLastDayOfMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

export function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return `${year}년 ${monthIndex}월`;
}

export function toCalendarAriaLabel(selectedDate: string, label: string) {
  const [year, month] = selectedDate.split("-").map(Number);
  return `${year}년 ${month}월 ${label}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** `15:00-15:50`. 보강 시간을 입력하지 않은 일정은 시간을 보여 주지 않는다. */
export function formatLessonTimeRange(
  row: Pick<DailyAcademyAttendanceRow, "startTime" | "endTime" | "timeUnspecified">,
) {
  return row.timeUnspecified ? "-" : `${row.startTime}-${row.endTime}`;
}

export function getTodayDate() {
  return toSeoulDate(new Date().toISOString());
}

export function toSeoulDate(value: string) {
  return seoulFormatter.format(new Date(value));
}

export function toSeoulHourMinute(value: string) {
  return hourMinuteFormatter.format(new Date(value));
}

export function getEventTone(
  status: CalendarEvent["status"],
  variant: "academy" | "private",
) {
  if (status === "present") {
    return "bg-accent text-accent-foreground";
  }

  if (status === "absent") {
    return "bg-destructive/10 text-destructive";
  }

  if (variant === "private") {
    return "bg-secondary text-secondary-foreground";
  }

  return "bg-primary/10 text-primary";
}

export function formatPrivateLessonStatus(status: PrivateLesson["status"]) {
  const labels: Record<PrivateLesson["status"], string> = {
    scheduled: "예정",
    present: "출석",
    absent: "결석",
    cancelled: "취소",
    makeup: "보강",
  };

  return labels[status];
}

export function toLessonView(value: string): LessonView {
  return value === "table" ? "table" : "calendar";
}

export function toControlId(value: string) {
  return value.replace(/\s+/g, "-");
}

export function formatRecentPrivateLesson(
  recentLesson: PrivateLessonStudentSearchResult["recentLesson"],
) {
  if (!recentLesson) {
    return "최근 레슨: 없음";
  }

  return `최근 레슨: ${recentLesson.date} ${recentLesson.instrumentName} ${recentLesson.statusLabel}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function toSeoulIsoOffset(value: string) {
  return `${value}:00+09:00`;
}

import { compareKoreanNames } from "./common-list";
import type { AcademyLessonEvent } from "./academy-lesson-schedule";

export type AcademyLessonAttendanceStatus = "pending" | "present" | "absent";
export type LessonEventOrigin =
  | "regular"
  | "manual"
  | "makeup"
  | "private"
  | "special"
  | "rescheduled";

export type AbsenceResolutionKind = "makeup" | "pass";

/** 사유 없이 결석으로 저장할 때 기록하는 기본 문구. 화면에서는 사유가 아니라 빈 값으로 보여 준다. */
export const DEFAULT_ABSENCE_REASON = "결석 확인";

/** 결석 사유 표시. 사유가 없거나 기본 문구면 -로 보여 준다. */
export function formatAbsenceReason(reason: string | undefined) {
  const trimmed = reason?.trim();

  return trimmed && trimmed !== DEFAULT_ABSENCE_REASON ? trimmed : "-";
}

export type DailyAcademyAttendanceOptions = {
  academyId: string;
  date: string;
};

export type DailyAcademyAttendanceRow = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  studentName: string;
  teacherId?: string;
  teacherName?: string;
  instrumentId: string;
  instrumentName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AcademyLessonAttendanceStatus;
  origin?: LessonEventOrigin;
  originLabel?: string;
  absenceReason?: string;
  markedAt?: string;
  /** 결석을 보강 또는 패스로 확정했으면 그 결과. 비어 있으면 아직 처리하지 않은 결석이다. */
  absenceResolution?: AbsenceResolutionKind;
  /** 보강 시간을 입력하지 않아 원본 시간을 임시로 둔 일정. 화면에서 시간을 숨긴다. */
  timeUnspecified?: boolean;
  /** 보강 일정이 어느 결석 수업에서 생겼는지(원래 결석 수업의 일정 id). */
  sourceLessonEventId?: string;
};

export type PendingAcademyLessonAbsence = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  originalDate: string;
  reason: string;
  markedAt: string;
};

export type DailyAcademyAttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  pending: number;
};

export type DailyAcademyAttendanceSheet = {
  academyId: string;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  absenceQueue: PendingAcademyLessonAbsence[];
  summary: DailyAcademyAttendanceSummary;
};

export type MarkStudentAcademyLessonAttendanceInput = {
  lessonEventId: string;
  status: Exclude<AcademyLessonAttendanceStatus, "pending">;
  reason?: string;
  markedAt: string;
};

export type MarkAllAcademyLessonAttendanceInput = {
  status: Exclude<AcademyLessonAttendanceStatus, "pending">;
  reason?: string;
  markedAt: string;
};

export type RemoveResolvedAbsenceInput = {
  lessonEventId: string;
};

export function buildDailyAcademyAttendance(
  events: AcademyLessonEvent[],
  options: DailyAcademyAttendanceOptions,
): DailyAcademyAttendanceSheet {
  const rows = events
    .filter(
      (event) =>
        event.academyId === options.academyId &&
        event.date === options.date &&
        event.status !== "deleted",
    )
    .sort(compareEventsForDailyAttendance)
    .map(toPendingRow);

  return toDailyAcademyAttendanceSheet(options.academyId, options.date, rows);
}

export function markStudentAcademyLessonAttendance(
  sheet: DailyAcademyAttendanceSheet,
  input: MarkStudentAcademyLessonAttendanceInput,
): DailyAcademyAttendanceSheet {
  if (input.status === "absent") {
    assertAbsenceReason(input.reason);
  }

  let found = false;
  const rows = sheet.rows.map((row) => {
    if (row.lessonEventId !== input.lessonEventId) {
      return row;
    }

    found = true;

    return {
      ...row,
      status: input.status,
      absenceReason: input.status === "absent" ? input.reason?.trim() : undefined,
      markedAt: input.markedAt,
    };
  });

  if (!found) {
    throw new Error("출결 처리할 수업을 찾을 수 없습니다.");
  }

  return toDailyAcademyAttendanceSheet(sheet.academyId, sheet.date, rows);
}

export function markAllAcademyLessonAttendance(
  sheet: DailyAcademyAttendanceSheet,
  input: MarkAllAcademyLessonAttendanceInput,
): DailyAcademyAttendanceSheet {
  if (input.status === "absent") {
    assertAbsenceReason(input.reason);
  }

  const rows = sheet.rows.map((row) => ({
    ...row,
    status: input.status,
    absenceReason: input.status === "absent" ? input.reason?.trim() : undefined,
    markedAt: input.markedAt,
  }));

  return toDailyAcademyAttendanceSheet(sheet.academyId, sheet.date, rows);
}

/** 결석으로 확인됐지만 아직 보강·패스로 확정하지 않은 수업. 결석인원 목록의 기준이다. */
export function findUnresolvedAbsences(
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceRow[] {
  return rows.filter((row) => row.status === "absent" && !row.absenceResolution);
}

export type AcademyLessonEditResult = { ok: true } | { ok: false; reason: string };

/** 출결을 처리한 일정은 DB가 이동·삭제를 거부하므로 화면에서도 같은 안내를 먼저 준다. */
export function checkAcademyLessonEditable(
  row: Pick<DailyAcademyAttendanceRow, "status">,
  action: "move" | "delete",
): AcademyLessonEditResult {
  if (row.status === "pending") {
    return { ok: true };
  }

  const actionLabel = action === "move" ? "이동" : "삭제";

  return {
    ok: false,
    reason: `이미 출결이 처리된 일정은 ${actionLabel}할 수 없습니다. 먼저 출결을 초기화해 주세요.`,
  };
}

/** 학원 레슨 일정은 같은 달 안에서만 이동한다. DB 함수도 같은 규칙으로 거부한다. */
export function checkAcademyLessonMoveTarget(
  row: Pick<DailyAcademyAttendanceRow, "date">,
  targetDate: string,
): AcademyLessonEditResult {
  if (row.date.slice(0, 7) === targetDate.slice(0, 7)) {
    return { ok: true };
  }

  return {
    ok: false,
    reason:
      "일정은 같은 달 안에서만 이동할 수 있습니다. 다른 달에 수업을 잡으려면 일정 추가를 이용해 주세요.",
  };
}

const ACADEMY_LESSON_ORIGIN_LABELS: Record<LessonEventOrigin, string> = {
  regular: "정기",
  manual: "비정기",
  makeup: "보강 수업",
  private: "개인레슨",
  special: "특강",
  rescheduled: "이동",
};

/** 학원 레슨 일정의 출처 표시 문구. 개인레슨의 표기와는 따로 둔다. */
export function formatAcademyLessonOriginLabel(origin: LessonEventOrigin) {
  return ACADEMY_LESSON_ORIGIN_LABELS[origin];
}

export function removeResolvedAbsenceFromQueue(
  sheet: DailyAcademyAttendanceSheet,
  input: RemoveResolvedAbsenceInput,
): DailyAcademyAttendanceSheet {
  return {
    ...sheet,
    absenceQueue: sheet.absenceQueue.filter(
      (absence) => absence.lessonEventId !== input.lessonEventId,
    ),
  };
}

function toPendingRow(event: AcademyLessonEvent): DailyAcademyAttendanceRow {
  return {
    academyId: event.academyId,
    lessonEventId: getLessonEventId(event),
    studentId: event.studentId,
    studentName: event.studentName,
    instrumentId: event.instrumentId,
    instrumentName: event.instrumentName,
    date: event.date,
    startTime: event.startTime,
    endTime: event.endTime,
    status: "pending",
  };
}

export function toDailyAcademyAttendanceSheet(
  academyId: string,
  date: string,
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceSheet {
  return {
    academyId,
    date,
    rows,
    absenceQueue: buildAbsenceQueue(rows),
    summary: summarizeRows(rows),
  };
}

function buildAbsenceQueue(
  rows: DailyAcademyAttendanceRow[],
): PendingAcademyLessonAbsence[] {
  return findUnresolvedAbsences(rows).map((row) => ({
    academyId: row.academyId,
    lessonEventId: row.lessonEventId,
    studentId: row.studentId,
    studentName: row.studentName,
    instrumentId: row.instrumentId,
    instrumentName: row.instrumentName,
    originalDate: row.date,
    reason: row.absenceReason ?? "",
    markedAt: row.markedAt ?? "",
  }));
}

function summarizeRows(
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceSummary {
  return {
    total: rows.length,
    present: rows.filter((row) => row.status === "present").length,
    absent: rows.filter((row) => row.status === "absent").length,
    pending: rows.filter((row) => row.status === "pending").length,
  };
}

function compareEventsForDailyAttendance(
  left: AcademyLessonEvent,
  right: AcademyLessonEvent,
) {
  return (
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.studentName, right.studentName)
  );
}

function getLessonEventId(event: AcademyLessonEvent) {
  return (
    event.id ??
    `${event.academyId}:${event.studentId}:${event.date}:${event.startTime}`
  );
}

function assertAbsenceReason(reason: string | undefined) {
  if (!reason?.trim()) {
    throw new Error("결석 사유는 필수입니다.");
  }
}

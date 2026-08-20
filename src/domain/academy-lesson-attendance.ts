import type { AcademyLessonEvent } from "./academy-lesson-schedule";

export type AcademyLessonAttendanceStatus = "pending" | "present" | "absent";

export type DailyAcademyAttendanceOptions = {
  academyId: string;
  date: string;
};

export type DailyAcademyAttendanceRow = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: AcademyLessonAttendanceStatus;
  absenceReason?: string;
  markedAt?: string;
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

  return toSheet(options.academyId, options.date, rows);
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

  return toSheet(sheet.academyId, sheet.date, rows);
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

  return toSheet(sheet.academyId, sheet.date, rows);
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

function toSheet(
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
  return rows
    .filter((row) => row.status === "absent")
    .map((row) => ({
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
    left.studentName.localeCompare(right.studentName, "ko-KR")
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

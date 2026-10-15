import {
  DEFAULT_ABSENCE_REASON,
  toDailyAcademyAttendanceSheet,
  type AbsenceResolutionKind,
  type DailyAcademyAttendanceRow,
  type DailyAcademyAttendanceSheet,
} from "./academy-lesson-attendance";
import { compareKoreanNames } from "./common-list";

export type AcademySheetsByDate = Record<string, DailyAcademyAttendanceSheet>;

export type AttendanceRecordUpdate = {
  lessonEventId: string;
  studentId: string;
  status: "present" | "absent";
  reason?: string;
  markedAt: string;
};

export type AttendanceResetTarget = {
  lessonEventId: string;
  studentId: string;
};

export type AbsenceResolutionUpdate = {
  lessonEventId: string;
  resolution: AbsenceResolutionKind;
  reason?: string;
  /** 보강으로 확정할 때 보강일에 새로 생기는 일정 */
  makeupRow?: DailyAcademyAttendanceRow;
};

export function indexSheets(sheets: DailyAcademyAttendanceSheet[]): AcademySheetsByDate {
  return Object.fromEntries(sheets.map((sheet) => [sheet.date, sheet]));
}

export function createEmptySheet(academyId: string, date: string) {
  return toDailyAcademyAttendanceSheet(academyId, date, []);
}

export function compareAcademyAttendanceRows(
  left: DailyAcademyAttendanceRow,
  right: DailyAcademyAttendanceRow,
) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.studentName, right.studentName)
  );
}

export function updateAttendanceSheets(
  sheets: AcademySheetsByDate,
  academyId: string,
  records: AttendanceRecordUpdate[],
): AcademySheetsByDate {
  let next = sheets;

  for (const record of records) {
    next = mapRow(next, academyId, record.lessonEventId, (row) => ({
      ...row,
      status: record.status,
      absenceReason: record.status === "absent" ? record.reason ?? DEFAULT_ABSENCE_REASON : undefined,
      markedAt: record.markedAt,
    }));
  }

  return next;
}

export function resetAttendanceSheets(
  sheets: AcademySheetsByDate,
  academyId: string,
  records: AttendanceResetTarget[],
): AcademySheetsByDate {
  let next = sheets;

  for (const record of records) {
    next = mapRow(next, academyId, record.lessonEventId, (row) => ({
      ...row,
      status: "pending" as const,
      absenceReason: undefined,
      absenceResolution: undefined,
      markedAt: undefined,
    }));
  }

  return next;
}

export function appendAcademyAttendanceRow(
  sheets: AcademySheetsByDate,
  academyId: string,
  row: DailyAcademyAttendanceRow,
): AcademySheetsByDate {
  const existingSheet = sheets[row.date] ?? createEmptySheet(academyId, row.date);
  const rows = [...existingSheet.rows, row].sort(compareAcademyAttendanceRows);

  return {
    ...sheets,
    [row.date]: toDailyAcademyAttendanceSheet(academyId, row.date, rows),
  };
}

export function removeAcademyAttendanceRow(
  sheets: AcademySheetsByDate,
  academyId: string,
  lessonEventId: string,
): AcademySheetsByDate {
  const next = { ...sheets };

  for (const sheet of Object.values(next)) {
    if (!sheet.rows.some((row) => row.lessonEventId === lessonEventId)) {
      continue;
    }

    const rows = sheet.rows.filter((row) => row.lessonEventId !== lessonEventId);
    next[sheet.date] = toDailyAcademyAttendanceSheet(academyId, sheet.date, rows);
  }

  return next;
}

/**
 * 결석을 보강 또는 패스로 확정한 결과를 시간표에 반영한다.
 * 학원 레슨은 회차 개념이 없어 차감·복구 없이 결석 행에 처리 결과만 남긴다.
 */
export function resolveAbsenceInSheets(
  sheets: AcademySheetsByDate,
  academyId: string,
  update: AbsenceResolutionUpdate,
): AcademySheetsByDate {
  if (!findSheetOfRow(sheets, update.lessonEventId)) {
    throw new Error("결석 처리할 수업을 찾을 수 없습니다.");
  }

  const trimmedReason = update.reason?.trim();
  const resolved = mapRow(sheets, academyId, update.lessonEventId, (row) => ({
    ...row,
    absenceResolution: update.resolution,
    absenceReason: trimmedReason ? trimmedReason : row.absenceReason,
  }));

  return update.makeupRow
    ? appendAcademyAttendanceRow(resolved, academyId, update.makeupRow)
    : resolved;
}

/**
 * 보강 일정을 삭제하면 그 결석은 보강 없이 결석(패스)으로 처리된 상태가 된다.
 * 삭제한 일정이 보강 일정이 아니거나 원래 결석 수업을 모르면 시간표를 그대로 돌려준다.
 */
export function passAbsenceOfDeletedMakeup(
  sheets: AcademySheetsByDate,
  academyId: string,
  deletedRow: DailyAcademyAttendanceRow,
): AcademySheetsByDate {
  const sourceId = deletedRow.sourceLessonEventId;

  if (deletedRow.origin !== "makeup" || !sourceId || !findSheetOfRow(sheets, sourceId)) {
    return sheets;
  }

  return mapRow(sheets, academyId, sourceId, (row) => ({ ...row, absenceResolution: "pass" }));
}

/** 날짜별 등원 인원을 원생 기준으로 센다. 같은 원생의 두 수업은 한 명이다. */
export function countAttendeesByDate(
  rows: ReadonlyArray<Pick<DailyAcademyAttendanceRow, "studentId" | "date">>,
): Record<string, number> {
  const studentsByDate = new Map<string, Set<string>>();

  for (const row of rows) {
    const students = studentsByDate.get(row.date) ?? new Set<string>();
    students.add(row.studentId);
    studentsByDate.set(row.date, students);
  }

  return Object.fromEntries(
    [...studentsByDate.entries()].map(([date, students]) => [date, students.size]),
  );
}

function mapRow(
  sheets: AcademySheetsByDate,
  academyId: string,
  lessonEventId: string,
  update: (row: DailyAcademyAttendanceRow) => DailyAcademyAttendanceRow,
): AcademySheetsByDate {
  const sheet = findSheetOfRow(sheets, lessonEventId);

  if (!sheet) {
    return sheets;
  }

  const rows = sheet.rows.map((row) => (row.lessonEventId === lessonEventId ? update(row) : row));

  return { ...sheets, [sheet.date]: toDailyAcademyAttendanceSheet(academyId, sheet.date, rows) };
}

function findSheetOfRow(sheets: AcademySheetsByDate, lessonEventId: string) {
  return Object.values(sheets).find((candidate) =>
    candidate.rows.some((row) => row.lessonEventId === lessonEventId),
  );
}

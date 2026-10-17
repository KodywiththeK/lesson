import type { DailyAcademyAttendanceRow } from "./academy-lesson-attendance";
import { compareKoreanNames } from "./common-list";
import { toFinanceMonth } from "./finance-date";
import type { PrivateLesson } from "./private-lesson";

export type MonthlyAcademyAbsenceSummary = {
  total: number;
  /** 아직 보강·패스로 확정하지 않은 결석 */
  unresolved: number;
  makeup: number;
  pass: number;
};

/**
 * 조회 중인 달의 학원 레슨 결석(결석인원 목록). 보강·패스로 처리한 결석도 처리 결과와 함께 남겨
 * 한 달의 결석을 한눈에 볼 수 있게 한다. 날짜·시간·이름 순이다.
 */
export function buildMonthlyAcademyAbsences(
  rows: DailyAcademyAttendanceRow[],
  month: string,
): DailyAcademyAttendanceRow[] {
  return rows
    .filter((row) => row.status === "absent" && row.date.startsWith(month))
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.startTime.localeCompare(right.startTime) ||
        compareKoreanNames(left.studentName, right.studentName) ||
        left.lessonEventId.localeCompare(right.lessonEventId),
    );
}

export function summarizeMonthlyAcademyAbsences(
  absences: DailyAcademyAttendanceRow[],
): MonthlyAcademyAbsenceSummary {
  const countOf = (resolution: DailyAcademyAttendanceRow["absenceResolution"]) =>
    absences.filter((absence) => absence.absenceResolution === resolution).length;

  return {
    total: absences.length,
    unresolved: countOf(undefined),
    makeup: countOf("makeup"),
    pass: countOf("pass"),
  };
}

/**
 * 조회 중인 달의 개인레슨 결석. 달 경계는 한국 시간(Asia/Seoul) 기준이고 시작 시각 순이다.
 * 개인레슨은 보강·패스 처리 흐름이 없어 결석 상태만 모은다.
 */
export function buildMonthlyPrivateAbsences(
  lessons: PrivateLesson[],
  month: string,
): PrivateLesson[] {
  return lessons
    .filter((lesson) => lesson.status === "absent" && toFinanceMonth(lesson.startAt) === month)
    .sort(
      (left, right) =>
        left.startAt.localeCompare(right.startAt) ||
        compareKoreanNames(left.studentName, right.studentName) ||
        left.id.localeCompare(right.id),
    );
}

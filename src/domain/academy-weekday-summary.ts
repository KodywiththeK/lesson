import { compareKoreanNames } from "./common-list";

export type WeekdaySummaryRow = {
  studentId: string;
  studentName: string;
  date: string;
  origin?: string;
};

export type WeekdaySummaryStudent = {
  studentId: string;
  studentName: string;
};

export type WeekdayAttendance = {
  /** 0=일 ... 6=토. 이 요약에는 1~5만 나온다. */
  weekday: number;
  label: string;
  students: WeekdaySummaryStudent[];
  count: number;
};

export type WeekdayAttendanceSummary = {
  weekdays: WeekdayAttendance[];
  /** 요일을 합산하되 같은 원생은 한 번만 센 전체 인원 */
  totalCount: number;
};

const SUMMARY_WEEKDAYS = [
  { weekday: 1, label: "월" },
  { weekday: 2, label: "화" },
  { weekday: 3, label: "수" },
  { weekday: 4, label: "목" },
  { weekday: 5, label: "금" },
] as const;

/**
 * 선택한 달의 정규 일정 기준으로 월~금 요일별 등원 원생과 전체 인원을 만든다.
 * 보강·이동·비정기 일정은 정규 시간표가 아니므로 세지 않는다.
 */
export function buildWeekdayAttendanceSummary(
  rows: readonly WeekdaySummaryRow[],
  month: string,
): WeekdayAttendanceSummary {
  const regularRows = rows.filter(
    (row) =>
      row.date.startsWith(month) && (row.origin === undefined || row.origin === "regular"),
  );
  const allStudentIds = new Set<string>();
  const weekdays = SUMMARY_WEEKDAYS.map(({ weekday, label }) => {
    const students = new Map<string, WeekdaySummaryStudent>();

    for (const row of regularRows) {
      if (toWeekday(row.date) === weekday) {
        students.set(row.studentId, { studentId: row.studentId, studentName: row.studentName });
        allStudentIds.add(row.studentId);
      }
    }

    const sortedStudents = [...students.values()].sort(
      (left, right) =>
        compareKoreanNames(left.studentName, right.studentName) ||
        compareKoreanNames(left.studentId, right.studentId),
    );

    return { weekday, label, students: sortedStudents, count: sortedStudents.length };
  });

  return { weekdays, totalCount: allStudentIds.size };
}

function toWeekday(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

import { describe, expect, it } from "vitest";

import type { DailyAcademyAttendanceRow } from "./academy-lesson-attendance";
import {
  buildMonthlyAcademyAbsences,
  buildMonthlyPrivateAbsences,
  summarizeMonthlyAcademyAbsences,
} from "./monthly-lesson-absence";
import type { PrivateLesson } from "./private-lesson";

function buildAcademyRow(
  overrides: Partial<DailyAcademyAttendanceRow> & Pick<DailyAcademyAttendanceRow, "lessonEventId">,
): DailyAcademyAttendanceRow {
  return {
    academyId: "academy-1",
    studentId: `student-${overrides.lessonEventId}`,
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-12",
    startTime: "15:00",
    endTime: "15:50",
    status: "absent",
    origin: "regular",
    originLabel: "정기",
    ...overrides,
  };
}

function buildPrivateLesson(
  overrides: Partial<PrivateLesson> & Pick<PrivateLesson, "id">,
): PrivateLesson {
  return {
    academyId: "academy-1",
    studentId: `student-${overrides.id}`,
    studentName: "한서아",
    instrumentId: "violin",
    instrumentName: "바이올린",
    teacherId: "teacher-1",
    teacherName: "이선생",
    startAt: "2026-08-12T06:00:00.000Z",
    endAt: "2026-08-12T06:50:00.000Z",
    status: "absent",
    ...overrides,
  };
}

describe("월 학원레슨 결석 목록", () => {
  it("조회 중인 달의 결석만 날짜·시간·이름 순으로 모은다", () => {
    const rows = [
      buildAcademyRow({ lessonEventId: "late", studentName: "박지호", date: "2026-08-21" }),
      buildAcademyRow({ lessonEventId: "next-month", date: "2026-09-01" }),
      buildAcademyRow({ lessonEventId: "prev-month", date: "2026-07-31" }),
      buildAcademyRow({ lessonEventId: "early-b", studentName: "최도윤", startTime: "16:00" }),
      buildAcademyRow({ lessonEventId: "early-a", studentName: "강도현", startTime: "16:00" }),
      buildAcademyRow({ lessonEventId: "morning", studentName: "이서윤", startTime: "10:00" }),
    ];

    expect(
      buildMonthlyAcademyAbsences(rows, "2026-08").map((row) => row.lessonEventId),
    ).toEqual(["morning", "early-a", "early-b", "late"]);
  });

  it("출석·대기 일정은 결석 목록에 넣지 않는다", () => {
    const rows = [
      buildAcademyRow({ lessonEventId: "present", status: "present" }),
      buildAcademyRow({ lessonEventId: "pending", status: "pending" }),
      buildAcademyRow({ lessonEventId: "absent" }),
    ];

    expect(
      buildMonthlyAcademyAbsences(rows, "2026-08").map((row) => row.lessonEventId),
    ).toEqual(["absent"]);
  });

  it("보강·패스로 처리한 결석도 처리 결과와 함께 목록에 남긴다", () => {
    const rows = [
      buildAcademyRow({ lessonEventId: "makeup", date: "2026-08-03", absenceResolution: "makeup" }),
      buildAcademyRow({ lessonEventId: "pass", date: "2026-08-04", absenceResolution: "pass" }),
      buildAcademyRow({ lessonEventId: "open", date: "2026-08-05" }),
    ];

    const absences = buildMonthlyAcademyAbsences(rows, "2026-08");

    expect(absences.map((row) => row.absenceResolution)).toEqual(["makeup", "pass", undefined]);
  });

  it("처리 현황을 미처리·보강·패스 건수로 요약한다", () => {
    const rows = [
      buildAcademyRow({ lessonEventId: "a", absenceResolution: "makeup" }),
      buildAcademyRow({ lessonEventId: "b", absenceResolution: "pass" }),
      buildAcademyRow({ lessonEventId: "c" }),
      buildAcademyRow({ lessonEventId: "d" }),
    ];

    expect(summarizeMonthlyAcademyAbsences(rows)).toEqual({
      total: 4,
      unresolved: 2,
      makeup: 1,
      pass: 1,
    });
    expect(summarizeMonthlyAcademyAbsences([])).toEqual({
      total: 0,
      unresolved: 0,
      makeup: 0,
      pass: 0,
    });
  });
});

describe("월 개인레슨 결석 목록", () => {
  it("결석 상태의 개인레슨만 시작 시각 순으로 모은다", () => {
    const lessons = [
      buildPrivateLesson({ id: "later", startAt: "2026-08-20T06:00:00.000Z" }),
      buildPrivateLesson({ id: "scheduled", status: "scheduled" }),
      buildPrivateLesson({ id: "present", status: "present" }),
      buildPrivateLesson({ id: "cancelled", status: "cancelled" }),
      buildPrivateLesson({ id: "earlier", startAt: "2026-08-03T06:00:00.000Z" }),
    ];

    expect(buildMonthlyPrivateAbsences(lessons, "2026-08").map((lesson) => lesson.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("달 경계는 한국 시간 기준으로 판정한다", () => {
    const lessons = [
      // UTC 7/31 16:00 = 한국 8/1 01:00 → 8월
      buildPrivateLesson({ id: "seoul-august", startAt: "2026-07-31T16:00:00.000Z" }),
      // UTC 8/31 16:00 = 한국 9/1 01:00 → 9월
      buildPrivateLesson({ id: "seoul-september", startAt: "2026-08-31T16:00:00.000Z" }),
    ];

    expect(buildMonthlyPrivateAbsences(lessons, "2026-08").map((lesson) => lesson.id)).toEqual([
      "seoul-august",
    ]);
    expect(buildMonthlyPrivateAbsences(lessons, "2026-09").map((lesson) => lesson.id)).toEqual([
      "seoul-september",
    ]);
  });

  it("같은 시각이면 원생 이름 가나다순이다", () => {
    const lessons = [
      buildPrivateLesson({ id: "b", studentName: "최도윤" }),
      buildPrivateLesson({ id: "a", studentName: "강도현" }),
    ];

    expect(buildMonthlyPrivateAbsences(lessons, "2026-08").map((lesson) => lesson.id)).toEqual([
      "a",
      "b",
    ]);
  });
});

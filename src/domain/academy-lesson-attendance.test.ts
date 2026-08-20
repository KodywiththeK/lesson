import { describe, expect, it } from "vitest";

import {
  buildDailyAcademyAttendance,
  markAllAcademyLessonAttendance,
  markStudentAcademyLessonAttendance,
  removeResolvedAbsenceFromQueue,
} from "./academy-lesson-attendance";
import type { AcademyLessonEvent } from "./academy-lesson-schedule";

const events: AcademyLessonEvent[] = [
  {
    id: "lesson-2",
    academyId: "academy-1",
    enrollmentId: "enrollment-2",
    studentId: "student-2",
    studentName: "이서윤",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "16:00",
    endTime: "16:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-1",
    academyId: "academy-1",
    enrollmentId: "enrollment-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-other-date",
    academyId: "academy-1",
    studentId: "student-3",
    studentName: "박하준",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-21",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-other-academy",
    academyId: "academy-2",
    studentId: "student-4",
    studentName: "최민준",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
];

describe("buildDailyAcademyAttendance", () => {
  it("선택한 날짜의 예상 출석 원생을 시간과 이름 순서로 보여준다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    expect(sheet.rows.map((row) => row.studentName)).toEqual(["김민지", "이서윤"]);
    expect(sheet.rows.every((row) => row.status === "pending")).toBe(true);
    expect(sheet.summary).toEqual({
      total: 2,
      present: 0,
      absent: 0,
      pending: 2,
    });
  });
});

describe("markStudentAcademyLessonAttendance", () => {
  it("개별 원생을 출석 또는 결석으로 처리하고 결석 대기열을 만든다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markStudentAcademyLessonAttendance(sheet, {
      lessonEventId: "lesson-1",
      status: "absent",
      reason: "감기",
      markedAt: "2026-08-20T15:05:00+09:00",
    });

    expect(result.rows.find((row) => row.lessonEventId === "lesson-1")).toMatchObject({
      status: "absent",
      absenceReason: "감기",
    });
    expect(result.absenceQueue).toEqual([
      {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        studentId: "student-1",
        studentName: "김민지",
        instrumentId: "piano",
        instrumentName: "피아노",
        originalDate: "2026-08-20",
        reason: "감기",
        markedAt: "2026-08-20T15:05:00+09:00",
      },
    ]);
  });
});

describe("markAllAcademyLessonAttendance", () => {
  it("전체 출석은 모든 원생을 출석으로 처리하고 결석 대기열을 비운다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markAllAcademyLessonAttendance(sheet, {
      status: "present",
      markedAt: "2026-08-20T15:00:00+09:00",
    });

    expect(result.rows.every((row) => row.status === "present")).toBe(true);
    expect(result.absenceQueue).toEqual([]);
    expect(result.summary).toMatchObject({ present: 2, absent: 0, pending: 0 });
  });

  it("전체 결석은 모든 원생을 결석 처리하고 결석 대기열로 이동한다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markAllAcademyLessonAttendance(sheet, {
      status: "absent",
      reason: "태풍 휴강",
      markedAt: "2026-08-20T15:00:00+09:00",
    });

    expect(result.rows.every((row) => row.status === "absent")).toBe(true);
    expect(result.absenceQueue.map((absence) => absence.studentName)).toEqual([
      "김민지",
      "이서윤",
    ]);
    expect(result.summary).toMatchObject({ present: 0, absent: 2, pending: 0 });
  });
});

describe("removeResolvedAbsenceFromQueue", () => {
  it("보강 또는 패스로 확정된 결석 원생은 결석 대기열에서 제거한다", () => {
    const sheet = markAllAcademyLessonAttendance(
      buildDailyAcademyAttendance(events, {
        academyId: "academy-1",
        date: "2026-08-20",
      }),
      {
        status: "absent",
        reason: "태풍 휴강",
        markedAt: "2026-08-20T15:00:00+09:00",
      },
    );

    const result = removeResolvedAbsenceFromQueue(sheet, {
      lessonEventId: "lesson-1",
    });

    expect(result.absenceQueue.map((absence) => absence.lessonEventId)).toEqual([
      "lesson-2",
    ]);
  });
});

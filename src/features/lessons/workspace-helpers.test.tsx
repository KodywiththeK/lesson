import { describe, expect, it } from "vitest";

import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import { toMovedAcademyAttendanceRow } from "@/features/lessons/workspace-helpers";

function buildRow(overrides: Partial<DailyAcademyAttendanceRow> = {}): DailyAcademyAttendanceRow {
  return {
    academyId: "academy-1",
    lessonEventId: "lesson-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-12",
    startTime: "15:00",
    endTime: "15:50",
    status: "pending",
    origin: "regular",
    originLabel: "정기",
    ...overrides,
  };
}

describe("toMovedAcademyAttendanceRow", () => {
  it("정기 일정을 옮기면 이동 일정이 되고 처리 기록은 비운다", () => {
    const moved = toMovedAcademyAttendanceRow({
      row: buildRow(),
      targetDate: "2026-08-19",
      startTime: "16:00",
      endTime: "16:50",
      reason: "",
    });

    expect(moved).toMatchObject({ origin: "rescheduled", date: "2026-08-19", startTime: "16:00" });
  });

  it("보강 일정을 옮겨도 보강 표시와 원래 결석 연결을 유지한다", () => {
    const moved = toMovedAcademyAttendanceRow({
      row: buildRow({
        lessonEventId: "makeup-1",
        origin: "makeup",
        originLabel: "보강 수업",
        sourceLessonEventId: "absent-1",
        timeUnspecified: true,
      }),
      targetDate: "2026-08-19",
      startTime: "15:00",
      endTime: "15:50",
      reason: "",
    });

    expect(moved).toMatchObject({
      origin: "makeup",
      originLabel: "보강 수업",
      sourceLessonEventId: "absent-1",
      // 시간을 바꾸지 않고 날짜만 옮겼으므로 시간 미정 표시를 유지한다.
      timeUnspecified: true,
    });
  });

  it("시간 미정 보강의 시간을 바꾸면 시간 미정 표시를 해제한다", () => {
    const moved = toMovedAcademyAttendanceRow({
      row: buildRow({ origin: "makeup", sourceLessonEventId: "absent-1", timeUnspecified: true }),
      targetDate: "2026-08-19",
      startTime: "17:00",
      endTime: "17:50",
      reason: "",
    });

    expect(moved.timeUnspecified).toBeUndefined();
  });
});

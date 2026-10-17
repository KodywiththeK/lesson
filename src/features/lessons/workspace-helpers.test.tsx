import { describe, expect, it } from "vitest";

import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import {
  describePrivateAttendanceMark,
  toMovedAcademyAttendanceRow,
  toPrivateAbsenceReason,
} from "@/features/lessons/workspace-helpers";

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

describe("describePrivateAttendanceMark", () => {
  it("이미 결석인 수업을 다시 결석으로 저장하면 사유만 수정했다고 알린다", () => {
    expect(describePrivateAttendanceMark("absent", "absent")).toBe("결석 사유를 수정했습니다.");
  });

  it("그 밖의 변경은 회차권 변화를 알리는 기존 문구를 쓴다", () => {
    expect(describePrivateAttendanceMark("scheduled", "absent")).toBe(
      "결석 처리했습니다. 회차권은 차감되지 않습니다.",
    );
    expect(describePrivateAttendanceMark("present", "absent")).toBe(
      "결석으로 바꾸고 회차권 1회를 복구했습니다.",
    );
    expect(describePrivateAttendanceMark("scheduled", "present")).toBe(
      "출석 처리하고 회차권 1회를 차감했습니다.",
    );
  });
});

describe("toPrivateAbsenceReason", () => {
  it("결석이면 입력한 사유, 비었으면 기본 문구를 쓴다", () => {
    expect(toPrivateAbsenceReason("absent", " 감기 ")).toBe("감기");
    expect(toPrivateAbsenceReason("absent", "  ")).toBe("결석 확인");
    expect(toPrivateAbsenceReason("absent", undefined)).toBe("결석 확인");
  });

  it("출석이나 예정이면 사유를 남기지 않는다", () => {
    expect(toPrivateAbsenceReason("present", "감기")).toBeUndefined();
    expect(toPrivateAbsenceReason("scheduled", undefined)).toBeUndefined();
  });
});

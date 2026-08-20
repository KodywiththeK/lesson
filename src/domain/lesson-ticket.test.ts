import { describe, expect, it } from "vitest";

import { applyAttendanceToTicket } from "./lesson-ticket";

const baseTicket = {
  academyId: "academy-1",
  studentId: "student-1",
  instrumentId: "piano",
  remainingCount: 4,
};

const baseAttendance = {
  academyId: "academy-1",
  lessonEventId: "lesson-1",
  studentId: "student-1",
  instrumentId: "piano",
};

describe("applyAttendanceToTicket", () => {
  it("실제 출석 확인일 때만 회차권을 1회 차감하고 사용 기록을 만든다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "present",
    });

    expect(result.ticket.remainingCount).toBe(3);
    expect(result.usage).toMatchObject({
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      instrumentId: "piano",
      usedCount: 1,
    });
  });

  it("결석은 회차권을 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "absent",
    });

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
  });

  it("수업 일정에 올라간 상태만으로는 회차권을 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(baseTicket, {
      ...baseAttendance,
      status: "scheduled",
    });

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
  });

  it("다른 학원 회차권은 차감하지 못한다", () => {
    expect(() =>
      applyAttendanceToTicket(baseTicket, {
        ...baseAttendance,
        academyId: "academy-2",
        status: "present",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });

  it("같은 수업 출석을 두 번 처리해도 중복 차감하지 않는다", () => {
    const result = applyAttendanceToTicket(
      baseTicket,
      {
        ...baseAttendance,
        status: "present",
      },
      { alreadyDeductedLessonEventIds: ["lesson-1"] },
    );

    expect(result.ticket.remainingCount).toBe(4);
    expect(result.usage).toBeUndefined();
    expect(result.skippedReason).toBe("already-deducted");
  });
});

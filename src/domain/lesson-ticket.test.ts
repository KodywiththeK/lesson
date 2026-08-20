import { describe, expect, it } from "vitest";

import {
  applyAttendanceToTicket,
  registerLessonTicket,
  summarizeLessonTicketStatus,
} from "./lesson-ticket";

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

describe("registerLessonTicket", () => {
  const activeTicket = {
    academyId: "academy-1",
    studentId: "student-1",
    instrumentId: "piano",
    totalGrantedCount: 12,
    remainingCount: 3,
    validFrom: "2026-08-01",
    validUntil: "2026-09-30",
    registeredAt: "2026-08-01",
  };

  it("같은 학원, 원생, 악기의 활성 회차권에 회수와 유효기간을 추가한다", () => {
    const result = registerLessonTicket(activeTicket, {
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      grantedCount: 10,
      validFrom: "2026-10-01",
      validUntil: "2026-11-30",
      registeredAt: "2026-09-20",
    });

    expect(result.ticket).toMatchObject({
      totalGrantedCount: 22,
      remainingCount: 13,
      validFrom: "2026-10-01",
      validUntil: "2026-11-30",
      registeredAt: "2026-09-20",
    });
    expect(result.event).toEqual({
      type: "merged-existing-ticket",
      addedCount: 10,
      previousValidUntil: "2026-09-30",
      nextValidUntil: "2026-11-30",
    });
  });

  it("기존 활성 회차권이 없으면 새 회차권을 만든다", () => {
    const result = registerLessonTicket(undefined, {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      grantedCount: 8,
      validFrom: "2026-08-20",
      validUntil: "2026-10-20",
      registeredAt: "2026-08-20",
    });

    expect(result.ticket).toMatchObject({
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      totalGrantedCount: 8,
      remainingCount: 8,
      validUntil: "2026-10-20",
    });
    expect(result.event.type).toBe("created-new-ticket");
  });

  it("다른 학원 회차권에는 재등록을 병합하지 못한다", () => {
    expect(() =>
      registerLessonTicket(activeTicket, {
        academyId: "academy-2",
        studentId: "student-1",
        instrumentId: "piano",
        grantedCount: 10,
        validFrom: "2026-10-01",
        validUntil: "2026-11-30",
        registeredAt: "2026-09-20",
      }),
    ).toThrow("학원 범위가 일치하지 않습니다.");
  });
});

describe("summarizeLessonTicketStatus", () => {
  it("잔여 회차가 학원 설정 기준 이하이면 잔여 부족 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 2,
        validFrom: "2026-08-01",
        validUntil: "2026-09-30",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.statuses).toContain("low-remaining");
  });

  it("만료일이 학원 설정 기준 안으로 다가오면 만료 임박 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 6,
        validFrom: "2026-08-01",
        validUntil: "2026-09-08",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.daysUntilExpiration).toBe(7);
    expect(summary.statuses).toContain("expiring-soon");
  });

  it("만료되었거나 잔여 회차가 0이면 각각의 상태를 표시한다", () => {
    const summary = summarizeLessonTicketStatus(
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        totalGrantedCount: 12,
        remainingCount: 0,
        validFrom: "2026-08-01",
        validUntil: "2026-08-31",
        registeredAt: "2026-08-01",
      },
      {
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      },
    );

    expect(summary.statuses).toEqual(["exhausted", "expired"]);
  });
});

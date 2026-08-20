import { describe, expect, it } from "vitest";

import {
  calculateWithdrawnStudentRetention,
  transitionStudentStatus,
} from "./student-status";

describe("transitionStudentStatus", () => {
  const student = {
    academyId: "academy-1",
    studentId: "student-1",
    studentName: "김민지",
    status: "enrolled" as const,
  };

  it("재원 원생을 휴원으로 전환할 때 확인 절차를 요구한다", () => {
    const result = transitionStudentStatus(student, {
      action: "suspend",
      reason: "한 달 휴식",
      changedAt: "2026-08-20T10:00:00+09:00",
    });

    expect(result.student).toMatchObject({
      status: "suspended",
      suspendedAt: "2026-08-20T10:00:00+09:00",
    });
    expect(result.event).toEqual({
      type: "suspended",
      reason: "한 달 휴식",
      changedAt: "2026-08-20T10:00:00+09:00",
      confirmationRequired: true,
    });
  });

  it("휴원 원생을 재원으로 복구할 때 확인 절차를 요구한다", () => {
    const result = transitionStudentStatus(
      {
        ...student,
        status: "suspended",
        suspendedAt: "2026-08-01T10:00:00+09:00",
      },
      {
        action: "reinstate",
        reason: "수업 재개",
        changedAt: "2026-08-20T10:00:00+09:00",
      },
    );

    expect(result.student.status).toBe("enrolled");
    expect(result.student.suspendedAt).toBeUndefined();
    expect(result.event.confirmationRequired).toBe(true);
  });

  it("휴원 원생을 퇴원으로 전환하면 퇴원일을 기록한다", () => {
    const result = transitionStudentStatus(
      {
        ...student,
        status: "suspended",
      },
      {
        action: "withdraw",
        reason: "이사",
        changedAt: "2026-08-20T10:00:00+09:00",
      },
    );

    expect(result.student).toMatchObject({
      status: "withdrawn",
      withdrawnAt: "2026-08-20T10:00:00+09:00",
    });
    expect(result.event.type).toBe("withdrawn");
  });

  it("퇴원 원생을 휴원으로 직접 전환할 수 없다", () => {
    expect(() =>
      transitionStudentStatus(
        {
          ...student,
          status: "withdrawn",
          withdrawnAt: "2026-08-01T10:00:00+09:00",
        },
        {
          action: "suspend",
          reason: "잘못된 전환",
          changedAt: "2026-08-20T10:00:00+09:00",
        },
      ),
    ).toThrow("퇴원 원생은 먼저 재원 처리해야 합니다.");
  });
});

describe("calculateWithdrawnStudentRetention", () => {
  it("퇴원 후 30일 보관 만료일과 남은 일수를 계산한다", () => {
    const retention = calculateWithdrawnStudentRetention(
      {
        academyId: "academy-1",
        studentId: "student-1",
        studentName: "김민지",
        status: "withdrawn",
        withdrawnAt: "2026-08-01T10:00:00+09:00",
      },
      {
        today: "2026-08-20",
        retentionDays: 30,
      },
    );

    expect(retention).toEqual({
      deletableOn: "2026-08-31",
      daysRemaining: 11,
      canDelete: false,
    });
  });

  it("퇴원 후 30일이 지나면 삭제 가능 상태만 표시하고 실제 삭제 방식은 결정하지 않는다", () => {
    const retention = calculateWithdrawnStudentRetention(
      {
        academyId: "academy-1",
        studentId: "student-1",
        studentName: "김민지",
        status: "withdrawn",
        withdrawnAt: "2026-08-01T10:00:00+09:00",
      },
      {
        today: "2026-09-01",
        retentionDays: 30,
      },
    );

    expect(retention).toEqual({
      deletableOn: "2026-08-31",
      daysRemaining: 0,
      canDelete: true,
    });
  });
});

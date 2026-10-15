import { describe, expect, it } from "vitest";

import {
  buildStatusManagementList,
  calculateRetentionUntil,
  formatManagedStatusLabel,
} from "./status-management";

describe("status-management", () => {
  it("퇴원/퇴사 처리일 기준 30일 보관 만료일을 계산한다", () => {
    expect(
      calculateRetentionUntil({
        changedAt: "2026-08-25T10:00:00+09:00",
        retentionDays: 30,
      }),
    ).toBe("2026-09-24");
  });

  it("보관 대상 목록에 남은 일수와 자동 보관 상태를 붙인다", () => {
    const result = buildStatusManagementList(
      [
        {
          entityType: "student",
          entityId: "student-1",
          academyId: "academy-1",
          name: "김민지",
          status: "withdrawn",
          changedAt: "2026-08-01T00:00:00+09:00",
          retentionUntil: "2026-08-31",
          statusReason: "이사로 퇴원",
        },
        {
          entityType: "teacher",
          entityId: "teacher-1",
          academyId: "academy-1",
          name: "박선생",
          status: "on_leave",
          changedAt: "2026-08-20T00:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        entityType: "student",
        status: "withdrawn",
        today: "2026-08-25",
      },
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        entityType: "student",
        entityId: "student-1",
        statusLabel: "퇴원",
        retentionUntil: "2026-08-31",
        daysRemaining: 6,
        archiveStateLabel: "보관 중",
        statusReason: "이사로 퇴원",
      }),
    ]);
  });

  it("상태 변경 메모도 검색 대상에 포함한다", () => {
    const result = buildStatusManagementList(
      [
        {
          entityType: "student",
          entityId: "student-1",
          academyId: "academy-1",
          name: "김민지",
          status: "suspended",
          changedAt: "2026-08-20T00:00:00+09:00",
          statusReason: "방학 기간 휴원",
        },
      ],
      {
        academyId: "academy-1",
        entityType: "student",
        status: "suspended",
        today: "2026-08-25",
      },
    );

    expect(result.items[0]).toMatchObject({
      statusReason: "방학 기간 휴원",
    });
  });

  it("검색어로 이름과 처리 메모를 찾는다", () => {
    const rows = [
      {
        entityType: "student" as const,
        entityId: "student-1",
        academyId: "academy-1",
        name: "김민지",
        status: "suspended" as const,
        statusReason: "방학 기간 휴원",
      },
      {
        entityType: "student" as const,
        entityId: "student-2",
        academyId: "academy-1",
        name: "박지호",
        status: "suspended" as const,
        statusReason: "유학 준비",
      },
    ];
    const baseOptions = {
      academyId: "academy-1",
      entityType: "student" as const,
      status: "suspended" as const,
      today: "2026-08-25",
    };

    const byName = buildStatusManagementList(rows, { ...baseOptions, search: "박지" });
    const byReason = buildStatusManagementList(rows, { ...baseOptions, search: "방학" });

    expect(byName.items.map((item) => item.name)).toEqual(["박지호"]);
    expect(byName.totalItems).toBe(1);
    expect(byReason.items.map((item) => item.name)).toEqual(["김민지"]);
  });

  it("페이지 크기만큼 나누고 동명이인은 entityId 순으로 고정한다", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      entityType: "teacher" as const,
      entityId: `teacher-${String(index).padStart(2, "0")}`,
      academyId: "academy-1",
      name: "김선생",
      status: "on_leave" as const,
    })).reverse();
    const baseOptions = {
      academyId: "academy-1",
      entityType: "teacher" as const,
      status: "on_leave" as const,
      today: "2026-08-25",
    };

    const firstPage = buildStatusManagementList(rows, { ...baseOptions, page: 1, pageSize: 10 });
    const secondPage = buildStatusManagementList(rows, { ...baseOptions, page: 2, pageSize: 10 });

    expect(firstPage.totalItems).toBe(12);
    expect(firstPage.totalPages).toBe(2);
    expect(firstPage.items.map((item) => item.entityId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `teacher-${String(index).padStart(2, "0")}`),
    );
    expect(secondPage.items.map((item) => item.entityId)).toEqual(["teacher-10", "teacher-11"]);
    expect(secondPage.hasPreviousPage).toBe(true);
    expect(secondPage.hasNextPage).toBe(false);
  });

  it("상태 표시명을 원생과 선생님 문맥에 맞게 바꾼다", () => {
    expect(formatManagedStatusLabel("student", "suspended")).toBe("휴원");
    expect(formatManagedStatusLabel("student", "withdrawn")).toBe("퇴원");
    expect(formatManagedStatusLabel("teacher", "on_leave")).toBe("휴직");
    expect(formatManagedStatusLabel("teacher", "resigned")).toBe("퇴사");
  });
});

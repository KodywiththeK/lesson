import { describe, expect, it } from "vitest";

import {
  canAccessFeature,
  getVisibleNavigationItems,
  resolveSessionRole,
} from "./permissions";

describe("resolveSessionRole", () => {
  it("활성 학원 멤버십의 역할을 세션 역할로 해석한다", () => {
    expect(
      resolveSessionRole({
        userId: "user-1",
        academyId: "academy-1",
        memberships: [
          {
            academyId: "academy-1",
            role: "owner",
            status: "active",
          },
        ],
      }),
    ).toBe("owner");
  });

  it("비활성 멤버십 또는 다른 학원 멤버십은 anonymous로 본다", () => {
    expect(
      resolveSessionRole({
        userId: "user-1",
        academyId: "academy-1",
        memberships: [
          {
            academyId: "academy-2",
            role: "owner",
            status: "active",
          },
          {
            academyId: "academy-1",
            role: "desk",
            status: "disabled",
          },
        ],
      }),
    ).toBe("anonymous");
  });
});

describe("canAccessFeature", () => {
  it("owner는 전체 운영 기능에 접근할 수 있다", () => {
    expect(canAccessFeature({ role: "owner" }, "vendors")).toBe(true);
    expect(canAccessFeature({ role: "owner" }, "income-management")).toBe(true);
    expect(canAccessFeature({ role: "owner" }, "manual-ledger")).toBe(true);
  });

  it("desk는 일상 운영 기능에 접근하지만 기본적으로 수입 관리는 접근하지 못한다", () => {
    expect(canAccessFeature({ role: "desk" }, "students")).toBe(true);
    expect(canAccessFeature({ role: "desk" }, "lesson-schedule")).toBe(true);
    expect(canAccessFeature({ role: "desk" }, "vendors")).toBe(true);
    expect(canAccessFeature({ role: "desk" }, "income-management")).toBe(false);
  });

  it("수입 관리는 원장 전용이라 데스크는 어떤 설정으로도 열 수 없다", () => {
    // 화면만 열리고 DB(RLS)가 빈 결과를 돌려주는 반쪽 상태를 만들지 않는다.
    expect(canAccessFeature({ role: "desk", flags: { allowDeskFinance: true } } as never, "manual-ledger")).toBe(false);
    expect(canAccessFeature({ role: "desk", flags: { allowDeskFinance: true } } as never, "income-management")).toBe(false);
  });

  it("회차권 수동 수정은 원장과 데스크에 허용하고 선생님에게는 허용하지 않는다", () => {
    expect(canAccessFeature({ role: "owner" }, "ticket-manual-adjustment")).toBe(
      true,
    );
    expect(canAccessFeature({ role: "desk" }, "ticket-manual-adjustment")).toBe(true);
    expect(
      canAccessFeature({ role: "teacher" }, "ticket-manual-adjustment"),
    ).toBe(false);
  });

  it("teacher는 배정된 학생과 본인 급여에만 접근한다", () => {
    const teacherContext = {
      role: "teacher" as const,
      teacherId: "teacher-1",
      assignedStudentIds: ["student-1"],
    };

    expect(
      canAccessFeature(teacherContext, "assigned-student", {
        studentId: "student-1",
      }),
    ).toBe(true);
    expect(
      canAccessFeature(teacherContext, "assigned-student", {
        studentId: "student-2",
      }),
    ).toBe(false);
    expect(
      canAccessFeature(teacherContext, "own-payroll", {
        teacherId: "teacher-1",
      }),
    ).toBe(true);
    expect(canAccessFeature(teacherContext, "vendors")).toBe(false);
    expect(canAccessFeature(teacherContext, "income-management")).toBe(false);
  });

  it("anonymous는 운영 기능에 접근하지 못한다", () => {
    expect(canAccessFeature({ role: "anonymous" }, "students")).toBe(false);
    expect(canAccessFeature({ role: "anonymous" }, "lesson-schedule")).toBe(false);
  });
});

describe("getVisibleNavigationItems", () => {
  it("teacher에게는 거래처와 수입 관리 메뉴를 숨긴다", () => {
    const visibleItems = getVisibleNavigationItems({
      role: "teacher",
      teacherId: "teacher-1",
      assignedStudentIds: ["student-1"],
    });

    expect(visibleItems).toContain("lesson-schedule");
    expect(visibleItems).toContain("students");
    expect(visibleItems).toContain("own-payroll");
    expect(visibleItems).not.toContain("vendors");
    expect(visibleItems).not.toContain("income-management");
  });
});

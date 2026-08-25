import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("owner에게 운영 전체 메뉴와 주요 액션을 보여준다", () => {
    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{ role: "owner" }}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "대시보드",
      "레슨 시간표",
      "회차권",
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
      "교재",
      "수입",
    ]);
    expect(screen.getByRole("link", { name: /수납 등록/ })).toHaveAttribute(
      "href",
      "/finance",
    );
    expect(screen.getByRole("link", { name: /출석 확인/ })).toHaveAttribute(
      "href",
      "/lessons",
    );
  });

  it("teacher에게는 거래처와 수입 관리성 메뉴를 숨기고 본인 급여 메뉴를 보여준다", () => {
    render(
      <AppShell
        academyName="더 클래식"
        permissionContext={{
          role: "teacher",
          teacherId: "teacher-1",
          assignedStudentIds: ["student-1"],
        }}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const labels = within(navigation).getAllByRole("link").map((link) => link.textContent);

    expect(labels).toContain("레슨 시간표");
    expect(labels).toContain("원생");
    expect(labels).toContain("내 급여");
    expect(labels).not.toContain("휴원/퇴원");
    expect(labels).not.toContain("수입");
    expect(labels).not.toContain("거래처");
    expect(screen.queryByRole("link", { name: /수납 등록/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /출석 확인/ })).toHaveAttribute(
      "href",
      "/lessons",
    );
  });
});

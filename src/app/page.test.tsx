import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("학원 운영자가 바로 사용할 수 있는 첫 화면을 보여준다", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "음악학원 관리" }),
    ).toBeInTheDocument();
    expect(screen.getByText("현재 학원: 더 클래식")).toBeInTheDocument();
    expect(screen.getByText("오늘 출석 확인")).toBeInTheDocument();
    expect(screen.getByText("회차권 임박")).toBeInTheDocument();
    expect(screen.getByText("미납 확인")).toBeInTheDocument();
  });

  it("PDF 1차 범위의 주요 메뉴를 탐색 링크로 제공한다", () => {
    render(<Home />);

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const links = within(navigation).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "대시보드",
      "레슨 시간표",
      "학원레슨표",
      "개인레슨표",
      "회차권",
      "인원·거래처",
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
      "교재",
      "수입",
    ]);
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(
      within(navigation).getByRole("link", { name: "레슨 시간표" }),
    ).toHaveAttribute("href", "/lessons/academy");
  });
});

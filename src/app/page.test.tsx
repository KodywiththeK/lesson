import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home", () => {
  it("첫 화면은 가짜 수치나 개발 메모 없이 사용할 수 있는 메뉴로 바로 이동하는 바로가기를 보여준다", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "음악학원 관리" }),
    ).toBeInTheDocument();
    expect(screen.getByText("현재 학원: 더 클래식")).toBeInTheDocument();

    const shortcuts = screen.getByRole("region", { name: "바로가기" });
    expect(within(shortcuts).getAllByRole("link").map((link) => link.textContent)).toEqual([
      expect.stringContaining("레슨 시간표"),
      expect.stringContaining("회차권"),
      expect.stringContaining("인원·거래처"),
      expect.stringContaining("교재"),
      expect.stringContaining("수입 관리"),
      expect.stringContaining("설정"),
    ]);
    expect(within(shortcuts).getByRole("link", { name: /수입 관리/ })).toHaveAttribute(
      "href",
      "/finance/lesson-income",
    );
    expect(screen.queryByText("오늘 출석 확인")).not.toBeInTheDocument();
    expect(screen.queryByText("우선 개발 흐름")).not.toBeInTheDocument();
    expect(screen.queryByText(/Supabase tenant/)).not.toBeInTheDocument();
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
      "상담",
      "교재",
      "재고",
      "출고",
      "결제 완료",
      "발주·입고",
      "수입 관리",
      "학원 고정 수입",
      "입출입내역",
      "교재 내역",
      "선생님 월급",
      "전체 수입",
      "설정",
      "회차권 설정",
    ]);
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(
      within(navigation).getByRole("link", { name: "레슨 시간표" }),
    ).toHaveAttribute("href", "/lessons/academy");
    expect(
      within(navigation).getByRole("link", { name: "수입 관리" }),
    ).toHaveAttribute("href", "/finance/lesson-income");
  });
});

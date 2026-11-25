import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Home from "./page";
import { AppProviders } from "./providers";

function renderHome() {
  return render(
    <AppProviders>
      <Home />
    </AppProviders>,
  );
}

describe("Home", () => {
  it("대시보드 맨 위에 오늘 할 일을 보여 주고 바로가기는 그 아래에 둔다", async () => {
    renderHome();

    const tasks = await screen.findByRole("list", { name: "할 일 목록" });
    expect(screen.getByRole("heading", { level: 2, name: "오늘 할 일" })).toBeInTheDocument();
    expect(within(tasks).getByText("김민지 피아노 보강 날짜 잡기")).toBeInTheDocument();
    expect(within(tasks).getByText("한서아 학부모님께 변경 시간 안내")).toBeInTheDocument();

    const heading = screen.getByRole("heading", { level: 2, name: "오늘 할 일" });
    const shortcuts = screen.getByRole("region", { name: "바로가기" });
    expect(heading.compareDocumentPosition(shortcuts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("첫 화면은 가짜 수치나 개발 메모 없이 사용할 수 있는 메뉴로 바로 이동하는 바로가기를 보여준다", () => {
    renderHome();

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

  it("주요 메뉴는 상위 링크를 기본 표시하고 클릭한 하위 링크를 제공한다", async () => {
    renderHome();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const links = within(navigation).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "대시보드",
      "레슨 시간표",
      "회차권",
      "인원·거래처",
      "교재",
      "수입 관리",
      "설정",
    ]);
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    await userEvent.click(within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: "원생" })).toHaveAttribute("href", "/management/students");
    expect(
      within(navigation).getByRole("link", { name: "레슨 시간표" }),
    ).toHaveAttribute("href", "/lessons/academy");
    expect(
      within(navigation).getByRole("link", { name: "수입 관리" }),
    ).toHaveAttribute("href", "/finance/lesson-income");
  });
});

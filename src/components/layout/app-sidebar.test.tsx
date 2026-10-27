import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mainNavigation } from "@/domain/navigation";

import { SidebarNavigation } from "./app-sidebar";

const lessonNavigation = mainNavigation.find((item) => item.label === "레슨 시간표")!;
const managementNavigation = mainNavigation.find((item) => item.label === "인원·거래처")!;

describe("사이드바 하위 메뉴", () => {
  it("데스크톱은 처음 접고 화살표를 클릭할 때만 펼치거나 접는다", async () => {
    const user = userEvent.setup();
    render(<SidebarNavigation ariaLabel="주요 메뉴"
      visibleNavigation={[lessonNavigation, managementNavigation]} />);

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    const lessonLink = within(navigation).getByRole("link", { name: "레슨 시간표" });
    expect(within(navigation).getByRole("button", { name: "레슨 시간표 하위 메뉴 펼치기" })).toHaveAttribute("aria-expanded", "false");
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();

    await user.hover(lessonLink);
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "레슨 시간표 하위 메뉴 펼치기" }));
    expect(within(navigation).getByRole("button", { name: "레슨 시간표 하위 메뉴 접기" })).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getByRole("link", { name: "학원레슨표" })).toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "레슨 시간표 하위 메뉴 접기" }));
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();
  });

  it("현재 하위 페이지의 메뉴만 기본으로 열고 사용자가 접을 수 있다", async () => {
    const user = userEvent.setup();
    render(<SidebarNavigation ariaLabel="주요 메뉴"
      activeHref="/management/students" visibleNavigation={[lessonNavigation, managementNavigation]} />);

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 접기" })).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 접기" }));
    expect(within(navigation).queryByRole("link", { name: "원생" })).not.toBeInTheDocument();
  });

  it("모바일도 같은 기본 펼침과 클릭 동작을 쓴다", async () => {
    const user = userEvent.setup();
    render(<SidebarNavigation ariaLabel="모바일 주요 메뉴"
      activeHref="/management/students" visibleNavigation={[lessonNavigation, managementNavigation]} />);

    const navigation = screen.getByRole("navigation", { name: "모바일 주요 메뉴" });
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "레슨 시간표 하위 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: "학원레슨표" })).toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 접기" }));
    expect(within(navigation).queryByRole("link", { name: "원생" })).not.toBeInTheDocument();
  });

  it("선택 경로가 바뀌면 새 경로 메뉴만 기본 펼침으로 계산한다", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SidebarNavigation ariaLabel="주요 메뉴"
      activeHref="/lessons/private" visibleNavigation={[lessonNavigation, managementNavigation]} />);
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    await user.click(within(navigation).getByRole("button", { name: "인원·거래처 하위 메뉴 펼치기" }));
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();

    rerender(<SidebarNavigation ariaLabel="주요 메뉴"
      activeHref="/management/students" visibleNavigation={[lessonNavigation, managementNavigation]} />);
    expect(within(navigation).queryByRole("link", { name: "학원레슨표" })).not.toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: "원생" })).toBeInTheDocument();
  });
});

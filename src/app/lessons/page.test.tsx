import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { nextRedirectMock } from "@/test/setup";

import { AppProviders } from "../providers";
import LessonsPage from "./page";
import AcademyLessonsPage from "./academy/page";
import PrivateLessonsPage from "./private/page";

describe("LessonsPage", () => {
  beforeEach(() => {
    nextRedirectMock.mockClear();
    vi.setSystemTime(new Date("2026-09-05T12:00:00+09:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("/lessons는 학원레슨표로 이동한다", () => {
    expect(() => LessonsPage()).toThrow("NEXT_REDIRECT:/lessons/academy");
    expect(nextRedirectMock).toHaveBeenCalledWith("/lessons/academy");
  });

  it("레슨 시간표 화면은 레이아웃 헤더만 제목으로 쓰고 캘린더 진입점을 보여준다", () => {
    window.history.pushState(null, "", "/lessons/academy");

    render(
      <AppProviders>
        <AcademyLessonsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "레슨 시간표" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "레슨관리표" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("레슨 관리 날짜")).not.toBeInTheDocument();
    const subNavigation = screen.getByRole("navigation", {
      name: "레슨 시간표 하위 메뉴",
    });
    expect(
      within(subNavigation).getByRole("link", { name: "학원레슨표" }),
    ).toBeInTheDocument();
    expect(
      within(subNavigation).getByRole("link", { name: "개인레슨표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "2026년 9월 학원레슨 캘린더" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("gridcell", { name: /5 오늘/ }),
    ).toHaveAttribute("aria-current", "date");
    expect(
      screen.getByRole("button", { name: "결석인원" }),
    ).toBeInTheDocument();
  });

  it("개인레슨표의 레슨원생 검색은 개인레슨 수강 원생만 보여준다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/lessons/private");

    render(
      <AppProviders>
        <PrivateLessonsPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "레슨원생 검색" }));

    const dialog = await screen.findByRole("dialog", { name: "레슨원생 검색 및 선택" });

    expect(within(dialog).getByText("한서아")).toBeInTheDocument();
    expect(within(dialog).getByText("최도윤")).toBeInTheDocument();
    expect(within(dialog).queryByText("김민지")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("이서윤")).not.toBeInTheDocument();
  });
});

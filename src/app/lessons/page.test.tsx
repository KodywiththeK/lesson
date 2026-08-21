import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import LessonsPage from "./page";

describe("LessonsPage", () => {
  it("레슨 시간표 화면과 캘린더 기반 레슨관리표 진입점을 보여준다", () => {
    render(
      <AppProviders>
        <LessonsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "레슨 시간표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "레슨관리표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "학원 레슨표" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "2026년 8월 학원 레슨 캘린더" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "미등원인원" }),
    ).toBeInTheDocument();
  });

  it("개인레슨표의 레슨원생 검색은 개인레슨 수강 원생만 보여준다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <LessonsPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("tab", { name: "개인레슨표" }));
    await user.click(screen.getByRole("button", { name: "레슨원생 검색" }));

    const dialog = await screen.findByRole("dialog", { name: "레슨원생 검색" });

    expect(within(dialog).getByText("한서아")).toBeInTheDocument();
    expect(within(dialog).getByText("최도윤")).toBeInTheDocument();
    expect(within(dialog).queryByText("김민지")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("이서윤")).not.toBeInTheDocument();
  });
});

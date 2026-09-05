import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import StudentsPage from "./page";

describe("StudentsPage", () => {
  it("인원·거래처 메뉴의 원생 하위 메뉴에서 원생 목록 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <StudentsPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "원생 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "인원·거래처" }),
    ).toHaveAttribute("href", "/management/students");
    expect(within(navigation).getByRole("link", { name: "원생" })).toHaveAttribute(
      "href",
      "/management/students",
    );
    expect(screen.getByRole("searchbox", { name: "원생 검색" })).toBeInTheDocument();
    expect(await screen.findByText("김민지")).toBeInTheDocument();
    expect(screen.getByText("한서아")).toBeInTheDocument();
  });

  it("원생 등록 다이얼로그에서 등록한 원생을 목록에 반영한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <StudentsPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "원생 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "원생 등록" });

    await user.type(within(dialog).getByLabelText("원생명"), "윤라온");
    await user.type(within(dialog).getByLabelText("연락처"), "010-9999-1234");
    await user.click(within(dialog).getByLabelText("피아노 금요일"));
    await user.type(
      within(dialog).getByLabelText("피아노 금 시작 시간"),
      "14:00",
    );
    await user.type(
      within(dialog).getByLabelText("피아노 금 종료 시간"),
      "14:50",
    );
    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    expect(await screen.findByText("윤라온")).toBeInTheDocument();
  });
});

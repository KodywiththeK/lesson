import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import FinancePage from "./page";

describe("FinancePage", () => {
  it("수입 메뉴에서 입출입 내역 화면으로 진입할 수 있다", async () => {
    render(
      <AppProviders>
        <FinancePage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "수입 관리" }),
    ).toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(
      within(navigation).getByRole("link", { name: "수입" }),
    ).toHaveAttribute("href", "/finance");
    expect(
      screen.getByRole("searchbox", { name: "입출입 내역 검색" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("김민지 8월 피아노 수강료")).toBeInTheDocument();
    expect(screen.getByText("피아노 조율비")).toBeInTheDocument();
  });

  it("수동 입출입 등록 다이얼로그에서 입력한 내역을 목록에 반영한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <FinancePage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "수동 입출입 등록" }));
    const dialog = await screen.findByRole("dialog", {
      name: "수동 입출입 등록",
    });

    await user.selectOptions(within(dialog).getByLabelText("유형"), "expense");
    fireEvent.change(within(dialog).getByLabelText("금액"), {
      target: { value: "45000" },
    });
    await user.type(within(dialog).getByLabelText("설명"), "현악기 줄 교체비");
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "수동 입출입 입력" }),
    );

    expect(await screen.findByText("현악기 줄 교체비")).toBeInTheDocument();
    expect(screen.getByText("45,000원")).toBeInTheDocument();
  });
});

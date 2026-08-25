import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import StatusManagementPage from "./page";

describe("StatusManagementPage", () => {
  it("휴원/퇴원 통합 관리 화면에서 원생과 선생님 상태 목록을 전환한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <StatusManagementPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "휴원/퇴원 관리" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("박지호")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "박지호 재원 처리" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "박지호 퇴원 처리" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "퇴원" }));
    expect(await screen.findByText("유하린")).toBeInTheDocument();
    expect(screen.getByText("보관 중")).toBeInTheDocument();
    expect(screen.getByText("2026-09-10")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "유하린 휴원 처리" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "선생님" }));
    expect(await screen.findByText("문서준")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "문서준 재직 처리" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "퇴사" }));
    expect(await screen.findByText("정예린")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "정예린 휴직 처리" }),
    ).toBeInTheDocument();
  });

  it("상태 변경 버튼은 AlertDialog로 더블체크한다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <StatusManagementPage />
      </AppProviders>,
    );

    await user.click(await screen.findByRole("button", { name: "박지호 재원 처리" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "상태 변경 확인",
    });

    expect(within(dialog).getByText("박지호")).toBeInTheDocument();
    expect(within(dialog).getByText("휴원 -> 재원")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("상태 변경 메모")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "처리" })).toBeInTheDocument();
  });
});

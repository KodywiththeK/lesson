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
    const table = await screen.findByRole("table", {
      name: "휴원/퇴원 관리 목록",
    });
    expect(
      within(table).getByRole("columnheader", { name: "대상" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "처리/보관" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("columnheader", { name: "자동 보관 상태" }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("박지호")).toBeInTheDocument();
    expect(screen.getByText("방학 기간 휴원")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "박지호 재원 처리" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "박지호 자세히보기" }));
    const detailDialog = await screen.findByRole("dialog", {
      name: "박지호 상태 상세",
    });
    expect(within(detailDialog).getByText("방학 기간 휴원")).toBeInTheDocument();
    await user.click(within(detailDialog).getByRole("button", { name: "닫기" }));

    expect(
      screen.getByRole("button", { name: "박지호 퇴원 처리" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "퇴원" }));
    expect(await screen.findByText("유하린")).toBeInTheDocument();
    expect(screen.getByText(/2026-09-10.*보관 중/)).toBeInTheDocument();
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

  it("재원 처리 확인창은 메모 없이 더블체크한다", async () => {
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
    expect(within(dialog).queryByLabelText("상태 변경 메모")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "처리" })).toBeInTheDocument();
  });

  it("휴원/퇴원 처리 확인창은 상태 변경 메모를 남길 수 있다", async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <StatusManagementPage />
      </AppProviders>,
    );

    await user.click(await screen.findByRole("button", { name: "박지호 퇴원 처리" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "상태 변경 확인",
    });

    expect(within(dialog).getByText("휴원 -> 퇴원")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("상태 변경 메모")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "처리" })).toBeInTheDocument();
  });
});

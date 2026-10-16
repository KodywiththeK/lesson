import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../providers";
import BookPaidPage from "./page";

function renderPaidPage() {
  window.history.pushState(null, "", "/books/paid");

  return render(
    <AppProviders>
      <BookPaidPage />
    </AppProviders>,
  );
}

describe("BookPaidPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-20T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("교재 메뉴의 결제 완료 하위 메뉴에서 이번 달 결제 완료 내역으로 진입할 수 있다", async () => {
    renderPaidPage();

    expect(screen.getByRole("heading", { level: 1, name: "교재" })).toBeInTheDocument();
    const subNavigation = screen.getByRole("navigation", { name: "교재 하위 메뉴" });
    expect(within(subNavigation).getByRole("link", { name: "결제 완료" })).toHaveAttribute("href", "/books/paid");
    expect(screen.getByLabelText("조회 월")).toHaveValue("2026-08");

    const row = await screen.findByRole("row", { name: /한서아/ });
    expect(within(row).getByRole("cell", { name: "스즈키 바이올린 1" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2026-08-14" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "결제 완료" })).toBeInTheDocument();
  });

  it("원장이 결제를 취소하면 결제 완료 목록에서 사라진다", async () => {
    const user = userEvent.setup();
    renderPaidPage();

    await user.click(await screen.findByRole("button", { name: "한서아 스즈키 바이올린 1 결제 취소" }));
    const confirmation = await screen.findByRole("alertdialog", { name: "결제를 취소할까요?" });
    await user.type(within(confirmation).getByLabelText("취소 사유"), "입금자 착오");
    await user.click(within(confirmation).getByRole("button", { name: "결제 취소" }));

    expect(await screen.findByText("결제 완료 내역이 없습니다.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });
});

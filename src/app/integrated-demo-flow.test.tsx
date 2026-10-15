import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./providers";
import FinanceLedgerPage from "./finance/ledger/page";
import PrivateLessonsPage from "./lessons/private/page";
import PassesPage from "./passes/page";

describe("integrated demo flow", () => {
  it("회차권 구매 금액을 수입 페이지에 자동 반영한다", async () => {
    const user = userEvent.setup();
    const view = render(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "회차권 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });

    await within(dialog).findByRole("option", { name: "한서아" });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-4");
    await within(dialog).findByRole("option", { name: "바이올린" });
    await user.selectOptions(within(dialog).getByLabelText("악기"), "violin");
    fireEvent.change(within(dialog).getByLabelText("부여 회수"), {
      target: { value: "4" },
    });
    fireEvent.change(within(dialog).getByLabelText("결제 금액"), {
      target: { value: "160000" },
    });
    fireEvent.change(within(dialog).getByLabelText("유효 시작일"), {
      target: { value: "2026-08-21" },
    });
    fireEvent.change(within(dialog).getByLabelText("유효 만료일"), {
      target: { value: "2026-09-20" },
    });
    fireEvent.change(within(dialog).getByLabelText("등록일"), {
      target: { value: "2026-08-21" },
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "회차권 등록 입력" }),
    );

    view.rerender(
      <AppProviders>
        <FinanceLedgerPage />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("입출금 월 선택"), {
      target: { value: "2026-08" },
    });

    expect(
      await screen.findByText("한서아 바이올린 회차권 4회 구매"),
    ).toBeInTheDocument();
    expect(screen.getByText("160,000원")).toBeInTheDocument();
  });

  it("개인레슨 출석 확인이 회차권 잔여 회수를 차감한다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/lessons/private");

    const view = render(
      <AppProviders>
        <PrivateLessonsPage />
      </AppProviders>,
    );

    fireEvent.change(screen.getByLabelText("개인레슨 캘린더 월 선택"), {
      target: { value: "2026-08" },
    });
    await user.click(
      screen.getByRole("gridcell", {
        name: /21(?: 메모 \d+)? 한서 한서아 \[개인레슨\] 18:00 오유진/,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 개인레슨 출석 확인",
    });

    await user.click(
      within(dialog).getByRole("button", { name: "한서아 개인레슨 출석" }),
    );

    view.rerender(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    expect(within(seoaRow).getByText("1회")).toBeInTheDocument();
  });
});

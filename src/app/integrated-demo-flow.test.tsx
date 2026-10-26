import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

    await within(dialog).findByRole("option", { name: "바이올린" });
    await user.selectOptions(within(dialog).getByLabelText("악기"), "violin");
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-4");
    fireEvent.change(within(dialog).getByLabelText("부여 회수"), {
      target: { value: "4" },
    });
    fireEvent.change(within(dialog).getByLabelText("결제 금액"), {
      target: { value: "160000" },
    });
    fireEvent.change(within(dialog).getByLabelText("사용 기한(일)"), {
      target: { value: "30" },
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

    const purchase = await screen.findByText("한서아 바이올린 회차권 4회 구매");
    expect(within(purchase.closest("tr")!).getByText("160,000원")).toBeInTheDocument();
  });

  it("같은 원생·악기로 다시 등록하면 기존 회차권에 회수가 더해지고 만료일이 새로 계산된다", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "회차권 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });
    await within(dialog).findByRole("option", { name: "바이올린" });
    await user.selectOptions(within(dialog).getByLabelText("악기"), "violin");
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-4");
    fireEvent.change(within(dialog).getByLabelText("부여 회수"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("등록일"), { target: { value: "2026-08-21" } });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    await waitFor(() => {
      expect(within(seoaRow).getByRole("cell", { name: "13회" })).toBeInTheDocument();
    });
    expect(within(seoaRow).getByRole("cell", { name: "7회" })).toBeInTheDocument();
    expect(within(seoaRow).getByRole("cell", { name: "2026-09-20" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "회차권 등록" })).not.toBeInTheDocument();
  });

  it("회차권 수정 다이얼로그에서 회수와 만료일을 고치면 목록에 반영된다", async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    await user.click(await screen.findByRole("button", { name: "한서아 바이올린 회차권 수정" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 수정" });
    fireEvent.change(within(dialog).getByLabelText("잔여 회수"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("수정 사유"), {
      target: { value: "수기 장부와 맞추기" },
    });
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    await waitFor(() => {
      expect(within(seoaRow).getByRole("cell", { name: "5회" })).toBeInTheDocument();
    });
    expect(within(seoaRow).queryByText("잔여 부족")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "회차권 수정" })).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: /2026-08-21 일정 \d+건/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 개인레슨 출석 확인",
    });

    await user.click(
      within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }),
    );

    expect(within(dialog).queryByRole("button", { name: "한서아 개인레슨 등원 확인" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인 취소" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" })).toBeEnabled();

    view.rerender(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    expect(within(seoaRow).getByText("1회")).toBeInTheDocument();
  });

  it("개인레슨 등원 확인을 취소하면 차감했던 회차권 잔여 회수가 복구된다", async () => {
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
      screen.getByRole("button", { name: /2026-08-21 일정 \d+건/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 개인레슨 출석 확인",
    });

    await user.click(
      within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인 취소" }),
    );

    expect(
      within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }),
    ).toBeEnabled();

    view.rerender(
      <AppProviders>
        <PassesPage />
      </AppProviders>,
    );

    const seoaRow = await screen.findByRole("row", { name: /한서아/ });
    expect(within(seoaRow).getByText("2회")).toBeInTheDocument();
  });
});

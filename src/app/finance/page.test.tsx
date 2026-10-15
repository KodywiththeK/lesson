import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../providers";
import { nextRedirectMock } from "@/test/setup";
import FinancePage from "./page";
import FinanceBooksPage from "./books/page";
import FinanceLedgerPage from "./ledger/page";
import FinanceLessonIncomePage from "./lesson-income/page";
import FinanceOverviewPage from "./overview/page";
import FinancePayrollPage from "./payroll/page";

describe("Finance routes", () => {
  it("/finance는 입출금 내역으로 redirect한다", () => {
    expect(() => FinancePage()).toThrow("NEXT_REDIRECT");
    expect(nextRedirectMock).toHaveBeenCalledWith("/finance/ledger");
  });

  it("입출금 내역 하위 탭과 캘린더뷰, CSV action을 제공한다", async () => {
    window.history.pushState(null, "", "/finance/ledger");

    render(
      <AppProviders>
        <FinanceLedgerPage />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "수입 관리" }),
    ).toBeInTheDocument();
    const subNavigation = screen.getByRole("navigation", {
      name: "수입 관리 하위 메뉴",
    });
    expect(
      within(subNavigation).getByRole("link", { name: "입출금 내역" }),
    ).toHaveAttribute("href", "/finance/ledger");
    expect(
      screen.getByRole("button", { name: "CSV 내보내기" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("입출금 월 선택"), {
      target: { value: "2026-08" },
    });
    await screen.findByRole("table", { name: "입출금 내역" });

    await userEvent.click(screen.getByRole("tab", { name: "캘린더" }));
    expect(
      screen.getByRole("grid", { name: "2026년 8월 입출금 캘린더" }),
    ).toBeInTheDocument();
  });

  it("수동 입출금 등록 후 수정과 삭제를 할 수 있다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/finance/ledger");

    render(
      <AppProviders>
        <FinanceLedgerPage />
      </AppProviders>,
    );

    await user.click(screen.getByRole("button", { name: "수동 입출금 등록" }));
    const createDialog = await screen.findByRole("dialog", {
      name: "수동 입출금 등록",
    });
    await user.selectOptions(within(createDialog).getByLabelText("유형"), "expense");
    await user.selectOptions(
      within(createDialog).getByLabelText("고정 분류"),
      "supplies",
    );
    fireEvent.change(within(createDialog).getByLabelText("금액"), {
      target: { value: "45000" },
    });
    await user.type(within(createDialog).getByLabelText("설명"), "현악기 줄 교체비");
    fireEvent.submit(
      within(createDialog).getByRole("form", { name: "수동 입출금 입력" }),
    );

    expect(await screen.findByText("현악기 줄 교체비")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "현악기 줄 교체비 수정" }),
    );
    const editDialog = await screen.findByRole("dialog", {
      name: "입출금 내역 수정",
    });
    await user.clear(within(editDialog).getByLabelText("설명"));
    await user.type(within(editDialog).getByLabelText("설명"), "피아노 조율비 수정");
    fireEvent.submit(
      within(editDialog).getByRole("form", { name: "입출금 내역 수정 입력" }),
    );
    expect(await screen.findByText("피아노 조율비 수정")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "피아노 조율비 수정 삭제" }),
    );
    expect(screen.queryByText("피아노 조율비 수정")).not.toBeInTheDocument();
  });

  it("학원 레슨수입은 통합 표와 수납 dialog를 제공한다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/finance/lesson-income");

    render(
      <AppProviders>
        <FinanceLessonIncomePage />
      </AppProviders>,
    );

    fireEvent.change(await screen.findByLabelText("월별 전체 레슨수입 월 선택"), {
      target: { value: "2026-08" },
    });

    const table = await screen.findByRole("table", { name: "학원 레슨수입" });
    expect(within(table).getByRole("columnheader", { name: "진도" })).toBeInTheDocument();
    expect(
      (await within(table).findAllByRole("cell", { name: "학원레슨 월수강료" })).length,
    ).toBeGreaterThan(0);
    expect(
      within(table).getAllByRole("cell", { name: "개인레슨 회차권" }).length,
    ).toBeGreaterThan(0);

    await user.click(within(screen.getByRole("table", { name: "학원 레슨수입" })).getByRole("button", { name: /김민지 수납 처리/ }));
    const dialog = await screen.findByRole("dialog", { name: "수납 처리" });
    expect(within(dialog).getByLabelText("수납일")).toBeInTheDocument();
  });

  it("교재내역은 발주일, 출고일, 입금일을 보여준다", async () => {
    window.history.pushState(null, "", "/finance/books");

    render(
      <AppProviders>
        <FinanceBooksPage />
      </AppProviders>,
    );

    const table = await screen.findByRole("table", { name: "교재내역" });
    expect(within(table).getByRole("columnheader", { name: "발주일" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "출고일" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "입금일" })).toBeInTheDocument();
  });

  it("선생님 월급은 월별 급여와 지급 확정 action을 보여준다", async () => {
    window.history.pushState(null, "", "/finance/payroll");

    render(
      <AppProviders>
        <FinancePayrollPage />
      </AppProviders>,
    );

    const table = await screen.findByRole("table", { name: "선생님 월급" });
    expect(within(table).getByRole("columnheader", { name: "기본급여" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "원천징수" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /급여 지급 확정/ }).length,
    ).toBeGreaterThan(0);
  });

  it("전체수입은 수입만 월별 그래프와 분류별 합계로 보여준다", async () => {
    window.history.pushState(null, "", "/finance/overview");

    render(
      <AppProviders>
        <FinanceOverviewPage />
      </AppProviders>,
    );

    expect(await screen.findByRole("figure", { name: "월별 수입 그래프" })).toBeInTheDocument();
    expect(screen.getByText("분류별 수입")).toBeInTheDocument();
    expect(screen.queryByText("피아노 조율비")).not.toBeInTheDocument();
  });
});

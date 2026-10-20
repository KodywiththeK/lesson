import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookSale } from "@/domain/book-sale";

import { buildBookFinanceRows, FinanceBooksScreen } from "./finance-books-screen";
import { resetFinanceMonthForTest } from "./finance-shared";
import type { FinanceManagementData } from "./finance-types";

/** 기본값은 8월에 입금된 결제 완료 건이다. 결제 대기 건은 `status`를 덮어써서 만든다. */
function buildSale(overrides: { saleId: string } & Record<string, unknown>): BookSale {
  return {
    academyId: "academy-1",
    bookId: "book-1",
    bookTitle: "바이엘 1",
    studentId: "student-1",
    studentName: "김민지",
    price: 12000,
    quantity: 1,
    shippedAt: "2026-08-10",
    status: "paid",
    paidAt: "2026-08-12",
    permanent: true,
    ...overrides,
  } as BookSale;
}

function renderBooks(bookSales: BookSale[]) {
  const financeData: FinanceManagementData = {
    ledgerEntries: [],
    enrollments: [],
    tickets: [],
    bookSales,
    teachers: [],
  };
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceBooksScreen academyId="academy-1" financeData={financeData} />
    </QueryClientProvider>,
  );
}

const MONTH_LABEL = "교재 수입 총합 월 선택";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00"));
  resetFinanceMonthForTest();
});
afterEach(() => vi.useRealTimers());

describe("교재 내역 화면", () => {
  it("발주·입고·지급을 같은 월 교재 화면에서 조회하고 원장 불일치를 경고한다", async () => {
    const financeData: FinanceManagementData = { ledgerEntries: [], enrollments: [], tickets: [], teachers: [], bookSales: [] };
    render(<QueryClientProvider client={new QueryClient()}>
      <FinanceBooksScreen academyId="academy-1" financeData={financeData} bookOrdersQueryOptions={{
        queryKey: ["orders", "academy-1"],
        queryFn: async () => [{
          id: "order-1", academyId: "academy-1", vendorId: "vendor-1", vendorName: "음악서점",
          orderedOn: "2026-08-01", receivedOn: "2026-08-04", paidOn: "2026-08-09",
          paidLedgerEntryId: "ledger-1", ledgerMismatch: true, status: "received" as const,
          items: [{ id: "item-1", bookId: "book-1", title: "바이엘 1", quantity: 2, purchasePrice: 5000, salePrice: 12000 }],
        }],
      }} />
    </QueryClientProvider>);
    expect(await screen.findByText("음악서점")).toBeInTheDocument();
    expect(screen.getByText("원장 불일치")).toBeInTheDocument();
    expect(screen.getByText("2026-08-04")).toBeInTheDocument();
    expect(screen.getByText("2026-08-09")).toBeInTheDocument();
  });
  it("같은 날 출고된 두 품목을 한 행으로 묶고 원장 기준 수입·지출·차액을 보여 준다", () => {
    const financeData: FinanceManagementData = {
      ledgerEntries: [
        { academyId: "academy-1", ledgerId: "sale", occurredOn: "2026-08-12", type: "income", source: "book-sale", category: "book-sale", amount: 18000, description: "교재", refId: "sale" },
        { academyId: "academy-1", ledgerId: "order", occurredOn: "2026-08-14", type: "expense", source: "manual", category: "book-order", amount: 7000, description: "발주", refId: "order" },
      ],
      enrollments: [], tickets: [], teachers: [],
      bookSales: [buildSale({ saleId: "one" }), buildSale({ saleId: "two", bookTitle: "체르니", price: 6000 })],
    };
    render(<QueryClientProvider client={new QueryClient()}>
      <FinanceBooksScreen academyId="academy-1" financeData={financeData} />
    </QueryClientProvider>);
    const cashFlow = screen.getByLabelText("교재 원장 수지");
    expect(within(cashFlow).getByText("18,000원")).toBeInTheDocument();
    expect(within(cashFlow).getByText("7,000원")).toBeInTheDocument();
    expect(within(cashFlow).getByText("11,000원")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "교재내역" })).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /품목/ }));
    expect(screen.getByText(/체르니 · 1권/)).toBeInTheDocument();
  });
  it("입금 완료인데 원장 연결이 null인 교재에만 원장 기록 없음 배지를 보여 준다", () => {
    renderBooks([
      buildSale({ saleId: "linked", studentName: "김민지", paidLedgerEntryId: "ledger-1" }),
      buildSale({ saleId: "missing", studentName: "이서윤", paidLedgerEntryId: null }),
      // 연결 정보를 읽지 않은 환경(데모)에서는 알 수 없으므로 배지를 보이지 않는다.
      buildSale({ saleId: "unknown", studentName: "박지후" }),
    ]);
    const table = screen.getByRole("table", { name: "교재내역" });

    expect(within(within(table).getByRole("row", { name: /이서윤/ })).getByText("원장 기록 없음")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /김민지/ })).queryByText("원장 기록 없음")).not.toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /박지후/ })).queryByText("원장 기록 없음")).not.toBeInTheDocument();
  });

  it("결제 완료 건만 이름·도서명·가격·수량·금액·출고일·입금일 열로 보여 준다", () => {
    renderBooks([
      buildSale({ saleId: "sale-paid" }),
      buildSale({
        saleId: "sale-pending",
        studentName: "이서윤",
        bookTitle: "체르니 100",
        status: "payment-pending",
        paidAt: undefined,
        permanent: undefined,
      }),
      buildSale({ saleId: "sale-other-academy", academyId: "academy-2", studentName: "박지후" }),
    ]);

    const table = screen.getByRole("table", { name: "교재내역" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "이름", "도서명", "가격", "수량", "금액", "출고일", "입금일",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "이름", "도서명", "가격", "수량", "금액", "출고일", "입금일",
    ]);
    expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "김민지", "바이엘 1", "12,000원", "1권", "12,000원", "2026-08-10", "2026-08-12",
    ]);
    expect(screen.queryByText("이서윤")).not.toBeInTheDocument();
    expect(screen.queryByText("박지후")).not.toBeInTheDocument();
    expect(screen.queryByText("입금 대기")).not.toBeInTheDocument();
  });

  it("금액은 단가 × 수량이고 교재 수입 총합도 금액의 합이다", () => {
    renderBooks([
      buildSale({ saleId: "sale-1", price: 15000, quantity: 3 }),
      buildSale({ saleId: "sale-2", studentName: "이서윤", price: 10000, quantity: 1 }),
    ]);

    const table = screen.getByRole("table", { name: "교재내역" });
    const firstRow = within(table).getByRole("row", { name: /김민지/ });
    expect(within(firstRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "김민지", "바이엘 1", "15,000원", "3권", "45,000원", "2026-08-10", "2026-08-12",
    ]);
    expect(screen.getByText("55,000원")).toHaveClass("text-total");
  });

  it("조회 전용임을 알리는 한 줄 설명과 파란색 교재 수입 총합을 보여 준다", () => {
    renderBooks([
      buildSale({ saleId: "sale-1", price: 12000 }),
      buildSale({ saleId: "sale-2", studentName: "이서윤", price: 18000 }),
    ]);

    expect(
      screen.getByText("교재 관리의 '결제 완료' 상태인 데이터만 자동으로 반영됩니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("교재 수입 총합")).toBeInTheDocument();
    expect(screen.getByText("30,000원")).toHaveClass("text-total");
  });

  it("고른 월은 출고일이 아니라 입금일이 속한 월로 거르고 합계도 그 달만 더한다", () => {
    renderBooks([
      buildSale({ saleId: "sale-aug", studentName: "김민지", price: 12000, shippedAt: "2026-07-30", paidAt: "2026-08-02" }),
      buildSale({ saleId: "sale-jul", studentName: "이서윤", price: 18000, shippedAt: "2026-07-10", paidAt: "2026-07-12" }),
    ]);

    expect(screen.getByLabelText(MONTH_LABEL)).toHaveValue("2026-08");
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.queryByText("이서윤")).not.toBeInTheDocument();
    expect(screen.getByText("12,000원", { selector: "span.text-total" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(MONTH_LABEL), { target: { value: "2026-07" } });

    expect(screen.getByText("이서윤")).toBeInTheDocument();
    expect(screen.queryByText("김민지")).not.toBeInTheDocument();
    expect(screen.getByText("18,000원", { selector: "span.text-total" })).toBeInTheDocument();
  });

  it("그 달에 결제 완료된 교재가 없으면 결제 표기로 안내하고, 검색 결과만 없으면 조건 안내를 보여 준다", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBooks([buildSale({ saleId: "sale-jul", paidAt: "2026-07-12" })]);

    expect(screen.getByText("결제 완료된 교재 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("조건에 맞는 교재내역이 없습니다.")).not.toBeInTheDocument();
    unmount();

    renderBooks([buildSale({ saleId: "sale-aug" })]);
    await user.type(screen.getByRole("searchbox", { name: "교재내역 검색" }), "없는 교재");

    expect(screen.getByText("조건에 맞는 교재내역이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("결제 완료된 교재 내역이 없습니다.")).not.toBeInTheDocument();
  });

  it("고른 월은 다른 탭에서도 이어진다", () => {
    const first = renderBooks([buildSale({ saleId: "sale-jul", paidAt: "2026-07-12" })]);

    fireEvent.change(screen.getByLabelText(MONTH_LABEL), { target: { value: "2026-07" } });
    first.unmount();
    renderBooks([buildSale({ saleId: "sale-jul", paidAt: "2026-07-12" })]);

    expect(screen.getByLabelText(MONTH_LABEL)).toHaveValue("2026-07");
    expect(screen.getByText("김민지")).toBeInTheDocument();
  });
});

describe("buildBookFinanceRows", () => {
  it("입금일이 비어 있는 결제 완료 건도 어느 월에도 속하지 않게 제외한다", () => {
    const rows = buildBookFinanceRows(
      [buildSale({ saleId: "sale-no-date", paidAt: "" })],
      "academy-1",
      "2026-08",
    );

    expect(rows).toEqual([]);
  });
});

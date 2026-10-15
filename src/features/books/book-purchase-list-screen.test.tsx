import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildBookPurchaseList, type BookSale } from "@/domain/book-sale";

import {
  BookPurchaseListScreen,
  type BookPurchaseListQueryOptionsFactory,
} from "./book-purchase-list-screen";

const bookSales: BookSale[] = [
  {
    academyId: "academy-1",
    saleId: "sale-1",
    bookId: "book-1",
    bookTitle: "바이엘 2",
    studentId: "student-1",
    studentName: "김민지",
    price: 12000,
    shippedAt: "2026-08-21",
    status: "payment-pending" as const,
  },
  {
    academyId: "academy-1",
    saleId: "sale-2",
    bookId: "book-2",
    bookTitle: "체르니 100",
    studentId: "student-2",
    studentName: "이서윤",
    price: 15000,
    shippedAt: "2026-08-22",
    status: "paid" as const,
    paidAt: "2026-08-23",
    permanent: true,
  },
];

function renderBookPurchaseListScreen(
  queryOptionsFactory: BookPurchaseListQueryOptionsFactory,
  canRecordPayment = true,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BookPurchaseListScreen
        academyId="academy-1"
        academyName="더 클래식"
        canRecordPayment={canRecordPayment}
        queryOptionsFactory={queryOptionsFactory}
      />
    </QueryClientProvider>,
  );
}

describe("BookPurchaseListScreen", () => {
  afterEach(() => vi.useRealTimers());

  it("교재 출고일은 오늘로 시작하고 데스크는 결제 완료를 고를 수 없다", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00+09:00"));
    renderBookPurchaseListScreen((options) => ({
      queryKey: ["books", options.academyId],
      queryFn: async () => buildBookPurchaseList(bookSales, options),
    }), false);

    await userEvent.setup().click(screen.getByRole("button", { name: "교재 출고" }));
    const dialog = screen.getByRole("dialog", { name: "교재 출고" });
    expect(within(dialog).getByLabelText("출고일")).toHaveValue("2026-10-15");
    expect(within(dialog).queryByRole("option", { name: "결제 완료" })).not.toBeInTheDocument();
  });
  it("교재 구매 목록을 표로 보여주고 원생명, 교재명, 자동 입력 가격, 출고일, 결제 상태를 표시한다", async () => {
    renderBookPurchaseListScreen((options) => ({
      queryKey: ["books", options.academyId, options.search ?? ""],
      queryFn: async () => buildBookPurchaseList(bookSales, options),
    }));

    const table = await screen.findByRole("table", { name: "교재 구매 목록" });
    expect(
      within(table).getByRole("cell", { name: "김민지" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "바이엘 2" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "12,000원" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "2026-08-21" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "결제 대기" }),
    ).toBeInTheDocument();
  });

  it("검색어와 결제 상태 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<BookPurchaseListQueryOptionsFactory>[0][] = [];

    renderBookPurchaseListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "books",
          options.academyId,
          options.search ?? "",
          options.filters?.status ?? "",
        ],
        queryFn: async () => buildBookPurchaseList(bookSales, options),
      };
    });

    await screen.findByRole("cell", { name: "김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "교재 구매 검색" }),
      "체르니",
    );
    await user.selectOptions(screen.getByLabelText("결제 상태 필터"), "paid");

    expect(
      await screen.findByRole("cell", { name: "이서윤" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "김민지" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "체르니",
      filters: {
        status: "paid",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderBookPurchaseListScreen((options) => ({
      queryKey: ["books", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "교재 구매 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});

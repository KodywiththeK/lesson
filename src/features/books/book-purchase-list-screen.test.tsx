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

// 원생01~원생25. 앞 15건은 바이엘, 나머지는 체르니. 짝수 번호는 결제 완료, 홀수 번호는 결제 대기다.
const manyBookSales: BookSale[] = Array.from({ length: 25 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const isPaid = (index + 1) % 2 === 0;
  const sale = {
    academyId: "academy-1",
    saleId: `sale-${number}`,
    bookId: `book-${number}`,
    bookTitle: `${index < 15 ? "바이엘" : "체르니"} ${number}`,
    studentId: `student-${number}`,
    studentName: `원생${number}`,
    price: 12000,
    shippedAt: "2026-08-21",
  };

  return isPaid
    ? { ...sale, status: "paid" as const, paidAt: "2026-08-23", permanent: true as const }
    : { ...sale, status: "payment-pending" as const };
});

const pagedQueryOptionsFactory: BookPurchaseListQueryOptionsFactory = (options) => ({
  queryKey: [
    "books",
    options.academyId,
    options.search ?? "",
    options.filters?.status ?? "",
    options.page ?? "",
    options.pageSize ?? "",
  ],
  queryFn: async () => buildBookPurchaseList(manyBookSales, options),
});

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

  it("좁은 화면에서도 교재 구매 정보의 항목명을 제공한다", async () => {
    renderBookPurchaseListScreen((options) => ({
      queryKey: ["books", options.academyId],
      queryFn: async () => buildBookPurchaseList(bookSales, options),
    }));

    const table = await screen.findByRole("table", { name: "교재 구매 목록" });
    const row = within(table).getByRole("row", { name: /김민지/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "원생", "교재명", "가격", "출고일", "결제 상태",
    ]);
  });

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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });
});

describe("BookPurchaseListScreen 페이지 이동", () => {
  it("총 교재 구매 건수와 페이지당 개수 선택을 항상 보여주고 10건씩 표시한다", async () => {
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    const table = await screen.findByRole("table", { name: "교재 구매 목록" });

    expect(screen.getByText("총 25건")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByRole("cell", { name: "원생10" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "원생11" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 교재 구매 수" })).toHaveValue("10");
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("교재 구매가 10건 이하여도 총 건수와 페이지 이동을 보여준다", async () => {
    renderBookPurchaseListScreen((options) => ({
      queryKey: ["books", options.academyId, options.page ?? ""],
      queryFn: async () => buildBookPurchaseList(bookSales, options),
    }));

    await screen.findByRole("table", { name: "교재 구매 목록" });

    expect(screen.getByText("총 2건")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("다음 페이지로 이동하면 11번째 교재 구매부터 보여준다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생01" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("페이지당 20개를 고르면 1페이지로 돌아가 20건을 보여준다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByRole("combobox", { name: "페이지당 교재 구매 수" }), "20");

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "원생20" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생21" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("검색하면 1페이지로 돌아가 검색 결과의 첫 교재 구매부터 보여준다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.type(screen.getByRole("searchbox", { name: "교재 구매 검색" }), "바이엘");

    expect(await screen.findByText("총 15건")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("결제 상태 필터를 바꾸면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByLabelText("결제 상태 필터"), "payment-pending");

    expect(await screen.findByText("총 13건")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("초기화하면 1페이지로 돌아가 전체 교재 구매를 보여준다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.click(screen.getByRole("button", { name: "초기화" }));

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByText("총 25건")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("조건에 맞는 교재 구매가 없어도 총 0건을 보여준다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.type(screen.getByRole("searchbox", { name: "교재 구매 검색" }), "없는교재");

    expect(await screen.findByText("조건에 맞는 교재 구매 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0건")).toBeInTheDocument();
  });
});

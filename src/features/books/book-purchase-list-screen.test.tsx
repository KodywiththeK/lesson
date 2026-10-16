import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBookPurchaseList, type BookSale } from "@/domain/book-sale";

import {
  BookPurchaseListScreen,
  type BookPurchaseListQueryOptionsFactory,
} from "./book-purchase-list-screen";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const supabaseMock = vi.hoisted(() => ({
  client: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => supabaseMock.client,
}));

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

type BookPurchaseListScreenProps = ComponentProps<typeof BookPurchaseListScreen>;

function renderBookPurchaseListScreen(
  queryOptionsFactory: BookPurchaseListQueryOptionsFactory | undefined,
  canRecordPayment = true,
  props: Partial<BookPurchaseListScreenProps> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <BookPurchaseListScreen
          academyId="academy-1"
          academyName="더 클래식"
          canRecordPayment={canRecordPayment}
          queryOptionsFactory={queryOptionsFactory}
          {...props}
        />
      </QueryClientProvider>,
    ),
    invalidateQueries,
  };
}

const pendingBookQueryOptionsFactory: BookPurchaseListQueryOptionsFactory = (options) => ({
  queryKey: ["books", options.academyId],
  queryFn: async () => buildBookPurchaseList(bookSales, options),
});

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
    // 결제 상태 칸에는 원장용 "결제 완료 처리" 버튼이 함께 있어 셀 이름이 아닌 배지 글자로 확인한다.
    expect(within(table).getByText("결제 대기")).toBeInTheDocument();
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

describe("BookPurchaseListScreen 결제 완료 처리", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T12:00:00+09:00"));
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  async function openPaymentDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "김민지 바이엘 2 결제 완료 처리" }));

    return screen.findByRole("dialog", { name: "결제 완료 처리" });
  }

  it("원장에게는 결제 대기 행에만 결제 완료 처리 버튼을 보여 준다", async () => {
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory);

    const table = await screen.findByRole("table", { name: "교재 구매 목록" });
    expect(within(within(table).getByRole("row", { name: /김민지/ })).getByRole("button", { name: "김민지 바이엘 2 결제 완료 처리" })).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /이서윤/ })).queryByRole("button", { name: /결제 완료 처리/ })).not.toBeInTheDocument();
    expect(screen.queryByText("결제 완료 처리는 원장만 할 수 있습니다.")).not.toBeInTheDocument();
  });

  it("원장이 아니면 버튼 대신 원장만 할 수 있다는 안내 한 줄을 보여 준다", async () => {
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory, false);

    await screen.findByRole("table", { name: "교재 구매 목록" });
    expect(screen.queryByRole("button", { name: /결제 완료 처리/ })).not.toBeInTheDocument();
    expect(screen.getByText("결제 완료 처리는 원장만 할 수 있습니다.")).toBeInTheDocument();
  });

  it("입금일을 받아 결제 완료 처리하고 교재 목록과 재무 쿼리를 새로 불러온다", async () => {
    const user = userEvent.setup();
    const completeBookPayment = vi.fn().mockResolvedValue(undefined);
    const { invalidateQueries } = renderBookPurchaseListScreen(pendingBookQueryOptionsFactory, true, {
      completeBookPayment,
    });

    const dialog = await openPaymentDialog(user);
    expect(within(dialog).getByText("확인하면 입출입내역에 교재 수입이 기록됩니다.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("입금일")).toHaveValue("2026-10-15");

    fireEvent.change(within(dialog).getByLabelText("입금일"), { target: { value: "2026-10-14" } });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(completeBookPayment).toHaveBeenCalledWith({ releaseId: "sale-1", paidAt: "2026-10-14" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("교재 결제를 완료 처리했습니다.");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["academy", "academy-1", "books"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["academy", "academy-1", "finance"] });
  });

  it("처리하는 동안에는 확인 버튼을 막고 처리 중으로 알린다", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const completeBookPayment = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory, true, { completeBookPayment });

    const dialog = await openPaymentDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    expect(await within(dialog).findByRole("button", { name: "처리 중" })).toBeDisabled();
    expect(completeBookPayment).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("실패하면 사용자 문구로 알리고 성공 안내는 하지 않는다", async () => {
    const user = userEvent.setup();
    const completeBookPayment = vi.fn().mockRejectedValue(new Error("permission denied"));
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory, true, { completeBookPayment });

    const dialog = await openPaymentDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("교재 결제 완료 처리에 실패했습니다.", {
        description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("처리 핸들러도 서버 연결도 없는 환경에서는 처리할 수 없다고 알린다", async () => {
    const user = userEvent.setup();
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory);

    const dialog = await openPaymentDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("교재 결제 완료 처리에 실패했습니다.", {
        description: "이 화면에서는 처리할 수 없습니다.",
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("서버에 연결된 화면에서는 결제 완료 RPC로 처리한다", async () => {
    const user = userEvent.setup();
    const releaseRows = bookSales.map((sale) => ({
      id: sale.saleId,
      academy_id: sale.academyId,
      book_id: sale.bookId,
      student_id: sale.studentId,
      student_name: sale.studentName,
      book_title: sale.bookTitle,
      price: sale.price,
      shipped_at: sale.shippedAt,
      status: sale.status,
      paid_at: sale.status === "paid" ? sale.paidAt : null,
    }));
    // 목록 조회는 eq → order → range 순으로 이어 붙이고 마지막 range에서 결과를 돌려준다.
    const pagedQuery = {
      eq: () => pagedQuery,
      order: () => pagedQuery,
      range: async () => ({ data: releaseRows, error: null }),
    };
    supabaseMock.client.from.mockReturnValue({ select: () => pagedQuery });
    supabaseMock.client.rpc.mockResolvedValue({
      data: { ...releaseRows[0], status: "paid", paid_at: "2026-10-15" },
      error: null,
    });
    renderBookPurchaseListScreen(undefined, true, {
      students: [{ studentId: "student-1", name: "김민지" } as never],
    });

    const dialog = await openPaymentDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(supabaseMock.client.rpc).toHaveBeenCalledWith("complete_book_release_payment", {
        p_academy_id: "academy-1",
        p_release_id: "sale-1",
        p_paid_at: "2026-10-15",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("교재 결제를 완료 처리했습니다."));
  });
});

describe("BookPurchaseListScreen 교재 출고 저장", () => {
  async function fillReleaseForm(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "교재 출고" }));
    const dialog = await screen.findByRole("dialog", { name: "교재 출고" });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.type(within(dialog).getByLabelText("교재명"), "체르니 40");
    fireEvent.change(within(dialog).getByLabelText("가격"), { target: { value: "14000" } });

    return dialog;
  }

  it("저장하는 동안에는 저장 버튼을 막아 같은 출고가 두 번 등록되지 않게 한다", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const registerBookRelease = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    renderBookPurchaseListScreen(pendingBookQueryOptionsFactory, true, {
      registerBookRelease,
      students: [{ studentId: "student-1", name: "김민지" } as never],
    });

    const dialog = await fillReleaseForm(user);
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    const savingButton = await within(dialog).findByRole("button", { name: "저장 중" });
    expect(savingButton).toBeDisabled();
    fireEvent.submit(within(dialog).getByRole("form", { name: "교재 출고 입력" }));
    expect(registerBookRelease).toHaveBeenCalledTimes(1);

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

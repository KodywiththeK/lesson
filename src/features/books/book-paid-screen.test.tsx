import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBookPaidList, type BookSale } from "@/domain/book-sale";
import { queryKeys } from "@/lib/api/query-keys";

import { BookPaidScreen, type BookPaidQueryOptionsFactory } from "./book-paid-screen";
import { TEST_ACADEMY_ID, testPaidSales } from "./book-shipment-test-data";

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: toastMock }));

const supabaseMock = vi.hoisted(() => ({ client: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => supabaseMock.client }));

function paidFactory(sales: () => BookSale[]): BookPaidQueryOptionsFactory {
  return (options) => ({
    queryKey: queryKeys.books.paidList(options.academyId, {
      month: options.month,
      q: options.search,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: async () => buildBookPaidList(sales(), options),
  });
}

function renderScreen(props: Partial<ComponentProps<typeof BookPaidScreen>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const cancelBookPayment = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <BookPaidScreen
        academyId={TEST_ACADEMY_ID}
        canCancelPayment
        queryOptionsFactory={paidFactory(() => testPaidSales)}
        cancelBookPayment={cancelBookPayment}
        {...props}
      />
    </QueryClientProvider>,
  );

  return { cancelBookPayment, invalidateQueries };
}

async function findPaidRow(name: string | RegExp) {
  const table = await screen.findByRole("table", { name: "결제 완료 목록" });

  return within(table).getByRole("row", { name });
}

describe("BookPaidScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("제목과 기록 설명을 보여 주고 이번 달 결제 완료 내역을 입금일 최신순으로 보여 준다", async () => {
    renderScreen();

    expect(screen.getByRole("heading", { name: "결제 완료" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "최종 확인이 완료된 도서 출고 기록입니다. 수정·삭제는 불가능하며 기록으로 남습니다. 결제를 잘못 확인했다면 원장이 결제를 취소할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("조회 월")).toHaveValue("2026-10");

    const table = await screen.findByRole("table", { name: "결제 완료 목록" });
    const rows = within(table).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("이서윤");
    expect(rows[1]).toHaveTextContent("김민지");
  });

  it("이름·도서명·가격·수량·금액·출고일·입금일·상태·관리를 항목명과 함께 보여 준다", async () => {
    renderScreen();

    const row = await findPaidRow(/이서윤/);

    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "이름", "도서명", "가격", "수량", "금액", "출고일", "입금일", "상태", "관리",
    ]);
    expect(within(row).getByRole("cell", { name: "스즈키 바이올린 1" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "18,000원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2권" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "36,000원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2026-10-02" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "2026-10-14" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "결제 완료" })).toBeInTheDocument();
    expect(within(row).queryByText("원장 기록 없음")).not.toBeInTheDocument();
  });

  it("입출입내역 연결 행이 지워진 건은 원장 기록 없음 배지를 함께 보인다", async () => {
    renderScreen();

    const row = await findPaidRow(/김민지/);

    expect(within(row).getByText("원장 기록 없음")).toBeInTheDocument();
    expect(within(row).getByText("결제 완료")).toBeInTheDocument();
  });

  it("원장에게는 결제 취소 버튼을 보인다", async () => {
    renderScreen({ canCancelPayment: true });
    const row = await findPaidRow(/이서윤/);

    expect(within(row).getByRole("button", { name: "이서윤 스즈키 바이올린 1 결제 취소" })).toBeInTheDocument();
  });

  it("데스크는 읽기 전용이라 결제 취소 버튼이 없다", async () => {
    renderScreen({ canCancelPayment: false });
    await findPaidRow(/이서윤/);

    expect(screen.queryByRole("button", { name: /결제 취소/ })).not.toBeInTheDocument();
  });

  it("조회 월을 바꾸면 입금일이 그 달인 건만 보여 주고 이번 달 이후는 고를 수 없다", async () => {
    const user = userEvent.setup();
    renderScreen();
    await findPaidRow(/이서윤/);

    await user.click(screen.getByRole("button", { name: "조회 월 월 선택 열기" }));
    expect(screen.getByRole("button", { name: "11월" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "10월" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "9월" }));

    expect(await screen.findByText("결제 완료 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("조회 월")).toHaveValue("2026-09");
  });

  it("내역이 없어도 총 건수와 페이지 이동을 보여 준다", async () => {
    renderScreen({ queryOptionsFactory: paidFactory(() => []) });

    expect(await screen.findByText("결제 완료 내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0건")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 결제 완료 수" })).toHaveValue("10");
  });

  it("이름 또는 도서명으로 걸러 내고 결과가 없으면 조건 안내를 보여 준다", async () => {
    const user = userEvent.setup();
    renderScreen();
    await findPaidRow(/이서윤/);

    await user.type(screen.getByRole("searchbox", { name: "결제 완료 검색" }), "바이엘");

    expect(await screen.findByText("총 1건")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "김민지" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "이서윤" })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "결제 완료 검색" }));
    await user.type(screen.getByRole("searchbox", { name: "결제 완료 검색" }), "없는이름");

    expect(await screen.findByText("조건에 맞는 결제 완료 내역이 없습니다.")).toBeInTheDocument();
  });

  it("검색하면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    const manySales: BookSale[] = Array.from({ length: 25 }, (_, index) => ({
      ...testPaidSales[0],
      saleId: `sale-many-${String(index + 1).padStart(2, "0")}`,
      studentName: `원생${String(index + 1).padStart(2, "0")}`,
    }));
    renderScreen({ queryOptionsFactory: paidFactory(() => manySales) });

    expect(await screen.findByText("총 25건")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2페이지" }));
    expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "결제 완료 검색" }), "원생");

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  describe("결제 취소", () => {
    async function openCancelConfirmation(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        within(await findPaidRow(/이서윤/)).getByRole("button", { name: "이서윤 스즈키 바이올린 1 결제 취소" }),
      );

      return screen.findByRole("alertdialog", { name: "결제를 취소할까요?" });
    }

    it("취소 사유를 입력해야 확인할 수 있고 사유가 비면 이유를 알린다", async () => {
      const user = userEvent.setup();
      const { cancelBookPayment } = renderScreen();

      const confirmation = await openCancelConfirmation(user);
      const confirm = within(confirmation).getByRole("button", { name: "결제 취소" });

      expect(confirmation).toHaveTextContent("재고에는 영향이 없습니다");
      expect(confirm).toBeDisabled();
      expect(confirm).toHaveAccessibleDescription("취소 사유를 입력해 주세요.");

      await user.type(within(confirmation).getByLabelText("취소 사유"), "   ");
      expect(confirm).toBeDisabled();

      await user.type(within(confirmation).getByLabelText("취소 사유"), "입금자 착오");
      expect(confirm).toBeEnabled();
      expect(cancelBookPayment).not.toHaveBeenCalled();
    });

    it("사유와 함께 취소하면 알리고 교재·수입 조회를 새로 불러온다", async () => {
      const user = userEvent.setup();
      const { cancelBookPayment, invalidateQueries } = renderScreen();
      const confirmation = await openCancelConfirmation(user);

      await user.type(within(confirmation).getByLabelText("취소 사유"), "  입금자 착오  ");
      await user.click(within(confirmation).getByRole("button", { name: "결제 취소" }));

      await waitFor(() =>
        expect(cancelBookPayment).toHaveBeenCalledWith({ releaseId: "sale-10", reason: "입금자 착오" }),
      );
      await waitFor(() =>
        expect(toastMock.success).toHaveBeenCalledWith(
          "결제를 취소했습니다. 출고 탭에서 다시 수정하거나 결제 처리할 수 있습니다.",
        ),
      );
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all(TEST_ACADEMY_ID) });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.finance.all(TEST_ACADEMY_ID) });
    });

    it("실패하면 이유를 알리고 확인 창과 입력한 사유를 유지한다", async () => {
      const user = userEvent.setup();
      renderScreen({
        cancelBookPayment: vi.fn().mockRejectedValue(new Error("이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.")),
      });
      const confirmation = await openCancelConfirmation(user);

      await user.type(within(confirmation).getByLabelText("취소 사유"), "입금자 착오");
      await user.click(within(confirmation).getByRole("button", { name: "결제 취소" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("결제 취소에 실패했습니다.", {
          description: "이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.",
        }),
      );
      expect(screen.getByLabelText("취소 사유")).toHaveValue("입금자 착오");
    });

    it("처리하는 동안 확인 버튼을 막아 중복 취소를 막는다", async () => {
      const user = userEvent.setup();
      let finish: () => void = () => undefined;
      const cancelBookPayment = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      renderScreen({ cancelBookPayment });
      const confirmation = await openCancelConfirmation(user);

      await user.type(within(confirmation).getByLabelText("취소 사유"), "입금자 착오");
      await user.click(within(confirmation).getByRole("button", { name: "결제 취소" }));

      expect(within(confirmation).getByRole("button", { name: "처리 중" })).toBeDisabled();
      expect(cancelBookPayment).toHaveBeenCalledTimes(1);

      finish();
      await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    });
  });

  describe("Supabase 연결", () => {
    it("주입된 동작이 없으면 교재 RPC로 결제를 취소한다", async () => {
      const user = userEvent.setup();
      const paidRow = {
        id: "sale-10",
        academy_id: TEST_ACADEMY_ID,
        book_id: "book-2",
        student_id: "student-2",
        student_name: "이서윤",
        book_title: "스즈키 바이올린 1",
        price: 18000,
        quantity: 2,
        shipped_at: "2026-10-02",
        status: "paid",
        paid_at: "2026-10-14",
        paid_ledger_entry_id: "ledger-10",
      };
      supabaseMock.client.from.mockImplementation(() => ({ select: () => resolvedQuery([paidRow]) }));
      supabaseMock.client.rpc.mockResolvedValue({ data: { ...paidRow, status: "payment-pending", paid_at: null }, error: null });
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <BookPaidScreen academyId={TEST_ACADEMY_ID} canCancelPayment />
        </QueryClientProvider>,
      );

      await user.click(await screen.findByRole("button", { name: "이서윤 스즈키 바이올린 1 결제 취소" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "결제를 취소할까요?" });
      await user.type(within(confirmation).getByLabelText("취소 사유"), "입금자 착오");
      await user.click(within(confirmation).getByRole("button", { name: "결제 취소" }));

      await waitFor(() =>
        expect(supabaseMock.client.rpc).toHaveBeenCalledWith("cancel_book_release_payment", {
          p_academy_id: TEST_ACADEMY_ID,
          p_release_id: "sale-10",
          p_reason: "입금자 착오",
        }),
      );
    });
  });
});

/** `from().select().eq()...range()` 체인을 어떻게 이어 불러도 같은 행을 돌려주는 가짜 조회. */
function resolvedQuery(rows: unknown[]): unknown {
  const chain: unknown = new Proxy(
    {},
    {
      get: (_target, property) =>
        property === "then"
          ? (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null })
          : () => chain,
    },
  );

  return chain;
}

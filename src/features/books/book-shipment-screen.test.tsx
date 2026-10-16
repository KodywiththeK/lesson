import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildBookShipmentList, type BookSale } from "@/domain/book-sale";
import { queryKeys } from "@/lib/api/query-keys";

import { BookShipmentScreen, type BookShipmentQueryOptionsFactory } from "./book-shipment-screen";
import { TEST_ACADEMY_ID, testBooks, testPendingSales, testStudents } from "./book-shipment-test-data";

const { toastMock } = vi.hoisted(() => ({ toastMock: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: toastMock }));

const supabaseMock = vi.hoisted(() => ({ client: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => supabaseMock.client }));

function pendingFactory(sales: () => BookSale[]): BookShipmentQueryOptionsFactory {
  return (options) => ({
    queryKey: queryKeys.books.pendingList(options.academyId, {
      q: options.search,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: async () => buildBookShipmentList(sales(), options),
  });
}

function renderScreen(props: Partial<ComponentProps<typeof BookShipmentScreen>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const handlers = {
    registerBookRelease: vi.fn(),
    updateBookRelease: vi.fn(),
    deleteBookRelease: vi.fn(),
    completeBookPayment: vi.fn(),
  };

  render(
    <QueryClientProvider client={queryClient}>
      <BookShipmentScreen
        academyId={TEST_ACADEMY_ID}
        canRecordPayment
        queryOptionsFactory={pendingFactory(() => testPendingSales)}
        bookOptionsQueryOptionsFactory={() => ({
          queryKey: queryKeys.books.options(TEST_ACADEMY_ID),
          queryFn: async () => testBooks,
        })}
        students={testStudents}
        {...handlers}
        {...props}
      />
    </QueryClientProvider>,
  );

  return { ...handlers, invalidateQueries };
}

async function findShipmentRow(name: string | RegExp) {
  const table = await screen.findByRole("table", { name: "출고 목록" });

  return within(table).getByRole("row", { name });
}

describe("BookShipmentScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T03:00:00Z"));
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("출고 목록", () => {
    it("구매 폼과 출고목록 영역의 제목·설명을 보여 준다", async () => {
      renderScreen();

      expect(screen.getByRole("heading", { name: "도서 구매 목록" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "출고목록" })).toBeInTheDocument();
      expect(
        screen.getByText("등록된 출고 내역을 확인 및 수정·삭제하거나, 최종확인하여 결제 완료 단계로 넘길 수 있습니다."),
      ).toBeInTheDocument();
      expect(await screen.findByRole("table", { name: "출고 목록" })).toBeInTheDocument();
    });

    it("결제 대기 출고를 이름·도서명·가격·수량·금액·출고일 순으로 항목명과 함께 보여 준다", async () => {
      renderScreen();

      const row = await findShipmentRow(/김민지/);

      expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
        "이름", "도서명", "가격", "수량", "금액", "출고일", "관리",
      ]);
      expect(within(row).getByRole("cell", { name: "김민지" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "바이엘 상" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "12,000원" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "2권" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "24,000원" })).toBeInTheDocument();
      expect(within(row).getByRole("cell", { name: "2026-10-01" })).toBeInTheDocument();
    });

    it("원생 삭제로 연결이 끊긴 출고도 이름 스냅샷으로 보여 준다", async () => {
      renderScreen();

      expect(await findShipmentRow(/박지우/)).toBeInTheDocument();
    });

    it("원장은 수정·삭제·결제 완료 처리를 볼 수 있다", async () => {
      renderScreen({ canRecordPayment: true });
      const row = await findShipmentRow(/김민지/);

      expect(within(row).getByRole("button", { name: "김민지 바이엘 상 수정" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "김민지 바이엘 상 삭제" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "김민지 바이엘 상 결제 완료 처리" })).toBeInTheDocument();
    });

    it("데스크에게는 결제 완료 처리와 바로 결제 완료 선택지를 보이지 않는다", async () => {
      renderScreen({ canRecordPayment: false });
      const row = await findShipmentRow(/김민지/);

      expect(within(row).getByRole("button", { name: "김민지 바이엘 상 수정" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "김민지 바이엘 상 삭제" })).toBeInTheDocument();
      expect(within(row).queryByRole("button", { name: /결제 완료 처리/ })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("결제 상태")).not.toBeInTheDocument();
    });

    it("대기 건이 없으면 안내하고 페이지 이동은 계속 보여 준다", async () => {
      renderScreen({ queryOptionsFactory: pendingFactory(() => []) });

      expect(await screen.findByText("대기 중인 출고 내역이 없습니다.")).toBeInTheDocument();
      expect(screen.getByText("총 0건")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "페이지당 출고 수" })).toHaveValue("10");
    });

    it("이름 또는 도서명으로 검색하고 결과가 없으면 조건 안내를 보여 준다", async () => {
      const user = userEvent.setup();
      renderScreen();
      await findShipmentRow(/김민지/);

      await user.type(screen.getByRole("searchbox", { name: "출고 검색" }), "스즈키");

      expect(await screen.findByText("총 1건")).toBeInTheDocument();
      expect(screen.getByRole("cell", { name: "이서윤" })).toBeInTheDocument();
      expect(screen.queryByRole("cell", { name: "김민지" })).not.toBeInTheDocument();

      await user.clear(screen.getByRole("searchbox", { name: "출고 검색" }));
      await user.type(screen.getByRole("searchbox", { name: "출고 검색" }), "없는이름");

      expect(await screen.findByText("조건에 맞는 출고 내역이 없습니다.")).toBeInTheDocument();
    });

    it("검색하면 1페이지로 돌아간다", async () => {
      const user = userEvent.setup();
      const manySales: BookSale[] = Array.from({ length: 25 }, (_, index) => ({
        ...testPendingSales[0],
        saleId: `sale-many-${String(index + 1).padStart(2, "0")}`,
        studentId: null,
        studentName: `원생${String(index + 1).padStart(2, "0")}`,
      }));
      renderScreen({ queryOptionsFactory: pendingFactory(() => manySales) });

      expect(await screen.findByText("총 25건")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "2페이지" }));
      expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();

      await user.type(screen.getByRole("searchbox", { name: "출고 검색" }), "원생");

      expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
    });
  });

  describe("출고 등록", () => {
    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
      await screen.findByRole("option", { name: "바이엘 상 (남은 재고 9권)" });
      await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-1");
      await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
      await user.click(screen.getByRole("button", { name: "출고 등록" }));
    }

    it("등록하면 폼을 비우고 알린 뒤 교재·수입 조회를 새로 불러온다", async () => {
      const user = userEvent.setup();
      const { registerBookRelease, invalidateQueries } = renderScreen();

      await fillAndSubmit(user);

      await waitFor(() =>
        expect(registerBookRelease).toHaveBeenCalledWith({
          studentId: "student-1",
          bookId: "book-1",
          price: 12000,
          quantity: 1,
          shippedOn: "2026-10-15",
          status: "payment-pending",
        }),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("교재 출고를 등록했습니다."));
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all(TEST_ACADEMY_ID) });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.finance.all(TEST_ACADEMY_ID) });
      expect(screen.getByLabelText("이름(원생)")).toHaveValue("");
      expect(screen.getByLabelText("도서명")).toHaveValue("");
    });

    it("등록에 실패하면 이유를 알리고 입력한 내용을 그대로 둔다", async () => {
      const user = userEvent.setup();
      renderScreen({
        registerBookRelease: vi.fn().mockRejectedValue(new Error("재고가 부족합니다. 남은 재고는 0권입니다.")),
      });

      await fillAndSubmit(user);

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 출고 등록에 실패했습니다.", {
          description: "재고가 부족합니다. 남은 재고는 0권입니다.",
        }),
      );
      expect(screen.getByLabelText("이름(원생)")).toHaveValue("student-1");
    });

    it("처리하는 동안 등록 버튼을 막아 중복 등록을 막는다", async () => {
      const user = userEvent.setup();
      let finish: () => void = () => undefined;
      const registerBookRelease = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
      renderScreen({ registerBookRelease });

      await fillAndSubmit(user);

      expect(screen.getByRole("button", { name: "출고 등록" })).toBeDisabled();
      expect(registerBookRelease).toHaveBeenCalledTimes(1);

      finish();
      await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    });
  });

  describe("수정", () => {
    async function openEditDialog(user: ReturnType<typeof userEvent.setup>) {
      await user.click(within(await findShipmentRow(/김민지/)).getByRole("button", { name: "김민지 바이엘 상 수정" }));

      return screen.findByRole("dialog", { name: "출고 내역 수정" });
    }

    it("수정 다이얼로그에서 고친 값을 저장하면 알리고 닫는다", async () => {
      const user = userEvent.setup();
      const { updateBookRelease, invalidateQueries } = renderScreen();

      const dialog = await openEditDialog(user);
      await user.clear(within(dialog).getByLabelText("수량"));
      await user.type(within(dialog).getByLabelText("수량"), "3");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(updateBookRelease).toHaveBeenCalledWith({
          releaseId: "sale-1",
          studentId: "student-1",
          bookId: "book-1",
          price: 12000,
          quantity: 3,
          shippedOn: "2026-10-01",
        }),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("출고 내역을 수정했습니다."));
      expect(screen.queryByRole("dialog", { name: "출고 내역 수정" })).not.toBeInTheDocument();
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all(TEST_ACADEMY_ID) });
    });

    it("서버가 재고 부족으로 거부하면 그 문구를 그대로 알리고 다이얼로그를 유지한다", async () => {
      const user = userEvent.setup();
      renderScreen({
        updateBookRelease: vi
          .fn()
          .mockRejectedValue(new Error("교재 출고를 수정하지 못했습니다: 재고가 부족합니다. 남은 재고는 1권입니다.")),
      });

      const dialog = await openEditDialog(user);
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 출고 수정에 실패했습니다.", {
          description: "재고가 부족합니다. 남은 재고는 1권입니다.",
        }),
      );
      expect(screen.getByRole("dialog", { name: "출고 내역 수정" })).toBeInTheDocument();
    });
  });

  describe("삭제", () => {
    async function openDeleteConfirmation(user: ReturnType<typeof userEvent.setup>) {
      await user.click(within(await findShipmentRow(/김민지/)).getByRole("button", { name: "김민지 바이엘 상 삭제" }));

      return screen.findByRole("alertdialog", { name: "출고 내역을 삭제할까요?" });
    }

    it("삭제 확인 창에서 재고가 되돌아온다고 알리고 확인하면 삭제한다", async () => {
      const user = userEvent.setup();
      const { deleteBookRelease } = renderScreen();

      const confirmation = await openDeleteConfirmation(user);

      expect(confirmation).toHaveTextContent("김민지");
      expect(confirmation).toHaveTextContent("바이엘 상 2권");
      expect(confirmation).toHaveTextContent("재고가 2권 되돌아옵니다");

      await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

      await waitFor(() => expect(deleteBookRelease).toHaveBeenCalledWith({ releaseId: "sale-1" }));
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("출고 내역을 삭제했습니다."));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("삭제에 실패하면 이유를 알리고 확인 창을 유지한다", async () => {
      const user = userEvent.setup();
      renderScreen({
        deleteBookRelease: vi
          .fn()
          .mockRejectedValue(
            new Error("결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요."),
          ),
      });

      const confirmation = await openDeleteConfirmation(user);
      await user.click(within(confirmation).getByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("출고 내역 삭제에 실패했습니다.", {
          description: "결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.",
        }),
      );
      expect(screen.getByRole("alertdialog", { name: "출고 내역을 삭제할까요?" })).toBeInTheDocument();
    });
  });

  describe("결제 완료 처리", () => {
    async function openPayment(user: ReturnType<typeof userEvent.setup>) {
      await user.click(
        within(await findShipmentRow(/김민지/)).getByRole("button", { name: "김민지 바이엘 상 결제 완료 처리" }),
      );

      return screen.findByRole("dialog", { name: "결제 완료 처리" });
    }

    it("입금일은 오늘이 기본이고 어느 달 내역에 반영되는지 안내한다", async () => {
      const user = userEvent.setup();
      renderScreen();

      const dialog = await openPayment(user);

      expect(within(dialog).getByLabelText("입금일")).toHaveValue("2026-10-15");
      expect(
        within(dialog).getByText("입금일이 속한 10월의 입출입내역과 교재 내역에 반영됩니다."),
      ).toBeInTheDocument();
    });

    it("입금일이 출고일과 다른 달이면 그 사실을 강조해 안내한다", async () => {
      const user = userEvent.setup();
      renderScreen();
      const dialog = await openPayment(user);

      await user.clear(within(dialog).getByLabelText("입금일"));
      await user.type(within(dialog).getByLabelText("입금일"), "2026-11-03");

      expect(
        within(dialog).getByText(
          "입금일이 속한 11월의 입출입내역과 교재 내역에 반영됩니다. 출고일(10월)과 다른 달입니다.",
        ),
      ).toBeInTheDocument();
    });

    it("입금일이 출고일보다 이르면 막고 이유를 알린다", async () => {
      const user = userEvent.setup();
      const { completeBookPayment } = renderScreen();
      const dialog = await openPayment(user);

      await user.clear(within(dialog).getByLabelText("입금일"));
      await user.type(within(dialog).getByLabelText("입금일"), "2026-09-30");

      expect(within(dialog).getByText("입금일은 출고일(2026-10-01) 이후여야 합니다.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "결제 완료 처리" })).toBeDisabled();
      expect(completeBookPayment).not.toHaveBeenCalled();
    });

    it("입금일을 확인하면 결제 완료 처리하고 알린다", async () => {
      const user = userEvent.setup();
      const { completeBookPayment, invalidateQueries } = renderScreen();
      const dialog = await openPayment(user);

      await user.click(within(dialog).getByRole("button", { name: "결제 완료 처리" }));

      await waitFor(() =>
        expect(completeBookPayment).toHaveBeenCalledWith({ releaseId: "sale-1", paidAt: "2026-10-15" }),
      );
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("교재 결제 완료 처리를 했습니다."));
      expect(screen.queryByRole("dialog", { name: "결제 완료 처리" })).not.toBeInTheDocument();
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.finance.all(TEST_ACADEMY_ID) });
    });

    it("실패하면 이유를 알리고 다이얼로그를 유지한다", async () => {
      const user = userEvent.setup();
      renderScreen({ completeBookPayment: vi.fn().mockRejectedValue(new Error("이미 결제 완료된 출고입니다.")) });
      const dialog = await openPayment(user);

      await user.click(within(dialog).getByRole("button", { name: "결제 완료 처리" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 결제 완료 처리에 실패했습니다.", {
          description: "이미 결제 완료된 출고입니다.",
        }),
      );
      expect(screen.getByRole("dialog", { name: "결제 완료 처리" })).toBeInTheDocument();
    });
  });

  describe("Supabase 연결", () => {
    it("주입된 동작이 없으면 교재 RPC로 출고를 등록한다", async () => {
      const user = userEvent.setup();
      const bookRows = testBooks.map((book) => ({
        id: book.bookId,
        academy_id: book.academyId,
        title: book.title,
        price: book.price,
        quantity: book.quantity,
        stocked_on: book.stockedOn,
      }));
      supabaseMock.client.from.mockImplementation((table: string) => ({
        select: () => resolvedQuery(table === "books" ? bookRows : []),
      }));
      supabaseMock.client.rpc.mockResolvedValue({
        data: {
          id: "sale-new",
          academy_id: TEST_ACADEMY_ID,
          book_id: "book-1",
          student_id: "student-1",
          student_name: "김민지",
          book_title: "바이엘 상",
          price: 12000,
          quantity: 1,
          shipped_at: "2026-10-15",
          status: "payment-pending",
          paid_at: null,
        },
        error: null,
      });
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <BookShipmentScreen academyId={TEST_ACADEMY_ID} canRecordPayment={false} students={testStudents} />
        </QueryClientProvider>,
      );

      await screen.findByRole("option", { name: "바이엘 상 (남은 재고 9권)" });
      await user.selectOptions(screen.getByLabelText("이름(원생)"), "student-1");
      await user.selectOptions(screen.getByLabelText("도서명"), "book-1");
      await user.click(screen.getByRole("button", { name: "출고 등록" }));

      await waitFor(() =>
        expect(supabaseMock.client.rpc).toHaveBeenCalledWith("register_book_release", {
          p_academy_id: TEST_ACADEMY_ID,
          p_student_id: "student-1",
          p_book_id: "book-1",
          p_price: 12000,
          p_quantity: 1,
          p_shipped_on: "2026-10-15",
          p_status: "payment-pending",
          p_paid_on: null,
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

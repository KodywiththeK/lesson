import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildBookStockList, type BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";
import { queryKeys } from "@/lib/api/query-keys";
import { expectWholeWonInput } from "@/test/expect-whole-won-input";

import { BookStockScreen, type BookStockListQueryOptionsFactory } from "./book-stock-screen";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));

const bayer: BookStockRow = {
  academyId: "academy-1",
  bookId: "book-1",
  title: "바이엘 상",
  price: 12000,
  quantity: 9,
  stockedOn: "2026-08-01",
};
const suzuki: BookStockRow = {
  academyId: "academy-1",
  bookId: "book-2",
  title: "스즈키 바이올린 1",
  price: 18000,
  quantity: 4,
  stockedOn: "2026-08-03",
};
const czerny: BookStockRow = {
  academyId: "academy-1",
  bookId: "book-3",
  title: "체르니 100",
  price: 15000,
  quantity: 0,
  stockedOn: "2026-07-20",
};
const books = [suzuki, czerny, bayer];

const manyBooks: BookStockRow[] = Array.from({ length: 25 }, (_, index) => ({
  academyId: "academy-1",
  bookId: `book-${String(index + 1).padStart(2, "0")}`,
  title: `교재${String(index + 1).padStart(2, "0")}`,
  price: 10000,
  quantity: 1,
  stockedOn: "2026-09-01",
}));

function stockQueryOptionsFor(rows: () => BookStockRow[]): BookStockListQueryOptionsFactory {
  return (options) => ({
    queryKey: queryKeys.books.stockList(options.academyId, {
      q: options.search,
      sort: options.sortOrder,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: async () => buildBookStockList(rows(), options),
  });
}

function bookOptionsFor(rows: () => BookStockRow[]) {
  return () => ({
    queryKey: queryKeys.books.options("academy-1"),
    queryFn: async () => rows(),
  });
}

function renderScreen(props: Partial<ComponentProps<typeof BookStockScreen>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <BookStockScreen
        academyId="academy-1"
        queryOptionsFactory={stockQueryOptionsFor(() => books)}
        bookOptionsQueryOptions={bookOptionsFor(() => books)}
        countPendingReleases={async () => 0}
        {...props}
      />
    </QueryClientProvider>,
  );

  return { invalidateQueries };
}

function dataRows(table: HTMLElement) {
  return within(table).getAllByRole("row").slice(1);
}

async function openRegisterDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "교재 등록" }));

  return screen.findByRole("dialog", { name: "교재 등록" });
}

async function fillRegisterForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  values: { title: string; price: string; quantity: string },
) {
  await user.type(within(dialog).getByRole("textbox", { name: "도서명" }), values.title);
  await user.type(within(dialog).getByRole("spinbutton", { name: "가격(원)" }), values.price);
  await user.type(within(dialog).getByRole("spinbutton", { name: "권수" }), values.quantity);
}

describe("BookStockScreen", () => {
  beforeEach(() => {
    Object.values(toastMock).forEach((mock) => mock.mockReset());
  });

  describe("화면 구성과 목록", () => {
    it("와이어프레임의 두 영역(교재 등록 관리, 교재 재고 상태)과 교재 등록 버튼을 보여 준다", async () => {
      renderScreen();

      expect(screen.getByRole("heading", { name: "교재 등록 관리" })).toBeInTheDocument();
      expect(screen.getByText("새로운 교재를 입고 및 등록합니다.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "교재 등록" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "교재 재고 상태" })).toBeInTheDocument();
      expect(await screen.findByRole("table", { name: "교재 재고 목록" })).toBeInTheDocument();
    });

    it("도서명 가나다 오름차순으로 도서명·가격·권수·입고일·관리를 보여 주고 0권은 재고 없음 배지를 붙인다", async () => {
      renderScreen();

      const table = await screen.findByRole("table", { name: "교재 재고 목록" });
      const rows = dataRows(table);
      expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
        "바이엘 상",
        "스즈키 바이올린 1",
        "체르니 100",
      ]);
      expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
        "도서명",
        "가격",
        "권수",
        "입고일",
        "관리",
      ]);
      expect(within(rows[0]).getByRole("cell", { name: "12,000원" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "9" })).toBeInTheDocument();
      expect(within(rows[0]).getByRole("cell", { name: "2026-08-01" })).toBeInTheDocument();
      expect(within(rows[0]).queryByText("재고 없음")).not.toBeInTheDocument();
      expect(within(rows[2]).getByRole("cell", { name: "0 재고 없음" })).toBeInTheDocument();
    });

    it("좁은 화면에서도 같은 행에서 수정과 삭제를 할 수 있다", async () => {
      renderScreen();

      const row = await screen.findByRole("row", { name: /바이엘 상/ });
      expect(within(row).getByRole("button", { name: "바이엘 상 수정" })).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "바이엘 상 삭제" })).toBeInTheDocument();
    });

    it("정렬 토글로 도서명 내림차순으로 바꾸면 1페이지부터 다시 보여 준다", async () => {
      const user = userEvent.setup();
      const seenOptions: Array<Parameters<BookStockListQueryOptionsFactory>[0]> = [];
      renderScreen({
        queryOptionsFactory: (options) => {
          seenOptions.push(options);
          return stockQueryOptionsFor(() => manyBooks)(options);
        },
      });
      await screen.findByRole("table", { name: "교재 재고 목록" });
      expect(screen.getByRole("radio", { name: "오름차순" })).toBeChecked();
      await user.click(screen.getByRole("button", { name: "3페이지" }));

      await user.click(screen.getByRole("radio", { name: "내림차순" }));

      await waitFor(() => expect(seenOptions.at(-1)).toMatchObject({ sortOrder: "desc", page: 1 }));
      const table = screen.getByRole("table", { name: "교재 재고 목록" });
      await waitFor(() =>
        expect(within(dataRows(table)[0]).getAllByRole("cell")[0]).toHaveTextContent("교재25"),
      );
      expect(screen.getByRole("radio", { name: "내림차순" })).toBeChecked();
    });

    it("선택된 정렬 방향을 다시 눌러도 정렬 방향이 비지 않는다", async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole("table", { name: "교재 재고 목록" });

      await user.click(screen.getByRole("radio", { name: "오름차순" }));

      expect(screen.getByRole("radio", { name: "오름차순" })).toBeChecked();
    });

    it("도서명 검색을 조회 조건으로 반영하고 1페이지로 돌아간다", async () => {
      const user = userEvent.setup();
      const seenOptions: Array<Parameters<BookStockListQueryOptionsFactory>[0]> = [];
      renderScreen({
        queryOptionsFactory: (options) => {
          seenOptions.push(options);
          return stockQueryOptionsFor(() => books)(options);
        },
      });
      await screen.findByRole("table", { name: "교재 재고 목록" });

      await user.type(screen.getByRole("searchbox", { name: "도서명 검색" }), "바이엘");

      await waitFor(() => expect(screen.queryByRole("cell", { name: "스즈키 바이올린 1" })).not.toBeInTheDocument());
      expect(screen.getByRole("cell", { name: "바이엘 상" })).toBeInTheDocument();
      expect(seenOptions.at(-1)).toMatchObject({ academyId: "academy-1", search: "바이엘", page: 1 });
    });

    it("검색 결과가 없으면 조건 안내를, 교재가 하나도 없으면 재고 도서 없음 안내를 보여 준다", async () => {
      const user = userEvent.setup();
      renderScreen();
      await screen.findByRole("table", { name: "교재 재고 목록" });

      await user.type(screen.getByRole("searchbox", { name: "도서명 검색" }), "없는 교재");

      expect(await screen.findByText("조건에 맞는 교재가 없습니다.")).toBeInTheDocument();
      expect(screen.getByText("총 0건")).toBeInTheDocument();
    });

    it("교재가 하나도 없으면 재고 도서가 없다고 안내하고 페이지 컨트롤은 그대로 보인다", async () => {
      renderScreen({ queryOptionsFactory: stockQueryOptionsFor(() => []) });

      expect(await screen.findByText("재고 도서가 없습니다.")).toBeInTheDocument();
      expect(screen.getByText("총 0건")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "페이지당 교재 수" })).toHaveValue("10");
    });

    it("교재가 많아도 10건씩 보여 주고 총 건수와 페이지 이동을 제공한다", async () => {
      const user = userEvent.setup();
      renderScreen({ queryOptionsFactory: stockQueryOptionsFor(() => manyBooks) });

      const table = await screen.findByRole("table", { name: "교재 재고 목록" });
      expect(dataRows(table)).toHaveLength(10);
      expect(screen.getByText("총 25건")).toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "페이지당 교재 수" })).toHaveValue("10");

      await user.click(screen.getByRole("button", { name: "3페이지" }));

      await waitFor(() => expect(dataRows(table)).toHaveLength(5));
    });

    it("조회에 실패하면 원인을 사용자 문구로 안내한다", async () => {
      renderScreen({
        queryOptionsFactory: (options) => ({
          queryKey: queryKeys.books.stockList(options.academyId),
          queryFn: async () => {
            throw new Error("permission denied");
          },
        }),
      });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("교재 재고를 불러오지 못했습니다.");
      expect(alert).toHaveTextContent("이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.");
      expect(alert).not.toHaveTextContent("permission denied");
    });
  });

  describe("교재 등록", () => {
    it("필수 칸은 비어 있고 입고일은 오늘이며, 저장할 수 없는 이유를 가까이에 알려 준다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerBook: vi.fn() });

      const dialog = await openRegisterDialog(user);

      expect(within(dialog).getByRole("textbox", { name: "도서명" })).toHaveValue("");
      expect(within(dialog).getByRole("spinbutton", { name: "가격(원)" })).toHaveValue(null);
      expect(within(dialog).getByRole("spinbutton", { name: "권수" })).toHaveValue(null);
      expect(within(dialog).getByRole("textbox", { name: "입고일" })).toHaveValue(getFinanceToday());
      const registerButton = within(dialog).getByRole("button", { name: "등록" });
      expect(registerButton).toBeDisabled();
      expect(registerButton).toHaveAccessibleDescription("도서명을 입력해 주세요.");

      await user.type(within(dialog).getByRole("textbox", { name: "도서명" }), "체르니 30");
      expect(registerButton).toHaveAccessibleDescription(
        "가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.",
      );

      await user.type(within(dialog).getByRole("spinbutton", { name: "가격(원)" }), "14000");
      expect(registerButton).toHaveAccessibleDescription(
        "권수는 0권 이상 9,999권 이하의 정수로 입력해 주세요.",
      );

      await user.type(within(dialog).getByRole("spinbutton", { name: "권수" }), "5");
      expect(registerButton).toBeEnabled();
    });

    it("가격은 1원 단위 양의 정수만 제약 검증으로 허용한다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerBook: vi.fn() });

      const dialog = await openRegisterDialog(user);

      expectWholeWonInput(within(dialog).getByRole("spinbutton", { name: "가격(원)" }));
    });

    it("가격 140000원도 등록 버튼으로 저장할 수 있다", async () => {
      const user = userEvent.setup();
      const registerBook = vi.fn().mockResolvedValue(undefined);
      renderScreen({ registerBook });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "체르니 40", price: "140000", quantity: "3" });
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(registerBook).toHaveBeenCalledWith({
          title: "체르니 40",
          price: 140000,
          quantity: 3,
          stockedOn: getFinanceToday(),
        }),
      );
    });

    it("새 교재를 다듬어 저장하고 성공하면 닫고 목록을 다시 불러오도록 알린다", async () => {
      const user = userEvent.setup();
      const registerBook = vi.fn().mockResolvedValue(undefined);
      const { invalidateQueries } = renderScreen({ registerBook });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: " 체르니 30 ", price: "14000", quantity: "0" });
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(registerBook).toHaveBeenCalledWith({
          title: "체르니 30",
          price: 14000,
          quantity: 0,
          stockedOn: getFinanceToday(),
        }),
      );
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "교재 등록" })).not.toBeInTheDocument());
      expect(toastMock.success).toHaveBeenCalledWith("교재를 등록했습니다.");
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all("academy-1") });
    });

    it("같은 도서명이면 합산·가격 변경을 미리 안내하고, 저장하면 합산했다고 알린다", async () => {
      const user = userEvent.setup();
      const registerBook = vi.fn().mockResolvedValue(undefined);
      renderScreen({ registerBook });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "바이엘 상", price: "13000", quantity: "5" });

      expect(
        await within(dialog).findByText(
          "이미 등록된 교재입니다. 권수가 합산되고(현재 9권 → 14권) 가격이 12,000원에서 13,000원으로 바뀝니다.",
        ),
      ).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("기존 교재에 권수를 합산했습니다."));
    });

    it("서버가 합산한 결과를 돌려주면 미리보기가 없었어도 합산했다고 알린다", async () => {
      const user = userEvent.setup();
      renderScreen({
        bookOptionsQueryOptions: bookOptionsFor(() => []),
        registerBook: vi.fn().mockResolvedValue({ ...bayer, quantity: 14 }),
      });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "바이엘 상", price: "12000", quantity: "5" });
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("기존 교재에 권수를 합산했습니다."));
    });

    it("합산하면 9,999권을 넘는 재입고는 안내와 함께 등록할 수 없다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerBook: vi.fn() });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "바이엘 상", price: "12000", quantity: "9991" });

      expect(await within(dialog).findByText(/이미 등록된 교재입니다\. 권수가 합산됩니다/)).toBeInTheDocument();
      const registerButton = within(dialog).getByRole("button", { name: "등록" });
      expect(registerButton).toBeDisabled();
      expect(registerButton).toHaveAccessibleDescription(
        "재고는 9,999권을 넘을 수 없습니다. 입력한 권수를 줄여 주세요.",
      );
    });

    it("등록에 실패하면 입력을 남겨 둔 채 사용자 문구로 알린다", async () => {
      const user = userEvent.setup();
      renderScreen({ registerBook: vi.fn().mockRejectedValue(new Error("permission denied")) });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "체르니 30", price: "14000", quantity: "5" });
      await user.click(within(dialog).getByRole("button", { name: "등록" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 등록에 실패했습니다.", {
          description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
        }),
      );
      expect(screen.getByRole("dialog", { name: "교재 등록" })).toBeInTheDocument();
      expect(within(dialog).getByRole("textbox", { name: "도서명" })).toHaveValue("체르니 30");
    });

    it("처리 중에는 등록 버튼을 막아 같은 교재가 두 번 등록되지 않게 한다", async () => {
      const user = userEvent.setup();
      let finishRegistration: () => void = () => undefined;
      const registerBook = vi.fn(
        () => new Promise<void>((resolve) => { finishRegistration = resolve; }),
      );
      renderScreen({ registerBook });

      const dialog = await openRegisterDialog(user);
      await fillRegisterForm(user, dialog, { title: "체르니 30", price: "14000", quantity: "5" });
      const registerButton = within(dialog).getByRole("button", { name: "등록" });
      await user.click(registerButton);
      await user.click(registerButton);

      await waitFor(() => expect(registerButton).toBeDisabled());
      expect(registerBook).toHaveBeenCalledTimes(1);
      finishRegistration();
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "교재 등록" })).not.toBeInTheDocument());
    });
  });

  describe("교재 수정", () => {
    it("저장된 값을 채우고 가격 변경이 이미 출고된 건에 반영되지 않는다고 안내한다", async () => {
      const user = userEvent.setup();
      renderScreen({ updateBook: vi.fn() });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 수정" }));
      const dialog = await screen.findByRole("dialog", { name: "교재 수정" });

      expect(within(dialog).getByRole("textbox", { name: "도서명" })).toHaveValue("바이엘 상");
      expect(within(dialog).getByRole("spinbutton", { name: "가격(원)" })).toHaveValue(12000);
      expect(within(dialog).getByRole("spinbutton", { name: "권수" })).toHaveValue(9);
      expect(within(dialog).getByRole("textbox", { name: "입고일" })).toHaveValue("2026-08-01");
      expect(within(dialog).getByText("이미 출고된 건에는 반영되지 않습니다.")).toBeInTheDocument();
    });

    it("바꾼 내용을 모두 저장하고 현재 재고를 직접 고칠 수 있다", async () => {
      const user = userEvent.setup();
      const updateBook = vi.fn().mockResolvedValue(undefined);
      const { invalidateQueries } = renderScreen({ updateBook });

      await user.click(await screen.findByRole("button", { name: "체르니 100 수정" }));
      const dialog = await screen.findByRole("dialog", { name: "교재 수정" });
      expect(within(dialog).getByRole("spinbutton", { name: "권수" })).toHaveValue(0);
      await user.clear(within(dialog).getByRole("textbox", { name: "도서명" }));
      await user.type(within(dialog).getByRole("textbox", { name: "도서명" }), "체르니 100 개정판");
      await user.clear(within(dialog).getByRole("spinbutton", { name: "가격(원)" }));
      await user.type(within(dialog).getByRole("spinbutton", { name: "가격(원)" }), "16000");
      await user.clear(within(dialog).getByRole("spinbutton", { name: "권수" }));
      await user.type(within(dialog).getByRole("spinbutton", { name: "권수" }), "7");
      await user.click(within(dialog).getByRole("button", { name: "수정" }));

      await waitFor(() =>
        expect(updateBook).toHaveBeenCalledWith({
          bookId: "book-3",
          title: "체르니 100 개정판",
          price: 16000,
          quantity: 7,
          stockedOn: "2026-07-20",
        }),
      );
      expect(toastMock.success).toHaveBeenCalledWith("교재를 수정했습니다.");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "교재 수정" })).not.toBeInTheDocument());
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all("academy-1") });
    });

    it("다른 교재와 같은 도서명으로 바꾸면 저장하지 못하게 막고 권수를 수정하라고 안내한다", async () => {
      const user = userEvent.setup();
      const updateBook = vi.fn();
      renderScreen({ updateBook });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 수정" }));
      const dialog = await screen.findByRole("dialog", { name: "교재 수정" });
      const titleInput = within(dialog).getByRole("textbox", { name: "도서명" });
      await user.clear(titleInput);
      await user.type(titleInput, "스즈키  바이올린 1");

      const saveButton = within(dialog).getByRole("button", { name: "수정" });
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveAccessibleDescription(
        "이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.",
      );
      expect(updateBook).not.toHaveBeenCalled();
    });

    it("서버가 도서명 중복을 돌려주면 그 문구를 그대로 안내한다", async () => {
      const user = userEvent.setup();
      renderScreen({
        updateBook: vi
          .fn()
          .mockRejectedValue(new Error("교재를 수정하지 못했습니다: 이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.")),
      });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 수정" }));
      const dialog = await screen.findByRole("dialog", { name: "교재 수정" });
      await user.click(within(dialog).getByRole("button", { name: "수정" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 수정에 실패했습니다.", {
          description: "이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.",
        }),
      );
      expect(screen.getByRole("dialog", { name: "교재 수정" })).toBeInTheDocument();
    });
  });

  describe("교재 삭제", () => {
    it("확인을 거쳐야 삭제하며 취소하면 아무것도 지우지 않는다", async () => {
      const user = userEvent.setup();
      const deleteBook = vi.fn().mockResolvedValue(undefined);
      const { invalidateQueries } = renderScreen({ deleteBook });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      let confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
      expect(confirmation).toHaveTextContent("바이엘 상");
      await user.click(within(confirmation).getByRole("button", { name: "취소" }));
      expect(deleteBook).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "바이엘 상 삭제" }));
      confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
      await user.click(await within(confirmation).findByRole("button", { name: "삭제" }));

      await waitFor(() => expect(deleteBook).toHaveBeenCalledWith({ bookId: "book-1" }));
      expect(toastMock.success).toHaveBeenCalledWith("교재를 삭제했습니다.");
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog", { name: "교재를 삭제할까요?" })).not.toBeInTheDocument(),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.books.all("academy-1") });
    });

    it("대기 중인 출고가 있으면 확인 창에 건수와 계속 결제 처리할 수 있다는 안내를 함께 보인다", async () => {
      const user = userEvent.setup();
      const countPendingReleases = vi.fn().mockResolvedValue(2);
      renderScreen({ countPendingReleases, deleteBook: vi.fn() });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });

      expect(
        await within(confirmation).findByText(
          "대기 중인 출고 2건이 있습니다. 삭제해도 대기 건은 계속 결제 처리할 수 있습니다.",
        ),
      ).toBeInTheDocument();
      expect(countPendingReleases).toHaveBeenCalledWith(expect.objectContaining({ bookId: "book-1" }));
    });

    it("대기 중인 출고가 없으면 대기 안내를 보이지 않는다", async () => {
      const user = userEvent.setup();
      renderScreen({ countPendingReleases: async () => 0, deleteBook: vi.fn() });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });

      expect(await within(confirmation).findByRole("button", { name: "삭제" })).toBeEnabled();
      expect(within(confirmation).queryByText(/대기 중인 출고/)).not.toBeInTheDocument();
    });

    it("대기 출고 조회에 실패해도 안내만 생략하고 삭제는 진행할 수 있다", async () => {
      const user = userEvent.setup();
      const deleteBook = vi.fn().mockResolvedValue(undefined);
      renderScreen({
        countPendingReleases: vi.fn().mockRejectedValue(new Error("failed to fetch")),
        deleteBook,
      });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
      await user.click(await within(confirmation).findByRole("button", { name: "삭제" }));

      expect(within(confirmation).queryByText(/대기 중인 출고/)).not.toBeInTheDocument();
      await waitFor(() => expect(deleteBook).toHaveBeenCalledWith({ bookId: "book-1" }));
    });

    it("대기 출고를 확인하는 동안에는 삭제 버튼을 막고 확인 중임을 알린다", async () => {
      const user = userEvent.setup();
      renderScreen({
        countPendingReleases: () => new Promise<number>(() => undefined),
        deleteBook: vi.fn(),
      });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });

      expect(within(confirmation).getByText("대기 중인 출고를 확인하고 있습니다.")).toBeInTheDocument();
      expect(within(confirmation).getByRole("button", { name: "삭제" })).toBeDisabled();
    });

    it("삭제에 실패하면 확인 창을 유지한 채 사용자 문구로 알린다", async () => {
      const user = userEvent.setup();
      renderScreen({ deleteBook: vi.fn().mockRejectedValue(new Error("permission denied")) });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
      await user.click(await within(confirmation).findByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(toastMock.error).toHaveBeenCalledWith("교재 삭제에 실패했습니다.", {
          description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
        }),
      );
      expect(screen.getByRole("alertdialog", { name: "교재를 삭제할까요?" })).toBeInTheDocument();
    });

    it("처리 중에는 삭제 버튼을 막아 중복 삭제를 막는다", async () => {
      const user = userEvent.setup();
      let finishDeletion: () => void = () => undefined;
      const deleteBook = vi.fn(
        () => new Promise<void>((resolve) => { finishDeletion = resolve; }),
      );
      renderScreen({ deleteBook });

      await user.click(await screen.findByRole("button", { name: "바이엘 상 삭제" }));
      const confirmation = await screen.findByRole("alertdialog", { name: "교재를 삭제할까요?" });
      const confirmButton = await within(confirmation).findByRole("button", { name: "삭제" });
      await user.click(confirmButton);
      await user.click(confirmButton);

      await waitFor(() => expect(confirmButton).toBeDisabled());
      expect(deleteBook).toHaveBeenCalledTimes(1);
      finishDeletion();
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog", { name: "교재를 삭제할까요?" })).not.toBeInTheDocument(),
      );
    });
  });
});

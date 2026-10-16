import { describe, expect, it } from "vitest";

import {
  cancelBookReleasePayment,
  completeBookReleasePayment,
  createBookOptionsQueryOptions,
  createBookStockListQueryOptions,
  deleteBook,
  deleteBookRelease,
  fetchBookStockList,
  fetchBookStockRows,
  fetchPaidBookReleases,
  fetchPendingBookReleaseCount,
  fetchPendingBookReleases,
  registerBookRelease,
  registerBookStock,
  updateBook,
  updateBookRelease,
  type BookMutationSupabaseClient,
  type BookReadSupabaseClient,
  type BookReleaseSupabaseRow,
  type BookSupabaseRow,
} from "./books";
import { createFakeSupabase, createNumberedRows } from "./test-support/fake-supabase";

function bookRow(overrides: Partial<BookSupabaseRow> = {}): BookSupabaseRow {
  return {
    id: "book-1",
    academy_id: "academy-1",
    title: "바이엘 상",
    price: 12000,
    quantity: 10,
    stocked_on: "2026-10-01",
    ...overrides,
  };
}

function releaseRow(overrides: Partial<BookReleaseSupabaseRow> = {}): BookReleaseSupabaseRow {
  return {
    id: "sale-1",
    academy_id: "academy-1",
    book_id: "book-1",
    student_id: "student-1",
    student_name: "김민지",
    book_title: "바이엘 상",
    price: 12000,
    quantity: 2,
    shipped_at: "2026-10-10",
    status: "payment-pending",
    paid_at: null,
    paid_ledger_entry_id: null,
    ...overrides,
  };
}

function createReadClient(rows: Record<string, Array<Record<string, unknown>>>, errors: Record<string, Error> = {}) {
  const fake = createFakeSupabase(rows, { errors });

  return { client: fake.client as unknown as BookReadSupabaseClient, queriesFor: fake.queriesFor };
}

describe("교재 재고 조회", () => {
  it("보관하지 않은 교재만 학원 범위로 읽고 도서명·id 순으로 고정해 페이지를 이어 읽는다", async () => {
    const { client, queriesFor } = createReadClient({ books: [bookRow()] });

    await fetchBookStockRows(client, "academy-1");

    expect(queriesFor("books")).toEqual([
      expect.objectContaining({
        select: "id, academy_id, title, price, quantity, stocked_on",
        eq: [["academy_id", "academy-1"], ["active", true]],
        order: [["title", undefined], ["id", undefined]],
        range: [[0, 999]],
      }),
    ]);
  });

  it("1000건을 넘어도 끝까지 읽는다", async () => {
    const { client, queriesFor } = createReadClient({
      books: createNumberedRows(1200, (index) => bookRow({ id: `book-${index}`, title: `교재${index}` })),
    });

    const rows = await fetchBookStockRows(client, "academy-1");

    expect(rows).toHaveLength(1200);
    expect(queriesFor("books").map((query) => query.range[0])).toEqual([[0, 999], [1000, 1999]]);
  });

  it("재고 목록은 0권 교재도 남기고 도서명 정렬 방향과 검색을 적용한다", async () => {
    const { client } = createReadClient({
      books: [bookRow({ id: "book-1", title: "바이엘 상" }), bookRow({ id: "book-2", title: "체르니 100", quantity: 0 })],
    });

    const view = await fetchBookStockList(client, { academyId: "academy-1", sortOrder: "desc" });

    expect(view.items.map((row) => [row.title, row.isOutOfStock])).toEqual([
      ["체르니 100", true],
      ["바이엘 상", false],
    ]);
  });

  it("조회 오류는 사용자에게 보여 줄 수 있는 문구로 바꾼다", async () => {
    const { client } = createReadClient({}, { books: new Error("permission denied") });

    await expect(fetchBookStockRows(client, "academy-1")).rejects.toThrow(
      "교재 재고를 불러오지 못했습니다: permission denied",
    );
  });

  it("목록·선택지 쿼리 key에 학원과 조건을 담는다", async () => {
    const { client } = createReadClient({ books: [bookRow()] });
    const list = createBookStockListQueryOptions(client, {
      academyId: "academy-1",
      search: "바이엘",
      sortOrder: "desc",
      page: 2,
      pageSize: 20,
    });

    expect(list.queryKey).toEqual(["academy", "academy-1", "books", "stock", "바이엘", "desc", "2", "20"]);
    expect(createBookOptionsQueryOptions(client, "academy-1").queryKey).toEqual([
      "academy",
      "academy-1",
      "books",
      "options",
    ]);
    await expect(list.queryFn()).resolves.toMatchObject({ totalItems: 1 });
  });
});

describe("출고·결제 완료 조회", () => {
  it("출고 탭은 결제 대기 건만 서버에서 거르고 수량·금액을 계산한다", async () => {
    const { client, queriesFor } = createReadClient({
      book_releases: [releaseRow({ price: 15000, quantity: 3 })],
    });

    const view = await fetchPendingBookReleases(client, { academyId: "academy-1" });

    expect(queriesFor("book_releases")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"], ["status", "payment-pending"]],
      order: [["shipped_at", { ascending: false }], ["id", undefined]],
      range: [[0, 999]],
    });
    expect(view.items[0]).toMatchObject({ saleId: "sale-1", quantity: 3, amount: 45000 });
  });

  it("결제 완료 탭은 결제 완료 건만 입금일 월 범위로 서버에서 거르고 원장 기록 없음을 표시한다", async () => {
    const { client, queriesFor } = createReadClient({
      book_releases: [
        releaseRow({ id: "sale-1", status: "paid", paid_at: "2026-10-12", paid_ledger_entry_id: "ledger-1" }),
        releaseRow({ id: "sale-2", status: "paid", paid_at: "2026-10-13", paid_ledger_entry_id: null }),
      ],
    });

    const view = await fetchPaidBookReleases(client, { academyId: "academy-1", month: "2026-10" });

    expect(queriesFor("book_releases")[0]).toMatchObject({
      eq: [["academy_id", "academy-1"], ["status", "paid"]],
      gte: [["paid_at", "2026-10-01"]],
      lte: [["paid_at", "2026-10-31"]],
      order: [["paid_at", { ascending: false }], ["id", undefined]],
    });
    expect(view.items.map((row) => [row.saleId, row.ledgerMissing])).toEqual([
      ["sale-2", true],
      ["sale-1", false],
    ]);
  });

  it("교재 삭제 안내용 대기 출고 건수는 그 교재의 결제 대기 건만 서버에서 거르고 id만 읽어 센다", async () => {
    const { client, queriesFor } = createReadClient({
      book_releases: [releaseRow({ id: "sale-1" }), releaseRow({ id: "sale-2" })],
    });

    await expect(fetchPendingBookReleaseCount(client, { academyId: "academy-1", bookId: "book-1" })).resolves.toBe(2);
    expect(queriesFor("book_releases")[0]).toMatchObject({
      select: "id",
      eq: [["academy_id", "academy-1"], ["book_id", "book-1"], ["status", "payment-pending"]],
      order: [["id", undefined]],
      range: [[0, 999]],
    });
  });

  it("원생 연결이 끊긴 출고도 이름 스냅샷으로 읽는다", async () => {
    const { client } = createReadClient({ book_releases: [releaseRow({ student_id: null, student_name: "삭제된원생" })] });

    const view = await fetchPendingBookReleases(client, { academyId: "academy-1" });

    expect(view.items[0]).toMatchObject({ studentId: null, studentName: "삭제된원생" });
  });
});

function createMutationClient(data: unknown, error: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });

      return { data: error ? null : data, error };
    },
  } as unknown as BookMutationSupabaseClient;

  return { client, calls };
}

describe("교재·출고 변경 RPC", () => {
  it("교재 등록은 이름 있는 인자로 RPC를 부르고 교재 한 줄을 돌려준다", async () => {
    const { client, calls } = createMutationClient(bookRow({ quantity: 15 }));

    const result = await registerBookStock(client, {
      academyId: "academy-1",
      title: "바이엘 상",
      price: 12000,
      quantity: 5,
      stockedOn: "2026-10-17",
    });

    expect(calls).toEqual([
      {
        name: "register_book_stock",
        args: {
          p_academy_id: "academy-1",
          p_title: "바이엘 상",
          p_price: 12000,
          p_quantity: 5,
          p_stocked_on: "2026-10-17",
        },
      },
    ]);
    expect(result).toMatchObject({ bookId: "book-1", quantity: 15, stockedOn: "2026-10-01" });
  });

  it("교재 수정·삭제 RPC 인자를 맞춘다", async () => {
    const update = createMutationClient(bookRow());
    await updateBook(update.client, {
      academyId: "academy-1",
      bookId: "book-1",
      title: "바이엘 하",
      price: 13000,
      quantity: 7,
      stockedOn: "2026-10-02",
    });
    expect(update.calls[0]).toEqual({
      name: "update_book",
      args: {
        p_academy_id: "academy-1",
        p_book_id: "book-1",
        p_title: "바이엘 하",
        p_price: 13000,
        p_quantity: 7,
        p_stocked_on: "2026-10-02",
      },
    });

    const remove = createMutationClient(null);
    await deleteBook(remove.client, { academyId: "academy-1", bookId: "book-1" });
    expect(remove.calls[0]).toEqual({ name: "delete_book", args: { p_academy_id: "academy-1", p_book_id: "book-1" } });
  });

  it("출고 등록은 교재 id·수량·출고일과 선택적 결제 완료·입금일을 보낸다", async () => {
    const { client, calls } = createMutationClient(releaseRow());

    const sale = await registerBookRelease(client, {
      academyId: "academy-1",
      studentId: "student-1",
      bookId: "book-1",
      price: 12000,
      quantity: 2,
      shippedOn: "2026-10-10",
    });

    expect(calls[0]).toEqual({
      name: "register_book_release",
      args: {
        p_academy_id: "academy-1",
        p_student_id: "student-1",
        p_book_id: "book-1",
        p_price: 12000,
        p_quantity: 2,
        p_shipped_on: "2026-10-10",
        p_status: "payment-pending",
        p_paid_on: null,
      },
    });
    expect(sale).toMatchObject({ saleId: "sale-1", status: "payment-pending", quantity: 2 });
  });

  it("원장의 바로 결제 완료 등록은 입금일을 함께 보낸다", async () => {
    const { client, calls } = createMutationClient(
      releaseRow({ status: "paid", paid_at: "2026-10-12", paid_ledger_entry_id: "ledger-1" }),
    );

    const sale = await registerBookRelease(client, {
      academyId: "academy-1",
      studentId: "student-1",
      bookId: "book-1",
      price: 12000,
      quantity: 1,
      shippedOn: "2026-10-10",
      status: "paid",
      paidOn: "2026-10-12",
    });

    expect(calls[0].args).toMatchObject({ p_status: "paid", p_paid_on: "2026-10-12" });
    expect(sale).toMatchObject({ status: "paid", paidAt: "2026-10-12", paidLedgerEntryId: "ledger-1" });
  });

  it("출고 수정·삭제·결제 처리·결제 취소 RPC 인자를 맞춘다", async () => {
    const update = createMutationClient(releaseRow({ quantity: 5 }));
    await updateBookRelease(update.client, {
      academyId: "academy-1",
      releaseId: "sale-1",
      studentId: "student-2",
      bookId: "book-2",
      price: 14000,
      quantity: 5,
      shippedOn: "2026-10-11",
    });
    expect(update.calls[0]).toEqual({
      name: "update_book_release",
      args: {
        p_academy_id: "academy-1",
        p_release_id: "sale-1",
        p_student_id: "student-2",
        p_book_id: "book-2",
        p_price: 14000,
        p_quantity: 5,
        p_shipped_on: "2026-10-11",
      },
    });

    const remove = createMutationClient(null);
    await deleteBookRelease(remove.client, { academyId: "academy-1", releaseId: "sale-1" });
    expect(remove.calls[0]).toEqual({
      name: "delete_book_release",
      args: { p_academy_id: "academy-1", p_release_id: "sale-1" },
    });

    const pay = createMutationClient(releaseRow({ status: "paid", paid_at: "2026-10-12" }));
    const paid = await completeBookReleasePayment(pay.client, {
      academyId: "academy-1",
      releaseId: "sale-1",
      paidAt: "2026-10-12",
    });
    expect(pay.calls[0]).toEqual({
      name: "complete_book_release_payment",
      args: { p_academy_id: "academy-1", p_release_id: "sale-1", p_paid_at: "2026-10-12" },
    });
    expect(paid).toMatchObject({ status: "paid", paidAt: "2026-10-12" });

    const cancel = createMutationClient(releaseRow());
    const cancelled = await cancelBookReleasePayment(cancel.client, {
      academyId: "academy-1",
      releaseId: "sale-1",
      reason: "입금 확인 착오",
    });
    expect(cancel.calls[0]).toEqual({
      name: "cancel_book_release_payment",
      args: { p_academy_id: "academy-1", p_release_id: "sale-1", p_reason: "입금 확인 착오" },
    });
    expect(cancelled.status).toBe("payment-pending");
  });

  it("서버 거부 문구를 앞부분 안내와 함께 그대로 전달한다", async () => {
    const { client } = createMutationClient(null, new Error("재고가 부족합니다. 남은 재고는 2권입니다."));

    await expect(
      registerBookRelease(client, {
        academyId: "academy-1",
        studentId: "student-1",
        bookId: "book-1",
        price: 12000,
        quantity: 3,
        shippedOn: "2026-10-10",
      }),
    ).rejects.toThrow("교재 출고를 등록하지 못했습니다: 재고가 부족합니다. 남은 재고는 2권입니다.");
  });

  it("반환 데이터가 없으면 알려 준다", async () => {
    const { client } = createMutationClient(null);

    await expect(
      registerBookStock(client, { academyId: "academy-1", title: "바이엘", price: 1, quantity: 1, stockedOn: "2026-10-17" }),
    ).rejects.toThrow("교재를 등록했지만 반환된 데이터가 없습니다.");
  });
});

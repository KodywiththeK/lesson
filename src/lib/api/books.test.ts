import { describe, expect, it, vi } from "vitest";

import {
  createBookPurchaseListQueryKey,
  createBookPurchaseListQueryOptions,
  fetchBookPurchaseList,
  completeBookReleasePayment,
  registerBookRelease,
  type BookPurchaseListSupabaseClient,
  type BookReleaseSupabaseRow,
} from "./books";
import { createFakeSupabase } from "./test-support/fake-supabase";

function createReleaseRows(count: number): BookReleaseSupabaseRow[] {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");

    return {
      id: `sale-${number}`,
      academy_id: "academy-1",
      book_id: `book-${number}`,
      student_id: `student-${number}`,
      student_name: `원생${number}`,
      book_title: `교재${number}`,
      price: 12000,
      shipped_at: "2026-08-21",
      status: "payment-pending",
      paid_at: null,
    };
  });
}

function createSupabaseStub(
  rows: BookReleaseSupabaseRow[],
  error: Error | null = null,
) {
  const fake = createFakeSupabase(
    { book_releases: rows },
    error ? { errors: { book_releases: error } } : {},
  );

  return {
    client: fake.client as unknown as BookPurchaseListSupabaseClient,
    calls: fake.queries,
  };
}

describe("fetchBookPurchaseList", () => {
  it("Supabase 교재 출고 row를 구매 목록으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "sale-1",
        academy_id: "academy-1",
        book_id: "book-1",
        student_id: "student-1",
        student_name: "김민지",
        book_title: "바이엘 2",
        price: 12000,
        shipped_at: "2026-08-21",
        status: "payment-pending",
        paid_at: null,
      },
    ]);

    const result = await fetchBookPurchaseList(client, {
      academyId: "academy-1",
      search: "바이엘",
    });

    expect(calls).toEqual([
      expect.objectContaining({
        table: "book_releases",
        select:
          "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at, paid_ledger_entry_id",
        eq: [["academy_id", "academy-1"]],
        order: [
          ["shipped_at", { ascending: false }],
          ["id", undefined],
        ],
        range: [[0, 999]],
      }),
    ]);
    expect(result.items).toEqual([
      {
        saleId: "sale-1",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        autoFilledPrice: 12000,
        shippedAt: "2026-08-21",
        status: "payment-pending",
      },
    ]);
    expect(result.totalItems).toBe(1);
  });

  it("조회한 교재 구매를 페이지로 나눠 총 건수와 함께 돌려준다", async () => {
    const { client } = createSupabaseStub(createReleaseRows(25));

    const result = await fetchBookPurchaseList(client, {
      academyId: "academy-1",
      page: 3,
      pageSize: 10,
    });

    expect(result.items.map((row) => row.studentName)).toEqual([
      "원생21",
      "원생22",
      "원생23",
      "원생24",
      "원생25",
    ]);
    expect(result).toMatchObject({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3 });
  });

  it("1000건을 넘는 교재 출고도 range를 이어 끝까지 읽어 조용히 잘리지 않는다", async () => {
    const { client, calls } = createSupabaseStub(createReleaseRows(1200));

    const result = await fetchBookPurchaseList(client, { academyId: "academy-1" });

    expect(result.totalItems).toBe(1200);
    expect(calls.map((call) => call.range[0])).toEqual([[0, 999], [1000, 1999]]);
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchBookPurchaseList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("교재 구매 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("registerBookRelease", () => {
  it("교재와 출고, 결제 수입을 단일 RPC에서 등록한다", async () => {
    const row: BookReleaseSupabaseRow = {
      id: "release-1", academy_id: "academy-1", book_id: "book-1",
      student_id: "student-1", student_name: "김민지", book_title: "바이엘 2",
      price: 12000, shipped_at: "2026-08-21", status: "paid", paid_at: "2026-08-21",
    };
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const client = { rpc };

    await expect(registerBookRelease(client, {
      academyId: "academy-1", studentId: "student-1", studentName: "김민지",
      bookTitle: "바이엘 2", price: 12000, shippedAt: "2026-08-21", status: "paid",
    })).resolves.toMatchObject({ saleId: "release-1", status: "paid" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("register_book_release", {
      p_academy_id: "academy-1", p_student_id: "student-1", p_student_name: "김민지",
      p_book_title: "바이엘 2", p_price: 12000, p_shipped_at: "2026-08-21",
      p_status: "paid",
    });
  });
});

describe("completeBookReleasePayment", () => {
  it("결제 대기 교재를 결제 완료로 바꾸는 일을 입금일과 함께 RPC 하나에 맡긴다", async () => {
    const row: BookReleaseSupabaseRow = {
      id: "release-1", academy_id: "academy-1", book_id: "book-1",
      student_id: "student-1", student_name: "김민지", book_title: "바이엘 2",
      price: 12000, shipped_at: "2026-08-21", status: "paid", paid_at: "2026-08-25",
    };
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });

    await expect(completeBookReleasePayment({ rpc }, {
      academyId: "academy-1", releaseId: "release-1", paidAt: "2026-08-25",
    })).resolves.toMatchObject({ saleId: "release-1", status: "paid" });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("complete_book_release_payment", {
      p_academy_id: "academy-1", p_release_id: "release-1", p_paid_at: "2026-08-25",
    });
  });

  it("RPC 오류는 안내 문구로 감싸 전달한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("이미 결제 완료된 교재입니다.") });

    await expect(completeBookReleasePayment({ rpc }, {
      academyId: "academy-1", releaseId: "release-1", paidAt: "2026-08-25",
    })).rejects.toThrow("교재 결제 완료 처리에 실패했습니다: 이미 결제 완료된 교재입니다.");
  });
});

describe("createBookPurchaseListQueryOptions", () => {
  it("학원 범위와 검색/상태 필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createBookPurchaseListQueryOptions(client, {
      academyId: "academy-1",
      search: "바이엘",
      filters: {
        status: "payment-pending",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "books",
      "purchase-list",
      "바이엘",
      "payment-pending",
      "",
      "",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({ items: [], totalItems: 0 });
  });

  it("페이지와 페이지당 개수가 바뀌면 다른 queryKey를 만든다", () => {
    const { client } = createSupabaseStub([]);

    const secondPage = createBookPurchaseListQueryOptions(client, {
      academyId: "academy-1",
      page: 2,
      pageSize: 20,
    });
    const firstPage = createBookPurchaseListQueryOptions(client, {
      academyId: "academy-1",
      page: 1,
      pageSize: 20,
    });

    expect(secondPage.queryKey.slice(-2)).toEqual(["2", "20"]);
    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(
      createBookPurchaseListQueryKey({ academyId: "academy-1", page: 2, pageSize: 20 }),
    ).toEqual(secondPage.queryKey);
  });
});

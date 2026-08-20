import { describe, expect, it } from "vitest";

import {
  createBookPurchaseListQueryOptions,
  fetchBookPurchaseList,
  type BookPurchaseListSupabaseClient,
  type BookReleaseSupabaseRow,
} from "./books";

function createSupabaseStub(
  rows: BookReleaseSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: BookPurchaseListSupabaseClient = {
    from(table) {
      calls.push({ table });

      return {
        select(select) {
          calls[calls.length - 1].select = select;

          return {
            async eq(column, value) {
              calls[calls.length - 1].eq = [column, value];

              return {
                data: error ? null : rows,
                error,
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
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
      {
        table: "book_releases",
        select:
          "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result).toEqual([
      {
        saleId: "sale-1",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        autoFilledPrice: 12000,
        shippedAt: "2026-08-21",
        status: "payment-pending",
      },
    ]);
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
    ]);
    await expect(options.queryFn()).resolves.toEqual([]);
  });
});

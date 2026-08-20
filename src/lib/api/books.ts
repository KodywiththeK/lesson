import {
  buildBookPurchaseList,
  type BookPurchaseListRow,
  type BookSale,
  type BuildBookPurchaseListOptions,
} from "@/domain/book-sale";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type BookReleaseSupabaseRow = {
  id: string;
  academy_id: string;
  book_id: string;
  student_id: string;
  student_name: string;
  book_title: string;
  price: number;
  shipped_at: string;
  status: "payment-pending" | "paid";
  paid_at: string | null;
};

type BookPurchaseListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<BookReleaseSupabaseRow[]>>;
};

type BookPurchaseListFromBuilder = {
  select(select: string): BookPurchaseListSelectBuilder;
};

export type BookPurchaseListSupabaseClient = {
  from(table: "book_releases"): BookPurchaseListFromBuilder;
};

export type FetchBookPurchaseListOptions = BuildBookPurchaseListOptions;

const BOOK_PURCHASE_LIST_SELECT =
  "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at";

export async function fetchBookPurchaseList(
  supabase: BookPurchaseListSupabaseClient,
  options: FetchBookPurchaseListOptions,
): Promise<BookPurchaseListRow[]> {
  const { data, error } = await supabase
    .from("book_releases")
    .select(BOOK_PURCHASE_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`교재 구매 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildBookPurchaseList((data ?? []).map(toBookSale), options);
}

export function createBookPurchaseListQueryOptions(
  supabase: BookPurchaseListSupabaseClient,
  options: FetchBookPurchaseListOptions,
) {
  return {
    queryKey: queryKeys.books.purchaseList(options.academyId, {
      q: options.search,
      status: options.filters?.status,
    }),
    queryFn: () => fetchBookPurchaseList(supabase, options),
  };
}

function toBookSale(row: BookReleaseSupabaseRow): BookSale {
  const pendingSale = {
    academyId: row.academy_id,
    saleId: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    studentId: row.student_id,
    studentName: row.student_name,
    price: row.price,
    shippedAt: row.shipped_at,
  };

  if (row.status === "paid") {
    return {
      ...pendingSale,
      status: "paid",
      paidAt: row.paid_at ?? "",
      permanent: true,
    };
  }

  return {
    ...pendingSale,
    status: "payment-pending",
  };
}

import type { ListView } from "@/domain/common-list";
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

export type RegisterBookReleaseInput = {
  academyId: string;
  studentId: string;
  studentName: string;
  bookTitle: string;
  price: number;
  shippedAt: string;
  status: "payment-pending" | "paid";
};

export type BookReleaseMutationSupabaseClient = {
  rpc(
    name: "register_book_release",
    args: {
      p_academy_id: string;
      p_student_id: string;
      p_student_name: string;
      p_book_title: string;
      p_price: number;
      p_shipped_at: string;
      p_status: "payment-pending" | "paid";
    },
  ): PromiseLike<SupabaseQueryResult<BookReleaseSupabaseRow>>;
};

const BOOK_PURCHASE_LIST_SELECT =
  "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at";

export async function fetchBookPurchaseList(
  supabase: BookPurchaseListSupabaseClient,
  options: FetchBookPurchaseListOptions,
): Promise<ListView<BookPurchaseListRow>> {
  const { data, error } = await supabase
    .from("book_releases")
    .select(BOOK_PURCHASE_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`교재 구매 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildBookPurchaseList((data ?? []).map(toBookSale), options);
}

export function createBookPurchaseListQueryKey(
  options: FetchBookPurchaseListOptions,
) {
  return queryKeys.books.purchaseList(options.academyId, {
    q: options.search,
    status: options.filters?.status,
    page: options.page?.toString(),
    pageSize: options.pageSize?.toString(),
  });
}

export function createBookPurchaseListQueryOptions(
  supabase: BookPurchaseListSupabaseClient,
  options: FetchBookPurchaseListOptions,
) {
  return {
    queryKey: createBookPurchaseListQueryKey(options),
    queryFn: () => fetchBookPurchaseList(supabase, options),
  };
}

export async function registerBookRelease(
  supabase: BookReleaseMutationSupabaseClient,
  input: RegisterBookReleaseInput,
): Promise<BookPurchaseListRow> {
  const { data, error } = await supabase.rpc("register_book_release", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_student_name: input.studentName,
    p_book_title: input.bookTitle,
    p_price: input.price,
    p_shipped_at: input.shippedAt,
    p_status: input.status,
  });

  if (error) {
    throw new Error(`교재 출고를 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 출고를 등록했지만 반환된 데이터가 없습니다.");
  }

  return buildBookPurchaseList([toBookSale(data)], {
    academyId: input.academyId,
  }).items[0];
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

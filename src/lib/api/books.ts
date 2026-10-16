import type { ListView } from "@/domain/common-list";
import {
  buildBookPurchaseList,
  type BookPurchaseListRow,
  type BookSale,
  type BuildBookPurchaseListOptions,
} from "@/domain/book-sale";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
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
  paid_ledger_entry_id?: string | null;
};

type BookPurchaseListFromBuilder = {
  select(select: string): PagedSelectQuery<BookReleaseSupabaseRow>;
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

export type CompleteBookReleasePaymentInput = {
  academyId: string;
  releaseId: string;
  paidAt: string;
};

export type BookReleaseMutationSupabaseClient = {
  rpc(
    name: "complete_book_release_payment",
    args: {
      p_academy_id: string;
      p_release_id: string;
      p_paid_at: string;
    },
  ): PromiseLike<SupabaseQueryResult<BookReleaseSupabaseRow>>;
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
  "id, academy_id, book_id, student_id, student_name, book_title, price, shipped_at, status, paid_at, paid_ledger_entry_id";

export async function fetchBookPurchaseList(
  supabase: BookPurchaseListSupabaseClient,
  options: FetchBookPurchaseListOptions,
): Promise<ListView<BookPurchaseListRow>> {
  const rows = await fetchAllRows("교재 구매 목록을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("book_releases")
      .select(BOOK_PURCHASE_LIST_SELECT)
      .eq("academy_id", options.academyId)
      .order("shipped_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return buildBookPurchaseList(rows.map(toBookSale), options);
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

/** 결제 대기 교재를 결제 완료로 바꾼다. 상태 변경과 수입 원장 등록은 DB 함수 안에서 한 트랜잭션으로 처리한다. */
export async function completeBookReleasePayment(
  supabase: BookReleaseMutationSupabaseClient,
  input: CompleteBookReleasePaymentInput,
): Promise<BookPurchaseListRow> {
  const { data, error } = await supabase.rpc("complete_book_release_payment", {
    p_academy_id: input.academyId,
    p_release_id: input.releaseId,
    p_paid_at: input.paidAt,
  });

  if (error) {
    throw new Error(`교재 결제 완료 처리에 실패했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 결제 완료 처리 후 반환된 데이터가 없습니다.");
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
      paidLedgerEntryId: row.paid_ledger_entry_id,
      permanent: true,
    };
  }

  return {
    ...pendingSale,
    status: "payment-pending",
  };
}

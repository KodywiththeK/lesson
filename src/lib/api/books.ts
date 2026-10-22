import type { ListView } from "@/domain/common-list";
import {
  buildBookPaidList,
  buildBookShipmentList,
  type BookPaidRow,
  type BookSale,
  type BookShipmentRow,
  type BuildBookPaidListOptions,
  type BuildBookShipmentListOptions,
} from "@/domain/book-sale";
import {
  buildBookStockList,
  type BookStockListRow,
  type BookStockRow,
  type BuildBookStockListOptions,
} from "@/domain/book-stock";
import { toMonthDateRange } from "@/domain/finance-date";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type BookSupabaseRow = {
  id: string;
  academy_id: string;
  title: string;
  price: number;
  quantity: number;
  stocked_on: string;
  purchase_vendor_name: string | null;
};

export type BookReleaseSupabaseRow = {
  id: string;
  academy_id: string;
  book_id: string;
  /** 원생이 삭제되면 비어 있다. 이름은 student_name 스냅샷으로 계속 보인다. */
  student_id: string | null;
  student_name: string;
  book_title: string;
  /** 출고 시점의 단가. */
  price: number;
  quantity: number;
  shipped_at: string;
  status: "payment-pending" | "paid";
  paid_at: string | null;
  paid_ledger_entry_id?: string | null;
};

export type BookReadSupabaseClient = {
  from(table: "books"): { select(select: string): PagedSelectQuery<BookSupabaseRow> };
  from(table: "book_releases"): { select(select: string): PagedSelectQuery<BookReleaseSupabaseRow> };
};

const BOOK_SELECT = "id, academy_id, title, price, quantity, stocked_on, purchase_vendor_name";
export const BOOK_RELEASE_SELECT =
  "id, academy_id, book_id, student_id, student_name, book_title, price, quantity, shipped_at, status, paid_at, paid_ledger_entry_id";

/** 보관(삭제)하지 않은 교재 전체. 재고 목록·출고 폼 선택지가 같이 쓴다. */
export async function fetchBookStockRows(
  supabase: BookReadSupabaseClient,
  academyId: string,
): Promise<BookStockRow[]> {
  const rows = await fetchAllRows("교재 재고를 불러오지 못했습니다", (from, to) =>
    supabase
      .from("books")
      .select(BOOK_SELECT)
      .eq("academy_id", academyId)
      .eq("active", true)
      .order("title")
      .order("id")
      .range(from, to),
  );

  return rows.map(toBookStockRow);
}

export async function fetchBookStockList(
  supabase: BookReadSupabaseClient,
  options: BuildBookStockListOptions,
): Promise<ListView<BookStockListRow>> {
  return buildBookStockList(await fetchBookStockRows(supabase, options.academyId), options);
}

export function createBookStockListQueryOptions(
  supabase: BookReadSupabaseClient,
  options: BuildBookStockListOptions,
) {
  return {
    queryKey: queryKeys.books.stockList(options.academyId, {
      q: options.search,
      sort: options.sortOrder,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: () => fetchBookStockList(supabase, options),
  };
}

export function createBookOptionsQueryOptions(supabase: BookReadSupabaseClient, academyId: string) {
  return {
    queryKey: queryKeys.books.options(academyId),
    queryFn: () => fetchBookStockRows(supabase, academyId),
  };
}

/** 출고 탭: 결제 대기 건만 서버에서 거른다. */
export async function fetchPendingBookReleases(
  supabase: BookReadSupabaseClient,
  options: BuildBookShipmentListOptions,
): Promise<ListView<BookShipmentRow>> {
  const rows = await fetchAllRows("출고 목록을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("book_releases")
      .select(BOOK_RELEASE_SELECT)
      .eq("academy_id", options.academyId)
      .eq("status", "payment-pending")
      .order("shipped_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return buildBookShipmentList(rows.map(toBookSale), options);
}

/** 이 교재로 아직 결제 대기 중인 출고 건수(교재 삭제 확인 안내용). id만 읽어 센다. */
export async function fetchPendingBookReleaseCount(
  supabase: BookReadSupabaseClient,
  input: { academyId: string; bookId: string },
): Promise<number> {
  const rows = await fetchAllRows("대기 중인 출고 건수를 확인하지 못했습니다", (from, to) =>
    supabase
      .from("book_releases")
      .select("id")
      .eq("academy_id", input.academyId)
      .eq("book_id", input.bookId)
      .eq("status", "payment-pending")
      .order("id")
      .range(from, to),
  );

  return rows.length;
}

export function createPendingBookReleasesQueryOptions(
  supabase: BookReadSupabaseClient,
  options: BuildBookShipmentListOptions,
) {
  return {
    queryKey: queryKeys.books.pendingList(options.academyId, {
      q: options.search,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: () => fetchPendingBookReleases(supabase, options),
  };
}

/** 결제 완료 탭: 결제 완료 건 중 입금일이 고른 월에 속한 것만 서버에서 거른다. */
export async function fetchPaidBookReleases(
  supabase: BookReadSupabaseClient,
  options: BuildBookPaidListOptions,
): Promise<ListView<BookPaidRow>> {
  const range = toMonthDateRange(options.month);
  const rows = await fetchAllRows("결제 완료 목록을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("book_releases")
      .select(BOOK_RELEASE_SELECT)
      .eq("academy_id", options.academyId)
      .eq("status", "paid")
      .gte("paid_at", range.from)
      .lte("paid_at", range.to)
      .order("paid_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return buildBookPaidList(rows.map(toBookSale), options);
}

export function createPaidBookReleasesQueryOptions(
  supabase: BookReadSupabaseClient,
  options: BuildBookPaidListOptions,
) {
  return {
    queryKey: queryKeys.books.paidList(options.academyId, {
      month: options.month,
      q: options.search,
      page: options.page?.toString(),
      pageSize: options.pageSize?.toString(),
    }),
    queryFn: () => fetchPaidBookReleases(supabase, options),
  };
}

type BookRpcArgs = {
  register_book_stock: {
    p_academy_id: string;
    p_title: string;
    p_price: number;
    p_quantity: number;
    p_stocked_on: string;
    p_purchase_vendor_name: string | null;
  };
  update_book: {
    p_academy_id: string;
    p_book_id: string;
    p_title: string;
    p_price: number;
    p_quantity: number;
    p_stocked_on: string;
    p_purchase_vendor_name: string | null;
  };
  delete_book: { p_academy_id: string; p_book_id: string };
  register_book_release: {
    p_academy_id: string;
    p_student_id: string;
    p_book_id: string;
    p_price: number;
    p_quantity: number;
    p_shipped_on: string;
    p_status: "payment-pending" | "paid";
    p_paid_on: string | null;
  };
  update_book_release: {
    p_academy_id: string;
    p_release_id: string;
    p_student_id: string | null;
    p_book_id: string;
    p_price: number;
    p_quantity: number;
    p_shipped_on: string;
  };
  delete_book_release: { p_academy_id: string; p_release_id: string };
  cancel_book_release_payment: { p_academy_id: string; p_release_id: string; p_reason: string };
};

type BookRpcResult = {
  register_book_stock: BookSupabaseRow;
  update_book: BookSupabaseRow;
  delete_book: null;
  register_book_release: BookReleaseSupabaseRow;
  update_book_release: BookReleaseSupabaseRow;
  delete_book_release: null;
  cancel_book_release_payment: BookReleaseSupabaseRow;
};

export type BookMutationSupabaseClient = {
  rpc<TName extends keyof BookRpcArgs>(
    name: TName,
    args: BookRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<BookRpcResult[TName]>>;
};

export type BookStockInput = {
  academyId: string;
  title: string;
  price: number;
  quantity: number;
  stockedOn: string;
  purchaseVendorName?: string;
};

/** 교재 등록 또는 재입고. 같은 도서명이면 서버가 기존 교재에 권수를 합산한다. */
export async function registerBookStock(
  supabase: BookMutationSupabaseClient,
  input: BookStockInput,
): Promise<BookStockRow> {
  const { data, error } = await supabase.rpc("register_book_stock", {
    p_academy_id: input.academyId,
    p_title: input.title,
    p_price: input.price,
    p_quantity: input.quantity,
    p_stocked_on: input.stockedOn,
    p_purchase_vendor_name: input.purchaseVendorName ?? null,
  });

  if (error) {
    throw new Error(`교재를 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재를 등록했지만 반환된 데이터가 없습니다.");
  }

  return toBookStockRow(data);
}

export async function updateBook(
  supabase: BookMutationSupabaseClient,
  input: BookStockInput & { bookId: string },
): Promise<BookStockRow> {
  const { data, error } = await supabase.rpc("update_book", {
    p_academy_id: input.academyId,
    p_book_id: input.bookId,
    p_title: input.title,
    p_price: input.price,
    p_quantity: input.quantity,
    p_stocked_on: input.stockedOn,
    p_purchase_vendor_name: input.purchaseVendorName ?? null,
  });

  if (error) {
    throw new Error(`교재를 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재를 수정했지만 반환된 데이터가 없습니다.");
  }

  return toBookStockRow(data);
}

/** 삭제는 보관 처리다. 재고 목록에서만 사라지고 판매 기록은 그대로 남는다. */
export async function deleteBook(
  supabase: BookMutationSupabaseClient,
  input: { academyId: string; bookId: string },
): Promise<void> {
  const { error } = await supabase.rpc("delete_book", {
    p_academy_id: input.academyId,
    p_book_id: input.bookId,
  });

  if (error) {
    throw new Error(`교재를 삭제하지 못했습니다: ${error.message}`);
  }
}

export type RegisterBookReleaseInput = {
  academyId: string;
  studentId: string;
  bookId: string;
  /** 출고 단가. 교재 가격에서 자동 입력된 값을 고쳐 보낼 수 있다. */
  price: number;
  quantity: number;
  shippedOn: string;
  /** 원장만 `paid`를 보낼 수 있다. */
  status?: "payment-pending" | "paid";
  /** `paid`일 때 입금일. 비우면 서버가 출고일을 쓴다. */
  paidOn?: string;
};

export async function registerBookRelease(
  supabase: BookMutationSupabaseClient,
  input: RegisterBookReleaseInput,
): Promise<BookSale> {
  const { data, error } = await supabase.rpc("register_book_release", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_book_id: input.bookId,
    p_price: input.price,
    p_quantity: input.quantity,
    p_shipped_on: input.shippedOn,
    p_status: input.status ?? "payment-pending",
    p_paid_on: input.paidOn ?? null,
  });

  if (error) {
    throw new Error(`교재 출고를 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 출고를 등록했지만 반환된 데이터가 없습니다.");
  }

  return toBookSale(data);
}

export type UpdateBookReleaseInput = {
  academyId: string;
  releaseId: string;
  studentId: string | null;
  bookId: string;
  price: number;
  quantity: number;
  shippedOn: string;
};

/** 결제 대기 출고만 수정한다. 재고는 서버가 한 번에 복원·재차감한다. */
export async function updateBookRelease(
  supabase: BookMutationSupabaseClient,
  input: UpdateBookReleaseInput,
): Promise<BookSale> {
  const { data, error } = await supabase.rpc("update_book_release", {
    p_academy_id: input.academyId,
    p_release_id: input.releaseId,
    p_student_id: input.studentId,
    p_book_id: input.bookId,
    p_price: input.price,
    p_quantity: input.quantity,
    p_shipped_on: input.shippedOn,
  });

  if (error) {
    throw new Error(`교재 출고를 수정하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 출고를 수정했지만 반환된 데이터가 없습니다.");
  }

  return toBookSale(data);
}

export async function deleteBookRelease(
  supabase: BookMutationSupabaseClient,
  input: { academyId: string; releaseId: string },
): Promise<void> {
  const { error } = await supabase.rpc("delete_book_release", {
    p_academy_id: input.academyId,
    p_release_id: input.releaseId,
  });

  if (error) {
    throw new Error(`교재 출고를 삭제하지 못했습니다: ${error.message}`);
  }
}

/** 결제 완료를 취소해 결제 대기로 되돌린다(원장). 연결된 입출입내역 수입 행도 서버가 함께 지운다. */
export async function cancelBookReleasePayment(
  supabase: BookMutationSupabaseClient,
  input: { academyId: string; releaseId: string; reason: string },
): Promise<BookSale> {
  const { data, error } = await supabase.rpc("cancel_book_release_payment", {
    p_academy_id: input.academyId,
    p_release_id: input.releaseId,
    p_reason: input.reason,
  });

  if (error) {
    throw new Error(`교재 결제를 취소하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 결제를 취소했지만 반환된 데이터가 없습니다.");
  }

  return toBookSale(data);
}

function toBookStockRow(row: BookSupabaseRow): BookStockRow {
  return {
    academyId: row.academy_id,
    bookId: row.id,
    title: row.title,
    price: row.price,
    quantity: row.quantity,
    stockedOn: row.stocked_on,
    purchaseVendorName: row.purchase_vendor_name ?? undefined,
  };
}

export function toBookSale(row: BookReleaseSupabaseRow): BookSale {
  const pendingSale = {
    academyId: row.academy_id,
    saleId: row.id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    studentId: row.student_id,
    studentName: row.student_name,
    price: row.price,
    quantity: row.quantity,
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

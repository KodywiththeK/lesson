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
  from(table: "books"): {
    insert(values: Record<string, unknown>): {
      select(select: "id"): {
        single(): PromiseLike<SupabaseQueryResult<{ id: string }>>;
      };
    };
  };
  from(table: "book_releases"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<BookReleaseSupabaseRow>>;
      };
    };
  };
  from(table: "ledger_entries"): {
    insert(values: Record<string, unknown>): PromiseLike<SupabaseQueryResult<null>>;
  };
};

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

export async function registerBookRelease(
  supabase: BookReleaseMutationSupabaseClient,
  input: RegisterBookReleaseInput,
): Promise<BookPurchaseListRow> {
  const { data: book, error: bookError } = await supabase
    .from("books")
    .insert({
      academy_id: input.academyId,
      title: input.bookTitle,
      price: input.price,
    })
    .select("id")
    .single();

  if (bookError) {
    throw new Error(`교재를 등록하지 못했습니다: ${bookError.message}`);
  }

  if (!book) {
    throw new Error("교재를 등록했지만 반환된 데이터가 없습니다.");
  }

  const { data, error } = await supabase
    .from("book_releases")
    .insert({
      academy_id: input.academyId,
      book_id: book.id,
      student_id: input.studentId,
      student_name: input.studentName,
      book_title: input.bookTitle,
      price: input.price,
      shipped_at: input.shippedAt,
      status: input.status,
      paid_at: input.status === "paid" ? input.shippedAt : null,
    })
    .select(BOOK_PURCHASE_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`교재 출고를 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("교재 출고를 등록했지만 반환된 데이터가 없습니다.");
  }

  if (input.status === "paid") {
    const { error: ledgerError } = await supabase.from("ledger_entries").insert({
      academy_id: input.academyId,
      occurred_on: input.shippedAt,
      entry_type: "income",
      source: "book-sale",
      amount: input.price,
      description: `교재 판매: ${input.bookTitle} / ${input.studentName}`,
      ref_table: "book_releases",
      ref_id: data.id,
    });

    if (ledgerError) {
      throw new Error(`교재 수입 내역을 저장하지 못했습니다: ${ledgerError.message}`);
    }
  }

  return buildBookPurchaseList([toBookSale(data)], {
    academyId: input.academyId,
  })[0];
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

import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type BookSaleStatus = "payment-pending" | "paid";

export type PendingBookSale = {
  academyId: string;
  saleId: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  price: number;
  orderedOn?: string;
  shippedAt: string;
  status: "payment-pending";
};

export type PaidBookSale = Omit<PendingBookSale, "status"> & {
  status: "paid";
  paidAt: string;
  /** 결제 완료 시 만들어진 수입 원장 id. 원장 연결이 없는 옛 결제는 비어 있다. */
  paidLedgerEntryId?: string | null;
  permanent: true;
};

export type BookSale = PendingBookSale | PaidBookSale;

export type LedgerCategory =
  | "tuition"
  | "lesson-ticket"
  | "book-sale"
  | "payroll"
  | "book-order"
  | "rent"
  | "utilities"
  | "tuning-repair"
  | "supplies"
  | "tax"
  | "other";

export type LedgerEntry = {
  academyId: string;
  ledgerId: string;
  occurredOn: string;
  type: "income" | "expense";
  source: "book-sale" | "tuition" | "payroll" | "manual" | "lesson-ticket";
  category?: LedgerCategory;
  amount: number;
  description: string;
  refId: string;
};

export type BuildBookPurchaseListOptions = {
  academyId: string;
  search?: string;
  filters?: {
    status?: BookSaleStatus;
  };
  page?: number;
  pageSize?: PageSizeOption;
};

export type BookPurchaseListRow = {
  saleId: string;
  studentName: string;
  bookTitle: string;
  autoFilledPrice: number;
  shippedAt: string;
  status: BookSaleStatus;
};

export function buildBookPurchaseList(
  sales: BookSale[],
  options: BuildBookPurchaseListOptions,
): ListView<BookPurchaseListRow> {
  const rows = sales
    .filter((sale) => sale.academyId === options.academyId)
    .filter((sale) => matchesBookPurchaseFilters(sale, options.filters))
    .map(toBookPurchaseListRow);

  return buildListView(rows, {
    getName: (row) => row.studentName,
    getTieBreaker: toBookPurchaseTieBreaker,
    search: options.search,
    searchFields: [
      (row) => row.studentName,
      (row) => row.bookTitle,
      (row) => row.shippedAt,
      (row) => row.status,
      (row) => formatBookSaleStatus(row.status),
    ],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export function formatBookSaleStatus(status: BookSaleStatus) {
  return status === "paid" ? "결제 완료" : "결제 대기";
}

function matchesBookPurchaseFilters(
  sale: BookSale,
  filters: BuildBookPurchaseListOptions["filters"],
) {
  return !filters?.status || sale.status === filters.status;
}

function toBookPurchaseListRow(sale: BookSale): BookPurchaseListRow {
  return {
    saleId: sale.saleId,
    studentName: sale.studentName,
    bookTitle: sale.bookTitle,
    autoFilledPrice: sale.price,
    shippedAt: sale.shippedAt,
    status: sale.status,
  };
}

/** 원생명이 같으면 출고일 → 교재명 → 판매 id 순. 탭 구분자는 글자보다 앞서 정렬되어 항목별 순서를 유지한다. */
function toBookPurchaseTieBreaker(row: BookPurchaseListRow) {
  return [row.shippedAt, row.bookTitle, row.saleId].join("\t");
}

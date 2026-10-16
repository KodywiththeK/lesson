import { toFinanceMonth } from "./finance-date";
import { calculateBookAmount } from "./book-stock";
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
  /** 출고 시점의 도서명 스냅샷. 교재를 고치거나 삭제해도 바뀌지 않는다. */
  bookTitle: string;
  /** 원생이 삭제되면 연결이 끊겨 비어 있다. 이름은 `studentName` 스냅샷으로 계속 보인다. */
  studentId: string | null;
  studentName: string;
  /** 출고 시점의 단가. 금액은 단가 × 수량이다. */
  price: number;
  quantity: number;
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

type BookSaleListOptions = {
  academyId: string;
  search?: string;
  page?: number;
  pageSize?: PageSizeOption;
};

export type BuildBookShipmentListOptions = BookSaleListOptions;

/** 출고목록(결제 대기) 한 줄. */
export type BookShipmentRow = {
  saleId: string;
  bookId: string;
  studentId: string | null;
  studentName: string;
  bookTitle: string;
  price: number;
  quantity: number;
  amount: number;
  shippedAt: string;
};

/** 원생명 가나다순 → 출고일 → 교재명 → 판매 id 순. 탭 구분자는 글자보다 앞서 정렬되어 항목별 순서를 유지한다. */
export function buildBookShipmentList(
  sales: BookSale[],
  options: BuildBookShipmentListOptions,
): ListView<BookShipmentRow> {
  const rows = sales
    .filter(
      (sale): sale is PendingBookSale =>
        sale.academyId === options.academyId && sale.status === "payment-pending",
    )
    .map(toBookShipmentRow);

  return buildListView(rows, {
    getName: (row) => row.studentName,
    getTieBreaker: (row) => [row.shippedAt, row.bookTitle, row.saleId].join("\t"),
    search: options.search,
    searchFields: [(row) => row.studentName, (row) => row.bookTitle, (row) => row.shippedAt],
    page: options.page,
    pageSize: options.pageSize,
  });
}

export type BuildBookPaidListOptions = BookSaleListOptions & {
  /** 입금일이 속한 월(`YYYY-MM`). */
  month: string;
};

/** 결제 완료 목록 한 줄. */
export type BookPaidRow = {
  saleId: string;
  studentName: string;
  bookTitle: string;
  price: number;
  quantity: number;
  amount: number;
  shippedAt: string;
  paidAt: string;
  /** 입출입내역의 연결 행이 지워진 결제 완료 건. 연결 정보를 읽지 않은 환경(undefined)은 알 수 없어 false다. */
  ledgerMissing: boolean;
};

/** 입금일 최신순 → 원생명 → 도서명 → 판매 id 순. */
export function buildBookPaidList(
  sales: BookSale[],
  options: BuildBookPaidListOptions,
): ListView<BookPaidRow> {
  const rows = sales
    .filter(
      (sale): sale is PaidBookSale =>
        sale.academyId === options.academyId &&
        sale.status === "paid" &&
        Boolean(sale.paidAt) &&
        toFinanceMonth(sale.paidAt) === options.month,
    )
    .map(toBookPaidRow);

  return buildListView(rows, {
    getName: (row) => row.studentName,
    getTieBreaker: (row) => [row.bookTitle, row.saleId].join("\t"),
    getSortValue: (row) => row.paidAt,
    sortDirection: "desc",
    search: options.search,
    searchFields: [(row) => row.studentName, (row) => row.bookTitle],
    page: options.page,
    pageSize: options.pageSize,
  });
}

/** 입출입내역 설명. 서버(`private.mark_book_release_paid`)의 설명과 같은 규칙이다. */
export function formatBookSaleLedgerDescription(sale: {
  bookTitle: string;
  quantity: number;
  studentName: string;
}) {
  const quantity = sale.quantity > 1 ? ` × ${sale.quantity}권` : "";

  return `교재 판매: ${sale.bookTitle}${quantity} / ${sale.studentName}`;
}

export function formatBookSaleStatus(status: BookSaleStatus) {
  return status === "paid" ? "결제 완료" : "결제 대기";
}

function toBookShipmentRow(sale: PendingBookSale): BookShipmentRow {
  return {
    saleId: sale.saleId,
    bookId: sale.bookId,
    studentId: sale.studentId,
    studentName: sale.studentName,
    bookTitle: sale.bookTitle,
    price: sale.price,
    quantity: sale.quantity,
    amount: calculateBookAmount(sale.price, sale.quantity),
    shippedAt: sale.shippedAt,
  };
}

function toBookPaidRow(sale: PaidBookSale): BookPaidRow {
  return {
    saleId: sale.saleId,
    studentName: sale.studentName,
    bookTitle: sale.bookTitle,
    price: sale.price,
    quantity: sale.quantity,
    amount: calculateBookAmount(sale.price, sale.quantity),
    shippedAt: sale.shippedAt,
    paidAt: sale.paidAt,
    ledgerMissing: sale.paidLedgerEntryId === null,
  };
}

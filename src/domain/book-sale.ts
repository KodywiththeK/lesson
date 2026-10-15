import {
  buildListView,
  type ListView,
  type PageSizeOption,
} from "./common-list";

export type BookStockInput = {
  academyId: string;
  bookId: string;
  title: string;
  price: number;
  quantity: number;
  orderedOn?: string;
  stockedAt: string;
};

export type BookStock = BookStockInput & {
  visible: true;
};

export type ShipBookInput = {
  academyId: string;
  saleId: string;
  studentId: string;
  studentName: string;
  shippedAt: string;
};

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

export type ShipBookResult = {
  stock: BookStock;
  sale: PendingBookSale;
};

export type CompleteBookSalePaymentInput = {
  academyId: string;
  paidAt: string;
};

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

export type CompleteBookSalePaymentResult = {
  sale: PaidBookSale;
  ledgerEntry: LedgerEntry;
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

export function registerBookStock(input: BookStockInput): BookStock {
  assertPositiveMoney(input.price);
  assertNonNegativeInteger(input.quantity);

  return {
    ...input,
    visible: true,
  };
}

export function shipBookToStudent(
  stock: BookStock,
  input: ShipBookInput,
): ShipBookResult {
  assertSameAcademy(stock.academyId, input.academyId);

  if (stock.quantity <= 0) {
    throw new Error("출고 가능한 교재 재고가 없습니다.");
  }

  return {
    stock: {
      ...stock,
      quantity: stock.quantity - 1,
      visible: true,
    },
    sale: {
      academyId: input.academyId,
      saleId: input.saleId,
      bookId: stock.bookId,
      bookTitle: stock.title,
      studentId: input.studentId,
      studentName: input.studentName,
      price: stock.price,
      shippedAt: input.shippedAt,
      status: "payment-pending",
    },
  };
}

export function completeBookSalePayment(
  sale: BookSale,
  input: CompleteBookSalePaymentInput,
): CompleteBookSalePaymentResult {
  assertSameAcademy(sale.academyId, input.academyId);

  if (sale.status === "paid") {
    throw new Error("이미 결제 완료된 교재 판매입니다.");
  }

  const paidSale: PaidBookSale = {
    ...sale,
    status: "paid",
    paidAt: input.paidAt,
    permanent: true,
  };

  return {
    sale: paidSale,
    ledgerEntry: {
      academyId: sale.academyId,
      ledgerId: `book-sale:${sale.saleId}`,
      occurredOn: input.paidAt,
      type: "income",
      source: "book-sale",
      category: "book-sale",
      amount: sale.price,
      description: `교재 판매: ${sale.bookTitle} / ${sale.studentName}`,
      refId: sale.saleId,
    },
  };
}

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

function assertSameAcademy(leftAcademyId: string, rightAcademyId: string) {
  if (leftAcademyId !== rightAcademyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }
}

function assertPositiveMoney(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("금액은 1 이상의 정수여야 합니다.");
  }
}

function assertNonNegativeInteger(value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("수량은 0 이상의 정수여야 합니다.");
  }
}

import {
  buildListView,
  type ListSortDirection,
  type ListView,
  type PageSizeOption,
} from "./common-list";

/** 교재 한 줄 = 현재 재고 권수 하나. `title`은 화면에 보이는 이름이고 중복 판정은 정규화한 이름으로 한다. */
export type BookStockRow = {
  academyId: string;
  bookId: string;
  title: string;
  price: number;
  quantity: number;
  /** 최근 입고일(재입고하면 갱신). */
  stockedOn: string;
  /** 구입 거래처명(자유 입력, 선택). vendors와 연결하지 않아 거래처를 지워도 남는다. */
  purchaseVendorName?: string;
};

export type BookStockListRow = BookStockRow & {
  /** 재고 0권. 목록에서 사라지지 않고 "재고 없음"으로 표시한다. */
  isOutOfStock: boolean;
};

/** 입출입내역 금액(`ledger_entries.amount`)이 integer라 단가 × 수량이 넘을 수 없는 값. */
export const LEDGER_AMOUNT_MAX = 2_147_483_647;

export const BOOK_LIMITS = {
  titleMaxLength: 100,
  purchaseVendorMaxLength: 100,
  priceMax: 9_999_999,
  stockQuantityMax: 9_999,
  releaseQuantityMax: 999,
} as const;

/** 화면·도메인·서버(RPC)가 같은 문구를 쓴다. 서버 문구는 `docs/product/book-management-spec.md` 8장과 같다. */
export const BOOK_MESSAGES = {
  titleRequired: "도서명을 입력해 주세요.",
  titleTooLong: "도서명은 100자 이하로 입력해 주세요.",
  purchaseVendorTooLong: "구입 거래처명은 100자 이하로 입력해 주세요.",
  priceRange: "가격은 1원 이상 9,999,999원 이하의 정수로 입력해 주세요.",
  stockQuantityRange: "권수는 0권 이상 9,999권 이하의 정수로 입력해 주세요.",
  releaseQuantityRange: "수량은 1권 이상 999권 이하의 정수로 입력해 주세요.",
  stockedOnRequired: "입고일을 입력해 주세요.",
  futureStockedOn: "입고일은 오늘 이후로 정할 수 없습니다.",
  shippedOnRequired: "출고일을 입력해 주세요.",
  futureShippedOn: "출고일은 오늘 이후로 정할 수 없습니다.",
  studentRequired: "재원 중인 원생을 선택해 주세요.",
  bookRequired: "도서를 선택해 주세요.",
  bookNotFound: "교재를 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  outOfStock: "재고가 없습니다. 교재를 입고한 뒤 출고해 주세요.",
  insufficientStock: (remaining: number) => `재고가 부족합니다. 남은 재고는 ${remaining}권입니다.`,
  duplicateTitle: "이미 등록된 도서명입니다. 같은 이름의 교재의 권수를 수정해 주세요.",
  stockOverflow: "재고는 9,999권을 넘을 수 없습니다.",
  amountTooLarge: "금액(단가 × 수량)이 너무 큽니다. 단가나 수량을 줄여 주세요.",
  paidOnRequired: "입금일을 입력해 주세요.",
  paymentBeforeShipment: (shippedOn: string) => `입금일은 출고일(${shippedOn}) 이후여야 합니다.`,
  cancelReasonRequired: "취소 사유를 입력해 주세요.",
  paidReleaseLocked: "결제 완료된 출고는 수정하거나 삭제할 수 없습니다. 원장이 결제를 취소한 뒤 수정해 주세요.",
  alreadyPaid: "이미 결제 완료된 출고입니다.",
  alreadyPending: "이미 결제 대기 상태입니다. 목록을 새로고침해 주세요.",
  notFound: "이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.",
  ownerOnly: "이 작업을 할 권한이 없습니다. 결제 확인과 취소는 원장만 할 수 있습니다.",
} as const;

/** 앞뒤 공백 제거, 연속 공백 한 칸, 대소문자 무시. DB의 `private.normalize_book_title`과 같은 규칙이다. */
export function normalizeBookTitle(title: string) {
  return title.replace(/\s+/g, " ").trim().toLowerCase();
}

export function findBookByTitle(
  books: BookStockRow[],
  academyId: string,
  title: string,
  options: { exceptBookId?: string } = {},
) {
  const key = normalizeBookTitle(title);

  if (!key) {
    return undefined;
  }

  return books.find(
    (book) =>
      book.academyId === academyId &&
      book.bookId !== options.exceptBookId &&
      normalizeBookTitle(book.title) === key,
  );
}

/** 금액은 단가 × 수량이다. */
export function calculateBookAmount(price: number, quantity: number) {
  return price * quantity;
}

export type BuildBookStockListOptions = {
  academyId: string;
  search?: string;
  sortOrder?: ListSortDirection;
  page?: number;
  pageSize?: PageSizeOption;
};

export function buildBookStockList(
  books: BookStockRow[],
  options: BuildBookStockListOptions,
): ListView<BookStockListRow> {
  return buildListView(
    books
      .filter((book) => book.academyId === options.academyId)
      .map((book) => ({ ...book, isOutOfStock: book.quantity === 0 })),
    {
      getName: (book) => book.title,
      getTieBreaker: (book) => book.bookId,
      getSortValue: (book) => book.title,
      sortDirection: options.sortOrder,
      search: options.search,
      searchFields: [(book) => book.title],
      page: options.page,
      pageSize: options.pageSize,
    },
  );
}

export type BookStockInput = {
  title: string;
  price: number;
  quantity: number;
  stockedOn: string;
  purchaseVendorName?: string;
};

function isWholeNumberInRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

/** 교재 등록·수정 입력을 확인한다. 문제가 없으면 null, 있으면 사용자에게 보일 문구를 돌려준다. */
export function validateBookStockInput(input: BookStockInput, today: string): string | null {
  const title = input.title.trim();

  if (!title) return BOOK_MESSAGES.titleRequired;
  if (title.length > BOOK_LIMITS.titleMaxLength) return BOOK_MESSAGES.titleTooLong;
  if (!isWholeNumberInRange(input.price, 1, BOOK_LIMITS.priceMax)) return BOOK_MESSAGES.priceRange;
  if (!isWholeNumberInRange(input.quantity, 0, BOOK_LIMITS.stockQuantityMax)) {
    return BOOK_MESSAGES.stockQuantityRange;
  }
  if (!input.stockedOn) return BOOK_MESSAGES.stockedOnRequired;
  if (input.stockedOn > today) return BOOK_MESSAGES.futureStockedOn;
  if ((input.purchaseVendorName ?? "").trim().length > BOOK_LIMITS.purchaseVendorMaxLength) {
    return BOOK_MESSAGES.purchaseVendorTooLong;
  }

  return null;
}

export type RestockPreview = {
  existingBookId: string;
  mergedQuantity: number;
  /** 입력한 가격이 기존과 다르면 새 가격으로 바뀐다. */
  priceChange: { from: number; to: number } | null;
  overflows: boolean;
};

/** 교재 등록 폼에서 같은 도서명이면 합산·가격 변경을 미리 안내하기 위한 계산. 새 도서명이면 null. */
export function calculateRestockPreview(
  books: BookStockRow[],
  academyId: string,
  input: { title: string; price: number; quantity: number },
): RestockPreview | null {
  const existing = findBookByTitle(books, academyId, input.title);

  if (!existing) {
    return null;
  }

  const mergedQuantity = existing.quantity + (Number.isFinite(input.quantity) ? input.quantity : 0);

  return {
    existingBookId: existing.bookId,
    mergedQuantity,
    priceChange: existing.price === input.price ? null : { from: existing.price, to: input.price },
    overflows: mergedQuantity > BOOK_LIMITS.stockQuantityMax,
  };
}

export type BookReleaseInput = {
  studentId: string;
  bookId: string;
  price: number;
  quantity: number;
  shippedOn: string;
};

/** 출고 등록·수정 입력을 확인한다. `availableQuantity`는 선택한 교재에서 출고할 수 있는 수량이다. */
export function validateBookReleaseInput(
  input: BookReleaseInput,
  context: { today: string; availableQuantity: number },
): string | null {
  if (!input.studentId) return BOOK_MESSAGES.studentRequired;
  if (!input.bookId) return BOOK_MESSAGES.bookRequired;
  if (!isWholeNumberInRange(input.price, 1, BOOK_LIMITS.priceMax)) return BOOK_MESSAGES.priceRange;
  if (!isWholeNumberInRange(input.quantity, 1, BOOK_LIMITS.releaseQuantityMax)) {
    return BOOK_MESSAGES.releaseQuantityRange;
  }
  if (!input.shippedOn) return BOOK_MESSAGES.shippedOnRequired;
  if (input.shippedOn > context.today) return BOOK_MESSAGES.futureShippedOn;
  if (calculateBookAmount(input.price, input.quantity) > LEDGER_AMOUNT_MAX) return BOOK_MESSAGES.amountTooLarge;
  if (context.availableQuantity <= 0) return BOOK_MESSAGES.outOfStock;
  if (input.quantity > context.availableQuantity) {
    return BOOK_MESSAGES.insufficientStock(context.availableQuantity);
  }

  return null;
}

/** 입금일은 출고일 이후여야 하고 미래 날짜도 허용한다. */
export function validatePaymentDate(paidOn: string, shippedOn: string): string | null {
  if (!paidOn) return BOOK_MESSAGES.paidOnRequired;
  if (paidOn < shippedOn) return BOOK_MESSAGES.paymentBeforeShipment(shippedOn);

  return null;
}

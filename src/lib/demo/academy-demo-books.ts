import {
  formatBookSaleLedgerDescription,
  type BookSale,
  type PaidBookSale,
  type PendingBookSale,
} from "@/domain/book-sale";
import {
  BOOK_MESSAGES,
  calculateBookAmount,
  findBookByTitle,
  validateBookReleaseInput,
  validateBookStockInput,
  validatePaymentDate,
  BOOK_LIMITS,
} from "@/domain/book-stock";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import { getFinanceToday } from "@/domain/finance-date";

import type { DemoAcademyState } from "./academy-demo-state";
import type { DemoBook } from "./management-demo-data";

/**
 * 교재 재고·출고 데모 상태 전이. 서버 RPC(`supabase/migrations/20261019090100_book_stock_rpcs.sql`)와 같은 규칙을 순수 함수로 옮겼다.
 * 규칙은 `docs/product/book-management-spec.md`를 따른다.
 */

type BookStockDemoInput = {
  title: string;
  price: number;
  quantity: number;
  stockedOn: string;
};

function throwIfInvalid(message: string | null): asserts message is null {
  if (message) {
    throw new Error(message);
  }
}

function getActiveBook(state: DemoAcademyState, bookId: string) {
  return state.books.find((book) => book.bookId === bookId && book.active);
}

/** 교재 등록 또는 재입고. 같은 도서명이면 권수를 합산하고 입고일·가격을 갱신한다. */
export function registerDemoBookStock(state: DemoAcademyState, input: BookStockDemoInput): DemoAcademyState {
  throwIfInvalid(validateBookStockInput(input, getFinanceToday()));

  const title = input.title.trim();
  const activeBooks = state.books.filter((book) => book.active);
  const existing = findBookByTitle(activeBooks, state.academyId, title);

  if (existing) {
    const quantity = existing.quantity + input.quantity;

    if (quantity > BOOK_LIMITS.stockQuantityMax) {
      throw new Error(BOOK_MESSAGES.stockOverflow);
    }

    return {
      ...state,
      books: state.books.map((book) =>
        book.bookId === existing.bookId
          ? { ...book, quantity, price: input.price, stockedOn: input.stockedOn }
          : book,
      ),
    };
  }

  const created: DemoBook = {
    academyId: state.academyId,
    bookId: `book-demo-${getNextNumber(state.books.map((book) => book.bookId))}`,
    title,
    price: input.price,
    quantity: input.quantity,
    stockedOn: input.stockedOn,
    active: true,
  };

  return { ...state, books: [...state.books, created] };
}

export function updateDemoBook(
  state: DemoAcademyState,
  input: BookStockDemoInput & { bookId: string },
): DemoAcademyState {
  throwIfInvalid(validateBookStockInput(input, getFinanceToday()));

  if (!getActiveBook(state, input.bookId)) {
    throw new Error(BOOK_MESSAGES.notFound);
  }

  const title = input.title.trim();

  if (findBookByTitle(state.books.filter((book) => book.active), state.academyId, title, { exceptBookId: input.bookId })) {
    throw new Error(BOOK_MESSAGES.duplicateTitle);
  }

  return {
    ...state,
    books: state.books.map((book) =>
      book.bookId === input.bookId
        ? { ...book, title, price: input.price, quantity: input.quantity, stockedOn: input.stockedOn }
        : book,
    ),
  };
}

/** 삭제는 보관 처리다. 재고 목록에서 사라지지만 판매 기록은 도서명·가격 스냅샷으로 남는다. */
export function deleteDemoBook(state: DemoAcademyState, input: { bookId: string }): DemoAcademyState {
  if (!getActiveBook(state, input.bookId)) {
    throw new Error(BOOK_MESSAGES.notFound);
  }

  return {
    ...state,
    books: state.books.map((book) => (book.bookId === input.bookId ? { ...book, active: false } : book)),
  };
}

type BookReleaseDemoInput = {
  studentId: string;
  bookId: string;
  price: number;
  quantity: number;
  shippedOn: string;
};

function findEnrolledStudent(state: DemoAcademyState, studentId: string) {
  const student = state.students.find((candidate) => candidate.studentId === studentId);

  return student && (student.status ?? "enrolled") === "enrolled" ? student : undefined;
}

function applyStockDelta(books: DemoBook[], bookId: string, delta: number) {
  return books.map((book) => (book.bookId === bookId ? { ...book, quantity: book.quantity + delta } : book));
}

/** 출고 등록. 재고를 수량만큼 줄이고, `status`가 paid(원장)이면 입금일(기본 출고일)로 바로 결제 완료한다. */
export function registerDemoBookRelease(
  state: DemoAcademyState,
  input: BookReleaseDemoInput & { status: BookSale["status"]; paidOn?: string },
): DemoAcademyState {
  const student = findEnrolledStudent(state, input.studentId);
  const book = getActiveBook(state, input.bookId);

  if (!student) {
    throw new Error(BOOK_MESSAGES.studentRequired);
  }

  if (!book) {
    throw new Error(BOOK_MESSAGES.bookNotFound);
  }

  throwIfInvalid(
    validateBookReleaseInput(input, { today: getFinanceToday(), availableQuantity: book.quantity }),
  );

  const saleId = `book-sale-demo-${getNextNumber(state.bookSales.map((sale) => sale.saleId))}`;
  const pending: PendingBookSale = {
    academyId: state.academyId,
    saleId,
    bookId: book.bookId,
    bookTitle: book.title,
    studentId: student.studentId,
    studentName: student.name,
    price: input.price,
    quantity: input.quantity,
    shippedAt: input.shippedOn,
    status: "payment-pending",
  };
  const registered: DemoAcademyState = {
    ...state,
    books: applyStockDelta(state.books, book.bookId, -input.quantity),
    bookSales: [...state.bookSales, pending],
  };

  return input.status === "paid"
    ? completeDemoBookRelease(registered, { releaseId: saleId, paidAt: input.paidOn ?? input.shippedOn })
    : registered;
}

function findSale(state: DemoAcademyState, releaseId: string) {
  const sale = state.bookSales.find((candidate) => candidate.saleId === releaseId);

  if (!sale) {
    throw new Error(BOOK_MESSAGES.notFound);
  }

  return sale;
}

function findPendingSale(state: DemoAcademyState, releaseId: string): PendingBookSale {
  const sale = findSale(state, releaseId);

  if (sale.status === "paid") {
    throw new Error(BOOK_MESSAGES.paidReleaseLocked);
  }

  return sale;
}

/** 결제 대기 출고 수정. 재고를 한 번에 복원·재차감하고, 한 곳이라도 모자라면 아무것도 바꾸지 않는다. */
export function updateDemoBookRelease(
  state: DemoAcademyState,
  input: BookReleaseDemoInput & { releaseId: string },
): DemoAcademyState {
  const sale = findPendingSale(state, input.releaseId);
  const targetBook = state.books.find(
    (book) => book.bookId === input.bookId && (book.active || book.bookId === sale.bookId),
  );

  if (!targetBook) {
    throw new Error(BOOK_MESSAGES.bookNotFound);
  }

  // 원생을 바꿀 때만 재원 여부를 확인한다.
  const studentChanged = input.studentId !== sale.studentId;
  const student = studentChanged ? findEnrolledStudent(state, input.studentId) : undefined;

  if (studentChanged && !student) {
    throw new Error(BOOK_MESSAGES.studentRequired);
  }

  const sameBook = input.bookId === sale.bookId;
  // 같은 도서면 복원 후 재차감한 순 재고로 검사한다(수량을 줄이는 수정이 재고 부족으로 막히지 않게).
  const availableQuantity = sameBook ? targetBook.quantity + sale.quantity : targetBook.quantity;

  throwIfInvalid(validateBookReleaseInput(input, { today: getFinanceToday(), availableQuantity }));

  const restored = applyStockDelta(state.books, sale.bookId, sale.quantity);
  const books = applyStockDelta(restored, input.bookId, -input.quantity);

  return {
    ...state,
    books,
    bookSales: state.bookSales.map((candidate) =>
      candidate.saleId === sale.saleId
        ? {
            ...sale,
            studentId: input.studentId,
            studentName: student?.name ?? sale.studentName,
            bookId: input.bookId,
            bookTitle: sameBook ? sale.bookTitle : targetBook.title,
            price: input.price,
            quantity: input.quantity,
            shippedAt: input.shippedOn,
          }
        : candidate,
    ),
  };
}

export function deleteDemoBookRelease(state: DemoAcademyState, input: { releaseId: string }): DemoAcademyState {
  const sale = findPendingSale(state, input.releaseId);

  return {
    ...state,
    books: applyStockDelta(state.books, sale.bookId, sale.quantity),
    bookSales: state.bookSales.filter((candidate) => candidate.saleId !== sale.saleId),
  };
}

/** 출고 등록에서 바로 결제 완료를 선택한 경우 수입 원장을 같은 변경 안에서 만든다. */
export function completeDemoBookRelease(
  state: DemoAcademyState,
  input: { releaseId: string; paidAt: string },
): DemoAcademyState {
  const sale = state.bookSales.find((candidate) => candidate.saleId === input.releaseId);

  if (!sale) {
    throw new Error(BOOK_MESSAGES.notFound);
  }

  if (sale.status === "paid") {
    throw new Error(BOOK_MESSAGES.alreadyPaid);
  }

  throwIfInvalid(validatePaymentDate(input.paidAt, sale.shippedAt));

  const paidSale: PaidBookSale = {
    ...sale,
    status: "paid",
    paidAt: input.paidAt,
    paidLedgerEntryId: `ledger-book-${sale.saleId}`,
    permanent: true,
  };

  return {
    ...state,
    bookSales: state.bookSales.map((candidate) => (candidate.saleId === sale.saleId ? paidSale : candidate)),
    ledgerEntries: buildFinanceLedgerList(
      [
        ...state.ledgerEntries,
        {
          academyId: state.academyId,
          ledgerId: `ledger-book-${sale.saleId}`,
          occurredOn: input.paidAt,
          type: "income",
          source: "book-sale",
          category: "book-sale",
          amount: calculateBookAmount(sale.price, sale.quantity),
          description: formatBookSaleLedgerDescription(sale),
          refId: sale.saleId,
        },
      ],
      { academyId: state.academyId },
    ),
  };
}

/** 결제 취소(원장). 수입 행을 지우고 결제 대기로 되돌린다. 연결 행이 이미 없어도 취소된다. 재고는 바꾸지 않는다. */
export function cancelDemoBookPayment(
  state: DemoAcademyState,
  input: { releaseId: string; reason: string },
): DemoAcademyState {
  if (!input.reason.trim()) {
    throw new Error(BOOK_MESSAGES.cancelReasonRequired);
  }

  const sale = findSale(state, input.releaseId);

  if (sale.status !== "paid") {
    throw new Error(BOOK_MESSAGES.alreadyPending);
  }

  const pending: PendingBookSale = {
    academyId: sale.academyId,
    saleId: sale.saleId,
    bookId: sale.bookId,
    bookTitle: sale.bookTitle,
    studentId: sale.studentId,
    studentName: sale.studentName,
    price: sale.price,
    quantity: sale.quantity,
    orderedOn: sale.orderedOn,
    shippedAt: sale.shippedAt,
    status: "payment-pending",
  };

  return {
    ...state,
    bookSales: state.bookSales.map((candidate) => (candidate.saleId === sale.saleId ? pending : candidate)),
    ledgerEntries: state.ledgerEntries.filter(
      (entry) => !(entry.source === "book-sale" && entry.refId === sale.saleId),
    ),
  };
}

/** 삭제 뒤에도 기존 id와 겹치지 않도록 남아 있는 id의 가장 큰 번호 다음 번호를 쓴다. */
function getNextNumber(ids: string[]) {
  return Math.max(0, ...ids.map((id) => Number(/(\d+)$/.exec(id)?.[1] ?? 0))) + 1;
}

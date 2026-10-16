import {
  BOOK_MESSAGES,
  calculateRestockPreview,
  findBookByTitle,
  validateBookStockInput,
  type BookStockInput,
  type BookStockRow,
  type RestockPreview,
} from "@/domain/book-stock";

import { formatBookPrice, formatBookQuantity } from "./book-stock-format";

/** 입력 칸의 글자 그대로의 값. 숫자로 바꾸는 일은 `evaluateBookStockForm`이 한다. */
export type BookStockFormValues = {
  title: string;
  price: string;
  quantity: string;
  stockedOn: string;
};

export type BookStockFormContext = {
  academyId: string;
  /** 보관하지 않은 교재 전체. 재입고 미리보기와 도서명 중복 검사에 쓴다. */
  books: BookStockRow[];
  today: string;
  /** 있으면 수정 폼이다. 이 교재 자신은 중복 검사에서 제외한다. */
  editingBookId?: string;
};

export type BookStockFormState = {
  input: BookStockInput;
  /** 같은 도서명으로 등록할 때 합산·가격 변경을 미리 알리는 안내. */
  restockNotice: string | null;
  /** 저장을 막는 이유. 없으면 저장할 수 있다. */
  blockReason: string | null;
};

export function createEmptyBookStockFormValues(today: string): BookStockFormValues {
  return { title: "", price: "", quantity: "", stockedOn: today };
}

export function toBookStockFormValues(book: BookStockRow): BookStockFormValues {
  return {
    title: book.title,
    price: String(book.price),
    quantity: String(book.quantity),
    stockedOn: book.stockedOn,
  };
}

/** 비워 둔 칸은 0이 아니라 숫자가 아닌 값(NaN)으로 두어 범위 검사에서 걸리게 한다. */
function toNumber(text: string) {
  return text.trim() === "" ? Number.NaN : Number(text);
}

export function evaluateBookStockForm(
  values: BookStockFormValues,
  context: BookStockFormContext,
): BookStockFormState {
  const input: BookStockInput = {
    title: values.title.trim(),
    price: toNumber(values.price),
    quantity: toNumber(values.quantity),
    stockedOn: values.stockedOn,
  };
  const isEditing = context.editingBookId !== undefined;
  const preview = isEditing ? null : calculateRestockPreview(context.books, context.academyId, input);
  const restockNotice = preview ? describeRestock(preview, context.books) : null;

  return {
    input,
    restockNotice,
    blockReason:
      validateBookStockInput(input, context.today) ??
      getDuplicateTitleReason(input.title, context) ??
      (preview?.overflows ? `${BOOK_MESSAGES.stockOverflow} 입력한 권수를 줄여 주세요.` : null),
  };
}

function getDuplicateTitleReason(title: string, context: BookStockFormContext) {
  if (context.editingBookId === undefined) {
    return null;
  }

  const duplicate = findBookByTitle(context.books, context.academyId, title, {
    exceptBookId: context.editingBookId,
  });

  return duplicate ? BOOK_MESSAGES.duplicateTitle : null;
}

function describeRestock(preview: RestockPreview, books: BookStockRow[]) {
  const currentQuantity = books.find((book) => book.bookId === preview.existingBookId)?.quantity ?? 0;
  const quantityText = `현재 ${formatBookQuantity(currentQuantity)} → ${formatBookQuantity(preview.mergedQuantity)}`;
  const priceChange = preview.priceChange;

  if (priceChange && Number.isFinite(priceChange.to)) {
    return `이미 등록된 교재입니다. 권수가 합산되고(${quantityText}) 가격이 ${formatBookPrice(priceChange.from)}에서 ${formatBookPrice(priceChange.to)}으로 바뀝니다.`;
  }

  return `이미 등록된 교재입니다. 권수가 합산됩니다(${quantityText}).`;
}

/**
 * 등록 결과가 새 교재인지 재입고(합산)인지 가른다.
 * 저장 전 목록에 같은 도서명이 있었거나, 서버가 돌려준 권수가 입력과 다르면 합산이다.
 */
export function didRestock(
  books: BookStockRow[],
  academyId: string,
  input: BookStockInput,
  saved: BookStockRow | undefined,
) {
  return (
    findBookByTitle(books, academyId, input.title) !== undefined ||
    (saved !== undefined && saved.quantity !== input.quantity)
  );
}

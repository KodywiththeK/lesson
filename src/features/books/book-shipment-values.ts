import type { BookShipmentRow } from "@/domain/book-sale";
import {
  BOOK_LIMITS,
  validateBookReleaseInput,
  type BookReleaseInput,
  type BookStockRow,
} from "@/domain/book-stock";
import { parseWonInput } from "@/domain/money-input";

/** 출고 등록 폼이 화면 밖으로 내보내는 값. 원장만 `paid`와 입금일을 보낼 수 있다. */
export type BookReleaseRegistration = BookReleaseInput & {
  status: "payment-pending" | "paid";
  paidOn?: string;
};

export type BookReleaseUpdate = BookReleaseInput & { releaseId: string };

export type StudentChoice = { studentId: string; name: string };

export type BookChoice = {
  bookId: string;
  title: string;
  price: number;
  /** 남은 재고. 이미 보관(삭제)된 교재는 현재 재고를 알 수 없어 null이다. */
  quantity: number | null;
};

/** 입력 칸의 값. 가격·수량은 비어 있거나 숫자가 아닐 수 있어 문자열로 들고 있다가 도메인 검증에 넘긴다. */
export type BookShipmentValues = {
  studentId: string;
  bookId: string;
  price: string;
  quantity: string;
  shippedOn: string;
};

const DEFAULT_RELEASE_QUANTITY = "1";

export function createEmptyShipmentValues(today: string): BookShipmentValues {
  return { studentId: "", bookId: "", price: "", quantity: DEFAULT_RELEASE_QUANTITY, shippedOn: today };
}

export function toShipmentValues(shipment: BookShipmentRow): BookShipmentValues {
  return {
    studentId: shipment.studentId ?? "",
    bookId: shipment.bookId,
    price: String(shipment.price),
    quantity: String(shipment.quantity),
    shippedOn: shipment.shippedAt,
  };
}

export function toBookReleaseInput(values: BookShipmentValues): BookReleaseInput {
  return {
    studentId: values.studentId,
    bookId: values.bookId,
    price: parseWonInput(values.price) ?? Number.NaN,
    quantity: Number(values.quantity),
    shippedOn: values.shippedOn,
  };
}

/** 출고 선택지의 원생. 수정하는 출고의 현재 원생이 휴원·퇴원으로 빠졌어도 선택된 채 남긴다. */
export function buildStudentChoices(
  students: StudentChoice[],
  currentShipment?: BookShipmentRow,
): StudentChoice[] {
  const currentStudentId = currentShipment?.studentId;

  if (!currentShipment || !currentStudentId || students.some((student) => student.studentId === currentStudentId)) {
    return students;
  }

  return [{ studentId: currentStudentId, name: currentShipment.studentName }, ...students];
}

/** 출고 선택지의 도서. 수정하는 출고의 현재 도서가 이미 보관됐다면 그 도서만 현재 선택으로 남긴다. */
export function buildBookChoices(books: BookStockRow[], currentShipment?: BookShipmentRow): BookChoice[] {
  const choices = books.map(({ bookId, title, price, quantity }) => ({ bookId, title, price, quantity }));

  if (!currentShipment || choices.some((choice) => choice.bookId === currentShipment.bookId)) {
    return choices;
  }

  const archivedChoice: BookChoice = {
    bookId: currentShipment.bookId,
    title: currentShipment.bookTitle,
    price: currentShipment.price,
    quantity: null,
  };

  return [archivedChoice, ...choices];
}

/** 도서를 고르면 교재 가격을 단가로 자동 입력한다. 도서를 지우면 입력한 가격은 그대로 둔다. */
export function selectBook(
  values: BookShipmentValues,
  bookId: string,
  choices: BookChoice[],
): BookShipmentValues {
  const choice = choices.find((candidate) => candidate.bookId === bookId);

  return { ...values, bookId, price: choice ? String(choice.price) : values.price };
}

/** 입력한 값을 도메인 검증에 맞춰 확인한다. 문제가 없으면 null, 있으면 사용자에게 보일 문구를 돌려준다. */
export function validateShipmentValues(
  values: BookShipmentValues,
  context: { today: string; books: BookChoice[]; currentShipment?: BookShipmentRow },
): string | null {
  const choice = context.books.find((candidate) => candidate.bookId === values.bookId);

  return validateBookReleaseInput(toBookReleaseInput(values), {
    today: context.today,
    availableQuantity: calculateAvailableQuantity(choice, context.currentShipment),
  });
}

/**
 * 이 출고로 내보낼 수 있는 수량. 수정 중인 출고가 이미 가져간 수량은 도로 쓸 수 있으므로
 * 같은 도서면 현재 재고에 기존 수량을 더한다. 보관된 교재는 재고를 알 수 없어 서버 검증에 맡긴다.
 */
function calculateAvailableQuantity(choice: BookChoice | undefined, currentShipment: BookShipmentRow | undefined) {
  if (!choice) {
    return 0;
  }

  if (choice.quantity === null) {
    return BOOK_LIMITS.releaseQuantityMax;
  }

  const isCurrentBook = currentShipment !== undefined && currentShipment.bookId === choice.bookId;

  return isCurrentBook ? choice.quantity + currentShipment.quantity : choice.quantity;
}

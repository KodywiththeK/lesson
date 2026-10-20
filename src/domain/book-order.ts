import { BOOK_LIMITS, LEDGER_AMOUNT_MAX } from "./book-stock";

export type BookOrderItem = {
  id: string;
  bookId: string | null;
  title: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number | null;
};

export type BookOrder = {
  id: string;
  academyId: string;
  vendorId: string | null;
  vendorName: string;
  orderedOn: string;
  receivedOn: string | null;
  paidOn: string | null;
  paidLedgerEntryId: string | null;
  ledgerMismatch: boolean;
  status: "ordered" | "received" | "cancelled";
  items: BookOrderItem[];
};

export type BookOrderInput = Pick<BookOrder, "vendorId" | "orderedOn"> & {
  items: Array<Omit<BookOrderItem, "id">>;
};

export function calculateBookOrderTotal(items: Pick<BookOrderItem, "quantity" | "purchasePrice">[]) {
  return items.reduce((total, item) => total + item.quantity * item.purchasePrice, 0);
}

export function validateBookOrderInput(input: BookOrderInput): string | null {
  if (!input.vendorId) return "거래처를 선택해 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.orderedOn)) return "발주일을 선택해 주세요.";
  if (input.items.length === 0) return "발주할 교재를 추가해 주세요.";

  for (const item of input.items) {
    if (!item.title.trim() || item.title.trim().length > BOOK_LIMITS.titleMaxLength) {
      return "도서명은 1자 이상 100자 이하로 입력해 주세요.";
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > BOOK_LIMITS.stockQuantityMax) {
      return "발주 수량은 1권 이상 9,999권 이하로 입력해 주세요.";
    }
    if (!Number.isInteger(item.purchasePrice) || item.purchasePrice < 1 || item.purchasePrice > BOOK_LIMITS.priceMax) {
      return "매입가는 1원 이상 9,999,999원 이하로 입력해 주세요.";
    }
  }

  if (calculateBookOrderTotal(input.items) > LEDGER_AMOUNT_MAX) {
    return "발주 금액이 너무 큽니다. 품목의 수량이나 매입가를 줄여 주세요.";
  }
  return null;
}

export function validateBookReceiptPrices(order: BookOrder, salePrices: Record<string, number>): string | null {
  for (const item of order.items) {
    if (item.bookId) continue;
    const price = salePrices[item.id];
    if (!Number.isInteger(price) || price < 1 || price > BOOK_LIMITS.priceMax) {
      return `${item.title}의 판매가는 1원 이상 9,999,999원 이하로 입력해 주세요.`;
    }
  }
  return null;
}

export function getBookOrderActions(order: BookOrder) {
  const active = order.status !== "cancelled";
  const unpaid = !order.paidOn;
  const paymentNeedsCorrection = !unpaid && order.ledgerMismatch;
  return {
    canEdit: active && order.status === "ordered" && unpaid,
    canReceive: active && order.status === "ordered",
    canPay: active && unpaid,
    canUndoPayment: active && !unpaid && !paymentNeedsCorrection,
    canCancel: active && !paymentNeedsCorrection,
  };
}

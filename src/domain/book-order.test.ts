import { describe, expect, it } from "vitest";

import {
  calculateBookOrderTotal,
  getBookOrderActions,
  validateBookReceiptPrices,
  validateBookOrderInput,
  type BookOrder,
} from "./book-order";

const order: BookOrder = {
  id: "order-1",
  academyId: "academy-1",
  vendorId: "vendor-1",
  vendorName: "음악서점",
  orderedOn: "2026-10-15",
  receivedOn: null,
  paidOn: null,
  paidLedgerEntryId: null,
  ledgerMismatch: false,
  status: "ordered",
  items: [{ id: "item-1", bookId: null, title: "새 교재", quantity: 2, purchasePrice: 5000, salePrice: 10000 }],
};

describe("교재 발주", () => {
  it("품목별 매입가와 수량으로 지급 총액을 계산한다", () => {
    expect(calculateBookOrderTotal(order.items)).toBe(10000);
  });

  it("새 교재의 판매가는 발주 때 비워 두고 매입 총액 경계를 검증한다", () => {
    expect(validateBookOrderInput({ ...order, items: [{ ...order.items[0], salePrice: null }] })).toBeNull();
    expect(validateBookOrderInput({ ...order, items: [{ ...order.items[0], quantity: 500, purchasePrice: 5_000_000 }] })).toMatch(/금액/);
    expect(validateBookOrderInput(order)).toBeNull();
  });

  it("지급 전후와 입고 전후에 가능한 액션을 분리한다", () => {
    expect(getBookOrderActions(order)).toEqual({ canEdit: true, canReceive: true, canPay: true, canUndoPayment: false, canCancel: true });
    expect(getBookOrderActions({ ...order, paidOn: "2026-10-16", paidLedgerEntryId: "ledger-1" })).toMatchObject({ canEdit: false, canPay: false, canUndoPayment: true });
    expect(getBookOrderActions({ ...order, status: "received", receivedOn: "2026-10-17" })).toMatchObject({ canEdit: false, canReceive: false, canCancel: true });
  });

  it("연결 원장이 불일치하면 지급 취소와 지급된 발주 취소를 잠근다", () => {
    expect(getBookOrderActions({ ...order, paidOn: "2026-10-16", paidLedgerEntryId: "ledger-1", ledgerMismatch: true }))
      .toMatchObject({ canUndoPayment: false, canCancel: false });
  });

  it("신규 도서 판매가는 입고 확정 시 검사한다", () => {
    expect(validateBookReceiptPrices(order, {})).toMatch(/새 교재의 판매가/);
    expect(validateBookReceiptPrices(order, { "item-1": 10000 })).toBeNull();
  });
});

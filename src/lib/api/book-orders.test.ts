import { describe, expect, it, vi } from "vitest";

import { cancelBookOrder, createBookOrder, fetchBookOrders, payBookOrder, receiveBookOrder, undoBookOrderPayment, updateBookOrder } from "./book-orders";

const row = {
  id: "order-1", academy_id: "academy-1", vendor_id: "vendor-1", vendor_name: "음악서점",
  ordered_on: "2026-10-15", received_on: null, paid_on: null, paid_ledger_entry_id: null,
  status: "ordered" as const,
  ledger_mismatch: false,
  items: [{ id: "item-1", book_id: null, title: "새 교재", quantity: 2, purchase_price: 5000, sale_price: 10000 }],
};

const input = { academyId: "academy-1", vendorId: "vendor-1", orderedOn: "2026-10-15", items: [{ bookId: null, title: "새 교재", quantity: 2, purchasePrice: 5000, salePrice: 10000 }] };

describe("교재 발주 RPC adapter", () => {
  it("학원별 발주와 연결 원장 불일치를 읽는다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...row, ledger_mismatch: true }], error: null });
    const orders = await fetchBookOrders({ rpc }, "academy-1");
    expect(rpc).toHaveBeenCalledWith("list_book_orders", { p_academy_id: "academy-1" });
    expect(orders[0]).toMatchObject({ vendorName: "음악서점", ledgerMismatch: true, items: [{ purchasePrice: 5000 }] });
  });

  it("등록·수정·입고·지급·지급 취소·발주 취소를 각각 한 RPC로 요청한다", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const client = { rpc };
    await createBookOrder(client, input);
    await updateBookOrder(client, { ...input, orderId: "order-1" });
    await receiveBookOrder(client, {
      academyId: "academy-1", orderId: "order-1", receivedOn: "2026-10-17",
      salePrices: { "item-1": 10000 },
    });
    await payBookOrder(client, { academyId: "academy-1", orderId: "order-1", paidOn: "2026-10-16" });
    await undoBookOrderPayment(client, { academyId: "academy-1", orderId: "order-1", reason: "입금 오류" });
    await cancelBookOrder(client, { academyId: "academy-1", orderId: "order-1", reason: "발주 취소" });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "create_book_order", "update_book_order", "receive_book_order", "pay_book_order", "undo_book_order_payment", "cancel_book_order",
    ]);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_academy_id: "academy-1", p_items: [{ title: "새 교재", purchase_price: 5000 }] });
    expect(rpc.mock.calls[2][1]).toMatchObject({ p_sale_prices: { "item-1": 10000 } });
  });
});

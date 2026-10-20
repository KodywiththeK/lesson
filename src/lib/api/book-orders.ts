import type { BookOrder, BookOrderInput } from "@/domain/book-order";
import { fetchAllRows, type PagedSelectQuery } from "./paged-query";

export type BookOrderRpcRow = {
  id: string;
  academy_id: string;
  vendor_id: string | null;
  vendor_name: string;
  ordered_on: string;
  received_on: string | null;
  paid_on: string | null;
  paid_ledger_entry_id: string | null;
  ledger_mismatch: boolean;
  status: BookOrder["status"];
  items: Array<{
    id: string;
    book_id: string | null;
    title: string;
    quantity: number;
    purchase_price: number;
    sale_price: number | null;
  }>;
};

export type BookOrderRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: BookOrderRpcRow | null; error: Error | null }>;
};

export type BookOrderReadClient = {
  rpc(name: "list_book_orders", args: { p_academy_id: string }): PromiseLike<{ data: BookOrderRpcRow[] | null; error: Error | null }>;
};

export type BookOrderVendor = { id: string; name: string };

export const bookOrderQueryKey = (academyId: string) => ["academy", academyId, "book-orders"] as const;

export type BookOrderVendorReadClient = {
  from(table: "vendors"): { select(columns: string): PagedSelectQuery<BookOrderVendor> };
};

export function toBookOrder(row: BookOrderRpcRow): BookOrder {
  return {
    id: row.id,
    academyId: row.academy_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    orderedOn: row.ordered_on,
    receivedOn: row.received_on,
    paidOn: row.paid_on,
    paidLedgerEntryId: row.paid_ledger_entry_id,
    ledgerMismatch: row.ledger_mismatch,
    status: row.status,
    items: row.items.map((item) => ({
      id: item.id,
      bookId: item.book_id,
      title: item.title,
      quantity: item.quantity,
      purchasePrice: item.purchase_price,
      salePrice: item.sale_price,
    })),
  };
}

export async function fetchBookOrders(client: BookOrderReadClient, academyId: string): Promise<BookOrder[]> {
  const { data, error } = await client.rpc("list_book_orders", { p_academy_id: academyId });
  if (error) throw new Error(`교재 발주 목록을 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map(toBookOrder);
}

export async function fetchBookOrderVendors(client: BookOrderVendorReadClient, academyId: string) {
  return fetchAllRows("거래처를 불러오지 못했습니다", (from, to) =>
    client.from("vendors").select("id, name").eq("academy_id", academyId).order("name").order("id").range(from, to),
  );
}

async function mutateBookOrder(client: BookOrderRpcClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`교재 발주를 처리하지 못했습니다: ${error.message}`);
  if (!data) throw new Error("교재 발주 처리 결과를 받지 못했습니다. 목록을 새로고침해 주세요.");
  return toBookOrder(data);
}

function toOrderArgs(input: BookOrderInput & { academyId: string }) {
  return {
    p_academy_id: input.academyId,
    p_vendor_id: input.vendorId,
    p_ordered_on: input.orderedOn,
    p_items: input.items.map((item) => ({
      book_id: item.bookId,
      title: item.title,
      quantity: item.quantity,
      purchase_price: item.purchasePrice,
      sale_price: item.salePrice,
    })),
  };
}

export function createBookOrder(client: BookOrderRpcClient, input: BookOrderInput & { academyId: string }) {
  return mutateBookOrder(client, "create_book_order", toOrderArgs(input));
}

export function updateBookOrder(client: BookOrderRpcClient, input: BookOrderInput & { academyId: string; orderId: string }) {
  return mutateBookOrder(client, "update_book_order", { ...toOrderArgs(input), p_order_id: input.orderId });
}

export function receiveBookOrder(client: BookOrderRpcClient, input: {
  academyId: string;
  orderId: string;
  receivedOn: string;
  salePrices: Record<string, number>;
}) {
  return mutateBookOrder(client, "receive_book_order", {
    p_academy_id: input.academyId,
    p_order_id: input.orderId,
    p_received_on: input.receivedOn,
    p_sale_prices: input.salePrices,
  });
}

export function payBookOrder(client: BookOrderRpcClient, input: { academyId: string; orderId: string; paidOn: string }) {
  return mutateBookOrder(client, "pay_book_order", {
    p_academy_id: input.academyId, p_order_id: input.orderId, p_paid_on: input.paidOn,
  });
}

export function undoBookOrderPayment(client: BookOrderRpcClient, input: { academyId: string; orderId: string; reason: string }) {
  return mutateBookOrder(client, "undo_book_order_payment", {
    p_academy_id: input.academyId, p_order_id: input.orderId, p_reason: input.reason,
  });
}

export function cancelBookOrder(client: BookOrderRpcClient, input: { academyId: string; orderId: string; reason: string }) {
  return mutateBookOrder(client, "cancel_book_order", {
    p_academy_id: input.academyId, p_order_id: input.orderId, p_reason: input.reason,
  });
}

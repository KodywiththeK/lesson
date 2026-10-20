"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ListStatusAlert } from "@/components/management/list-controls";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getBookOrderActions, calculateBookOrderTotal, type BookOrder, type BookOrderInput } from "@/domain/book-order";
import type { BookStockRow } from "@/domain/book-stock";
import { fetchBookStockRows, type BookReadSupabaseClient } from "@/lib/api/books";
import {
  bookOrderQueryKey, cancelBookOrder, createBookOrder, fetchBookOrders,
  fetchBookOrderVendors, payBookOrder, receiveBookOrder, undoBookOrderPayment,
  updateBookOrder, type BookOrderReadClient, type BookOrderRpcClient,
  type BookOrderVendor, type BookOrderVendorReadClient,
} from "@/lib/api/book-orders";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { BookOrderActionDialog, type BookOrderAction } from "./book-order-action-dialog";
import { BookOrderFormDialog } from "./book-order-form-dialog";
import { formatWon } from "./book-format";

type BookOrderClient = BookOrderReadClient & BookOrderRpcClient & BookOrderVendorReadClient & BookReadSupabaseClient;

type Props = {
  academyId: string;
  canPay: boolean;
  demoReadOnly?: boolean;
  client?: BookOrderReadClient & BookOrderRpcClient;
  vendors?: BookOrderVendor[];
  books?: BookStockRow[];
};

export function BookOrderScreen({ academyId, canPay, demoReadOnly = false, client: providedClient, vendors, books }: Props) {
  const queryClient = useQueryClient();
  const clientState = useMemo(() => {
    if (demoReadOnly) return { client: null, error: null };
    if (providedClient) return { client: providedClient, error: null };
    try {
      return { client: createSupabaseBrowserClient() as unknown as BookOrderClient, error: null };
    } catch (error) {
      return { client: null, error };
    }
  }, [demoReadOnly, providedClient]);
  const client = clientState.client;
  const ordersQuery = useQuery({
    queryKey: bookOrderQueryKey(academyId),
    queryFn: () => demoReadOnly ? Promise.resolve([]) : fetchBookOrders(client!, academyId),
    enabled: demoReadOnly || Boolean(client),
  });
  const vendorsQuery = useQuery({
    queryKey: [...bookOrderQueryKey(academyId), "vendors"],
    queryFn: () => fetchBookOrderVendors(client as BookOrderClient, academyId),
    enabled: !demoReadOnly && Boolean(client) && vendors === undefined,
  });
  const booksQuery = useQuery({
    queryKey: [...bookOrderQueryKey(academyId), "books"],
    queryFn: () => fetchBookStockRows(client as BookOrderClient, academyId),
    enabled: !demoReadOnly && Boolean(client) && books === undefined,
  });
  const [formOrder, setFormOrder] = useState<BookOrder | null | "new">(null);
  const [action, setAction] = useState<{ order: BookOrder; kind: BookOrderAction } | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function saveOrder(input: BookOrderInput) {
    if (!client || pending) return;
    setPending(true);
    setActionError(null);
    try {
      if (formOrder && formOrder !== "new") {
        await updateBookOrder(client, { ...input, academyId, orderId: formOrder.id });
      } else {
        await createBookOrder(client, { ...input, academyId });
      }
      setFormOrder(null);
      await queryClient.invalidateQueries({ queryKey: bookOrderQueryKey(academyId) });
    } catch (error) {
      setActionError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function confirmAction(value: string, salePrices: Record<string, number> = {}) {
    if (!client || !action || pending) return;
    setPending(true);
    setActionError(null);
    const { order, kind } = action;
    try {
      if (kind === "receive") {
        await receiveBookOrder(client, { academyId, orderId: order.id, receivedOn: value, salePrices });
      } else if (kind === "pay") {
        await payBookOrder(client, { academyId, orderId: order.id, paidOn: value });
      } else if (kind === "undo-payment") {
        await undoBookOrderPayment(client, { academyId, orderId: order.id, reason: value });
      } else {
        await cancelBookOrder(client, { academyId, orderId: order.id, reason: value });
      }
      setAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bookOrderQueryKey(academyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.books.all(academyId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) }),
      ]);
    } catch (error) {
      setActionError(toUserMessage(error));
    } finally {
      setPending(false);
    }
  }

  const loadError = clientState.error ?? ordersQuery.error ?? vendorsQuery.error ?? booksQuery.error;
  const orders = ordersQuery.data ?? [];

  return (
    <section aria-label="교재 발주·입고" className="grid min-w-0 gap-4">
      <div className="flex items-center justify-end">
        <Button type="button" disabled={demoReadOnly} onClick={() => { setActionError(null); setFormOrder("new"); }}>
          <Plus aria-hidden="true" /> 발주 등록
        </Button>
      </div>
      {demoReadOnly ? <p className="text-sm text-muted-foreground">데모에서는 발주 내역을 조회만 할 수 있습니다.</p> : null}
      {loadError ? <ListStatusAlert message="교재 발주를 불러오지 못했습니다." detail={toUserMessage(loadError)} /> : null}
      {actionError ? <p role="alert" className="text-sm text-destructive">{actionError}</p> : null}
      {ordersQuery.isPending && client ? <p className="text-sm text-muted-foreground">발주 목록을 불러오는 중입니다.</p> : null}
      {ordersQuery.isSuccess && orders.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">발주 내역이 없습니다.</p> : null}
      {orders.length > 0 ? (
        <Table>
          <TableHeader><TableRow>
            <TableHead>발주일</TableHead><TableHead>거래처</TableHead><TableHead>품목</TableHead>
            <TableHead>매입액</TableHead><TableHead>입고</TableHead><TableHead>지급</TableHead><TableHead>관리</TableHead>
          </TableRow></TableHeader>
          <TableBody>{orders.map((order) => {
            const actions = getBookOrderActions(order);
            return (
              <TableRow key={order.id}>
                <TableCell label="발주일">{order.orderedOn}</TableCell>
                <TableCell label="거래처" className="font-medium">{order.vendorName}</TableCell>
                <TableCell label="품목" className="max-w-72 whitespace-normal">
                  {order.items.map((item) => `${item.title} ${item.quantity}권`).join(", ")}
                </TableCell>
                <TableCell label="매입액" className="tabular-nums">{formatWon(calculateBookOrderTotal(order.items))}</TableCell>
                <TableCell label="입고">{order.receivedOn ?? (order.status === "cancelled" ? "취소" : "미입고")}</TableCell>
                <TableCell label="지급">
                  {order.paidOn ?? "미지급"}
                  {order.ledgerMismatch ? <span className="block text-destructive">원장 불일치 · 입출금 내역을 정정해 주세요.</span> : null}
                </TableCell>
                <TableCell label="관리"><div className="flex flex-wrap gap-1">
                  {actions.canEdit ? <Button variant="outline" size="sm" onClick={() => { setActionError(null); setFormOrder(order); }}>수정</Button> : null}
                  {actions.canReceive ? <Button variant="outline" size="sm" aria-label={`${order.vendorName} 입고 확인`} onClick={() => { setActionError(null); setAction({ order, kind: "receive" }); }}>입고</Button> : null}
                  {actions.canPay && canPay ? <Button variant="outline" size="sm" aria-label={`${order.vendorName} 지급`} onClick={() => { setActionError(null); setAction({ order, kind: "pay" }); }}>지급</Button> : null}
                  {actions.canUndoPayment && canPay ? <Button variant="outline" size="sm" onClick={() => { setActionError(null); setAction({ order, kind: "undo-payment" }); }}>지급 취소</Button> : null}
                  {actions.canCancel && (!order.paidOn || canPay) ? <Button variant="outline" size="sm" onClick={() => { setActionError(null); setAction({ order, kind: "cancel" }); }}>발주 취소</Button> : null}
                </div></TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table>
      ) : null}
      {formOrder ? (
        <BookOrderFormDialog
          key={formOrder === "new" ? "new" : formOrder.id}
          open
          onOpenChange={(open) => { if (!open) setFormOrder(null); }}
          order={formOrder === "new" ? undefined : formOrder}
          vendors={vendors ?? vendorsQuery.data ?? []}
          books={books ?? booksQuery.data ?? []}
          isSubmitting={pending}
          errorMessage={actionError}
          onSubmit={saveOrder}
        />
      ) : null}
      {action ? (
        <BookOrderActionDialog
          key={`${action.order.id}:${action.kind}`}
          order={action.order}
          action={action.kind}
          pending={pending}
          errorMessage={actionError}
          onClose={() => setAction(null)}
          onConfirm={confirmAction}
        />
      ) : null}
    </section>
  );
}

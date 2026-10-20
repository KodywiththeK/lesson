import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { validateBookOrderInput, type BookOrder, type BookOrderInput } from "@/domain/book-order";
import type { BookStockRow } from "@/domain/book-stock";
import { getFinanceToday } from "@/domain/finance-date";
import { parseWonInput } from "@/domain/money-input";
import type { BookOrderVendor } from "@/lib/api/book-orders";

type FormItem = { key: number; bookId: string; title: string; quantity: string; purchasePrice: string };

function emptyItem(key: number): FormItem {
  return { key, bookId: "", title: "", quantity: "1", purchasePrice: "" };
}

function initialItems(order?: BookOrder): FormItem[] {
  return order?.items.map((item, index) => ({
    key: index,
    bookId: item.bookId ?? "",
    title: item.title,
    quantity: String(item.quantity),
    purchasePrice: String(item.purchasePrice),
  })) ?? [emptyItem(0)];
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: BookOrder;
  vendors: BookOrderVendor[];
  books: BookStockRow[];
  isSubmitting: boolean;
  errorMessage?: string | null;
  onSubmit: (input: BookOrderInput) => void;
};

export function BookOrderFormDialog({ open, onOpenChange, order, vendors, books, isSubmitting, errorMessage, onSubmit }: Props) {
  const [vendorId, setVendorId] = useState(order?.vendorId ?? "");
  const [orderedOn, setOrderedOn] = useState(order?.orderedOn ?? getFinanceToday());
  const [dateValid, setDateValid] = useState(true);
  const [items, setItems] = useState<FormItem[]>(() => initialItems(order));
  const [error, setError] = useState<string | null>(null);

  function changeItem(key: number, patch: Partial<FormItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!dateValid) {
      setError("발주일을 올바르게 입력해 주세요.");
      return;
    }
    const input: BookOrderInput = {
      vendorId,
      orderedOn,
      items: items.map((item) => ({
        bookId: item.bookId || null,
        title: item.title,
        quantity: Number(item.quantity),
        purchasePrice: parseWonInput(item.purchasePrice) ?? NaN,
        salePrice: null,
      })),
    };
    const message = validateBookOrderInput(input);
    if (message) {
      setError(message);
      return;
    }
    onSubmit(input);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (isSubmitting ? undefined : onOpenChange(next))}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "발주 수정" : "발주 등록"}</DialogTitle>
          <DialogDescription>거래처와 품목을 정하고, 실제 입고일과 지급일은 각각 확인합니다.</DialogDescription>
        </DialogHeader>
        <form aria-label={order ? "발주 수정 입력" : "발주 등록 입력"} className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="grid gap-1">
              <span>거래처</span>
              <NativeSelect aria-label="거래처" value={vendorId} onChange={(event) => setVendorId(event.target.value)}>
                <NativeSelectOption value="">거래처 선택</NativeSelectOption>
                {vendors.map((vendor) => <NativeSelectOption key={vendor.id} value={vendor.id}>{vendor.name}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1">
              <span>발주일</span>
              <DateField aria-label="발주일" value={orderedOn} onValueChange={setOrderedOn} onValidityChange={setDateValid} required />
            </Label>
          </div>

          <div className="grid gap-3">
            {items.map((item, index) => (
              <fieldset key={item.key} className="grid gap-3 border-t pt-3">
                <legend className="font-medium">품목 {index + 1}</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Label className="grid gap-1 sm:col-span-2">
                    <span>교재</span>
                    <NativeSelect
                      aria-label={`품목 ${index + 1} 교재 선택`}
                      value={item.bookId}
                      onChange={(event) => {
                        const book = books.find((candidate) => candidate.bookId === event.target.value);
                        changeItem(item.key, { bookId: book?.bookId ?? "", title: book?.title ?? "" });
                      }}
                    >
                      <NativeSelectOption value="">새 교재 직접 입력</NativeSelectOption>
                      {books.map((book) => <NativeSelectOption key={book.bookId} value={book.bookId}>{book.title}</NativeSelectOption>)}
                    </NativeSelect>
                  </Label>
                  {!item.bookId ? (
                    <Label className="grid gap-1 sm:col-span-2">
                      <span>새 도서명</span>
                      <Input value={item.title} onChange={(event) => changeItem(item.key, { title: event.target.value })} />
                    </Label>
                  ) : null}
                  <Label className="grid gap-1">
                    <span>수량</span>
                    <Input inputMode="numeric" value={item.quantity} onChange={(event) => changeItem(item.key, { quantity: event.target.value })} />
                  </Label>
                  <Label className="grid gap-1">
                    <span>매입가</span>
                    <Input inputMode="numeric" value={item.purchasePrice} onChange={(event) => changeItem(item.key, { purchasePrice: event.target.value })} />
                  </Label>
                </div>
                {items.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}>
                    <Trash2 aria-hidden="true" /> 품목 제거
                  </Button>
                ) : null}
              </fieldset>
            ))}
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => setItems((current) => [...current, emptyItem(Math.max(...current.map((item) => item.key)) + 1)])}>
              <Plus aria-hidden="true" /> 품목 추가
            </Button>
          </div>
          {error || errorMessage ? <p role="alert" className="text-sm text-destructive">{error ?? errorMessage}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>취소</Button>
            <Button type="submit" disabled={isSubmitting}>{order ? "수정" : "등록"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

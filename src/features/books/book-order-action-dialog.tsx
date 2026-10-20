import { useState } from "react";

import { DateField } from "@/components/operations/date-time-fields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateBookReceiptPrices, type BookOrder } from "@/domain/book-order";
import { getFinanceToday } from "@/domain/finance-date";
import { parseWonInput } from "@/domain/money-input";

export type BookOrderAction = "receive" | "pay" | "undo-payment" | "cancel";

const ACTION_LABELS: Record<BookOrderAction, string> = {
  receive: "전량 입고 확인",
  pay: "발주 지급",
  "undo-payment": "지급 취소",
  cancel: "발주 취소",
};

type Props = {
  order: BookOrder;
  action: BookOrderAction;
  pending: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onConfirm: (value: string, salePrices?: Record<string, number>) => void;
};

export function BookOrderActionDialog({ order, action, pending, errorMessage, onClose, onConfirm }: Props) {
  const [value, setValue] = useState(action === "receive" || action === "pay" ? getFinanceToday() : "");
  const [valid, setValid] = useState(true);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const isDateAction = action === "receive" || action === "pay";
  const fieldLabel = action === "receive" ? "입고일" : "지급일";
  const salePrices = Object.fromEntries(Object.entries(priceDrafts).map(([id, text]) => [id, parseWonInput(text) ?? NaN]));
  const priceError = action === "receive" ? validateBookReceiptPrices(order, salePrices) : null;
  const canConfirm = !pending && Boolean(value.trim()) && valid && !priceError;

  if (isDateAction) {
    return (
      <Dialog open onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{ACTION_LABELS[action]}</DialogTitle>
            <DialogDescription>{order.vendorName} 발주의 {action === "receive" ? "모든 품목을 재고에 반영합니다." : "매입액을 해당 지급일의 입출금 내역에 기록합니다."}</DialogDescription>
          </DialogHeader>
          <Label className="grid gap-1"><span>{fieldLabel}</span>
            <DateField aria-label={fieldLabel} value={value} onValueChange={setValue} onValidityChange={setValid} required />
          </Label>
          {action === "receive" ? order.items.filter((item) => !item.bookId).map((item) => (
            <Label key={item.id} className="grid gap-1">
              <span>{item.title} 판매가</span>
              <Input
                aria-label={`${item.title} 판매가`}
                inputMode="numeric"
                value={priceDrafts[item.id] ?? ""}
                onChange={(event) => setPriceDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
              />
            </Label>
          )) : null}
          {action === "receive" && priceError ? <p role="alert" className="text-sm text-destructive">{priceError}</p> : null}
          {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose} disabled={pending}>취소</Button>
            <Button type="button" onClick={() => onConfirm(value, salePrices)} disabled={!canConfirm}>확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AlertDialog open onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{ACTION_LABELS[action]}</AlertDialogTitle>
          <AlertDialogDescription>
            {action === "cancel"
              ? "입고한 재고와 연결된 지급 내역을 되돌립니다. 이미 판매된 교재가 있으면 취소할 수 없습니다."
              : "연결된 입출금 지출을 삭제하고 지급 상태를 되돌립니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Label className="grid gap-1"><span>취소 사유</span>
          <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="사유를 입력해 주세요" />
        </Label>
        {errorMessage ? <p role="alert" className="text-sm text-destructive">{errorMessage}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>닫기</AlertDialogCancel>
          <AlertDialogAction disabled={!canConfirm} onClick={(event) => { event.preventDefault(); onConfirm(value.trim()); }}>
            {ACTION_LABELS[action]}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

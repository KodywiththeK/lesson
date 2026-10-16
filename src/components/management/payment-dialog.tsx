"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getFinanceToday } from "@/domain/finance-date";

const DEFAULT_PAYMENT_DESCRIPTION = "확인하면 연결된 입출입내역이 자동으로 기록됩니다.";

export function PaymentDialog({
  confirmLabel = "확인",
  contextMonth,
  dateLabel,
  description = DEFAULT_PAYMENT_DESCRIPTION,
  onConfirm,
  open,
  pending = false,
  title,
  onOpenChange,
}: {
  confirmLabel?: string;
  /** 지금 보고 있는 월(`YYYY-MM`). 고른 날짜가 이 월 밖이면 어느 월 내역으로 기록되는지 안내한다. */
  contextMonth?: string;
  dateLabel: string;
  description?: string;
  onConfirm: (paidAt: string) => void;
  open: boolean;
  pending?: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <PaymentDateForm
          confirmLabel={confirmLabel}
          contextMonth={contextMonth}
          dateLabel={dateLabel}
          pending={pending}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** 다이얼로그가 열릴 때마다 새로 마운트되어 날짜가 항상 오늘로 시작한다. */
export function PaymentDateForm({
  confirmLabel,
  contextMonth,
  dateLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  confirmLabel: string;
  contextMonth?: string;
  dateLabel: string;
  pending: boolean;
  onConfirm: (paidAt: string) => void;
  onCancel: () => void;
}) {
  const [paidAt, setPaidAt] = useState(getFinanceToday);
  const isMissing = paidAt === "";
  const recordedMonth = paidAt.slice(0, 7);
  const showsOtherMonth = !isMissing && contextMonth !== undefined && recordedMonth !== contextMonth;

  return (
    <>
      <Label className="grid gap-1 text-sm font-medium">
        <span>{dateLabel}</span>
        <DateField aria-label={dateLabel} value={paidAt} onValueChange={setPaidAt} />
      </Label>
      {isMissing ? (
        <p role="alert" className="text-sm text-destructive">
          {dateLabel}을 입력해 주세요.
        </p>
      ) : null}
      {showsOtherMonth ? (
        <p className="text-sm text-muted-foreground">
          {dateLabel}이 속한 {Number(recordedMonth.slice(5))}월 입출입내역으로 기록됩니다.
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          취소
        </Button>
        <Button type="button" disabled={pending || isMissing} onClick={() => onConfirm(paidAt)}>
          {pending ? "처리 중" : confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/** 되돌리기 어렵거나 연결된 기록을 지우는 동작은 무엇이 일어나는지 알리고 한 번 더 확인받는다. */
export function FinanceConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  title,
}: {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending?: boolean;
  title: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {pending ? "처리 중" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

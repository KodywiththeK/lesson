"use client";

import { useId, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BookPaidRow } from "@/domain/book-sale";
import { BOOK_MESSAGES } from "@/domain/book-stock";

import { formatQuantity, formatWon } from "./book-format";

type BookPaidCancelDialogProps = {
  /** 결제 취소할 건. 없으면 닫혀 있다. */
  sale: BookPaidRow | null;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: (sale: BookPaidRow, reason: string) => void;
};

/** 결제 취소 확인. 취소 사유가 있어야 확인할 수 있고, 끝나기 전에는 닫히지 않으며 처리 중에는 중복 클릭을 막는다. */
export function BookPaidCancelDialog({ sale, isCancelling, onClose, onConfirm }: BookPaidCancelDialogProps) {
  return (
    <AlertDialog open={sale !== null} onOpenChange={(open) => (open || isCancelling ? undefined : onClose())}>
      {sale ? (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>결제를 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {sale.studentName}의 {sale.bookTitle} {formatQuantity(sale.quantity)}({formatWon(sale.amount)}) 결제를
              취소합니다. 연결된 입출입내역의 수입 기록이 삭제되고 출고 탭의 결제 대기로 돌아갑니다. 재고에는 영향이
              없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CancelReasonForm sale={sale} isCancelling={isCancelling} onConfirm={onConfirm} />
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

/** 취소 사유 입력은 다이얼로그가 열릴 때마다 비어 있는 상태로 시작한다. */
function CancelReasonForm({
  sale,
  isCancelling,
  onConfirm,
}: {
  sale: BookPaidRow;
  isCancelling: boolean;
  onConfirm: (sale: BookPaidRow, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const disabledReasonId = useId();
  const trimmedReason = reason.trim();
  const isReasonMissing = trimmedReason === "";

  return (
    <>
      <Label className="grid gap-1 text-sm font-medium">
        <span>취소 사유 (필수)</span>
        <Textarea aria-label="취소 사유" aria-required value={reason} onChange={(event) => setReason(event.target.value)} />
      </Label>
      {isReasonMissing ? (
        <p id={disabledReasonId} className="text-sm text-muted-foreground">
          {BOOK_MESSAGES.cancelReasonRequired}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isCancelling}>닫기</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={isCancelling || isReasonMissing}
          aria-describedby={isReasonMissing ? disabledReasonId : undefined}
          onClick={(event) => {
            // 취소가 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 대상을 비운다.
            event.preventDefault();
            onConfirm(sale, trimmedReason);
          }}
        >
          {isCancelling ? "처리 중" : "결제 취소"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

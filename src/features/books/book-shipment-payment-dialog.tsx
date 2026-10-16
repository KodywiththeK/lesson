"use client";

import { PaymentDialog, type PaymentDateNotice } from "@/components/management/payment-dialog";
import type { BookShipmentRow } from "@/domain/book-sale";
import { validatePaymentDate } from "@/domain/book-stock";

import { formatQuantity, formatWon } from "./book-format";

type BookShipmentPaymentDialogProps = {
  /** 결제 완료 처리할 출고. 없으면 닫혀 있다. */
  shipment: BookShipmentRow | null;
  isPending: boolean;
  onConfirm: (shipment: BookShipmentRow, paidAt: string) => void;
  onClose: () => void;
};

/** 입금일을 받아 결제 완료 처리한다. 입금일은 출고일 이후만 허용하고, 어느 달 내역에 반영되는지 알린다. */
export function BookShipmentPaymentDialog({ shipment, isPending, onConfirm, onClose }: BookShipmentPaymentDialogProps) {
  if (!shipment) {
    return null;
  }

  return (
    <PaymentDialog
      open
      title="결제 완료 처리"
      description={`${shipment.studentName}의 ${shipment.bookTitle} ${formatQuantity(shipment.quantity)}(${formatWon(shipment.amount)}) 입금일을 확인합니다. 입금일은 출고일(${shipment.shippedAt}) 이후만 고를 수 있습니다.`}
      dateLabel="입금일"
      confirmLabel="결제 완료 처리"
      pending={isPending}
      validateDate={(paidAt) => validatePaymentDate(paidAt, shipment.shippedAt)}
      describeDate={(paidAt) => describeRecordedMonth(paidAt, shipment.shippedAt)}
      onConfirm={(paidAt) => onConfirm(shipment, paidAt)}
      onOpenChange={(open) => (open ? undefined : onClose())}
    />
  );
}

/** 입금일이 출고일과 다른 달이면 어느 달 기록이 바뀌는지 놓치지 않도록 강조한다. */
function describeRecordedMonth(paidAt: string, shippedAt: string): PaymentDateNotice {
  const paidMonth = Number(paidAt.slice(5, 7));
  const message = `입금일이 속한 ${paidMonth}월의 입출입내역과 교재 내역에 반영됩니다.`;

  if (paidAt.slice(0, 7) === shippedAt.slice(0, 7)) {
    return { message };
  }

  return { message: `${message} 출고일(${Number(shippedAt.slice(5, 7))}월)과 다른 달입니다.`, emphasized: true };
}

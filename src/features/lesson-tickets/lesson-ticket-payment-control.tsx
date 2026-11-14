"use client";

import { useState } from "react";

import { FinanceConfirmDialog, PaymentDialog } from "@/components/management/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getLessonTicketPaymentActions,
  isLessonTicketPaymentPastDue,
  LESSON_TICKET_PAYMENT_ACTION_LABELS,
  LESSON_TICKET_PAYMENT_STATUS_LABELS,
  type LessonTicketPaymentAction,
  type LessonTicketPaymentStatus,
} from "@/domain/lesson-ticket-payment";
import { TUITION_PAYMENT_METHODS, type TuitionPaymentMethod } from "@/domain/tuition-income";

export type LessonTicketPaymentTarget = {
  ticketId: string;
  studentName: string;
  instrumentName: string;
  paymentStatus: LessonTicketPaymentStatus;
  dueOn: string;
  isService?: boolean;
  legacyMerged?: boolean;
  /** 입금 처리 다이얼로그에 보여 줄 결제 금액. 모르면(권한상 읽지 못함) 생략한다. */
  amount?: number;
  paymentMethod?: TuitionPaymentMethod;
};

export type LessonTicketPaymentActionInput = { paidOn?: string; paymentMethod?: TuitionPaymentMethod };

const STATUS_BADGE_VARIANTS: Record<LessonTicketPaymentStatus, "outline" | "warning" | "success" | "secondary"> = {
  registered: "outline",
  "payment-pending": "warning",
  paid: "success",
  refunded: "secondary",
  cancelled: "secondary",
};

/**
 * 회차권 입금 상태(등록·입금대기·입금완료·환불·취소)와 납입일, 전환 버튼.
 * 입금 처리는 입금일·결제 방식을 받고, 입금 취소는 확인을 거친다. 회차권 목록과 수입 관리가 같이 쓴다.
 */
export function LessonTicketPaymentControl({
  ticket,
  today,
  canManage,
  pending = false,
  onAction,
}: {
  ticket: LessonTicketPaymentTarget;
  today: string;
  canManage: boolean;
  pending?: boolean;
  onAction: (action: LessonTicketPaymentAction, input: LessonTicketPaymentActionInput) => Promise<void> | void;
}) {
  const [openDialog, setOpenDialog] = useState<"mark-paid" | "cancel-payment" | null>(null);
  const actions = canManage ? getLessonTicketPaymentActions(ticket) : [];
  const label = `${ticket.studentName} ${ticket.instrumentName}`;

  async function run(action: LessonTicketPaymentAction, input: LessonTicketPaymentActionInput = {}) {
    try {
      await onAction(action, input);
      setOpenDialog(null);
    } catch {
      // 실패 안내는 부른 쪽이 한다. 다이얼로그를 열어 둬서 다시 시도할 수 있게 한다.
    }
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant={STATUS_BADGE_VARIANTS[ticket.paymentStatus]}>
          {LESSON_TICKET_PAYMENT_STATUS_LABELS[ticket.paymentStatus]}
        </Badge>
        {isLessonTicketPaymentPastDue(ticket, today) ? <Badge variant="warning">납입일 경과</Badge> : null}
      </div>
      <span className="text-xs text-muted-foreground">{`납입일 ${ticket.dueOn}`}</span>
      {ticket.paymentStatus === "paid" && ticket.paymentMethod ? (
        <span className="text-xs text-muted-foreground">
          {TUITION_PAYMENT_METHODS.find((method) => method.value === ticket.paymentMethod)?.label}
        </span>
      ) : null}
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {actions.map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === "cancel-payment" ? "outline" : "default"}
              disabled={pending}
              aria-label={`${label} ${LESSON_TICKET_PAYMENT_ACTION_LABELS[action]}`}
              onClick={() => (action === "start-payment-wait" ? void run(action) : setOpenDialog(action))}
            >
              {LESSON_TICKET_PAYMENT_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      ) : null}
      <PaymentDialog
        requirePaymentMethod
        open={openDialog === "mark-paid"}
        title="회차권 입금 처리"
        description={`${label}${ticket.amount !== undefined ? ` · ${ticket.amount.toLocaleString("ko-KR")}원` : ""}. 확인하면 입출입내역에 수입이 기록되고 입금완료가 됩니다.`}
        dateLabel="입금일"
        pending={pending}
        onConfirm={(paidOn, paymentMethod) => void run("mark-paid", { paidOn, paymentMethod })}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      />
      <FinanceConfirmDialog
        open={openDialog === "cancel-payment"}
        title="회차권 입금을 취소할까요?"
        description="연결된 입출입내역 1건이 삭제되고 입금대기로 돌아갑니다. 사용 이력은 그대로입니다."
        confirmLabel="입금 취소"
        pending={pending}
        onConfirm={() => void run("cancel-payment")}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      />
    </div>
  );
}

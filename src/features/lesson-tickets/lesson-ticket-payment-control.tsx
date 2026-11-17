"use client";

import { useState } from "react";

import { FinanceConfirmDialog, PaymentDialog } from "@/components/management/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CardFeeChoice, CardFeeRate } from "@/domain/card-fee";
import {
  canChangeLessonTicketDueOn,
  getLessonTicketPaymentActions,
  isLessonTicketPaymentPastDue,
  LESSON_TICKET_PAYMENT_ACTION_LABELS,
  LESSON_TICKET_PAYMENT_STATUS_LABELS,
  type LessonTicketPaymentChangeAction,
  type LessonTicketPaymentStatus,
} from "@/domain/lesson-ticket-payment";
import { TUITION_PAYMENT_METHODS, type TuitionPaymentMethod } from "@/domain/tuition-income";

export type LessonTicketPaymentTarget = {
  ticketId: string;
  studentName: string;
  instrumentName: string;
  paymentStatus: LessonTicketPaymentStatus;
  /** 납입일. 등록 때 '나중에 입력'을 고르면 null(미정)이다. */
  dueOn: string | null;
  isService?: boolean;
  legacyMerged?: boolean;
  /** 입금 처리 다이얼로그에 보여 줄 결제 금액. 모르면(권한상 읽지 못함) 생략한다. */
  amount?: number;
  paymentMethod?: TuitionPaymentMethod;
};

export type LessonTicketPaymentActionInput = {
  paidOn?: string;
  paymentMethod?: TuitionPaymentMethod;
  cardFee?: CardFeeChoice;
  dueOn?: string;
};

const STATUS_BADGE_VARIANTS: Record<LessonTicketPaymentStatus, "outline" | "warning" | "success" | "secondary"> = {
  registered: "outline",
  "payment-pending": "warning",
  paid: "success",
  refunded: "secondary",
  cancelled: "secondary",
};

/**
 * 회차권 입금 상태(등록·입금대기·입금완료·환불·취소)와 납입일, 전환 버튼.
 * 입금 처리는 입금일·결제 방식(카드면 카드사·수수료)을 받고, 입금 취소는 확인을 거친다.
 * 입금 전에는 납입일을 입력·수정한다. 회차권 목록과 수입 관리가 같이 쓴다.
 */
export function LessonTicketPaymentControl({
  ticket,
  today,
  canManage,
  cardFeeRates,
  cardFeeRatesUnavailable,
  pending = false,
  onAction,
}: {
  ticket: LessonTicketPaymentTarget;
  today: string;
  canManage: boolean;
  /** 카드 입금 때 고를 카드사. 없으면 카드 입금도 수입만 기록한다. */
  cardFeeRates?: CardFeeRate[];
  /** 카드사 목록을 읽는 중이거나 읽지 못했다. 카드 입금을 막는다. */
  cardFeeRatesUnavailable?: boolean;
  pending?: boolean;
  onAction: (action: LessonTicketPaymentChangeAction, input: LessonTicketPaymentActionInput) => Promise<void> | void;
}) {
  const [openDialog, setOpenDialog] = useState<"mark-paid" | "cancel-payment" | "set-due-on" | null>(null);
  const actions = canManage ? getLessonTicketPaymentActions(ticket) : [];
  const canChangeDueOn = canManage && canChangeLessonTicketDueOn(ticket.paymentStatus);
  const dueOnActionLabel = ticket.dueOn === null ? "납입일 입력" : "납입일 수정";
  const label = `${ticket.studentName} ${ticket.instrumentName}`;

  async function run(action: LessonTicketPaymentChangeAction, input: LessonTicketPaymentActionInput = {}) {
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
      <span className="text-xs text-muted-foreground">{ticket.dueOn === null ? "납입일 미정" : `납입일 ${ticket.dueOn}`}</span>
      {ticket.paymentStatus === "paid" && ticket.paymentMethod ? (
        <span className="text-xs text-muted-foreground">
          {TUITION_PAYMENT_METHODS.find((method) => method.value === ticket.paymentMethod)?.label}
        </span>
      ) : null}
      {actions.length > 0 || canChangeDueOn ? (
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
          {canChangeDueOn ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              aria-label={`${label} ${dueOnActionLabel}`}
              onClick={() => setOpenDialog("set-due-on")}
            >
              {dueOnActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      <PaymentDialog
        requirePaymentMethod
        open={openDialog === "mark-paid"}
        title="회차권 입금 처리"
        description={`${label}${ticket.amount !== undefined ? ` · ${ticket.amount.toLocaleString("ko-KR")}원` : ""}. 확인하면 입출입내역에 수입이 기록되고 입금완료가 됩니다.`}
        dateLabel="입금일"
        amount={ticket.amount}
        cardFeeRates={cardFeeRates}
        cardFeeRatesUnavailable={cardFeeRatesUnavailable}
        pending={pending}
        onConfirm={(paidOn, paymentMethod, cardFee) => void run("mark-paid", { paidOn, paymentMethod, cardFee })}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      />
      <PaymentDialog
        open={openDialog === "set-due-on"}
        title={`회차권 ${dueOnActionLabel}`}
        description={`${label}. 입금 전 회차권의 납입일을 정합니다.`}
        dateLabel="납입일"
        initialDate={ticket.dueOn ?? undefined}
        confirmLabel="저장"
        pending={pending}
        onConfirm={(dueOn) => void run("set-due-on", { dueOn })}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      />
      <FinanceConfirmDialog
        open={openDialog === "cancel-payment"}
        title="회차권 입금을 취소할까요?"
        description="연결된 입출입내역(카드 수수료 포함)이 삭제되고 입금대기로 돌아갑니다. 사용 이력은 그대로입니다."
        confirmLabel="입금 취소"
        pending={pending}
        onConfirm={() => void run("cancel-payment")}
        onOpenChange={(open) => !open && setOpenDialog(null)}
      />
    </div>
  );
}

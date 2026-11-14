/**
 * 회차권 입금 상태(2026-11-14). 등록 → 입금대기 → 입금완료 순서로 버튼으로만 바꾼다.
 * 등록은 접수만 한 상태라 예약·출석에 쓸 수 없고, 입금대기부터 쓸 수 있다.
 * 환불·취소는 끝난 상태다. 소진·만료는 저장하지 않고 잔여·만료일로 계산한다(`lesson-ticket.ts`).
 * 서버 RPC(`supabase/migrations/20261114000300_lesson_ticket_payment_status.sql`)와 같은 규칙이다.
 */
export type LessonTicketPaymentStatus = "registered" | "payment-pending" | "paid" | "refunded" | "cancelled";

export type LessonTicketPaymentAction = "start-payment-wait" | "mark-paid" | "cancel-payment";

export const LESSON_TICKET_PAYMENT_STATUS_LABELS: Record<LessonTicketPaymentStatus, string> = {
  registered: "등록",
  "payment-pending": "입금대기",
  paid: "입금완료",
  refunded: "환불",
  cancelled: "취소",
};

export const LESSON_TICKET_PAYMENT_ACTION_LABELS: Record<LessonTicketPaymentAction, string> = {
  "start-payment-wait": "입금대기로 전환",
  "mark-paid": "입금 처리",
  "cancel-payment": "입금 취소",
};

export function isLessonTicketUsable(status: LessonTicketPaymentStatus) {
  return status === "payment-pending" || status === "paid";
}

/** 환불·취소로 끝난 회차권. 다시 쓰지 않고 사용취소 이력으로만 본다. */
export function isLessonTicketClosed(status: LessonTicketPaymentStatus) {
  return status === "refunded" || status === "cancelled";
}

export function getLessonTicketPaymentActions(ticket: {
  paymentStatus: LessonTicketPaymentStatus;
  isService?: boolean;
  /** 여러 유료 구매가 한 권에 합쳐진 이전 회차권. 입금 취소가 어느 구매분인지 정할 수 없어 막는다. */
  legacyMerged?: boolean;
}): LessonTicketPaymentAction[] {
  if (ticket.paymentStatus === "registered") return ["start-payment-wait"];
  if (ticket.paymentStatus === "payment-pending") return ["mark-paid"];
  if (ticket.paymentStatus === "paid" && !ticket.isService && !ticket.legacyMerged) return ["cancel-payment"];

  return [];
}

/** 입금 전(등록·입금대기)인데 납입일이 지났는지. 화면에서만 계산하는 표시이고 상태는 바꾸지 않는다. */
export function isLessonTicketPaymentPastDue(
  ticket: { paymentStatus: LessonTicketPaymentStatus; dueOn: string },
  today: string,
) {
  return (ticket.paymentStatus === "registered" || ticket.paymentStatus === "payment-pending") && ticket.dueOn < today;
}

export function resolveLessonTicketDueOn(input: { registeredAt: string; dueOn: string; sameAsRegistered: boolean }) {
  return input.sameAsRegistered ? input.registeredAt : input.dueOn;
}

import type { LedgerEntry } from "./book-sale";
import type { LessonTicketListItem } from "./lesson-ticket";
import { isLessonTicketClosed, type LessonTicketPaymentStatus } from "./lesson-ticket-payment";
import type { TuitionPaymentMethod } from "./tuition-income";

export type LessonTicketIncomeRegistration = {
  registrationId: string;
  academyId: string;
  ticketId: string;
  registeredAt: string;
  grantedCount: number;
  validUntil: string;
  originalPaidAmount: number;
  ledgerEntryId: string | null;
};

export type PrivateLessonIncomeRow = {
  id: string;
  ticketId: string;
  studentId: string;
  source: "lesson-ticket";
  studentName: string;
  lessonKindLabel: "개인레슨 회차권";
  instrumentName: string;
  progress: string;
  lessonFee: number;
  discountTotal: 0;
  finalAmount: number;
  /** 입금 전(등록·입금대기)이면 그 상태, 입금완료면 원장 확인 결과(입금 완료·0원·원장 기록 없음). */
  status: "registered" | "payment-pending" | "paid" | "zero-amount" | "missing-ledger";
  paymentStatus: LessonTicketPaymentStatus;
  dueOn: string;
  paymentMethod?: TuitionPaymentMethod;
  legacyMerged?: boolean;
};

export function buildPrivateLessonIncomeRows(
  registrations: LessonTicketIncomeRegistration[],
  tickets: LessonTicketListItem[],
  ledgerEntries: LedgerEntry[],
  academyId: string,
  month: string,
  /** YYYY-MM. 입금 전 회차권을 납입일 달부터 이 달까지 이월해 보여 준다. */
  currentMonth: string,
): PrivateLessonIncomeRow[] {
  const ticketsById = new Map(
    tickets.filter((ticket) => ticket.academyId === academyId)
      .map((ticket) => [ticket.ticketId, ticket]),
  );
  const ledgerById = new Map(
    ledgerEntries.filter((entry) => entry.academyId === academyId)
      .map((entry) => [entry.ledgerId, entry]),
  );

  return registrations.flatMap((registration): PrivateLessonIncomeRow[] => {
    if (registration.academyId !== academyId) return [];

    const ticket = ticketsById.get(registration.ticketId);
    if (!ticket) return [];

    const paymentStatus = ticket.paymentStatus ?? "paid";
    // 환불·취소된 회차권은 행을 만들지 않는다. 환불 후 남은 수입은 입출입내역에서 본다.
    if (isLessonTicketClosed(paymentStatus)) return [];
    const dueOn = ticket.dueOn ?? ticket.registeredAt;
    const base = {
      id: `ticket:${registration.registrationId}`,
      ticketId: registration.ticketId,
      studentId: ticket.studentId,
      source: "lesson-ticket" as const,
      studentName: ticket.studentName,
      lessonKindLabel: "개인레슨 회차권" as const,
      instrumentName: ticket.instrumentName,
      progress: "회차권",
      discountTotal: 0 as const,
      paymentStatus,
      dueOn,
      ...(ticket.paymentMethod ? { paymentMethod: ticket.paymentMethod } : {}),
      ...(ticket.legacyMerged ? { legacyMerged: true } : {}),
    };

    // 입금 전 회차권은 아직 원장이 없어 납입일이 속한 달에 청구 금액으로 보여 주고,
    // 입금될 때까지 이번 달까지 매달 이월해 보여 준다.
    if (paymentStatus === "registered" || paymentStatus === "payment-pending") {
      const dueMonth = dueOn.slice(0, 7);
      const isDueMonth = dueMonth === month;
      const isCarriedOver = dueMonth < month && month <= currentMonth;
      if (!isDueMonth && !isCarriedOver) return [];

      return [{
        ...base,
        lessonFee: registration.originalPaidAmount,
        finalAmount: registration.originalPaidAmount,
        status: paymentStatus,
      }];
    }

    const linkedLedger = registration.ledgerEntryId
      ? ledgerById.get(registration.ledgerEntryId)
      : undefined;
    const incomeLedger = linkedLedger?.type === "income" &&
      linkedLedger.source === "lesson-ticket" &&
      linkedLedger.refId === registration.ticketId
      ? linkedLedger
      : undefined;
    const occurredOn = incomeLedger?.occurredOn ?? registration.registeredAt;
    if (!occurredOn.startsWith(month)) return [];

    let status: PrivateLessonIncomeRow["status"] = "missing-ledger";
    if (incomeLedger) status = "paid";
    else if (registration.originalPaidAmount === 0) status = "zero-amount";

    const amount = incomeLedger?.amount ?? 0;
    return [{ ...base, lessonFee: amount, finalAmount: amount, status }];
  });
}

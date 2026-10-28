import {
  allocateLessonTicketRefund,
  canDeleteLessonTicketAsMistake,
  quoteLessonTicketRefund,
  type LessonTicketRefundPolicy,
} from "@/domain/lesson-ticket-refund";
import type { DeleteLessonTicketMode, DeleteLessonTicketResult, LessonTicketRefundPreview } from "@/lib/api/lesson-tickets";

import type { DemoAcademyState } from "./academy-demo-state";

/**
 * 회차권 삭제·환불 규정 데모 상태 전이. 서버 RPC(`supabase/migrations/20261021090400_lesson_ticket_delete_refund.sql`)와
 * 같은 규칙을 순수 도메인 함수(`lesson-ticket-refund.ts`)로 옮겼다.
 */

const NOT_FOUND_MESSAGE = "이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.";
const USED_TICKET_MISTAKE_MESSAGE = "사용한 회차권은 잘못 등록으로 삭제할 수 없습니다. 환불 처리로 삭제해 주세요.";

export function setDemoLessonTicketRefundPolicy(
  state: DemoAcademyState,
  policy: LessonTicketRefundPolicy,
): DemoAcademyState {
  return { ...state, lessonTicketRefundPolicy: policy };
}

function getTicket(state: DemoAcademyState, ticketId: string) {
  const ticket = state.tickets.find((candidate) => candidate.ticketId === ticketId);

  if (!ticket) {
    throw new Error(NOT_FOUND_MESSAGE);
  }

  return ticket;
}

function hasUsageRecords(state: DemoAcademyState, ticket: { studentId: string; instrumentId: string }) {
  return state.ticketUsages.some(
    (usage) => usage.studentId === ticket.studentId && usage.instrumentId === ticket.instrumentId,
  );
}

export function getDemoLessonTicketRefundPreview(state: DemoAcademyState, ticketId: string): LessonTicketRefundPreview {
  const ticket = getTicket(state, ticketId);
  const registrations = state.ticketRegistrations.filter((registration) => registration.ticketId === ticketId);
  const quote = quoteLessonTicketRefund({
    policy: state.lessonTicketRefundPolicy,
    totalGrantedCount: ticket.totalGrantedCount,
    remainingCount: ticket.remainingCount,
    paidAmounts: registrations.map((registration) => registration.originalPaidAmount),
  });

  return {
    ...quote,
    canDeleteAsMistake: canDeleteLessonTicketAsMistake({
      totalGrantedCount: ticket.totalGrantedCount,
      remainingCount: ticket.remainingCount,
      hasUsageRecords: hasUsageRecords(state, ticket),
    }),
  };
}

export function deleteDemoLessonTicket(
  state: DemoAcademyState,
  input: { ticketId: string; mode: DeleteLessonTicketMode },
): { state: DemoAcademyState; result: DeleteLessonTicketResult } {
  const preview = getDemoLessonTicketRefundPreview(state, input.ticketId);
  const ticket = getTicket(state, input.ticketId);
  const registrations = state.ticketRegistrations.filter((registration) => registration.ticketId === input.ticketId);
  const withoutTicket: DemoAcademyState = {
    ...state,
    tickets: state.tickets.filter((ticket) => ticket.ticketId !== input.ticketId),
    ticketCancellationHistory: [...state.ticketCancellationHistory, {
      id: `${input.ticketId}-${state.ticketCancellationHistory.length}`, mode: input.mode,
      student_name: ticket.studentName, instrument_name: ticket.instrumentName,
      total_count: ticket.totalGrantedCount, remaining_count: ticket.remainingCount,
      registered_at: ticket.registeredAt, valid_until: ticket.validUntil,
      refund_amount: input.mode === "refund" ? preview.refundAmount : 0, occurred_at: new Date().toISOString(),
    }],
    ticketRegistrations: state.ticketRegistrations.filter((registration) => registration.ticketId !== input.ticketId),
  };

  if (input.mode === "mistake") {
    if (!preview.canDeleteAsMistake) {
      throw new Error(USED_TICKET_MISTAKE_MESSAGE);
    }

    const linkedLedgerIds = new Set(registrations.flatMap((registration) => registration.ledgerEntryId ?? []));

    return {
      state: {
        ...withoutTicket,
        ledgerEntries: state.ledgerEntries.filter((entry) => !linkedLedgerIds.has(entry.ledgerId)),
      },
      result: { mode: "mistake", refunded: false, refundAmount: 0 },
    };
  }

  const refundAmount = preview.refundAmount;
  // 수입 행은 등록 이력의 ledgerEntryId로 찾는다(서버와 같다). 연결된 수입 행이 없는 등록은 감액할 대상이 없다.
  const remainingByLedgerId = new Map(
    allocateLessonTicketRefund(
      registrations.flatMap((registration) =>
        registration.ledgerEntryId
          ? [{ registrationId: registration.ledgerEntryId, paidAmount: registration.originalPaidAmount }]
          : [],
      ),
      refundAmount,
    ).map((allocation) => [allocation.registrationId, allocation.remainingAmount] as const),
  );

  return {
    state: {
      ...withoutTicket,
      ledgerEntries: state.ledgerEntries.flatMap((entry) => {
        const remaining = remainingByLedgerId.get(entry.ledgerId);

        if (remaining === undefined) return [entry];
        if (remaining === 0) return [];

        return [{ ...entry, amount: remaining }];
      }),
    },
    result: { mode: "refund", refunded: refundAmount > 0, refundAmount },
  };
}

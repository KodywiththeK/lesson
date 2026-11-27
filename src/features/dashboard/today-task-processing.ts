import type { BookOrder } from "@/domain/book-order";
import type { CardFeeChoice, CardFeeRate } from "@/domain/card-fee";
import type { TuitionPaymentMethod } from "@/domain/tuition-income";
import { receiveBookOrder, fetchBookOrders } from "@/lib/api/book-orders";
import { fetchCardFeeRates } from "@/lib/api/card-fee-rates";
import { markMonthlyTuitionAsPaid } from "@/lib/api/finance-management";
import {
  applyLessonTicketPaymentChange,
  fetchLessonTicketRegistrationOptions,
  registerLessonTicket,
  type LessonTicketPaymentChangeInput,
  type LessonTicketRegistrationStudentOption,
  type RegisterLessonTicketInput,
} from "@/lib/api/lesson-tickets";
import {
  fetchPreparedAttendeeCounts,
  resolveAcademyLessonAbsence,
  type ResolveAcademyLessonAbsenceInput,
} from "@/lib/api/lesson-workspace";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type WithoutAcademy<T> = Omit<T, "academyId">;

/**
 * 오늘 할 일 모달에서 바로 하는 처리. 각 화면이 쓰는 API를 그대로 부르며, 테스트·데모는 이 모양으로 바꿔 끼운다.
 * 권한은 서버 RPC가 다시 확인한다.
 */
export type TodayTaskProcessing = {
  loadCardFeeRates: () => Promise<CardFeeRate[]>;
  markTuitionPaid: (input: {
    snapshotId: string;
    paidAt: string;
    paymentMethod: TuitionPaymentMethod;
    cardFee?: CardFeeChoice;
  }) => Promise<void>;
  changeTicketPayment: (input: WithoutAcademy<LessonTicketPaymentChangeInput>) => Promise<void>;
  loadBookOrder: (orderId: string) => Promise<BookOrder | null>;
  receiveBookOrder: (input: { orderId: string; receivedOn: string; salePrices: Record<string, number> }) => Promise<void>;
  loadTicketRegistrationOptions: () => Promise<LessonTicketRegistrationStudentOption[]>;
  registerLessonTicket: (input: RegisterLessonTicketInput) => Promise<void>;
  /** 그 달의 날짜별 등원 인원. 공휴일 자료가 준비되지 않았으면 실패한다(보강 추천 없이 직접 입력). */
  loadAttendeeCounts: (month: string) => Promise<Record<string, number>>;
  resolveAbsence: (input: WithoutAcademy<ResolveAcademyLessonAbsenceInput>) => Promise<void>;
};

/** 각 API는 필요한 메서드만 좁힌 클라이언트 타입을 받는다. 브라우저 클라이언트를 그 API의 첫 인자 타입으로 넘긴다. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientFor<Api extends (client: any, ...args: any[]) => unknown>() {
  return createSupabaseBrowserClient() as unknown as Parameters<Api>[0];
}

export function createSupabaseTaskProcessing(academyId: string): TodayTaskProcessing {

  return {
    loadCardFeeRates: () => fetchCardFeeRates(clientFor<typeof fetchCardFeeRates>(), academyId),
    markTuitionPaid: async ({ snapshotId, ...input }) => {
      await markMonthlyTuitionAsPaid(clientFor<typeof markMonthlyTuitionAsPaid>(), { academyId, tuitionId: snapshotId, ...input });
    },
    changeTicketPayment: (input) => applyLessonTicketPaymentChange(clientFor<typeof applyLessonTicketPaymentChange>(), { academyId, ...input }),
    loadBookOrder: async (orderId) =>
      (await fetchBookOrders(clientFor<typeof fetchBookOrders>(), academyId)).find((order) => order.id === orderId) ?? null,
    receiveBookOrder: async (input) => {
      await receiveBookOrder(clientFor<typeof receiveBookOrder>(), { academyId, ...input });
    },
    loadTicketRegistrationOptions: () => fetchLessonTicketRegistrationOptions(clientFor<typeof fetchLessonTicketRegistrationOptions>(), academyId),
    registerLessonTicket: async (input) => {
      await registerLessonTicket(clientFor<typeof registerLessonTicket>(), input);
    },
    loadAttendeeCounts: (month) =>
      fetchPreparedAttendeeCounts(clientFor<typeof fetchPreparedAttendeeCounts>(), { academyId, month }),
    resolveAbsence: async (input) => {
      await resolveAcademyLessonAbsence(clientFor<typeof resolveAcademyLessonAbsence>(), { academyId, ...input });
    },
  };
}

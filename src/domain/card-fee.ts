/**
 * 카드 수수료(2026-11-17). 카드 매출은 카드사가 수수료를 떼고 입금하므로, 카드로 입금 처리할 때
 * 수입(전액)과 함께 카드사별 수수료율로 계산한 '카드 수수료' 출금을 입출입내역에 같이 기록한다.
 * 서버 규칙(`supabase/migrations/20261117000000_card_fee.sql`의 `private.record_card_fee`)과 같다.
 */
import { parseWonInput } from "./money-input";
import type { TuitionPaymentMethod } from "./tuition-income";

export type CardFeeRate = { id: string; name: string; ratePercent: number };

/** 입금 창에서 고른 카드사와 수수료. 금액을 비우면 서버가 수수료율로 계산한다. */
export type CardFeeChoice = { rateId: string; amount?: number };

export const CARD_FEE_RATE_MAX_PERCENT = 10;
export const CARD_FEE_NAME_MAX_LENGTH = 30;
const RATE_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;

/** 결제 금액 × 수수료율을 원 단위로 반올림한다. 소수 오차를 피하려고 율을 만분율 정수로 바꿔 계산한다. */
export function calculateCardFee(amount: number, ratePercent: number) {
  const basisPoints = Math.round(ratePercent * 100);

  return Math.round((amount * basisPoints) / 10_000);
}

/** 카드 결제이고 고를 카드사가 있으면 카드사 선택이 필요하다. 카드사가 없으면 지금처럼 수입만 기록한다. */
export function needsCardFeeChoice(paymentMethod: TuitionPaymentMethod | undefined, rateCount: number) {
  return paymentMethod === "card" && rateCount > 0;
}

/** 수수료 금액은 0원부터 결제 금액까지의 정수다(서버와 같은 범위). */
export function getCardFeeAmountRangeError(amount: number | null, paidAmount: number) {
  return amount !== null && Number.isInteger(amount) && amount >= 0 && amount <= paidAmount
    ? null
    : "카드 수수료는 0원부터 결제 금액까지 입력할 수 있습니다.";
}

/** 입금 창의 수수료 입력. 다른 금액 입력과 같이 쉼표 세 자리 단위를 허용한다. */
export function parseCardFeeDraft(draft: string) {
  return parseWonInput(draft);
}

export function getCardFeeAmountError(draft: string, paidAmount: number) {
  if (draft.trim() === "") return "카드 수수료를 입력해 주세요.";

  return getCardFeeAmountRangeError(parseCardFeeDraft(draft), paidAmount);
}

export function getCardFeeRateFormError(values: { name: string; ratePercent: string }) {
  const name = values.name.trim();
  if (name.length < 1 || name.length > CARD_FEE_NAME_MAX_LENGTH) return "카드사 이름을 1~30자로 입력해 주세요.";
  const rate = values.ratePercent.trim();

  return RATE_PATTERN.test(rate) && Number(rate) <= CARD_FEE_RATE_MAX_PERCENT
    ? null
    : "수수료율은 0~10%, 소수점 둘째 자리까지 입력해 주세요.";
}

/**
 * 수입 행 금액이 바뀐 뒤 붙은 카드 수수료를 같은 비율로 맞춘다. 수입이 지워졌거나 수수료가 0원이 되면 지운다.
 * 서버 트리거(`private.scale_card_fee_with_income`)와 같은 규칙이고, 데모 상태에서 쓴다.
 */
export function syncCardFeesWithIncome<T extends { ledgerId: string; amount: number; feeForEntryId?: string }>(
  before: readonly T[],
  after: readonly T[],
): T[] {
  const beforeAmounts = new Map(before.map((entry) => [entry.ledgerId, entry.amount]));
  const afterAmounts = new Map(after.map((entry) => [entry.ledgerId, entry.amount]));

  return after.flatMap((entry) => {
    if (!entry.feeForEntryId) return [entry];
    const oldIncome = beforeAmounts.get(entry.feeForEntryId);
    const newIncome = afterAmounts.get(entry.feeForEntryId);
    if (newIncome === undefined) return [];
    if (oldIncome === undefined || oldIncome === newIncome) return [entry];
    const amount = Math.round((entry.amount * newIncome) / oldIncome);

    return amount === 0 ? [] : [{ ...entry, amount }];
  });
}

export function formatCardFeeRate(ratePercent: number) {
  return `${Number(ratePercent.toFixed(2))}%`;
}

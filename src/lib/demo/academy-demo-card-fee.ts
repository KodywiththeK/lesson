import { getCardFeeRateFormError, type CardFeeRate } from "@/domain/card-fee";

import type { DemoAcademyState } from "./academy-demo-state";

/** 카드사 수수료율 저장. 서버 RPC(`save_card_fee_rate`)와 같은 검증을 한다. 새 카드사는 newId로 만든다. */
export function saveDemoCardFeeRate(
  state: DemoAcademyState,
  input: { id?: string; name: string; ratePercent: number },
  newId: string,
): { state: DemoAcademyState; rate: CardFeeRate } {
  const error = getCardFeeRateFormError({ name: input.name, ratePercent: String(input.ratePercent) });
  if (error) throw new Error(error);
  const name = input.name.trim();
  if (state.cardFeeRates.some((rate) => rate.id !== input.id && rate.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("같은 이름의 카드사가 이미 있습니다.");
  }
  if (input.id && !state.cardFeeRates.some((rate) => rate.id === input.id)) {
    throw new Error("수정할 카드사를 찾지 못했습니다.");
  }
  const rate: CardFeeRate = { id: input.id ?? newId, name, ratePercent: input.ratePercent };
  const cardFeeRates = input.id
    ? state.cardFeeRates.map((candidate) => (candidate.id === input.id ? rate : candidate))
    : [...state.cardFeeRates, rate];

  return { state: { ...state, cardFeeRates }, rate };
}

/** 보관하면 새 입금에서 고르지 못한다. 이미 기록한 수수료 행은 그대로 둔다. */
export function archiveDemoCardFeeRate(state: DemoAcademyState, id: string): DemoAcademyState {
  if (!state.cardFeeRates.some((rate) => rate.id === id)) throw new Error("삭제할 카드사를 찾지 못했습니다.");

  return { ...state, cardFeeRates: state.cardFeeRates.filter((rate) => rate.id !== id) };
}

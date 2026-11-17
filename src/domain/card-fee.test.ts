import { describe, expect, it } from "vitest";

import {
  calculateCardFee,
  formatCardFeeRate,
  getCardFeeAmountError,
  getCardFeeRateFormError,
  needsCardFeeChoice,
  syncCardFeesWithIncome,
} from "./card-fee";

describe("카드 수수료", () => {
  it("결제 금액 × 수수료율을 원 단위로 반올림한다(서버와 같은 규칙)", () => {
    expect(calculateCardFee(150000, 1.45)).toBe(2175);
    expect(calculateCardFee(10000, 1.45)).toBe(145);
    expect(calculateCardFee(33333, 0.8)).toBe(267);
    expect(calculateCardFee(50, 0.5)).toBe(0);
  });

  it("카드 결제이고 활성 카드사가 있을 때만 카드사를 고른다", () => {
    expect(needsCardFeeChoice("card", 1)).toBe(true);
    expect(needsCardFeeChoice("card", 0)).toBe(false);
    expect(needsCardFeeChoice("cash", 2)).toBe(false);
    expect(needsCardFeeChoice(undefined, 2)).toBe(false);
  });

  it("수수료 금액은 0원부터 결제 금액까지의 정수다", () => {
    expect(getCardFeeAmountError("", 10000)).toBe("카드 수수료를 입력해 주세요.");
    expect(getCardFeeAmountError("1.5", 10000)).toBe("카드 수수료는 0원부터 결제 금액까지 입력할 수 있습니다.");
    expect(getCardFeeAmountError("10001", 10000)).toBe("카드 수수료는 0원부터 결제 금액까지 입력할 수 있습니다.");
    expect(getCardFeeAmountError("0", 10000)).toBeNull();
    expect(getCardFeeAmountError("145", 10000)).toBeNull();
    expect(getCardFeeAmountError("1,000", 10000)).toBeNull();
    expect(getCardFeeAmountError("1e3", 10000)).toBe("카드 수수료는 0원부터 결제 금액까지 입력할 수 있습니다.");
  });

  it("카드사 설정은 이름 1~30자, 수수료율 0~10%, 소수점 둘째 자리까지", () => {
    expect(getCardFeeRateFormError({ name: " ", ratePercent: "1" })).toBe("카드사 이름을 1~30자로 입력해 주세요.");
    expect(getCardFeeRateFormError({ name: "가".repeat(31), ratePercent: "1" })).toBe("카드사 이름을 1~30자로 입력해 주세요.");
    expect(getCardFeeRateFormError({ name: "신한", ratePercent: "" })).toBe("수수료율은 0~10%, 소수점 둘째 자리까지 입력해 주세요.");
    expect(getCardFeeRateFormError({ name: "신한", ratePercent: "10.01" })).toBe("수수료율은 0~10%, 소수점 둘째 자리까지 입력해 주세요.");
    expect(getCardFeeRateFormError({ name: "신한", ratePercent: "1.234" })).toBe("수수료율은 0~10%, 소수점 둘째 자리까지 입력해 주세요.");
    expect(getCardFeeRateFormError({ name: "신한", ratePercent: "1.45" })).toBeNull();
    expect(getCardFeeRateFormError({ name: "지역화폐", ratePercent: "0" })).toBeNull();
  });

  it("수입 금액이 바뀌면 붙은 수수료를 같은 비율로 맞추고, 수입이 지워지면 수수료도 지운다", () => {
    const income = { ledgerId: "i1", amount: 100000 };
    const fee = { ledgerId: "f1", amount: 1450, feeForEntryId: "i1" };
    const other = { ledgerId: "o1", amount: 5000 };

    expect(syncCardFeesWithIncome([income, fee, other], [{ ...income, amount: 40000 }, fee, other]))
      .toEqual([{ ...income, amount: 40000 }, { ...fee, amount: 580 }, other]);
    expect(syncCardFeesWithIncome([income, fee, other], [fee, other])).toEqual([other]);
    expect(syncCardFeesWithIncome([income, fee], [{ ...income, amount: 10 }, fee])).toEqual([{ ...income, amount: 10 }]);
  });

  it("수수료율을 사람이 읽는 퍼센트로 쓴다", () => {
    expect(formatCardFeeRate(1.45)).toBe("1.45%");
    expect(formatCardFeeRate(1.5)).toBe("1.5%");
    expect(formatCardFeeRate(2)).toBe("2%");
  });
});

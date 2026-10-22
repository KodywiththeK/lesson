import { describe, expect, it } from "vitest";

import {
  allocateLessonTicketRefund,
  canDeleteLessonTicketAsMistake,
  DEFAULT_LESSON_TICKET_REFUND_POLICY,
  formatLessonTicketRefundPolicy,
  quoteLessonTicketRefund,
  type LessonTicketRefundPolicy,
} from "./lesson-ticket-refund";

function quote(policy: LessonTicketRefundPolicy, totalGrantedCount: number, remainingCount: number, paidAmounts = [100_000]) {
  return quoteLessonTicketRefund({ policy, totalGrantedCount, remainingCount, paidAmounts });
}

describe("환불 규정 기본값", () => {
  it("설정하지 않은 학원은 환불 불가다", () => {
    expect(DEFAULT_LESSON_TICKET_REFUND_POLICY).toBe("none");
  });

  it("규정 이름은 설정 화면과 확인창이 같은 문구로 쓴다", () => {
    expect(formatLessonTicketRefundPolicy("proportional_always")).toBe("언제든 남은 회수 비례 환불");
    expect(formatLessonTicketRefundPolicy("proportional_until_half")).toBe("반 이하 사용 시에만 남은 회수 비례 환불");
    expect(formatLessonTicketRefundPolicy("none")).toBe("환불 불가");
  });
});

describe("quoteLessonTicketRefund", () => {
  it("환불 불가 규정이면 사용 이력과 상관없이 환불하지 않는다", () => {
    expect(quote("none", 10, 10)).toMatchObject({ eligible: false, refundAmount: 0, usedCount: 0 });
    expect(quote("none", 10, 5)).toMatchObject({ eligible: false, refundAmount: 0, usedCount: 5 });
  });

  it("언제든 비례 규정은 남은 회수 비율만큼 결제 금액을 돌려준다", () => {
    expect(quote("proportional_always", 10, 10).refundAmount).toBe(100_000);
    expect(quote("proportional_always", 10, 7).refundAmount).toBe(70_000);
    expect(quote("proportional_always", 10, 1)).toMatchObject({ eligible: true, refundAmount: 10_000 });
  });

  it("다 쓴 회차권은 환불 대상이어도 돌려줄 금액이 0원이다", () => {
    expect(quote("proportional_always", 10, 0)).toMatchObject({ eligible: true, refundAmount: 0, usedCount: 10 });
  });

  it("반 이하 사용 규정은 정확히 절반까지는 환불하고 절반을 넘기면 환불하지 않는다", () => {
    expect(quote("proportional_until_half", 10, 10)).toMatchObject({ eligible: true, refundAmount: 100_000 });
    expect(quote("proportional_until_half", 10, 5)).toMatchObject({ eligible: true, refundAmount: 50_000 });
    expect(quote("proportional_until_half", 10, 4)).toMatchObject({ eligible: false, refundAmount: 0, usedCount: 6 });
  });

  it("홀수 회수의 절반 경계는 사용 횟수 × 2가 부여 회수 이하인지로 본다", () => {
    expect(quote("proportional_until_half", 5, 3).eligible).toBe(true); // 2회 사용, 2.5 이하
    expect(quote("proportional_until_half", 5, 2).eligible).toBe(false); // 3회 사용
  });

  it("여러 번 결제한 회차권은 결제 합계를 기준으로 하고 원 단위로 반올림한다", () => {
    expect(quote("proportional_always", 10, 5, [60_000, 40_000]).refundAmount).toBe(50_000);
    expect(quote("proportional_always", 3, 1, [100_000]).refundAmount).toBe(33_333);
    expect(quote("proportional_always", 3, 2, [100_000]).refundAmount).toBe(66_667);
  });

  it("결제 금액이 없으면 돌려줄 금액이 0원이다", () => {
    expect(quote("proportional_always", 10, 10, [0, 0])).toMatchObject({ eligible: true, refundAmount: 0 });
    expect(quote("proportional_always", 10, 10, [])).toMatchObject({ refundAmount: 0 });
  });

  it("잔여가 부여보다 많거나 음수여도 0~부여 회수 범위로 보정해 계산한다", () => {
    expect(quote("proportional_always", 10, 12).refundAmount).toBe(100_000);
    expect(quote("proportional_always", 10, -1).refundAmount).toBe(0);
  });

  it("21억원 가까운 금액도 정밀도 손실 없이 계산한다", () => {
    expect(quote("proportional_always", 2, 1, [2_147_483_647]).refundAmount).toBe(1_073_741_824);
  });
});

describe("allocateLessonTicketRefund", () => {
  const registrations = [
    { registrationId: "r1", paidAmount: 60_000 },
    { registrationId: "r2", paidAmount: 40_000 },
  ];

  it("가장 최근 결제부터 환불액만큼 감액하고 합계가 환불액과 같다", () => {
    expect(allocateLessonTicketRefund(registrations, 30_000)).toEqual([
      { registrationId: "r2", paidAmount: 40_000, refundAmount: 30_000, remainingAmount: 10_000 },
    ]);
    expect(allocateLessonTicketRefund(registrations, 70_000)).toEqual([
      { registrationId: "r2", paidAmount: 40_000, refundAmount: 40_000, remainingAmount: 0 },
      { registrationId: "r1", paidAmount: 60_000, refundAmount: 30_000, remainingAmount: 30_000 },
    ]);
  });

  it("전액 환불이면 모든 수입 행이 0원이 되어 삭제 대상이 된다", () => {
    expect(allocateLessonTicketRefund(registrations, 100_000).map((row) => row.remainingAmount)).toEqual([0, 0]);
  });

  it("결제 금액이 없는 등록은 건너뛰고 환불액이 0이면 아무것도 바꾸지 않는다", () => {
    expect(allocateLessonTicketRefund([{ registrationId: "r1", paidAmount: 0 }], 0)).toEqual([]);
    expect(allocateLessonTicketRefund(registrations, 0)).toEqual([]);
  });

  it("환불액이 결제 합계를 넘으면 합계까지만 감액한다", () => {
    expect(allocateLessonTicketRefund(registrations, 150_000).reduce((sum, row) => sum + row.refundAmount, 0)).toBe(100_000);
  });
});

describe("canDeleteLessonTicketAsMistake", () => {
  it("사용한 회수도 없고 사용 기록도 없을 때만 잘못 등록으로 지울 수 있다", () => {
    expect(canDeleteLessonTicketAsMistake({ totalGrantedCount: 10, remainingCount: 10, hasUsageRecords: false })).toBe(true);
    expect(canDeleteLessonTicketAsMistake({ totalGrantedCount: 10, remainingCount: 9, hasUsageRecords: false })).toBe(false);
    expect(canDeleteLessonTicketAsMistake({ totalGrantedCount: 10, remainingCount: 10, hasUsageRecords: true })).toBe(false);
  });
});

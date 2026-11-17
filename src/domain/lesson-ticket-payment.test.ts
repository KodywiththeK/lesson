import { describe, expect, it } from "vitest";

import {
  getLessonTicketPaymentActions,
  canChangeLessonTicketDueOn,
  isLessonTicketPaymentPastDue,
  isLessonTicketUsable,
  LESSON_TICKET_PAYMENT_STATUS_LABELS,
  resolveLessonTicketDueOn,
} from "./lesson-ticket-payment";

describe("회차권 입금 상태", () => {
  it("상태 이름은 등록·입금대기·입금완료·환불·취소다", () => {
    expect(LESSON_TICKET_PAYMENT_STATUS_LABELS).toEqual({
      registered: "등록",
      "payment-pending": "입금대기",
      paid: "입금완료",
      refunded: "환불",
      cancelled: "취소",
    });
  });

  it("입금대기와 입금완료만 예약·출석에 쓸 수 있다", () => {
    expect(isLessonTicketUsable("registered")).toBe(false);
    expect(isLessonTicketUsable("payment-pending")).toBe(true);
    expect(isLessonTicketUsable("paid")).toBe(true);
    expect(isLessonTicketUsable("refunded")).toBe(false);
    expect(isLessonTicketUsable("cancelled")).toBe(false);
  });

  it("등록은 입금대기 시작, 입금대기는 입금 처리, 입금완료는 입금 취소만 할 수 있다", () => {
    expect(getLessonTicketPaymentActions({ paymentStatus: "registered" })).toEqual(["start-payment-wait"]);
    expect(getLessonTicketPaymentActions({ paymentStatus: "payment-pending" })).toEqual(["mark-paid"]);
    expect(getLessonTicketPaymentActions({ paymentStatus: "paid" })).toEqual(["cancel-payment"]);
    expect(getLessonTicketPaymentActions({ paymentStatus: "refunded" })).toEqual([]);
    expect(getLessonTicketPaymentActions({ paymentStatus: "cancelled" })).toEqual([]);
  });

  it("여러 구매가 합쳐진 이전 회차권은 입금 취소를 하지 않는다", () => {
    expect(getLessonTicketPaymentActions({ paymentStatus: "paid", legacyMerged: true })).toEqual([]);
  });

  it("서비스로 지급한 회차권은 받을 돈이 없어 입금 취소를 하지 않는다", () => {
    expect(getLessonTicketPaymentActions({ paymentStatus: "paid", isService: true })).toEqual([]);
  });

  it("입금 전(등록·입금대기)이고 납입일이 오늘보다 앞서면 납입일 경과다", () => {
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "registered", dueOn: "2026-11-13" }, "2026-11-14")).toBe(true);
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "payment-pending", dueOn: "2026-11-13" }, "2026-11-14")).toBe(true);
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "payment-pending", dueOn: "2026-11-14" }, "2026-11-14")).toBe(false);
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "paid", dueOn: "2026-11-01" }, "2026-11-14")).toBe(false);
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "cancelled", dueOn: "2026-11-01" }, "2026-11-14")).toBe(false);
    // 납입일 미정이면 경과를 판정하지 않는다.
    expect(isLessonTicketPaymentPastDue({ paymentStatus: "registered", dueOn: null }, "2026-11-14")).toBe(false);
  });

  it("납입일은 입금 전(등록·입금대기)에만 입력·수정할 수 있다", () => {
    expect(canChangeLessonTicketDueOn("registered")).toBe(true);
    expect(canChangeLessonTicketDueOn("payment-pending")).toBe(true);
    expect(canChangeLessonTicketDueOn("paid")).toBe(false);
    expect(canChangeLessonTicketDueOn("refunded")).toBe(false);
  });

  it("납입일은 '등록일과 동일'이면 등록일, '직접 입력'이면 고른 날짜, '나중에 입력'이면 미정이다", () => {
    expect(resolveLessonTicketDueOn({ registeredAt: "2026-11-14", dueOn: "2026-11-20", mode: "same" })).toBe("2026-11-14");
    expect(resolveLessonTicketDueOn({ registeredAt: "2026-11-14", dueOn: "2026-11-20", mode: "custom" })).toBe("2026-11-20");
    expect(resolveLessonTicketDueOn({ registeredAt: "2026-11-14", dueOn: "2026-11-20", mode: "later" })).toBeNull();
  });
});

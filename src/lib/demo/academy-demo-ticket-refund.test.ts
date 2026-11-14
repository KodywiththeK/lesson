import { describe, expect, it } from "vitest";

import { changeDemoLessonTicketPayment, createInitialDemoAcademyState, registerDemoLessonTicket, type DemoAcademyState } from "./academy-demo-state";
import {
  deleteDemoLessonTicket,
  getDemoLessonTicketRefundPreview,
  setDemoLessonTicketRefundPolicy,
} from "./academy-demo-ticket-refund";

// 데모 회차권 ticket-1: 한서아 바이올린, 8회 중 2회 남음(6회 사용), 결제 280,000원.
// 데모 회차권 ticket-2: 최도윤 첼로, 4회 중 1회 남음, 결제 160,000원.
function withPolicy(policy: Parameters<typeof setDemoLessonTicketRefundPolicy>[1]): DemoAcademyState {
  return setDemoLessonTicketRefundPolicy(createInitialDemoAcademyState(), policy);
}

/** 사용 이력이 없는 새 회차권(원생 1, 피아노 4회, 결제 100,000원)을 등록하고 입금까지 마친다. */
function registerPianoTicket(state: DemoAcademyState) {
  const created = registerDemoLessonTicket(state, {
    academyId: state.academyId,
    studentId: "student-1",
    instrumentId: "piano",
    instrumentName: "피아노",
    grantedCount: 4,
    validDays: 30,
    registeredAt: "2026-08-21",
    paidAmount: 100_000,
  });
  const ticketId = created.result.ticketId;
  const waiting = changeDemoLessonTicketPayment(created.state, { ticketId, action: "start-payment-wait" });
  const registered = changeDemoLessonTicketPayment(waiting, { ticketId, action: "mark-paid", paidOn: "2026-08-21", paymentMethod: "cash" });

  return { state: registered, ticketId };
}

function ledgerAmountOf(state: DemoAcademyState, ticketId: string) {
  return state.ledgerEntries.find((entry) => entry.source === "lesson-ticket" && entry.refId === ticketId)?.amount;
}

describe("회차권 환불 규정 설정(데모)", () => {
  it("설정하지 않은 데모 학원은 환불 불가다", () => {
    expect(createInitialDemoAcademyState().lessonTicketRefundPolicy).toBe("none");
  });
});

describe("getDemoLessonTicketRefundPreview", () => {
  it("현재 규정으로 환불 가능 여부와 환불 예정 금액을 계산한다", () => {
    expect(getDemoLessonTicketRefundPreview(withPolicy("proportional_always"), "ticket-1")).toEqual({
      policy: "proportional_always",
      totalGrantedCount: 8,
      usedCount: 6,
      eligible: true,
      refundAmount: 70_000,
      canDeleteAsMistake: false,
    });
  });

  it("반 이하 사용 규정은 절반을 넘긴 회차권을 환불 대상에서 뺀다", () => {
    expect(getDemoLessonTicketRefundPreview(withPolicy("proportional_until_half"), "ticket-1")).toMatchObject({
      eligible: false,
      refundAmount: 0,
    });
  });

  it("사용 이력이 없는 새 회차권은 잘못 등록으로 지울 수 있다", () => {
    const { state, ticketId } = registerPianoTicket(withPolicy("none"));

    expect(getDemoLessonTicketRefundPreview(state, ticketId)).toMatchObject({ usedCount: 0, canDeleteAsMistake: true });
  });

  it("없는 회차권은 안내 문구로 거부한다", () => {
    expect(() => getDemoLessonTicketRefundPreview(createInitialDemoAcademyState(), "none")).toThrow(
      "이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.",
    );
  });
});

describe("deleteDemoLessonTicket — 환불 처리", () => {
  it("규정에 맞으면 회차권을 지우지 않고 환불 상태(잔여 0)로 남기며 수입 행을 환불액만큼 줄인다", () => {
    const { state, result } = deleteDemoLessonTicket(withPolicy("proportional_always"), { ticketId: "ticket-1", mode: "refund" });

    expect(result).toEqual({ mode: "refund", refunded: true, refundAmount: 70_000, ledgerChanged: true });
    expect(state.tickets.find((ticket) => ticket.ticketId === "ticket-1")).toMatchObject({ paymentStatus: "refunded", remainingCount: 0 });
    expect(ledgerAmountOf(state, "ticket-1")).toBe(210_000);
    expect(state.ticketRegistrations.some((registration) => registration.ticketId === "ticket-1")).toBe(true);
    expect(state.ticketCancellationHistory).toEqual([expect.objectContaining({ mode: "refund", refund_amount: 70_000, student_name: expect.any(String) })]);
  });

  it("전액 환불이면 수입 행을 지운다", () => {
    const { state, ticketId } = registerPianoTicket(withPolicy("proportional_always"));
    const deleted = deleteDemoLessonTicket(state, { ticketId, mode: "refund" });

    expect(deleted.result).toMatchObject({ refunded: true, refundAmount: 100_000 });
    expect(ledgerAmountOf(deleted.state, ticketId)).toBeUndefined();
  });

  it("규정에 맞지 않으면 환불 상태로만 바꾸고 수입은 그대로 둔다", () => {
    const { state, result } = deleteDemoLessonTicket(withPolicy("none"), { ticketId: "ticket-1", mode: "refund" });

    expect(result).toEqual({ mode: "refund", refunded: false, refundAmount: 0, ledgerChanged: false });
    expect(state.tickets.find((ticket) => ticket.ticketId === "ticket-1")?.paymentStatus).toBe("refunded");
    expect(ledgerAmountOf(state, "ticket-1")).toBe(280_000);
  });

  it("입금대기 회차권 환불은 수입을 건드리지 않고 규정 금액만 사용취소 이력에 남긴다", () => {
    const base = withPolicy("proportional_always");
    const created = registerDemoLessonTicket(base, {
      academyId: base.academyId, studentId: "student-1", instrumentId: "piano", instrumentName: "피아노",
      grantedCount: 4, validDays: 30, registeredAt: "2026-08-21", paidAmount: 120_000,
    });
    const waiting = changeDemoLessonTicketPayment(created.state, { ticketId: created.result.ticketId, action: "start-payment-wait" });
    const { state, result } = deleteDemoLessonTicket(waiting, { ticketId: created.result.ticketId, mode: "refund" });

    expect(result).toMatchObject({ refunded: true, refundAmount: 120_000, ledgerChanged: false });
    expect(state.ledgerEntries).toEqual(waiting.ledgerEntries);
    expect(state.ticketCancellationHistory.at(-1)).toMatchObject({ mode: "refund", refund_amount: 120_000 });
  });

  it("등록 상태는 환불을 거부하고, 이미 환불·취소된 회차권은 다시 처리하지 않는다", () => {
    const base = withPolicy("proportional_always");
    const created = registerDemoLessonTicket(base, {
      academyId: base.academyId, studentId: "student-1", instrumentId: "piano", instrumentName: "피아노",
      grantedCount: 4, validDays: 30, registeredAt: "2026-08-21", paidAmount: 120_000,
    });

    expect(() => deleteDemoLessonTicket(created.state, { ticketId: created.result.ticketId, mode: "refund" })).toThrow(
      "등록 상태인 회차권은 환불이 아니라 취소로 처리해 주세요.",
    );
    const cancelled = deleteDemoLessonTicket(created.state, { ticketId: created.result.ticketId, mode: "mistake" }).state;
    expect(() => deleteDemoLessonTicket(cancelled, { ticketId: created.result.ticketId, mode: "mistake" })).toThrow(
      "이미 환불되었거나 취소된 회차권입니다.",
    );
  });
});

describe("deleteDemoLessonTicket — 취소(잘못 등록)", () => {
  it("사용 이력이 없으면 취소 상태로 남기고 연결된 수입 행을 지운다", () => {
    const registered = registerPianoTicket(withPolicy("none"));
    const { ticketId } = registered;

    const { state, result } = deleteDemoLessonTicket(registered.state, { ticketId, mode: "mistake" });

    expect(result).toEqual({ mode: "mistake", refunded: false, refundAmount: 0, ledgerChanged: true });
    expect(state.tickets.find((ticket) => ticket.ticketId === ticketId)).toMatchObject({ paymentStatus: "cancelled", remainingCount: 0 });
    expect(ledgerAmountOf(state, ticketId)).toBeUndefined();
  });

  it("한 번이라도 썼으면 막고 이유를 알린다", () => {
    expect(() => deleteDemoLessonTicket(createInitialDemoAcademyState(), { ticketId: "ticket-1", mode: "mistake" })).toThrow(
      "사용한 유료 회차가 있어 취소할 수 없습니다. 환불로 처리해 주세요.",
    );
  });

  it("없는 회차권은 안내 문구로 거부한다", () => {
    expect(() => deleteDemoLessonTicket(createInitialDemoAcademyState(), { ticketId: "none", mode: "refund" })).toThrow(
      "이미 삭제되었거나 찾을 수 없습니다. 목록을 새로고침해 주세요.",
    );
  });
});

describe("deleteDemoLessonTicket — 예약이 남은 회차권", () => {
  it("서버와 같이 예약된 개인레슨이 남아 있으면 환불·취소를 거부한다", () => {
    const registered = registerPianoTicket(withPolicy("proportional_always"));
    const lessonTemplate = registered.state.privateLessons[0];
    const reserved: DemoAcademyState = {
      ...registered.state,
      privateLessons: [
        ...registered.state.privateLessons,
        { ...lessonTemplate, id: "reserved-lesson", status: "scheduled", ticketGrantId: registered.ticketId },
      ],
    };

    for (const mode of ["refund", "mistake"] as const) {
      expect(() => deleteDemoLessonTicket(reserved, { ticketId: registered.ticketId, mode })).toThrow(
        "예약된 개인레슨이 있어 환불·취소할 수 없습니다. 일정을 먼저 정리해 주세요.",
      );
    }
  });
});

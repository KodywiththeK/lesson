import { describe, expect, it } from "vitest";

import type { LedgerEntry } from "./book-sale";
import type { LessonTicketListItem } from "./lesson-ticket";
import { buildPrivateLessonIncomeRows, type LessonTicketIncomeRegistration } from "./lesson-ticket-income";

const ticket: LessonTicketListItem = {
  academyId: "academy-1",
  ticketId: "ticket-1",
  studentId: "student-1",
  studentName: "김민지",
  instrumentId: "piano",
  instrumentName: "피아노",
  totalGrantedCount: 8,
  remainingCount: 8,
  validFrom: "2026-07-10",
  validUntil: "2026-09-10",
  registeredAt: "2026-08-10",
  paidAmount: 240000,
};

const registrations: LessonTicketIncomeRegistration[] = [
  {
    registrationId: "registration-july",
    academyId: "academy-1",
    ticketId: "ticket-1",
    registeredAt: "2026-07-10",
    grantedCount: 4,
    validUntil: "2026-08-10",
    originalPaidAmount: 100000,
    ledgerEntryId: "ledger-july",
  },
  {
    registrationId: "registration-august",
    academyId: "academy-1",
    ticketId: "ticket-1",
    registeredAt: "2026-08-10",
    grantedCount: 4,
    validUntil: "2026-09-10",
    originalPaidAmount: 140000,
    ledgerEntryId: "ledger-august",
  },
];

const ledgerEntries: LedgerEntry[] = registrations.map((registration) => ({
  academyId: "academy-1",
  ledgerId: registration.ledgerEntryId!,
  occurredOn: registration.registeredAt,
  type: "income",
  source: "lesson-ticket",
  amount: registration.originalPaidAmount,
  description: "회차권",
  refId: "ticket-1",
}));

describe("buildPrivateLessonIncomeRows", () => {
  it("재등록 누적금액 대신 각 등록에 연결된 현재 원장 금액을 해당 월에 표시한다", () => {
    const editedLedger = ledgerEntries.map((entry) =>
      entry.ledgerId === "ledger-july" ? { ...entry, amount: 90000 } : entry,
    );

    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({
        id: "ticket:registration-july",
        studentName: "김민지",
        instrumentName: "피아노",
        finalAmount: 90000,
        status: "paid",
      })]);
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-08", "2026-11"))
      .toEqual([expect.objectContaining({
        id: "ticket:registration-august",
        finalAmount: 140000,
        status: "paid",
      })]);
  });

  it("원장 날짜가 수정되면 수입을 수정된 발생월로 옮긴다", () => {
    const editedLedger = ledgerEntries.map((entry) =>
      entry.ledgerId === "ledger-july" ? { ...entry, occurredOn: "2026-09-03" } : entry,
    );

    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-07", "2026-11"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-09", "2026-11"))
      .toEqual([expect.objectContaining({ id: "ticket:registration-july", finalAmount: 100000 })]);
  });

  it("0원 등록은 수납 완료가 아니며 수입 탭에 0원 행으로 남는다", () => {
    const freeRegistration: LessonTicketIncomeRegistration = {
      ...registrations[0], registrationId: "registration-free", originalPaidAmount: 0,
      ledgerEntryId: null,
    };

    expect(buildPrivateLessonIncomeRows([freeRegistration], [ticket], [], "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({
        id: "ticket:registration-free", finalAmount: 0, status: "zero-amount",
      })]);
  });

  it("양수 결제 원장이 삭제되거나 수입이 아니면 누락 상태로 구분하고 금액은 집계하지 않는다", () => {
    const expense = { ...ledgerEntries[0], type: "expense" as const };

    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [], "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [expense], "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
  });

  it("다른 학원 등록과 원장 행을 섞거나 이름을 추측하지 않는다", () => {
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], [
      { ...ledgerEntries[0], academyId: "academy-2" },
    ], "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
    expect(buildPrivateLessonIncomeRows(registrations, [], ledgerEntries, "academy-1", "2026-07", "2026-11"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows([
      { ...registrations[0], academyId: "academy-2" },
    ], [ticket], ledgerEntries, "academy-1", "2026-07", "2026-11"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [
      { ...ledgerEntries[0], refId: "other-ticket" },
    ], "academy-1", "2026-07", "2026-11"))
      .toEqual([expect.objectContaining({ status: "missing-ledger", finalAmount: 0 })]);
  });
});

describe("환불·취소된 회차권", () => {
  it("학원 레슨수입 행에서 빠진다(남은 수입은 입출입내역에서 본다)", () => {
    for (const paymentStatus of ["refunded", "cancelled"] as const) {
      expect(
        buildPrivateLessonIncomeRows(registrations, [{ ...ticket, paymentStatus }], ledgerEntries, "academy-1", "2026-08", "2026-11"),
      ).toEqual([]);
    }
  });
});

describe("회차권 입금 상태가 있는 수입 행", () => {
  const pendingRegistration: LessonTicketIncomeRegistration = {
    registrationId: "registration-new",
    academyId: "academy-1",
    ticketId: "ticket-new",
    registeredAt: "2026-11-05",
    grantedCount: 4,
    validUntil: "2026-12-05",
    originalPaidAmount: 200000,
    ledgerEntryId: null,
  };

  function newTicket(paymentStatus: LessonTicketListItem["paymentStatus"], dueOn = "2026-11-20"): LessonTicketListItem {
    return { ...ticket, ticketId: "ticket-new", registeredAt: "2026-11-05", paymentStatus, dueOn };
  }

  it("입금 전(등록·입금대기) 회차권은 납입일이 속한 달에 청구 금액과 상태·납입일로 보인다(원장 기록 없음으로 보지 않는다)", () => {
    for (const status of ["registered", "payment-pending"] as const) {
      const rows = buildPrivateLessonIncomeRows([pendingRegistration], [newTicket(status)], [], "academy-1", "2026-11", "2026-11");

      expect(rows).toEqual([
        expect.objectContaining({
          ticketId: "ticket-new",
          status,
          paymentStatus: status,
          dueOn: "2026-11-20",
          finalAmount: 200000,
        }),
      ]);
    }
  });

  it("납입일이 다른 달이면 그 달에만 보인다", () => {
    const rows = buildPrivateLessonIncomeRows(
      [pendingRegistration],
      [newTicket("payment-pending", "2026-12-03")],
      [],
      "academy-1",
      "2026-11",
      "2026-11",
    );

    expect(rows).toEqual([]);
  });

  it("입금 전 회차권은 납입일이 지난 뒤에도 입금될 때까지 이번 달까지 매달 이월해 보인다", () => {
    const build = (month: string) =>
      buildPrivateLessonIncomeRows([pendingRegistration], [newTicket("payment-pending", "2026-09-20")], [], "academy-1", month, "2026-11");

    expect(build("2026-08")).toEqual([]);
    for (const month of ["2026-09", "2026-10", "2026-11"]) {
      expect(build(month)).toEqual([expect.objectContaining({ ticketId: "ticket-new", dueOn: "2026-09-20", finalAmount: 200000 })]);
    }
    expect(build("2026-12")).toEqual([]);
  });

  it("납입일 미정인 입금 전 회차권은 등록일 달부터 이번 달까지 이월해 보이고 정렬 기준일은 등록일이다", () => {
    const unsetTicket = { ...newTicket("registered"), registeredAt: "2026-10-05", dueOn: null };
    const build = (month: string) =>
      buildPrivateLessonIncomeRows([pendingRegistration], [unsetTicket], [], "academy-1", month, "2026-11");

    expect(build("2026-09")).toEqual([]);
    for (const month of ["2026-10", "2026-11"]) {
      expect(build(month)).toEqual([expect.objectContaining({ ticketId: "ticket-new", dueOn: null, billedOn: "2026-10-05" })]);
    }
  });

  it("입금완료된 회차권은 이월하지 않고 입금한 달에만 보인다", () => {
    const paidLedger = [{
      academyId: "academy-1", ledgerId: "ledger-new", occurredOn: "2026-10-02", type: "income" as const,
      source: "lesson-ticket" as const, category: "lesson-ticket" as const, amount: 200000, description: "", refId: "ticket-new",
    }];
    const registration = { ...pendingRegistration, ledgerEntryId: "ledger-new" };
    const paidTicket = newTicket("paid", "2026-09-20");

    expect(buildPrivateLessonIncomeRows([registration], [paidTicket], paidLedger, "academy-1", "2026-11", "2026-11")).toEqual([]);
    expect(buildPrivateLessonIncomeRows([registration], [paidTicket], paidLedger, "academy-1", "2026-10", "2026-11")).toHaveLength(1);
  });

  it("입금완료 회차권은 지금처럼 입금일(원장 날짜) 기준이고 납입일·결제 방식을 함께 싣는다", () => {
    const paidLedger: LedgerEntry = {
      academyId: "academy-1",
      ledgerId: "ledger-new",
      occurredOn: "2026-11-21",
      type: "income",
      source: "lesson-ticket",
      amount: 200000,
      description: "회차권",
      refId: "ticket-new",
    };
    const rows = buildPrivateLessonIncomeRows(
      [{ ...pendingRegistration, ledgerEntryId: "ledger-new" }],
      [{ ...newTicket("paid"), paymentMethod: "cash" }],
      [paidLedger],
      "academy-1",
      "2026-11",
      "2026-11",
    );

    expect(rows).toEqual([
      expect.objectContaining({ status: "paid", paymentStatus: "paid", dueOn: "2026-11-20", paymentMethod: "cash", finalAmount: 200000 }),
    ]);
  });
});

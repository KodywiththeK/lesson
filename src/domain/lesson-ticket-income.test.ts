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

    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({
        id: "ticket:registration-july",
        studentName: "김민지",
        instrumentName: "피아노",
        finalAmount: 90000,
        status: "paid",
      })]);
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-08"))
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

    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-07"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], editedLedger, "academy-1", "2026-09"))
      .toEqual([expect.objectContaining({ id: "ticket:registration-july", finalAmount: 100000 })]);
  });

  it("0원 등록은 수납 완료가 아니며 수입 탭에 0원 행으로 남는다", () => {
    const freeRegistration: LessonTicketIncomeRegistration = {
      ...registrations[0], registrationId: "registration-free", originalPaidAmount: 0,
      ledgerEntryId: null,
    };

    expect(buildPrivateLessonIncomeRows([freeRegistration], [ticket], [], "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({
        id: "ticket:registration-free", finalAmount: 0, status: "zero-amount",
      })]);
  });

  it("양수 결제 원장이 삭제되거나 수입이 아니면 누락 상태로 구분하고 금액은 집계하지 않는다", () => {
    const expense = { ...ledgerEntries[0], type: "expense" as const };

    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [], "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [expense], "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
  });

  it("다른 학원 등록과 원장 행을 섞거나 이름을 추측하지 않는다", () => {
    expect(buildPrivateLessonIncomeRows(registrations, [ticket], [
      { ...ledgerEntries[0], academyId: "academy-2" },
    ], "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({ finalAmount: 0, status: "missing-ledger" })]);
    expect(buildPrivateLessonIncomeRows(registrations, [], ledgerEntries, "academy-1", "2026-07"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows([
      { ...registrations[0], academyId: "academy-2" },
    ], [ticket], ledgerEntries, "academy-1", "2026-07"))
      .toEqual([]);
    expect(buildPrivateLessonIncomeRows([registrations[0]], [ticket], [
      { ...ledgerEntries[0], refId: "other-ticket" },
    ], "academy-1", "2026-07"))
      .toEqual([expect.objectContaining({ status: "missing-ledger", finalAmount: 0 })]);
  });
});

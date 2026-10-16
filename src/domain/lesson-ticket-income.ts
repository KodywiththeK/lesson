import type { LedgerEntry } from "./book-sale";
import type { LessonTicketListItem } from "./lesson-ticket";

export type LessonTicketIncomeRegistration = {
  registrationId: string;
  academyId: string;
  ticketId: string;
  registeredAt: string;
  grantedCount: number;
  validUntil: string;
  originalPaidAmount: number;
  ledgerEntryId: string | null;
};

export type PrivateLessonIncomeRow = {
  id: string;
  studentId: string;
  source: "lesson-ticket";
  studentName: string;
  lessonKindLabel: "개인레슨 회차권";
  instrumentName: string;
  progress: string;
  lessonFee: number;
  discountTotal: 0;
  finalAmount: number;
  status: "paid" | "zero-amount" | "missing-ledger";
};

export function buildPrivateLessonIncomeRows(
  registrations: LessonTicketIncomeRegistration[],
  tickets: LessonTicketListItem[],
  ledgerEntries: LedgerEntry[],
  academyId: string,
  month: string,
): PrivateLessonIncomeRow[] {
  const ticketsById = new Map(
    tickets.filter((ticket) => ticket.academyId === academyId)
      .map((ticket) => [ticket.ticketId, ticket]),
  );
  const ledgerById = new Map(
    ledgerEntries.filter((entry) => entry.academyId === academyId)
      .map((entry) => [entry.ledgerId, entry]),
  );

  return registrations.flatMap((registration) => {
    if (registration.academyId !== academyId) return [];

    const ticket = ticketsById.get(registration.ticketId);
    if (!ticket) return [];

    const linkedLedger = registration.ledgerEntryId
      ? ledgerById.get(registration.ledgerEntryId)
      : undefined;
    const incomeLedger = linkedLedger?.type === "income" &&
      linkedLedger.source === "lesson-ticket" &&
      linkedLedger.refId === registration.ticketId
      ? linkedLedger
      : undefined;
    const occurredOn = incomeLedger?.occurredOn ?? registration.registeredAt;
    if (!occurredOn.startsWith(month)) return [];

    let status: PrivateLessonIncomeRow["status"] = "missing-ledger";
    if (incomeLedger) status = "paid";
    else if (registration.originalPaidAmount === 0) status = "zero-amount";

    const amount = incomeLedger?.amount ?? 0;
    return [{
      id: `ticket:${registration.registrationId}`,
      studentId: ticket.studentId,
      source: "lesson-ticket" as const,
      studentName: ticket.studentName,
      lessonKindLabel: "개인레슨 회차권" as const,
      instrumentName: ticket.instrumentName,
      progress: "회차권",
      lessonFee: amount,
      discountTotal: 0 as const,
      finalAmount: amount,
      status,
    }];
  });
}

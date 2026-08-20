import type { LedgerEntry } from "./book-sale";

export type FixedIncomeSource = {
  academyId: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  instrumentId: string;
  instrumentName: string;
  monthlyAmount: number;
  effectiveFrom: string;
  active: boolean;
};

export type TuitionSnapshotOptions = {
  academyId: string;
  month: string;
};

export type TuitionStatus = "unpaid" | "paid";

export type TuitionRecord = {
  academyId: string;
  tuitionId: string;
  month: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  instrumentId: string;
  instrumentName: string;
  amount: number;
  status: TuitionStatus;
  paidAt?: string;
};

export type MarkTuitionAsPaidInput = {
  academyId: string;
  paidAt: string;
};

export type MarkTuitionAsPaidResult = {
  record: TuitionRecord & {
    status: "paid";
    paidAt: string;
  };
  ledgerEntry: LedgerEntry;
};

export type MarkTuitionAsUnpaidInput = {
  academyId: string;
  markedAt: string;
};

export type UnpaidTuitionItem = {
  academyId: string;
  tuitionId: string;
  studentId: string;
  studentName: string;
  month: string;
  amount: number;
  markedAt: string;
  reason: "tuition-unpaid";
};

export function createMonthlyTuitionSnapshot(
  sources: FixedIncomeSource[],
  options: TuitionSnapshotOptions,
): TuitionRecord[] {
  return sources
    .filter(
      (source) =>
        source.academyId === options.academyId &&
        source.active &&
        source.effectiveFrom <= options.month,
    )
    .map((source) => ({
      academyId: source.academyId,
      tuitionId: `${options.month}:${source.enrollmentId}`,
      month: options.month,
      studentId: source.studentId,
      studentName: source.studentName,
      enrollmentId: source.enrollmentId,
      instrumentId: source.instrumentId,
      instrumentName: source.instrumentName,
      amount: source.monthlyAmount,
      status: "unpaid",
    }));
}

export function markTuitionAsPaid(
  record: TuitionRecord,
  input: MarkTuitionAsPaidInput,
): MarkTuitionAsPaidResult {
  assertSameAcademy(record.academyId, input.academyId);

  if (record.status === "paid") {
    throw new Error("이미 수납 완료된 수강료입니다.");
  }

  return {
    record: {
      ...record,
      status: "paid",
      paidAt: input.paidAt,
    },
    ledgerEntry: {
      academyId: record.academyId,
      ledgerId: `tuition:${record.tuitionId}`,
      occurredOn: input.paidAt,
      type: "income",
      source: "tuition",
      amount: record.amount,
      description: `수강료 수납: ${record.month} ${record.studentName} ${record.instrumentName}`,
      refId: record.tuitionId,
    },
  };
}

export function markTuitionAsUnpaid(
  record: TuitionRecord,
  input: MarkTuitionAsUnpaidInput,
): UnpaidTuitionItem {
  assertSameAcademy(record.academyId, input.academyId);

  return {
    academyId: record.academyId,
    tuitionId: record.tuitionId,
    studentId: record.studentId,
    studentName: record.studentName,
    month: record.month,
    amount: record.amount,
    markedAt: input.markedAt,
    reason: "tuition-unpaid",
  };
}

function assertSameAcademy(leftAcademyId: string, rightAcademyId: string) {
  if (leftAcademyId !== rightAcademyId) {
    throw new Error("학원 범위가 일치하지 않습니다.");
  }
}

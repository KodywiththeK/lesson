export type FixedIncomeSource = {
  academyId: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  instrumentId: string;
  instrumentName: string;
  monthlyAmount: number;
  registeredOn: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  progress: string;
  effectiveFrom: string;
  active: boolean;
};

export type TuitionSnapshotOptions = {
  academyId: string;
  month: string;
};

/** 미입금(매달 기본) / 입금 완료 / 미납(미납 인원에 기록). DB 값은 unpaid / paid / overdue. */
export type TuitionStatus = "unpaid" | "paid" | "overdue";

export type TuitionRecord = {
  academyId: string;
  tuitionId: string;
  month: string;
  studentId: string;
  studentName: string;
  enrollmentId: string;
  instrumentId: string;
  instrumentName: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  amount: number;
  dueOn: string;
  status: TuitionStatus;
  paidAt?: string;
  /** 입금 때 만든 입출입내역(원장) 행. DB에서 읽었는데 null이면 원장 기록이 사라진 입금 건이다. */
  paidLedgerEntryId?: string | null;
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
      progress: source.progress,
      lessonFee: source.lessonFee,
      discountTotal: source.discountTotal,
      discountLabel: source.discountLabel,
      amount: source.monthlyAmount,
      dueOn: calculateTuitionDueOn(options.month, source.registeredOn),
      status: "unpaid",
    }));
}

function calculateTuitionDueOn(month: string, registeredOn: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const dueDay = Number(registeredOn.slice(-2));
  const lastDayOfMonth = new Date(year, monthIndex, 0).getDate();

  if (dueDay <= lastDayOfMonth) {
    return `${month}-${String(dueDay).padStart(2, "0")}`;
  }

  const overflowDate = new Date(year, monthIndex, 1);

  return [
    overflowDate.getFullYear(),
    String(overflowDate.getMonth() + 1).padStart(2, "0"),
    String(overflowDate.getDate()).padStart(2, "0"),
  ].join("-");
}

export function formatTuitionStatus(status: TuitionStatus) {
  const labels: Record<TuitionStatus, string> = {
    unpaid: "미입금",
    paid: "입금 완료",
    overdue: "미납",
  };

  return labels[status];
}

/** 미납 인원: 미납을 누른 원생만. 아직 처리하지 않은 미입금은 포함하지 않고, 입금하면 상태가 바뀌어 자동으로 빠진다. */
export function selectOverdueTuitions(records: TuitionRecord[]) {
  return records.filter((record) => record.status === "overdue");
}

export type TuitionAction =
  | { action: "pay"; disabledReason?: string }
  | { action: "overdue" }
  | { action: "clear-overdue" }
  | { action: "cancel-payment" };

/** 상태별로 할 수 있는 동작. 0원 수강료는 입금 처리가 막히고 이유를 함께 돌려준다. */
export function getTuitionActions(record: TuitionRecord): TuitionAction[] {
  if (record.status === "paid") {
    return [{ action: "cancel-payment" }];
  }

  const pay: TuitionAction =
    record.amount > 0
      ? { action: "pay" }
      : { action: "pay", disabledReason: "결제 금액이 0원이어서 입금 처리할 수 없습니다." };

  return [pay, record.status === "overdue" ? { action: "clear-overdue" } : { action: "overdue" }];
}

export type TuitionStatusSummary = Record<"total" | TuitionStatus, { count: number; amount: number }>;

export function summarizeTuitionStatus(records: TuitionRecord[]): TuitionStatusSummary {
  const summary: TuitionStatusSummary = {
    total: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    unpaid: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
  };

  for (const record of records) {
    for (const key of ["total", record.status] as const) {
      summary[key].count += 1;
      summary[key].amount += record.amount;
    }
  }

  return summary;
}

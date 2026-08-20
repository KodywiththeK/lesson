import type { LedgerEntry } from "./book-sale";

export type ManualLedgerInput = {
  academyId: string;
  ledgerId: string;
  occurredOn: string;
  type: "income" | "expense";
  amount: number;
  description: string;
  createdBy: string;
};

export type ManualLedgerOptions = {
  canCreateManualLedger: boolean;
};

export type ManualLedgerEntry = LedgerEntry & {
  source: "manual";
  createdBy: string;
};

export type FinanceGraphLedgerEntry = LedgerEntry & {
  instrumentId?: string;
  instrumentName?: string;
};

export type IncomeExpenseGraphOptions = {
  academyId: string;
  year: number;
};

export type InstrumentIncomeGraphPoint = {
  instrumentId: string;
  instrumentName: string;
  amount: number;
};

export type MonthlyIncomeExpenseGraphPoint = {
  month: string;
  totalInstrumentIncome: number;
  instrumentBreakdown: InstrumentIncomeGraphPoint[];
  academyIncome: number;
  expense: number;
  netIncome: number;
};

export type IncomeExpenseGraph = {
  academyId: string;
  year: number;
  months: MonthlyIncomeExpenseGraphPoint[];
};

export function createManualLedgerEntry(
  input: ManualLedgerInput,
  options: ManualLedgerOptions,
): ManualLedgerEntry {
  if (!options.canCreateManualLedger) {
    throw new Error("수동 입출입 입력 권한이 없습니다.");
  }

  assertPositiveMoney(input.amount);

  const description = input.description.trim();

  if (!description) {
    throw new Error("입출입 설명은 필수입니다.");
  }

  return {
    academyId: input.academyId,
    ledgerId: input.ledgerId,
    occurredOn: input.occurredOn,
    type: input.type,
    source: "manual",
    amount: input.amount,
    description,
    refId: input.ledgerId,
    createdBy: input.createdBy,
  };
}

export function buildIncomeExpenseGraph(
  entries: FinanceGraphLedgerEntry[],
  options: IncomeExpenseGraphOptions,
): IncomeExpenseGraph {
  const months = Array.from({ length: 12 }, (_, index) =>
    formatMonth(options.year, index + 1),
  );

  return {
    academyId: options.academyId,
    year: options.year,
    months: months.map((month) =>
      buildMonthlyGraphPoint(
        entries.filter(
          (entry) =>
            entry.academyId === options.academyId &&
            entry.occurredOn.startsWith(month),
        ),
        month,
      ),
    ),
  };
}

function buildMonthlyGraphPoint(
  entries: FinanceGraphLedgerEntry[],
  month: string,
): MonthlyIncomeExpenseGraphPoint {
  const instrumentIncomeEntries = entries.filter(
    (entry) => entry.type === "income" && entry.instrumentId,
  );
  const totalInstrumentIncome = sumAmounts(instrumentIncomeEntries);
  const academyIncome = sumAmounts(
    entries.filter((entry) => entry.type === "income" && !entry.instrumentId),
  );
  const expense = sumAmounts(entries.filter((entry) => entry.type === "expense"));

  return {
    month,
    totalInstrumentIncome,
    instrumentBreakdown: buildInstrumentBreakdown(instrumentIncomeEntries),
    academyIncome,
    expense,
    netIncome: totalInstrumentIncome + academyIncome - expense,
  };
}

function buildInstrumentBreakdown(entries: FinanceGraphLedgerEntry[]) {
  const totals = new Map<string, InstrumentIncomeGraphPoint>();

  for (const entry of entries) {
    if (!entry.instrumentId || !entry.instrumentName) {
      continue;
    }

    const current = totals.get(entry.instrumentId);

    totals.set(entry.instrumentId, {
      instrumentId: entry.instrumentId,
      instrumentName: entry.instrumentName,
      amount: (current?.amount ?? 0) + entry.amount,
    });
  }

  return [...totals.values()].sort((left, right) =>
    left.instrumentName.localeCompare(right.instrumentName, "ko-KR"),
  );
}

function sumAmounts(entries: FinanceGraphLedgerEntry[]) {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

function assertPositiveMoney(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("금액은 1 이상의 정수여야 합니다.");
  }
}

function formatMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

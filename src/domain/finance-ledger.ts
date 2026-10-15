import type { LedgerCategory, LedgerEntry } from "./book-sale";

export type { LedgerCategory };

export type ManualLedgerInput = {
  academyId: string;
  ledgerId: string;
  occurredOn: string;
  type: "income" | "expense";
  category?: LedgerCategory;
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

export type FinanceLedgerListFilters = {
  type?: LedgerEntry["type"];
  source?: LedgerEntry["source"];
  category?: LedgerCategory;
};

export type FinanceLedgerSortField = "occurredOn" | "amount";

export type FinanceLedgerSort = {
  field: FinanceLedgerSortField;
  direction: "asc" | "desc";
};

export type BuildFinanceLedgerListOptions = {
  academyId: string;
  search?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  filters?: FinanceLedgerListFilters;
  sort?: FinanceLedgerSort;
};

export type LedgerCategoryOption = {
  value: LedgerCategory;
  label: string;
};

export type FinanceCalendarDay = {
  date: string;
  income: number;
  expense: number;
  netIncome: number;
  entries: LedgerEntry[];
};

export const ledgerCategoryOptions: LedgerCategoryOption[] = [
  { value: "tuition", label: "수강료" },
  { value: "lesson-ticket", label: "회차권" },
  { value: "book-sale", label: "교재판매" },
  { value: "payroll", label: "급여" },
  { value: "book-order", label: "교재발주" },
  { value: "rent", label: "임대료" },
  { value: "utilities", label: "관리비" },
  { value: "tuning-repair", label: "조율/수리" },
  { value: "supplies", label: "소모품" },
  { value: "tax", label: "세금" },
  { value: "other", label: "기타" },
];

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
    category: input.category ?? "other",
  };
}

export function buildFinanceLedgerList(
  entries: LedgerEntry[],
  options: BuildFinanceLedgerListOptions,
): LedgerEntry[] {
  return entries
    .filter((entry) => entry.academyId === options.academyId)
    .filter((entry) => matchesFinanceLedgerDateRange(entry, options.dateRange))
    .filter((entry) => matchesFinanceLedgerFilters(entry, options.filters))
    .filter((entry) => matchesFinanceLedgerSearch(entry, options.search))
    .sort((left, right) => compareFinanceLedgerEntries(left, right, options.sort));
}

export function formatLedgerEntryType(type: LedgerEntry["type"]) {
  return type === "income" ? "수입" : "지출";
}

export function formatLedgerEntrySource(source: LedgerEntry["source"]) {
  const labels: Record<LedgerEntry["source"], string> = {
    tuition: "수강료",
    "book-sale": "교재",
    "lesson-ticket": "회차권",
    payroll: "급여",
    manual: "수동",
  };

  return labels[source];
}

export function formatLedgerCategory(category: LedgerCategory | undefined) {
  return (
    ledgerCategoryOptions.find((option) => option.value === category)?.label ??
    "기타"
  );
}

export function toDefaultLedgerCategory(
  source: LedgerEntry["source"],
): LedgerCategory {
  const categoryBySource: Record<LedgerEntry["source"], LedgerCategory> = {
    tuition: "tuition",
    "book-sale": "book-sale",
    "lesson-ticket": "lesson-ticket",
    payroll: "payroll",
    manual: "other",
  };

  return categoryBySource[source];
}

export function buildFinanceCalendarDays(
  entries: LedgerEntry[],
  options: {
    academyId: string;
    month: string;
  },
): FinanceCalendarDay[] {
  return buildMonthDates(options.month).map((date) => {
    const dayEntries = buildFinanceLedgerList(entries, {
      academyId: options.academyId,
      dateRange: {
        from: date,
        to: date,
      },
      sort: {
        field: "occurredOn",
        direction: "asc",
      },
    });
    const income = sumAmounts(dayEntries.filter((entry) => entry.type === "income"));
    const expense = sumAmounts(dayEntries.filter((entry) => entry.type === "expense"));

    return {
      date,
      income,
      expense,
      netIncome: income - expense,
      entries: dayEntries,
    };
  });
}

export function exportFinanceLedgerCsv(entries: LedgerEntry[]) {
  const rows = [
    ["발생일", "유형", "출처", "분류", "금액", "설명", "참조 ID"],
    ...entries.map((entry) => [
      entry.occurredOn,
      formatLedgerEntryType(entry.type),
      formatLedgerEntrySource(entry.source),
      formatLedgerCategory(entry.category ?? toDefaultLedgerCategory(entry.source)),
      String(entry.amount),
      entry.description,
      entry.refId,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
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

function matchesFinanceLedgerFilters(
  entry: LedgerEntry,
  filters: FinanceLedgerListFilters | undefined,
) {
  if (!filters) {
    return true;
  }

  return (
    (!filters.type || entry.type === filters.type) &&
    (!filters.source || entry.source === filters.source) &&
    (!filters.category ||
      (entry.category ?? toDefaultLedgerCategory(entry.source)) === filters.category)
  );
}

function matchesFinanceLedgerDateRange(
  entry: LedgerEntry,
  dateRange: BuildFinanceLedgerListOptions["dateRange"],
) {
  if (!dateRange) {
    return true;
  }

  return entry.occurredOn >= dateRange.from && entry.occurredOn <= dateRange.to;
}

function matchesFinanceLedgerSearch(
  entry: LedgerEntry,
  search: string | undefined,
) {
  const trimmedSearch = search?.trim().toLocaleLowerCase("ko-KR");

  if (!trimmedSearch) {
    return true;
  }

  return [
    entry.occurredOn,
    entry.description,
    entry.amount.toString(),
    entry.type,
    entry.source,
    formatLedgerEntryType(entry.type),
    formatLedgerEntrySource(entry.source),
    formatLedgerCategory(entry.category ?? toDefaultLedgerCategory(entry.source)),
  ].some((value) => value.toLocaleLowerCase("ko-KR").includes(trimmedSearch));
}

function compareFinanceLedgerEntries(
  left: LedgerEntry,
  right: LedgerEntry,
  sort: FinanceLedgerSort | undefined,
) {
  if (sort?.field === "amount") {
    return compareNumber(left.amount, right.amount, sort.direction);
  }

  const direction = sort?.direction ?? "desc";
  const dateCompare =
    direction === "asc"
      ? left.occurredOn.localeCompare(right.occurredOn)
      : right.occurredOn.localeCompare(left.occurredOn);

  return dateCompare || left.description.localeCompare(right.description, "ko-KR");
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

function compareNumber(left: number, right: number, direction: "asc" | "desc") {
  return direction === "asc" ? left - right : right - left;
}

function buildMonthDates(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const dates: string[] = [];
  const date = new Date(year, monthIndex - 1, 1);

  while (date.getMonth() === monthIndex - 1) {
    dates.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    );
    date.setDate(date.getDate() + 1);
  }

  return dates;
}

function escapeCsvCell(value: string) {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function assertPositiveMoney(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("금액은 1 이상의 정수여야 합니다.");
  }
}

function formatMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

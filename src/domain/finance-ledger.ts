import type { LedgerCategory, LedgerEntry } from "./book-sale";
import { paginateItems, type ListView, compareKoreanNames } from "./common-list";

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

export type FinanceLedgerPageOptions = {
  page: number;
  pageSize: number;
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

const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

/** 수입 유형에서 고를 수 있는 분류. 나머지 분류는 지출에만 쓴다. */
const INCOME_LEDGER_CATEGORIES: LedgerCategory[] = ["tuition", "lesson-ticket", "book-sale", "other"];

/** 입출금 한 건의 금액 상한(미만). DB integer 범위(약 21억)보다 낮게 둬서 합계가 넘치지 않게 한다. */
export const LEDGER_AMOUNT_LIMIT = 2_000_000_000;

export type LedgerMonthTotals = {
  income: number;
  expense: number;
};

export type LedgerDraftInput = {
  occurredOn: string;
  amountText: string;
  description: string;
};

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

/**
 * 이미 검색·필터·정렬이 끝난 입출금 내역을 받은 순서 그대로 한 페이지만큼 자른다.
 * 캘린더와 CSV는 전체 결과가 필요해서 `buildFinanceLedgerList`와 자르는 단계를 나눴다.
 */
export function buildFinanceLedgerPage(
  entries: LedgerEntry[],
  options: FinanceLedgerPageOptions,
): ListView<LedgerEntry> {
  return paginateItems(entries, options);
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

/** 선택한 월 전체의 입금·출금 합계. 검색·필터·페이지와 무관하게 받은 내역의 해당 월만 더한다. */
export function buildLedgerMonthTotals(entries: LedgerEntry[], month: string): LedgerMonthTotals {
  const monthEntries = entries.filter((entry) => entry.occurredOn.startsWith(`${month}-`));

  return {
    income: sumAmounts(monthEntries.filter((entry) => entry.type === "income")),
    expense: sumAmounts(monthEntries.filter((entry) => entry.type === "expense")),
  };
}

/**
 * 유형에 맞는 분류 후보. 이미 저장된 분류가 후보에 없으면(예전 데이터) 수정 화면에서
 * 값이 사라지지 않도록 끝에 더한다.
 */
export function getLedgerCategoryOptions(
  type: LedgerEntry["type"],
  currentCategory?: LedgerCategory,
): LedgerCategoryOption[] {
  const options = ledgerCategoryOptions.filter((option) => isLedgerCategoryAllowed(type, option.value));
  const current = ledgerCategoryOptions.find((option) => option.value === currentCategory);

  return current && !options.includes(current) ? [...options, current] : options;
}

export function isLedgerCategoryAllowed(type: LedgerEntry["type"], category: LedgerCategory) {
  if (category === "other") {
    return true;
  }

  const isIncomeCategory = INCOME_LEDGER_CATEGORIES.includes(category);

  return type === "income" ? isIncomeCategory : !isIncomeCategory;
}

/** 유형을 바꿀 때 분류를 되돌릴 기본값. 어느 유형에서나 허용되는 "기타"다. */
export function toDefaultLedgerCategoryForType(type: LedgerEntry["type"]): LedgerCategory {
  const categoryByType: Record<LedgerEntry["type"], LedgerCategory> = {
    income: "other",
    expense: "other",
  };

  return categoryByType[type];
}

/** 등록·수정 폼을 저장할 수 없는 이유. 저장할 수 있으면 null. */
export function getLedgerDraftBlockReason(draft: LedgerDraftInput): string | null {
  if (!draft.occurredOn) {
    return "날짜를 입력해 주세요.";
  }

  const amountReason = getLedgerAmountBlockReason(draft.amountText);

  if (amountReason) {
    return amountReason;
  }

  return draft.description.trim() ? null : "설명을 입력해 주세요.";
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
    ["발생일", "유형", "출처", "분류", "금액", "설명"],
    ...entries.map((entry) => [
      entry.occurredOn,
      formatLedgerEntryType(entry.type),
      formatLedgerEntrySource(entry.source),
      formatLedgerCategory(entry.category ?? toDefaultLedgerCategory(entry.source)),
      String(entry.amount),
      entry.description,
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
    return (
      compareNumber(left.amount, right.amount, sort.direction) ||
      compareOccurredOnThenDescription(left, right, "desc")
    );
  }

  return compareOccurredOnThenDescription(left, right, sort?.direction ?? "desc");
}

/** 마지막에 ledgerId까지 비교해, 다시 조회해도 같은 순서가 나와 페이지 경계에서 중복·누락이 없게 한다. */
function compareOccurredOnThenDescription(
  left: LedgerEntry,
  right: LedgerEntry,
  direction: "asc" | "desc",
) {
  const dateCompare =
    direction === "asc"
      ? compareKoreanNames(left.occurredOn, right.occurredOn)
      : compareKoreanNames(right.occurredOn, left.occurredOn);

  return (
    dateCompare ||
    compareKoreanNames(left.description, right.description) ||
    compareKoreanNames(left.ledgerId, right.ledgerId)
  );
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
    compareKoreanNames(left.instrumentName, right.instrumentName),
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

/** 엑셀이 수식으로 실행하지 못하도록 `=`, `+`, `-`, `@` 등으로 시작하는 값 앞에 작은따옴표를 붙인다. */
export function escapeCsvCell(value: string) {
  const safeValue = FORMULA_PREFIX_PATTERN.test(value) ? `'${value}` : value;

  if (!/[",\n]/.test(safeValue)) {
    return safeValue;
  }

  return `"${safeValue.replaceAll("\"", "\"\"")}"`;
}

export function buildFinanceLedgerCsvFileName(range: { from: string; to: string }) {
  return `입출입내역_${range.from}_${range.to}.csv`;
}

function getLedgerAmountBlockReason(amountText: string) {
  if (!amountText.trim()) {
    return "금액을 입력해 주세요.";
  }

  const amount = Number(amountText);

  if (!Number.isInteger(amount) || amount < 1) {
    return "금액은 1원 이상의 정수로 입력해 주세요.";
  }

  return amount < LEDGER_AMOUNT_LIMIT ? null : "금액은 20억 원 미만으로 입력해 주세요.";
}

function formatMonth(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

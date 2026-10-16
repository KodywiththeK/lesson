import type { LedgerEntry } from "./book-sale";
import { compareKoreanNames } from "./common-list";
import type { TuitionRecord } from "./tuition-income";

/** 전체 수입 그래프에서 고를 수 있는 지표. 순수익은 그래프 지표에 넣지 않는다. */
export type YearlyMetric = "all-instruments" | "instrument" | "academy-income" | "expense";

export type YearlyMetricPoint = {
  /** 1~12 */
  month: number;
  label: string;
  amount: number;
};

export type TuitionInstrument = {
  instrumentId: string;
  instrumentName: string;
};

/** 그래프 지표를 고르는 순서. */
export const YEARLY_METRICS: YearlyMetric[] = ["all-instruments", "instrument", "academy-income", "expense"];

const MONTHS_PER_YEAR = 12;
const RECENT_YEAR_COUNT = 6;

const YEARLY_METRIC_LABELS: Record<YearlyMetric, string> = {
  "all-instruments": "악기 전체",
  instrument: "악기별",
  "academy-income": "학원 수입",
  expense: "지출",
};

export function formatYearlyMetric(metric: YearlyMetric) {
  return YEARLY_METRIC_LABELS[metric];
}

/** 올해부터 과거로 거슬러 올라간 연도 목록. 올해 이후는 고를 수 없다. */
export function buildRecentYears(currentYear: number, count = RECENT_YEAR_COUNT) {
  return Array.from({ length: count }, (_, index) => currentYear - index);
}

/**
 * 선택한 연도 1~12월의 월별 금액.
 * 악기 지표는 수납 완료(paid) 수강료 snapshot, 학원 수입·지출은 원장의 발생일 기준으로 더한다.
 */
export function buildYearlyMetricSeries(input: {
  year: number;
  metric: YearlyMetric;
  ledgerEntries: LedgerEntry[];
  tuitionSnapshots: TuitionRecord[];
  instrumentId?: string;
}): YearlyMetricPoint[] {
  const amounts = selectMonthlyAmounts(input);
  const totals = new Array<number>(MONTHS_PER_YEAR).fill(0);

  for (const { month, amount } of amounts) {
    if (month.startsWith(`${input.year}-`)) {
      totals[Number(month.slice(5, 7)) - 1] += amount;
    }
  }

  return totals.map((amount, index) => ({
    month: index + 1,
    label: `${index + 1}월`,
    amount,
  }));
}

/** 수강료 snapshot에 나온 악기를 중복 없이 이름순으로 돌려준다. */
export function listTuitionInstruments(snapshots: TuitionRecord[]): TuitionInstrument[] {
  const instruments = new Map<string, TuitionInstrument>();

  for (const snapshot of snapshots) {
    instruments.set(snapshot.instrumentId, {
      instrumentId: snapshot.instrumentId,
      instrumentName: snapshot.instrumentName,
    });
  }

  return [...instruments.values()].sort(
    (left, right) =>
      compareKoreanNames(left.instrumentName, right.instrumentName) ||
      compareKoreanNames(left.instrumentId, right.instrumentId),
  );
}

function selectMonthlyAmounts({
  metric,
  ledgerEntries,
  tuitionSnapshots,
  instrumentId,
}: Parameters<typeof buildYearlyMetricSeries>[0]) {
  if (metric === "academy-income" || metric === "expense") {
    const ledgerType = metric === "academy-income" ? "income" : "expense";

    return ledgerEntries
      .filter((entry) => entry.type === ledgerType)
      .map((entry) => ({ month: entry.occurredOn.slice(0, 7), amount: entry.amount }));
  }

  return tuitionSnapshots
    .filter(
      (snapshot) =>
        snapshot.status === "paid" &&
        (metric === "all-instruments" || snapshot.instrumentId === instrumentId),
    )
    .map((snapshot) => ({ month: snapshot.month, amount: snapshot.amount }));
}

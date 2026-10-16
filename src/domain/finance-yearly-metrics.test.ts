import { describe, expect, it } from "vitest";

import type { LedgerEntry } from "./book-sale";
import {
  buildRecentYears,
  buildYearlyMetricSeries,
  formatYearlyMetric,
  listTuitionInstruments,
} from "./finance-yearly-metrics";
import type { TuitionRecord } from "./tuition-income";

function ledger(overrides: Partial<LedgerEntry>): LedgerEntry {
  return {
    academyId: "academy-1",
    ledgerId: "ledger",
    occurredOn: "2026-03-05",
    type: "income",
    source: "manual",
    amount: 1000,
    description: "",
    refId: "ref",
    ...overrides,
  };
}

function tuition(overrides: Partial<TuitionRecord>): TuitionRecord {
  return {
    academyId: "academy-1",
    tuitionId: "tuition",
    month: "2026-03",
    studentId: "student-1",
    studentName: "김민지",
    enrollmentId: "enrollment-1",
    instrumentId: "piano",
    instrumentName: "피아노",
    progress: "",
    lessonFee: 140000,
    discountTotal: 0,
    amount: 140000,
    dueOn: "2026-03-05",
    status: "paid",
    ...overrides,
  };
}

describe("buildYearlyMetricSeries", () => {
  it("항상 1~12월 12개 점을 만들고 데이터가 없는 달은 0원이다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "academy-income",
      ledgerEntries: [],
      tuitionSnapshots: [],
    });

    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ month: 1, label: "1월", amount: 0 });
    expect(series[11]).toEqual({ month: 12, label: "12월", amount: 0 });
  });

  it("학원 수입은 선택한 연도 원장 수입의 발생일 월별 합계다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "academy-income",
      ledgerEntries: [
        ledger({ ledgerId: "a", occurredOn: "2026-03-05", amount: 300000 }),
        ledger({ ledgerId: "b", occurredOn: "2026-03-31", amount: 20000 }),
        ledger({ ledgerId: "c", occurredOn: "2026-05-02", amount: 7000 }),
        ledger({ ledgerId: "d", occurredOn: "2025-03-05", amount: 999999 }),
        ledger({ ledgerId: "e", occurredOn: "2026-03-10", type: "expense", amount: 55555 }),
      ],
      tuitionSnapshots: [],
    });

    expect(series.map((point) => point.amount)).toEqual([0, 0, 320000, 0, 7000, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("지출은 선택한 연도 원장 지출의 월별 합계이고 수입은 섞지 않는다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "expense",
      ledgerEntries: [
        ledger({ ledgerId: "a", occurredOn: "2026-03-20", type: "expense", amount: 120000 }),
        ledger({ ledgerId: "b", occurredOn: "2026-03-21", type: "expense", amount: 30000 }),
        ledger({ ledgerId: "c", occurredOn: "2026-03-22", type: "income", amount: 888888 }),
        ledger({ ledgerId: "d", occurredOn: "2027-01-01", type: "expense", amount: 777777 }),
      ],
      tuitionSnapshots: [],
    });

    expect(series[2].amount).toBe(150000);
    expect(series.reduce((total, point) => total + point.amount, 0)).toBe(150000);
  });

  it("악기 전체는 수납 완료(paid) 수강료만 월별로 더한다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "all-instruments",
      ledgerEntries: [ledger({ amount: 999999 })],
      tuitionSnapshots: [
        tuition({ tuitionId: "a", month: "2026-03", amount: 140000, instrumentId: "piano" }),
        tuition({ tuitionId: "b", month: "2026-03", amount: 100000, instrumentId: "violin", instrumentName: "바이올린" }),
        tuition({ tuitionId: "c", month: "2026-03", amount: 50000, status: "unpaid" }),
        tuition({ tuitionId: "d", month: "2026-03", amount: 60000, status: "overdue" }),
        tuition({ tuitionId: "e", month: "2026-04", amount: 80000 }),
        tuition({ tuitionId: "f", month: "2025-04", amount: 70000 }),
      ],
    });

    expect(series[2].amount).toBe(240000);
    expect(series[3].amount).toBe(80000);
    expect(series.reduce((total, point) => total + point.amount, 0)).toBe(320000);
  });

  it("악기별은 선택한 악기 하나의 수납 완료 수강료만 더한다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "instrument",
      instrumentId: "violin",
      ledgerEntries: [],
      tuitionSnapshots: [
        tuition({ tuitionId: "a", month: "2026-03", amount: 140000, instrumentId: "piano" }),
        tuition({ tuitionId: "b", month: "2026-03", amount: 100000, instrumentId: "violin", instrumentName: "바이올린" }),
        tuition({ tuitionId: "c", month: "2026-06", amount: 90000, instrumentId: "violin", instrumentName: "바이올린" }),
        tuition({ tuitionId: "d", month: "2026-06", amount: 90000, instrumentId: "violin", instrumentName: "바이올린", status: "unpaid" }),
      ],
    });

    expect(series[2].amount).toBe(100000);
    expect(series[5].amount).toBe(90000);
    expect(series.reduce((total, point) => total + point.amount, 0)).toBe(190000);
  });

  it("악기별인데 악기를 고르지 않았으면 모든 달이 0원이다", () => {
    const series = buildYearlyMetricSeries({
      year: 2026,
      metric: "instrument",
      ledgerEntries: [],
      tuitionSnapshots: [tuition({})],
    });

    expect(series.every((point) => point.amount === 0)).toBe(true);
  });
});

describe("listTuitionInstruments", () => {
  it("snapshot에 나온 악기를 중복 없이 이름 가나다순으로 돌려준다", () => {
    expect(
      listTuitionInstruments([
        tuition({ instrumentId: "piano", instrumentName: "피아노" }),
        tuition({ instrumentId: "violin", instrumentName: "바이올린" }),
        tuition({ instrumentId: "piano", instrumentName: "피아노", month: "2026-04" }),
      ]),
    ).toEqual([
      { instrumentId: "violin", instrumentName: "바이올린" },
      { instrumentId: "piano", instrumentName: "피아노" },
    ]);
  });
});

describe("buildRecentYears", () => {
  it("올해부터 과거로 6개 연도를 돌려주고 올해 이후는 없다", () => {
    expect(buildRecentYears(2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
  });
});

describe("formatYearlyMetric", () => {
  it("지표마다 화면에 보일 이름을 돌려준다", () => {
    expect(formatYearlyMetric("all-instruments")).toBe("악기 전체");
    expect(formatYearlyMetric("instrument")).toBe("악기별");
    expect(formatYearlyMetric("academy-income")).toBe("학원 수입");
    expect(formatYearlyMetric("expense")).toBe("지출");
  });
});

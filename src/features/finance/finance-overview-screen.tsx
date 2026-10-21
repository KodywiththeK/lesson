"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { ListStatusAlert } from "@/components/management/list-controls";
import { StatTile } from "@/components/shared/stat-tile";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import { getFinanceCurrentMonth } from "@/domain/finance-date";
import { buildIncomeExpenseGraph, formatLedgerCategory, toDefaultLedgerCategory } from "@/domain/finance-ledger";
import {
  YEARLY_METRICS,
  buildRecentYears,
  buildYearlyMetricSeries,
  formatYearlyMetric,
  listTuitionInstruments,
  type YearlyMetric,
} from "@/domain/finance-yearly-metrics";
import type { TuitionRecord } from "@/domain/tuition-income";
import { toUserMessage } from "@/lib/errors/user-message";
import { queryKeys } from "@/lib/api/query-keys";
import { FinanceDataScreenProps } from "./finance-types";
import { FinanceAmount, formatWon, sumOf } from "./finance-shared";
import { FinanceYearlyChart } from "./finance-yearly-chart";
import { TuitionStatusSection } from "./finance-tuition-status-section";

const NO_TUITION_SNAPSHOTS: TuitionRecord[] = [];

export function FinanceOverviewScreen({
  academyId,
  financeData,
  initialYear,
  tuitionSnapshotsQueryOptionsFactory,
  yearlyLedgerQueryOptionsFactory,
  yearlyTuitionQueryOptionsFactory,
}: FinanceDataScreenProps & { initialYear?: number }) {
  const currentYear = Number(getFinanceCurrentMonth().slice(0, 4));
  const [year, setYear] = useState(() => initialYear ?? currentYear);
  // 연간 합계와 그래프는 월 단위로 읽은 화면 데이터가 아니라 선택한 연도의 원장 전체로 계산한다.
  // 연도 조회가 없는 환경(데모·테스트)에서는 화면에 이미 있는 원장을 그대로 쓴다.
  const yearlyLedgerOptions = yearlyLedgerQueryOptionsFactory?.(year);
  const yearlyLedgerQuery = useQuery({
    queryKey: yearlyLedgerOptions?.queryKey ?? [...queryKeys.finance.all(academyId), "yearly-ledger", "local"],
    queryFn: yearlyLedgerOptions?.queryFn ?? (async () => []),
    enabled: Boolean(yearlyLedgerOptions),
    placeholderData: keepPreviousData,
  });
  const ledgerEntries = yearlyLedgerOptions ? (yearlyLedgerQuery.data ?? []) : financeData.ledgerEntries;
  const academyLedgerEntries = ledgerEntries.filter((entry) => entry.academyId === academyId);
  const yearIncomeEntries = academyLedgerEntries.filter(
    (entry) => entry.type === "income" && entry.occurredOn.startsWith(`${year}-`),
  );
  const graph = buildIncomeExpenseGraph(academyLedgerEntries, { academyId, year });
  const categoryTotals = buildIncomeCategoryTotals(yearIncomeEntries);
  const monthlyTotals = graph.months.map((month) => ({
    month: month.month,
    income: month.totalInstrumentIncome + month.academyIncome,
    expense: month.expense,
    netIncome: month.netIncome,
  }));
  const yearTotal = {
    income: sumOf(monthlyTotals, "income"),
    expense: sumOf(monthlyTotals, "expense"),
    netIncome: sumOf(monthlyTotals, "netIncome"),
  };

  return (
    <section className="grid gap-4" aria-label="전체수입">
      <SectionCard>
        <Label className="grid w-fit gap-1 text-sm font-medium">
          <span>연도</span>
          <NativeSelect aria-label="연도" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {buildYearOptions(currentYear, year).map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}년
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </SectionCard>
      {yearlyLedgerOptions && yearlyLedgerQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">연간 입출입내역을 불러오는 중입니다.</p>
      ) : null}
      {yearlyLedgerQuery.isError ? (
        <ListStatusAlert
          message="연간 입출입내역을 불러오지 못했습니다."
          detail={toUserMessage(yearlyLedgerQuery.error)}
          onRetry={() => void yearlyLedgerQuery.refetch()}
        />
      ) : null}
      <section aria-label="연간 요약" className="grid gap-2 sm:grid-cols-3">
        <OverviewTotal label="수입" amount={yearTotal.income} tone="income" />
        <OverviewTotal label="지출" amount={yearTotal.expense} tone="expense" />
        <OverviewTotal label="순수익" amount={yearTotal.netIncome} tone="total" emphasized />
      </section>
      <TuitionStatusSection tuitionSnapshotsQueryOptionsFactory={tuitionSnapshotsQueryOptionsFactory} />
      <YearlyMetricSection
        academyId={academyId}
        year={year}
        ledgerEntries={academyLedgerEntries}
        yearlyTuitionQueryOptionsFactory={yearlyTuitionQueryOptionsFactory}
      />
      <SectionCard padded={false}>
        <Table aria-label="월별 수입·지출·순수익">
          <TableHeader>
            <TableRow>
              <TableHead>월</TableHead>
              <TableHead>수입</TableHead>
              <TableHead>지출</TableHead>
              <TableHead>순수익</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyTotals.map((month) => (
              <TableRow key={month.month}>
                <TableCell label="월" className="font-medium">{month.month}</TableCell>
                <TableCell label="수입">{formatWon(month.income)}</TableCell>
                <TableCell label="지출">{formatWon(month.expense)}</TableCell>
                <TableCell label="순수익" className="font-semibold">{formatWon(month.netIncome)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
      <SectionCard role="region" aria-label="분류별 수입">
        <SectionHeader title="분류별 수입" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryTotals.map((item) => (
            <div key={item.category} className="rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                {formatLedgerCategory(item.category)}
              </p>
              <p className="mt-1 text-lg font-semibold">{formatWon(item.amount)}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </section>
  );
}

/** 지표를 고르면 그 지표의 12개월 막대 그래프를 보여 준다. 악기 지표만 연간 수강료 snapshot을 읽는다. */
function YearlyMetricSection({
  academyId,
  year,
  ledgerEntries,
  yearlyTuitionQueryOptionsFactory,
}: {
  academyId: string;
  year: number;
  ledgerEntries: LedgerEntry[];
  yearlyTuitionQueryOptionsFactory: FinanceDataScreenProps["yearlyTuitionQueryOptionsFactory"];
}) {
  const [metric, setMetric] = useState<YearlyMetric>("academy-income");
  const [selectedInstrumentId, setSelectedInstrumentId] = useState("");
  const usesTuition = metric === "all-instruments" || metric === "instrument";
  const tuitionQuery = useQuery({
    ...(yearlyTuitionQueryOptionsFactory?.(year) ?? {
      queryKey: [...queryKeys.finance.all(academyId), "yearly-tuition", "unavailable"],
      queryFn: async () => NO_TUITION_SNAPSHOTS,
    }),
    enabled: usesTuition && Boolean(yearlyTuitionQueryOptionsFactory),
    placeholderData: keepPreviousData,
  });
  const tuitionSnapshots = tuitionQuery.data ?? NO_TUITION_SNAPSHOTS;
  const instruments = listTuitionInstruments(tuitionSnapshots);
  // 고른 악기가 없거나 연도를 바꿔 목록에서 사라지면 첫 악기를 보여 준다.
  const instrumentId = instruments.some((instrument) => instrument.instrumentId === selectedInstrumentId)
    ? selectedInstrumentId
    : (instruments[0]?.instrumentId ?? "");
  const series = buildYearlyMetricSeries({
    year,
    metric,
    ledgerEntries,
    tuitionSnapshots,
    instrumentId,
  });

  return (
    <SectionCard role="region" aria-label="월별 그래프" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="그래프 지표"
          value={metric}
          onValueChange={(next) => next && setMetric(next as YearlyMetric)}
        >
          {YEARLY_METRICS.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {formatYearlyMetric(item)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {metric === "instrument" && instruments.length > 0 ? (
          <NativeSelect
            aria-label="악기"
            value={instrumentId}
            onChange={(event) => setSelectedInstrumentId(event.target.value)}
          >
            {instruments.map((instrument) => (
              <NativeSelectOption key={instrument.instrumentId} value={instrument.instrumentId}>
                {instrument.instrumentName}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
      </div>
      {usesTuition && !yearlyTuitionQueryOptionsFactory ? (
        <p className="text-sm text-muted-foreground">연간 수강료 데이터는 실제 데이터에서만 볼 수 있습니다.</p>
      ) : null}
      {usesTuition && tuitionQuery.isError ? (
        <ListStatusAlert
          message="연간 수강료를 불러오지 못했습니다."
          detail={toUserMessage(tuitionQuery.error)}
          onRetry={() => void tuitionQuery.refetch()}
        />
      ) : null}
      {usesTuition && tuitionQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">연간 수강료를 불러오는 중입니다.</p>
      ) : null}
      {usesTuition && yearlyTuitionQueryOptionsFactory && tuitionQuery.isSuccess && instruments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{year}년에 기록된 수강료가 없습니다.</p>
      ) : null}
      {canShowChart({ usesTuition, hasFactory: Boolean(yearlyTuitionQueryOptionsFactory), isSuccess: tuitionQuery.isSuccess }) ? (
        <>
          <FinanceYearlyChart year={year} metric={metric} series={series} />
          <p className="text-xs text-muted-foreground">
            악기 지표는 입금 완료된 월 수강료(청구월), 학원 수입·지출은 입출입내역(발생일) 기준입니다.
          </p>
        </>
      ) : null}
    </SectionCard>
  );
}

/** 학원 수입·지출은 항상 그릴 수 있고, 악기 지표는 연간 수강료를 읽은 뒤에만 그린다. */
function canShowChart({ usesTuition, hasFactory, isSuccess }: { usesTuition: boolean; hasFactory: boolean; isSuccess: boolean }) {
  return !usesTuition || (hasFactory && isSuccess);
}

function buildYearOptions(currentYear: number, selectedYear: number) {
  return [...new Set([...buildRecentYears(currentYear), selectedYear])].sort((left, right) => right - left);
}

export function OverviewTotal({
  label,
  amount,
  tone,
  emphasized = false,
}: {
  label: string;
  amount: number;
  tone: "total" | "income" | "expense";
  emphasized?: boolean;
}) {
  return (
    <StatTile label={label} emphasized={emphasized}>
      <FinanceAmount amount={amount} tone={tone} />
    </StatTile>
  );
}

export function buildIncomeCategoryTotals(entries: LedgerEntry[]) {
  const totals = new Map<LedgerCategory, number>();

  for (const entry of entries) {
    const category = entry.category ?? toDefaultLedgerCategory(entry.source);
    totals.set(category, (totals.get(category) ?? 0) + entry.amount);
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((left, right) => right.amount - left.amount);
}

"use client";

import { useCallback, useState } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { ListFilterSelect, ListSearchField } from "@/components/management/list-controls";
import { DateField, MonthField } from "@/components/operations/date-time-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { LedgerCategory, LedgerEntry } from "@/domain/book-sale";
import {
  formatLedgerEntrySource,
  formatLedgerEntryType,
  ledgerCategoryOptions,
  type FinanceLedgerSort,
} from "@/domain/finance-ledger";

export type LedgerDateRange = { from: string; to: string };

export type LedgerFilterState = {
  search: string;
  type: LedgerEntry["type"] | "";
  source: LedgerEntry["source"] | "";
  category: LedgerCategory | "";
  sortValue: string;
  /** 월 기간이 아닌 직접 고른 기간. 없으면 선택한 월 전체다. */
  customRange: LedgerDateRange | null;
};

const typeFilterOptions = (["income", "expense"] as const).map((value) => ({
  value,
  label: formatLedgerEntryType(value),
}));

const sourceFilterOptions = (["tuition", "book-sale", "book-order", "lesson-ticket", "payroll", "manual"] as const).map(
  (value) => ({ value, label: formatLedgerEntrySource(value) }),
);

export const sortOptions: Array<{ value: string; label: string; sort: FinanceLedgerSort }> = [
  { value: "occurredOn-desc", label: "날짜 최신순", sort: { field: "occurredOn", direction: "desc" } },
  { value: "occurredOn-asc", label: "날짜 오래된순", sort: { field: "occurredOn", direction: "asc" } },
  { value: "amount-desc", label: "금액 높은순", sort: { field: "amount", direction: "desc" } },
  { value: "amount-asc", label: "금액 낮은순", sort: { field: "amount", direction: "asc" } },
];

export const DEFAULT_LEDGER_SORT = sortOptions[0];

const INITIAL_LEDGER_FILTERS: LedgerFilterState = {
  search: "",
  type: "",
  source: "",
  category: "",
  sortValue: DEFAULT_LEDGER_SORT.value,
  customRange: null,
};

/** 필터가 바뀌면 보던 페이지가 의미를 잃으므로 `onChange`(보통 1페이지로 이동)를 함께 부른다. */
export function useLedgerFilters(onChange: () => void) {
  const [filters, setFilters] = useState(INITIAL_LEDGER_FILTERS);
  const change = useCallback(
    (patch: Partial<LedgerFilterState>) => {
      setFilters((current) => ({ ...current, ...patch }));
      onChange();
    },
    [onChange],
  );
  const reset = useCallback(() => change(INITIAL_LEDGER_FILTERS), [change]);

  return { filters, change, reset };
}

export function FinanceLedgerFilters({
  dateRange,
  filters,
  hasActiveFilter,
  maxMonth,
  month,
  onChange,
  onChangeMonth,
  onReset,
}: {
  dateRange: LedgerDateRange;
  filters: LedgerFilterState;
  /** 검색·유형·출처·분류·기간 중 하나라도 켜져 있으면 접힌 상세 필터에서도 알린다. */
  hasActiveFilter: boolean;
  maxMonth: string;
  month: string;
  onChange: (patch: Partial<LedgerFilterState>) => void;
  onChangeMonth: (month: string) => void;
  onReset: () => void;
}) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const isRangeReversed = dateRange.from > dateRange.to;

  return (
    <Collapsible open={isDetailOpen} onOpenChange={setIsDetailOpen} asChild>
      <SectionCard className="grid gap-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_11rem_9rem_auto]">
          <ListSearchField
            label="입출금 내역 검색"
            value={filters.search}
            onChange={(search) => onChange({ search })}
            placeholder="발생일, 설명, 유형, 출처, 분류"
          />
          <Label className="grid gap-1 text-sm font-medium">
            <span>월 선택</span>
            <MonthField
              aria-label="입출금 월 선택"
              required
              max={maxMonth}
              value={month}
              onValueChange={onChangeMonth}
            />
          </Label>
          <ListFilterSelect
            label="유형 필터"
            value={filters.type}
            options={typeFilterOptions}
            onChange={(type) => onChange({ type: type as LedgerFilterState["type"] })}
          />
          <div className="flex flex-wrap items-end gap-2">
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline">
                상세 필터
                <ChevronDown aria-hidden="true" className={isDetailOpen ? "rotate-180" : undefined} />
              </Button>
            </CollapsibleTrigger>
            <Button type="button" variant="outline" onClick={onReset}>
              <RotateCcw aria-hidden="true" />
              초기화
            </Button>
          </div>
        </div>
        {hasActiveFilter ? <Badge variant="secondary">필터 적용 중</Badge> : null}
        <CollapsibleContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[9rem_9rem_11rem_11rem_11rem]">
            <ListFilterSelect
              label="출처 필터"
              value={filters.source}
              options={sourceFilterOptions}
              onChange={(source) => onChange({ source: source as LedgerFilterState["source"] })}
            />
            <ListFilterSelect
              label="분류 필터"
              value={filters.category}
              options={ledgerCategoryOptions}
              onChange={(category) => onChange({ category: category as LedgerFilterState["category"] })}
            />
            <Label className="grid gap-1 text-sm font-medium">
              <span>시작일</span>
              <DateField
                aria-label="입출금 시작일"
                required
                value={dateRange.from}
                onValueChange={(from) => onChange({ customRange: { ...dateRange, from } })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-medium">
              <span>종료일</span>
              <DateField
                aria-label="입출금 종료일"
                required
                value={dateRange.to}
                onValueChange={(to) => onChange({ customRange: { ...dateRange, to } })}
              />
            </Label>
            <Label className="grid gap-1 text-sm font-medium">
              <span>정렬</span>
              <NativeSelect
                aria-label="입출금 정렬"
                value={filters.sortValue}
                onChange={(event) => onChange({ sortValue: event.target.value })}
              >
                {sortOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Label>
          </div>
          {isRangeReversed ? (
            <p className="text-sm text-destructive">
              시작일이 종료일보다 늦습니다. 기간을 다시 골라 주세요.
            </p>
          ) : null}
        </CollapsibleContent>
      </SectionCard>
    </Collapsible>
  );
}

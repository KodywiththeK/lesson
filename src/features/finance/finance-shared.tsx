"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ListSearchField } from "@/components/management/list-controls";
import { SectionCard } from "@/components/shared/section-card";
import { StatFigure } from "@/components/shared/stat-tile";
import { useListPaging } from "@/components/management/use-list-paging";
import { MonthField } from "@/components/operations/date-time-fields";
import { Label } from "@/components/ui/label";
import { getFinanceCurrentMonth } from "@/domain/finance-date";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/api/query-keys";
import { SupabaseClientState } from "./finance-types";

export function sumOf<Key extends string>(rows: Array<Record<Key, number>>, key: Key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

export function FinanceMonthSummary({
  amount,
  label,
  maxMonth,
  month,
  onChangeMonth,
  tone = "total",
}: {
  amount: number;
  label: string;
  /** 고를 수 있는 마지막 달(보통 이번 달). 비우면 제한이 없다. */
  maxMonth?: string;
  month: string;
  onChangeMonth: (month: string) => void;
  tone?: FinanceAmountTone;
}) {
  return (
    <SectionCard className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <StatFigure label={label}>
        <FinanceAmount amount={amount} tone={tone} />
      </StatFigure>
      <Label className="grid gap-1 text-sm font-medium sm:min-w-44">
        <span>월 선택</span>
        <MonthField
          aria-label={`${label} 월 선택`}
          required
          max={maxMonth}
          value={month}
          onValueChange={onChangeMonth}
        />
      </Label>
    </SectionCard>
  );
}

export function FinanceListSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SectionCard className="sm:max-w-md">
      <ListSearchField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </SectionCard>
  );
}

/** 이름 검색이 있는 표의 상태. 검색어가 바뀌면 보던 페이지가 의미를 잃으므로 1페이지로 돌아간다. */
export function useSearchableListPaging() {
  const [search, setSearch] = useState("");
  const paging = useListPaging();
  const { resetPage } = paging;

  const changeSearch = useCallback(
    (nextSearch: string) => {
      setSearch(nextSearch);
      resetPage();
    },
    [resetPage],
  );

  return { search, changeSearch, paging };
}

export function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

export function invalidateFinanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  academyId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.finance.all(academyId),
  });
}

export function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export type FinanceAmountTone = "total" | "income" | "expense" | "neutral";

const FINANCE_AMOUNT_TONE_CLASS_NAMES: Record<FinanceAmountTone, string> = {
  total: "text-total",
  income: "text-income",
  expense: "text-expense",
  neutral: "",
};

/** 금액에 의미 색(합계 파랑·수입 초록·지출 빨강)을 입힌다. 색만으로 뜻을 전하지 않도록 앞뒤 라벨과 함께 쓴다. */
export function FinanceAmount({
  amount,
  className,
  tone = "neutral",
}: {
  amount: number;
  className?: string;
  tone?: FinanceAmountTone;
}) {
  return <span className={cn(FINANCE_AMOUNT_TONE_CLASS_NAMES[tone], className)}>{formatWon(amount)}</span>;
}

// 탭(라우트)을 옮겨도 보던 월을 이어가기 위한 작은 공유 상태. 새로고침하면 이번 달로 돌아간다.
let selectedFinanceMonth: string | undefined;
const financeMonthListeners = new Set<() => void>();

function readSelectedFinanceMonth() {
  const currentMonth = getFinanceCurrentMonth();

  return selectedFinanceMonth && selectedFinanceMonth <= currentMonth ? selectedFinanceMonth : currentMonth;
}

function subscribeFinanceMonth(listener: () => void) {
  financeMonthListeners.add(listener);

  return () => {
    financeMonthListeners.delete(listener);
  };
}

function notifyFinanceMonth() {
  financeMonthListeners.forEach((listener) => listener());
}

/** 수입 관리 탭이 함께 쓰는 조회 월. 미래 월은 고를 수 없고(월 snapshot이 미리 만들어지는 것을 막는다) 이번 달이 최대값이다. */
export function useFinanceMonth() {
  const month = useSyncExternalStore(subscribeFinanceMonth, readSelectedFinanceMonth, getFinanceCurrentMonth);
  const setMonth = useCallback((nextMonth: string) => {
    selectedFinanceMonth = nextMonth <= getFinanceCurrentMonth() ? nextMonth : getFinanceCurrentMonth();
    notifyFinanceMonth();
  }, []);

  return { month, setMonth, maxMonth: getFinanceCurrentMonth() };
}

/**
 * `refetch()` 결과에서 새 데이터를 꺼낸다. 재조회가 실패하면 `data`에는 직전 성공값이 남아 있으므로
 * 그것을 최신 데이터로 착각하지 않고 오류를 던진다.
 */
export async function readFreshData<TData>(
  refetch: () => Promise<{ data?: TData; isError: boolean; error: Error | null }>,
): Promise<TData | undefined> {
  const result = await refetch();

  if (result.isError) {
    throw result.error ?? new Error("최신 데이터를 불러오지 못했습니다.");
  }

  return result.data;
}

export function resetFinanceMonthForTest() {
  selectedFinanceMonth = undefined;
  notifyFinanceMonth();
}

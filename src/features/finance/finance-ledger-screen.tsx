"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard } from "@/components/shared/section-card";
import { ListStatusAlert } from "@/components/management/list-controls";
import { useListPaging } from "@/components/management/use-list-paging";
import { PageHeaderActionFallback, usePageHeaderActions } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LedgerEntry } from "@/domain/book-sale";
import { getFinanceCurrentMonth, toMonthDateRange } from "@/domain/finance-date";
import { buildFinanceLedgerPage, buildLedgerMonthTotals, type BuildFinanceLedgerListOptions } from "@/domain/finance-ledger";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  buildFinanceLedgerListQueryKey,
  createFinanceLedgerListQueryOptions,
  type RegisterManualLedgerEntryInput,
} from "@/lib/api/finance";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FinanceLedgerCalendar } from "./finance-ledger-calendar";
import { downloadFinanceCsv } from "./finance-ledger-export";
import { DEFAULT_LEDGER_SORT, FinanceLedgerFilters, sortOptions, useLedgerFilters } from "./finance-ledger-filters";
import { LedgerEditDialog, LedgerRegisterDialog } from "./finance-ledger-form";
import { useLedgerMutations } from "./finance-ledger-mutations";
import { LedgerMonthSummary } from "./finance-ledger-summary";
import { FinanceLedgerTable, LedgerDeleteDialog } from "./finance-ledger-table";
import { createMissingSupabaseClientState, useFinanceMonth } from "./finance-shared";
import type {
  FinanceLedgerListQueryOptions,
  FinanceLedgerListQueryOptionsFactory,
  FinanceLedgerSupabaseClient,
  SupabaseClientState,
} from "./finance-types";

export type FinanceLedgerListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: FinanceLedgerListQueryOptionsFactory;
  registerManualLedgerEntry?: (input: RegisterManualLedgerEntryInput) => void | Promise<void>;
  updateLedgerEntry?: (input: LedgerEntry) => void | Promise<void>;
  deleteLedgerEntry?: (input: { ledgerId: string }) => void | Promise<void>;
};

const MONTH_EMPTY_MESSAGE = "이 달에 기록된 입출입내역이 없습니다.";
const FILTER_EMPTY_MESSAGE = "조건에 맞는 입출금 내역이 없습니다.";

export function FinanceLedgerListScreen({
  academyId,
  queryOptionsFactory,
  registerManualLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
}: FinanceLedgerListScreenProps) {
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const paging = useListPaging();
  const { filters, change: changeFilters, reset: resetFilters } = useLedgerFilters(paging.resetPage);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntry | null>(null);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createFinanceLedgerSupabaseClient()),
    [hasInjectedQueryOptions],
  );
  const isQueryEnabled = hasInjectedQueryOptions || !supabaseClientState?.error;
  const monthRange = useMemo(() => toMonthDateRange(month), [month]);
  const dateRange = filters.customRange ?? monthRange;
  const isRangeChanged = dateRange.from !== monthRange.from || dateRange.to !== monthRange.to;
  const hasActiveFilter =
    Boolean(filters.search.trim() || filters.type || filters.source || filters.category) || isRangeChanged;
  const selectedSort = (sortOptions.find((option) => option.value === filters.sortValue) ?? DEFAULT_LEDGER_SORT).sort;

  function buildQueryOptions(options: BuildFinanceLedgerListOptions) {
    return queryOptionsFactory
      ? queryOptionsFactory(options)
      : createDefaultQueryOptions(options, supabaseClientState ?? createMissingSupabaseClientState());
  }

  const listQueryOptions = buildQueryOptions({
    academyId,
    search: filters.search,
    dateRange,
    filters: {
      type: filters.type || undefined,
      source: filters.source || undefined,
      category: filters.category || undefined,
    },
    sort: selectedSort,
  });
  // 월 합계는 검색·필터·기간 변경과 무관하게 그 월 전체 원장으로 계산한다.
  const monthQueryOptions = buildQueryOptions({
    academyId,
    dateRange: monthRange,
    sort: DEFAULT_LEDGER_SORT.sort,
  });
  const ledgerListQuery = useQuery({
    ...listQueryOptions,
    enabled: isQueryEnabled,
    // 검색·필터를 입력하는 동안 표가 비었다 다시 채워지며 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });
  const monthQuery = useQuery({ ...monthQueryOptions, enabled: isQueryEnabled });
  const entries = useMemo(() => ledgerListQuery.data ?? [], [ledgerListQuery.data]);
  const monthTotals = useMemo(
    () => (monthQuery.data ? buildLedgerMonthTotals(monthQuery.data, month) : null),
    [monthQuery.data, month],
  );
  const ledgerPage = useMemo(
    () => buildFinanceLedgerPage(entries, { page: paging.page, pageSize: paging.pageSize }),
    [entries, paging.page, paging.pageSize],
  );
  const loadError = ledgerListQuery.error ?? monthQuery.error;
  const { register, update, remove } = useLedgerMutations({
    academyId,
    clientState: supabaseClientState,
    handlers: { registerManualLedgerEntry, updateLedgerEntry, deleteLedgerEntry },
    onRegistered: () => setIsManualOpen(false),
    onUpdated: () => setEditingEntry(null),
    onDeleteSettled: () => setDeletingEntry(null),
  });
  const registerEntry = register.mutate;
  const headerActions = useMemo(
    () => (
      <>
        <LedgerRegisterDialog
          contextMonth={month}
          open={isManualOpen}
          pending={register.isPending}
          onOpenChange={setIsManualOpen}
          onSubmit={(values) => registerEntry({ academyId, ...values })}
        />
        <Button
          type="button"
          variant="outline"
          title="엑셀에서 열 수 있는 CSV 파일"
          onClick={() => downloadFinanceCsv(entries, dateRange)}
        >
          <Download aria-hidden="true" />
          엑셀 내보내기
        </Button>
      </>
    ),
    [academyId, dateRange, entries, isManualOpen, month, register.isPending, registerEntry],
  );
  const isHeaderActionMounted = usePageHeaderActions(headerActions);

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4" aria-label="입출금 내역">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {headerActions}
      </PageHeaderActionFallback>

      <FinanceLedgerFilters
        dateRange={dateRange}
        filters={filters}
        hasActiveFilter={hasActiveFilter}
        maxMonth={maxMonth}
        month={month}
        onChange={changeFilters}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          changeFilters({ customRange: null });
        }}
        onReset={() => {
          resetFilters();
          setMonth(getFinanceCurrentMonth());
        }}
      />

      <LedgerMonthSummary totals={monthTotals} />

      {!hasInjectedQueryOptions && supabaseClientState?.error ? (
        <ListStatusAlert
          message="입출금 내역을 불러오지 못했습니다."
          detail={toUserMessage(supabaseClientState.error)}
        />
      ) : null}

      {loadError ? (
        <ListStatusAlert
          message="입출금 내역을 불러오지 못했습니다."
          detail={toUserMessage(loadError)}
          onRetry={() => {
            void ledgerListQuery.refetch();
            void monthQuery.refetch({ cancelRefetch: false });
          }}
        />
      ) : null}

      <Tabs defaultValue="list" className="min-w-0 gap-3">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
          <TabsTrigger value="list">목록</TabsTrigger>
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="min-w-0">
          {ledgerListQuery.isLoading ? (
            <SectionCard padded={false}>
              <EmptyState>입출금 내역을 불러오는 중입니다.</EmptyState>
            </SectionCard>
          ) : null}
          {!ledgerListQuery.isLoading && !ledgerListQuery.isError && isQueryEnabled ? (
            <FinanceLedgerTable
              emptyMessage={hasActiveFilter ? FILTER_EMPTY_MESSAGE : MONTH_EMPTY_MESSAGE}
              isRefreshing={ledgerListQuery.isPlaceholderData}
              view={ledgerPage}
              onDelete={setDeletingEntry}
              onEdit={setEditingEntry}
              onPageChange={paging.goToPage}
              onPageSizeChange={paging.changePageSize}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="calendar">
          <FinanceLedgerCalendar month={month} entries={entries} />
        </TabsContent>
      </Tabs>

      <LedgerEditDialog
        entry={editingEntry}
        pending={update.isPending}
        onClose={() => setEditingEntry(null)}
        onSubmit={(entry, values) => update.mutate({ ...entry, ...values })}
      />

      <LedgerDeleteDialog
        entry={deletingEntry}
        isDeleting={remove.isPending}
        onConfirm={(entry) => remove.mutate(entry)}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
      />
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildFinanceLedgerListOptions,
  supabaseClientState: SupabaseClientState,
): FinanceLedgerListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: buildFinanceLedgerListQueryKey(options),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createFinanceLedgerListQueryOptions(supabaseClientState.client, options);
}

function createFinanceLedgerSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as FinanceLedgerSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

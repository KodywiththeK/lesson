"use client";

import { useId, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { ListSearchField, ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { MonthField } from "@/components/operations/date-time-fields";
import { Label } from "@/components/ui/label";
import type { BookPaidRow, BuildBookPaidListOptions } from "@/domain/book-sale";
import type { ListView } from "@/domain/common-list";
import { getFinanceCurrentMonth } from "@/domain/finance-date";
import { cancelBookReleasePayment, createPaidBookReleasesQueryOptions } from "@/lib/api/books";
import { invalidateAfterBookChange } from "@/lib/api/query-invalidation";
import { toUserMessage } from "@/lib/errors/user-message";

import { BookPaidCancelDialog } from "./book-paid-cancel-dialog";
import { BookPaidTable } from "./book-paid-table";
import {
  createBookSupabaseClientState,
  orUnavailableQueryOptions,
  requireBookSupabaseClient,
} from "./book-supabase";

type BookPaidQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<BookPaidRow>>;
};

export type BookPaidQueryOptionsFactory = (options: BuildBookPaidListOptions) => BookPaidQueryOptions;

type BookPaidScreenProps = {
  academyId: string;
  /** 결제 취소는 원장만 할 수 있다. 데스크는 읽기 전용이다. */
  canCancelPayment: boolean;
  queryOptionsFactory?: BookPaidQueryOptionsFactory;
  cancelBookPayment?: (input: { releaseId: string; reason: string }) => void | Promise<void>;
};

/** 결제 완료 탭: 입금일이 고른 달인 결제 완료 기록(읽기 전용)과 원장의 결제 취소. */
export function BookPaidScreen({
  academyId,
  canCancelPayment,
  queryOptionsFactory,
  cancelBookPayment,
}: BookPaidScreenProps) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const [month, setMonth] = useState(getFinanceCurrentMonth);
  const [search, setSearch] = useState("");
  const [cancelingSale, setCancelingSale] = useState<BookPaidRow | null>(null);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const clientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createBookSupabaseClientState()),
    [hasInjectedQueryOptions],
  );
  const client = clientState?.client ?? null;

  const listOptions: BuildBookPaidListOptions = { academyId, month, search, page, pageSize };
  const paidQuery = useQuery({
    ...orUnavailableQueryOptions(
      queryOptionsFactory?.(listOptions) ?? (client && createPaidBookReleasesQueryOptions(client, listOptions)),
    ),
    enabled: hasInjectedQueryOptions || client !== null,
    placeholderData: keepPreviousData,
  });
  const cancelMutation = useMutation({
    mutationFn: async (input: { releaseId: string; reason: string }) => {
      if (cancelBookPayment) {
        await cancelBookPayment(input);
        return;
      }

      await cancelBookReleasePayment(requireBookSupabaseClient(clientState), { academyId, ...input });
    },
    onSuccess: () => {
      setCancelingSale(null);
      toast.success("결제를 취소했습니다. 다시 결제를 확정하려면 출고를 삭제하고 새로 등록해 주세요.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("결제 취소에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const paidView = paidQuery.data;

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    resetPage();
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <SectionHeader
        headingId={headingId}
        title="결제 완료"
        description="최종 확인이 완료된 도서 출고 기록입니다. 수정·삭제는 불가능하며 기록으로 남습니다. 결제를 잘못 확인했다면 원장이 결제를 취소할 수 있습니다."
      />

      <SectionCard padded={false}>
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[12rem_minmax(12rem,24rem)]">
          <Label className="grid gap-1 text-sm font-medium">
            <span>조회 월</span>
            <MonthField aria-label="조회 월" required max={getFinanceCurrentMonth()} value={month} onValueChange={changeMonth} />
          </Label>
          <ListSearchField
            label="결제 완료 검색"
            value={search}
            onChange={changeSearch}
            placeholder="이름 또는 도서명"
          />
        </div>

        {clientState?.error ? (
          <ListStatusAlert message="결제 완료 목록을 불러오지 못했습니다." detail={toUserMessage(clientState.error)} />
        ) : null}

        {paidQuery.isError ? (
          <ListStatusAlert message="결제 완료 목록을 불러오지 못했습니다." detail={toUserMessage(paidQuery.error)} />
        ) : null}

        {paidQuery.isLoading ? (
          <EmptyState>결제 완료 목록을 불러오는 중입니다.</EmptyState>
        ) : null}

        {paidView && !paidQuery.isError ? (
          <>
            <BookPaidTable
              sales={paidView.items}
              isSearching={search.trim() !== ""}
              canCancelPayment={canCancelPayment}
              onCancelPayment={setCancelingSale}
            />
            <ListPagination
              itemLabel="결제 완료"
              countUnit="건"
              view={paidView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </SectionCard>

      <BookPaidCancelDialog
        sale={cancelingSale}
        isCancelling={cancelMutation.isPending}
        onClose={() => setCancelingSale(null)}
        onConfirm={(sale, reason) => cancelMutation.mutate({ releaseId: sale.saleId, reason })}
      />
    </section>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { ListSearchField, ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import type { BookShipmentRow, BuildBookShipmentListOptions } from "@/domain/book-sale";
import type { BookStockRow } from "@/domain/book-stock";
import type { ListView } from "@/domain/common-list";
import type { StudentListRow } from "@/domain/student-list";
import {
  createBookOptionsQueryOptions,
  createPendingBookReleasesQueryOptions,
} from "@/lib/api/books";
import { invalidateAfterBookChange } from "@/lib/api/query-invalidation";
import { createStudentOptionsQueryOptions } from "@/lib/api/students";
import { toUserMessage } from "@/lib/errors/user-message";

import { BookShipmentDeleteDialog } from "./book-shipment-delete-dialog";
import { BookShipmentEditDialog } from "./book-shipment-edit-dialog";
import { BookShipmentForm } from "./book-shipment-form";
import { createBookShipmentOperations, type BookShipmentOperationOverrides } from "./book-shipment-operations";
import { BookShipmentPaymentDialog } from "./book-shipment-payment-dialog";
import { createBookSupabaseClientState, orUnavailableQueryOptions } from "./book-supabase";
import { BookShipmentTable } from "./book-shipment-table";

type BookShipmentQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<BookShipmentRow>>;
};

export type BookShipmentQueryOptionsFactory = (options: BuildBookShipmentListOptions) => BookShipmentQueryOptions;

type BookOptionsQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<BookStockRow[]>;
};

type BookShipmentScreenProps = BookShipmentOperationOverrides & {
  academyId: string;
  /** 원장만 결제 완료 처리와 바로 결제 완료 등록을 할 수 있다. */
  canRecordPayment: boolean;
  queryOptionsFactory?: BookShipmentQueryOptionsFactory;
  /** 출고 폼의 도서 선택지(보관하지 않은 교재 전체). 없으면 Supabase에서 조회한다. */
  bookOptionsQueryOptionsFactory?: () => BookOptionsQueryOptions;
  /** 출고 폼의 재원 원생 선택지. 없으면 Supabase에서 조회한다. */
  students?: StudentListRow[];
};

const NO_BOOKS: BookStockRow[] = [];
const NO_STUDENTS: StudentListRow[] = [];

/** 출고 탭: 출고 등록 폼과 결제 대기 출고목록(수정·삭제·결제 완료 처리). */
export function BookShipmentScreen({
  academyId,
  canRecordPayment,
  queryOptionsFactory,
  bookOptionsQueryOptionsFactory,
  students,
  registerBookRelease,
  updateBookRelease,
  deleteBookRelease,
  completeBookPayment,
}: BookShipmentScreenProps) {
  const queryClient = useQueryClient();
  const purchaseHeadingId = useId();
  const shipmentsHeadingId = useId();
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const [search, setSearch] = useState("");
  const [formVersion, setFormVersion] = useState(0);
  const [editingShipment, setEditingShipment] = useState<BookShipmentRow | null>(null);
  const [deletingShipment, setDeletingShipment] = useState<BookShipmentRow | null>(null);
  const [payingShipment, setPayingShipment] = useState<BookShipmentRow | null>(null);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const clientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createBookSupabaseClientState()),
    [hasInjectedQueryOptions],
  );
  const client = clientState?.client ?? null;
  const operations = createBookShipmentOperations(academyId, clientState, {
    registerBookRelease,
    updateBookRelease,
    deleteBookRelease,
    completeBookPayment,
  });

  const listOptions: BuildBookShipmentListOptions = { academyId, search, page, pageSize };
  const shipmentsQuery = useQuery({
    ...orUnavailableQueryOptions(
      queryOptionsFactory?.(listOptions) ?? (client && createPendingBookReleasesQueryOptions(client, listOptions)),
    ),
    enabled: hasInjectedQueryOptions || client !== null,
    placeholderData: keepPreviousData,
  });
  const bookOptionsQuery = useQuery({
    ...orUnavailableQueryOptions(
      bookOptionsQueryOptionsFactory?.() ?? (client && createBookOptionsQueryOptions(client, academyId)),
    ),
    enabled: Boolean(bookOptionsQueryOptionsFactory) || client !== null,
  });
  const studentOptionsQuery = useQuery({
    ...orUnavailableQueryOptions(client && createStudentOptionsQueryOptions(client, academyId)),
    enabled: !students && client !== null,
  });
  const bookOptions = bookOptionsQuery.data ?? NO_BOOKS;
  const studentOptions = students ?? studentOptionsQuery.data ?? NO_STUDENTS;

  const registerMutation = useMutation({
    mutationFn: operations.register,
    onSuccess: () => {
      setFormVersion((version) => version + 1);
      toast.success("교재 출고를 등록했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 출고 등록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const updateMutation = useMutation({
    mutationFn: operations.update,
    onSuccess: () => {
      setEditingShipment(null);
      toast.success("출고 내역을 수정했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 출고 수정에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: operations.remove,
    onSuccess: () => {
      setDeletingShipment(null);
      toast.success("출고 내역을 삭제했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("출고 내역 삭제에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const completePaymentMutation = useMutation({
    mutationFn: operations.completePayment,
    onSuccess: () => {
      setPayingShipment(null);
      toast.success("교재 결제 완료 처리를 했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 결제 완료 처리에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  const shipmentsView = shipmentsQuery.data;
  const optionLoadError = clientState?.error ?? bookOptionsQuery.error ?? studentOptionsQuery.error;

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby={purchaseHeadingId} className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <h2 id={purchaseHeadingId} className="text-lg font-semibold">
          도서 구매 목록
        </h2>
        {optionLoadError ? (
          <ListStatusAlert message="원생 또는 도서 목록을 불러오지 못했습니다." detail={toUserMessage(optionLoadError)} />
        ) : null}
        <BookShipmentForm
          key={formVersion}
          students={studentOptions}
          books={bookOptions}
          canRecordPayment={canRecordPayment}
          isSubmitting={registerMutation.isPending}
          onSubmit={(registration) => registerMutation.mutate(registration)}
        />
      </section>

      <section aria-labelledby={shipmentsHeadingId} className="grid gap-3">
        <div>
          <h2 id={shipmentsHeadingId} className="text-lg font-semibold">
            출고목록
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            등록된 출고 내역을 확인 및 수정·삭제하거나, 최종확인하여 결제 완료 단계로 넘길 수 있습니다.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border p-4 sm:max-w-md">
            <ListSearchField
              label="출고 검색"
              value={search}
              onChange={changeSearch}
              placeholder="이름 또는 도서명"
            />
          </div>

          {shipmentsQuery.isError ? (
            <ListStatusAlert message="출고 목록을 불러오지 못했습니다." detail={toUserMessage(shipmentsQuery.error)} />
          ) : null}

          {shipmentsQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">출고 목록을 불러오는 중입니다.</p>
          ) : null}

          {shipmentsView && !shipmentsQuery.isError ? (
            <>
              <BookShipmentTable
                shipments={shipmentsView.items}
                isSearching={search.trim() !== ""}
                canRecordPayment={canRecordPayment}
                onEdit={setEditingShipment}
                onDelete={setDeletingShipment}
                onCompletePayment={setPayingShipment}
              />
              <ListPagination
                itemLabel="출고"
                countUnit="건"
                view={shipmentsView}
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            </>
          ) : null}
        </div>
      </section>

      <BookShipmentEditDialog
        shipment={editingShipment}
        students={studentOptions}
        books={bookOptions}
        isSubmitting={updateMutation.isPending}
        onSubmit={(update) => updateMutation.mutate(update)}
        onClose={() => setEditingShipment(null)}
      />
      <BookShipmentDeleteDialog
        shipment={deletingShipment}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingShipment(null)}
        onConfirm={(shipment) => deleteMutation.mutate({ releaseId: shipment.saleId })}
      />
      <BookShipmentPaymentDialog
        shipment={payingShipment}
        isPending={completePaymentMutation.isPending}
        onClose={() => setPayingShipment(null)}
        onConfirm={(shipment, paidAt) =>
          completePaymentMutation.mutate({ releaseId: shipment.saleId, paidAt })
        }
      />
    </div>
  );
}

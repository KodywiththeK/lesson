"use client";

import { useMemo, useState } from "react";
import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { BookPlus } from "lucide-react";
import { toast } from "sonner";

import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import { ListSearchField, ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ListSortDirection, ListView } from "@/domain/common-list";
import type {
  BookStockListRow,
  BookStockRow,
  BuildBookStockListOptions,
} from "@/domain/book-stock";
import {
  createBookOptionsQueryOptions,
  createBookStockListQueryOptions,
} from "@/lib/api/books";
import { invalidateAfterBookChange } from "@/lib/api/query-invalidation";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

import { BookStockDeleteDialog } from "./book-stock-delete-dialog";
import { BookStockFormDialog } from "./book-stock-form-dialog";
import { didRestock } from "./book-stock-form-state";
import {
  createBookStockOperations,
  createSupabaseClientState,
  type BookStockOperationOverrides,
} from "./book-stock-operations";
import { BookStockTable } from "./book-stock-table";

type BookQueryOptions<TData> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TData>;
};

export type BookStockListQueryOptionsFactory = (
  options: BuildBookStockListOptions,
) => BookQueryOptions<ListView<BookStockListRow>>;

type BookStockScreenProps = BookStockOperationOverrides & {
  academyId: string;
  /** 데모·테스트가 재고 목록 조회를 대신할 때 넘긴다. 없으면 Supabase에서 읽는다. */
  queryOptionsFactory?: BookStockListQueryOptionsFactory;
  /** 등록 폼의 재입고 미리보기와 도서명 중복 검사에 쓰는 전체 교재 조회. 목록 페이지와 별개다. */
  bookOptionsQueryOptions?: () => BookQueryOptions<BookStockRow[]>;
};

const NO_BOOKS: BookStockRow[] = [];

export function BookStockScreen({
  academyId,
  queryOptionsFactory,
  bookOptionsQueryOptions,
  ...operationOverrides
}: BookStockScreenProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<ListSortDirection>("asc");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookStockListRow | null>(null);
  const [deletingBook, setDeletingBook] = useState<BookStockListRow | null>(null);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createSupabaseClientState()),
    [hasInjectedQueryOptions],
  );
  const supabaseClient = supabaseClientState?.client ?? null;
  const operations = createBookStockOperations(academyId, supabaseClientState, operationOverrides);

  const currentOptions: BuildBookStockListOptions = { academyId, search, sortOrder, page, pageSize };
  const stockListQuery = useQuery({
    ...(queryOptionsFactory?.(currentOptions) ??
      (supabaseClient
        ? createBookStockListQueryOptions(supabaseClient, currentOptions)
        : { queryKey: queryKeys.books.stockList(academyId), queryFn: skipToken })),
    placeholderData: keepPreviousData,
  });
  const bookOptionsQuery = useQuery(
    bookOptionsQueryOptions?.() ??
      (supabaseClient
        ? createBookOptionsQueryOptions(supabaseClient, academyId)
        : { queryKey: queryKeys.books.options(academyId), queryFn: skipToken }),
  );
  const bookOptions = bookOptionsQuery.data ?? NO_BOOKS;

  const countPendingReleases = operations.countPendingReleases;
  const pendingReleaseQuery = useQuery({
    queryKey: [...queryKeys.books.all(academyId), "pending-release-count", deletingBook?.bookId ?? ""],
    queryFn: deletingBook && countPendingReleases ? () => countPendingReleases(deletingBook) : skipToken,
    // 열 때마다 새로 세고, 조회에 실패하면 안내만 생략하므로 다시 시도하지 않는다.
    gcTime: 0,
    retry: false,
  });

  const registerMutation = useMutation({
    mutationFn: operations.register,
    onSuccess: (savedBook, input) => {
      setIsRegistrationOpen(false);
      toast.success(
        didRestock(bookOptions, academyId, input, savedBook)
          ? "기존 교재에 권수를 합산했습니다."
          : "교재를 등록했습니다.",
      );
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 등록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const updateMutation = useMutation({
    mutationFn: operations.update,
    onSuccess: () => {
      setEditingBook(null);
      toast.success("교재를 수정했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 수정에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: operations.remove,
    onSuccess: () => {
      setDeletingBook(null);
      toast.success("교재를 삭제했습니다.");
      invalidateAfterBookChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("교재 삭제에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  const registrationAction = (
    <BookStockFormDialog
      open={isRegistrationOpen}
      onOpenChange={setIsRegistrationOpen}
      trigger={
        <Button type="button">
          <BookPlus aria-hidden="true" />
          교재 등록
        </Button>
      }
      academyId={academyId}
      books={bookOptions}
      isSubmitting={registerMutation.isPending}
      onSubmit={(input) => registerMutation.mutate(input)}
    />
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);
  const listView = stockListQuery.data;
  const loadError = supabaseClientState?.error ?? (stockListQuery.isError ? stockListQuery.error : null);

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  function changeSortOrder(nextSortOrder: ListSortDirection) {
    setSortOrder(nextSortOrder);
    resetPage();
  }

  return (
    <section className="grid gap-4" aria-label="교재 재고">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">교재 등록 관리</h2>
          <p className="text-sm text-muted-foreground">새로운 교재를 입고 및 등록합니다.</p>
        </div>
        <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
          {registrationAction}
        </PageHeaderActionFallback>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[1fr_minmax(12rem,20rem)_auto] lg:items-end">
          <h2 className="text-lg font-semibold">교재 재고 상태</h2>
          <ListSearchField
            label="도서명 검색"
            value={search}
            onChange={changeSearch}
            placeholder="도서명 필터 검색…"
          />
          <div className="grid gap-1 text-sm font-medium">
            <span>정렬</span>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-label="도서명 정렬"
              value={sortOrder}
              onValueChange={(nextSortOrder) => {
                // 선택된 항목을 다시 누르면 값이 비므로 무시해 정렬 방향이 항상 하나 선택되게 한다.
                if (nextSortOrder === "asc" || nextSortOrder === "desc") {
                  changeSortOrder(nextSortOrder);
                }
              }}
            >
              <ToggleGroupItem value="asc">오름차순</ToggleGroupItem>
              <ToggleGroupItem value="desc">내림차순</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {loadError ? (
          <ListStatusAlert message="교재 재고를 불러오지 못했습니다." detail={toUserMessage(loadError)} />
        ) : null}

        {stockListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">교재 재고를 불러오는 중입니다.</p>
        ) : null}

        {listView && !stockListQuery.isError ? (
          <>
            <BookStockTable
              books={listView.items}
              emptyMessage={search.trim() ? "조건에 맞는 교재가 없습니다." : "재고 도서가 없습니다."}
              onEdit={setEditingBook}
              onDelete={setDeletingBook}
            />
            <ListPagination
              itemLabel="교재"
              countUnit="건"
              view={listView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </div>

      {editingBook ? (
        <BookStockFormDialog
          key={editingBook.bookId}
          open
          onOpenChange={(open) => (open ? undefined : setEditingBook(null))}
          academyId={academyId}
          books={bookOptions}
          book={editingBook}
          isSubmitting={updateMutation.isPending}
          onSubmit={(input) => updateMutation.mutate({ bookId: editingBook.bookId, ...input })}
        />
      ) : null}

      <BookStockDeleteDialog
        book={deletingBook}
        pendingReleases={{
          isChecking: pendingReleaseQuery.isLoading,
          count: pendingReleaseQuery.isSuccess ? pendingReleaseQuery.data : null,
        }}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingBook(null)}
        onConfirm={(book) => deleteMutation.mutate({ bookId: book.bookId })}
      />
    </section>
  );
}

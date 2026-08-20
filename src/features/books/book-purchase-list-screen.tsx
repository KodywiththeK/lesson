"use client";

import { useMemo, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { BookOpenCheck, RotateCcw } from "lucide-react";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatBookSaleStatus,
  type BookPurchaseListRow,
  type BookSaleStatus,
  type BuildBookPurchaseListOptions,
} from "@/domain/book-sale";
import {
  createBookPurchaseListQueryOptions,
  type BookPurchaseListSupabaseClient,
} from "@/lib/api/books";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type BookPurchaseListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<BookPurchaseListRow[]>;
};

export type BookPurchaseListQueryOptionsFactory = (
  options: BuildBookPurchaseListOptions,
) => BookPurchaseListQueryOptions;

type BookPurchaseListScreenProps = {
  academyId: string;
  academyName: string;
  queryOptionsFactory?: BookPurchaseListQueryOptionsFactory;
};

type SupabaseClientState =
  | {
      client: BookPurchaseListSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const statusFilterOptions: Array<{
  value: BookSaleStatus;
  label: string;
}> = [
  { value: "payment-pending", label: formatBookSaleStatus("payment-pending") },
  { value: "paid", label: formatBookSaleStatus("paid") },
];

export function BookPurchaseListScreen({
  academyId,
  academyName,
  queryOptionsFactory,
}: BookPurchaseListScreenProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<BookSaleStatus | "">("");
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedQueryOptions ? null : createBookPurchaseListSupabaseClient(),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildBookPurchaseListOptions = {
    academyId,
    search,
    filters: {
      status: status || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const bookPurchaseListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const purchases = bookPurchaseListQuery.data ?? [];

  return (
    <section className="grid gap-4" aria-labelledby="book-purchase-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="book-purchase-heading" className="text-2xl font-semibold">
            교재 구매 목록
          </h2>
        </div>
        <Button type="button">
          <BookOpenCheck aria-hidden="true" />
          교재 출고
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="교재 구매 검색"
            value={search}
            onChange={setSearch}
            placeholder="원생명, 교재명, 출고일"
          />
          <ListFilterSelect
            label="결제 상태 필터"
            value={status}
            options={statusFilterOptions}
            onChange={(nextStatus) =>
              setStatus(nextStatus as BookSaleStatus | "")
            }
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 교재 구매 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {bookPurchaseListQuery.isError ? (
          <ListStatusAlert
            message="교재 구매 목록을 불러오지 못했습니다."
            detail={bookPurchaseListQuery.error.message}
          />
        ) : null}

        {bookPurchaseListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            교재 구매 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!bookPurchaseListQuery.isLoading &&
        !bookPurchaseListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <BookPurchaseListTable purchases={purchases} />
        ) : null}
      </div>
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildBookPurchaseListOptions,
  supabaseClientState: SupabaseClientState,
): BookPurchaseListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.books.purchaseList(options.academyId, {
        q: options.search,
        status: options.filters?.status,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createBookPurchaseListQueryOptions(supabaseClientState.client, options);
}

function createBookPurchaseListSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as BookPurchaseListSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

function BookPurchaseListTable({
  purchases,
}: {
  purchases: BookPurchaseListRow[];
}) {
  if (purchases.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 교재 구매 내역이 없습니다.
      </p>
    );
  }

  return (
    <Table aria-label="교재 구매 목록" className="min-w-[46rem]">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">원생</TableHead>
          <TableHead className="px-4 py-3">교재명</TableHead>
          <TableHead className="px-4 py-3">가격</TableHead>
          <TableHead className="px-4 py-3">출고일</TableHead>
          <TableHead className="px-4 py-3">결제 상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {purchases.map((purchase) => (
          <TableRow key={purchase.saleId}>
            <TableCell className="px-4 py-3 font-medium">
              {purchase.studentName}
            </TableCell>
            <TableCell className="px-4 py-3">{purchase.bookTitle}</TableCell>
            <TableCell className="px-4 py-3">
              {formatWon(purchase.autoFilledPrice)}
            </TableCell>
            <TableCell className="px-4 py-3">{purchase.shippedAt}</TableCell>
            <TableCell className="px-4 py-3">
              <Badge
                variant={
                  purchase.status === "paid" ? "secondary" : "outline"
                }
              >
                {formatBookSaleStatus(purchase.status)}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

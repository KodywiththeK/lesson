"use client";

import { useMemo, useState } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { RotateCcw, TicketPlus } from "lucide-react";

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
  formatLessonTicketStatus,
  type BuildLessonTicketListOptions,
  type LessonTicketListRow,
  type LessonTicketStatus,
} from "@/domain/lesson-ticket";
import {
  createLessonTicketListQueryOptions,
  type LessonTicketListSupabaseClient,
} from "@/lib/api/lesson-tickets";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LessonTicketListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LessonTicketListRow[]>;
};

export type LessonTicketListQueryOptionsFactory = (
  options: BuildLessonTicketListOptions,
) => LessonTicketListQueryOptions;

type LessonTicketListScreenProps = {
  academyId: string;
  academyName: string;
  today: string;
  queryOptionsFactory?: LessonTicketListQueryOptionsFactory;
};

type SupabaseClientState =
  | {
      client: LessonTicketListSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const statusFilterOptions: Array<{
  value: LessonTicketStatus;
  label: string;
}> = [
  { value: "low-remaining", label: formatLessonTicketStatus("low-remaining") },
  { value: "expiring-soon", label: formatLessonTicketStatus("expiring-soon") },
  { value: "expired", label: formatLessonTicketStatus("expired") },
  { value: "exhausted", label: formatLessonTicketStatus("exhausted") },
];

const defaultThresholds = {
  lowRemainingThreshold: 2,
  expiringWithinDays: 7,
};

export function LessonTicketListScreen({
  academyId,
  academyName,
  today,
  queryOptionsFactory,
}: LessonTicketListScreenProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LessonTicketStatus | "">("");
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const supabaseClientState = useMemo(
    () => (hasInjectedQueryOptions ? null : createLessonTicketSupabaseClient()),
    [hasInjectedQueryOptions],
  );

  const currentOptions: BuildLessonTicketListOptions = {
    academyId,
    today,
    ...defaultThresholds,
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
  const lessonTicketListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const tickets = lessonTicketListQuery.data ?? [];

  return (
    <section className="grid gap-4" aria-labelledby="lesson-ticket-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="lesson-ticket-heading" className="text-2xl font-semibold">
            회차권 목록
          </h2>
        </div>
        <Button type="button">
          <TicketPlus aria-hidden="true" />
          회차권 등록
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="회차권 검색"
            value={search}
            onChange={setSearch}
            placeholder="원생명, 악기, 유효기간, 상태"
          />
          <ListFilterSelect
            label="회차권 상태 필터"
            value={status}
            options={statusFilterOptions}
            onChange={(nextStatus) =>
              setStatus(nextStatus as LessonTicketStatus | "")
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
            message="Supabase 환경변수가 설정되면 회차권 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {lessonTicketListQuery.isError ? (
          <ListStatusAlert
            message="회차권 목록을 불러오지 못했습니다."
            detail={lessonTicketListQuery.error.message}
          />
        ) : null}

        {lessonTicketListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            회차권 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!lessonTicketListQuery.isLoading &&
        !lessonTicketListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <LessonTicketTable tickets={tickets} />
        ) : null}
      </div>
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildLessonTicketListOptions,
  supabaseClientState: SupabaseClientState,
): LessonTicketListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.lessonTickets.list(options.academyId, {
        q: options.search,
        status: options.filters?.status,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createLessonTicketListQueryOptions(supabaseClientState.client, options);
}

function createLessonTicketSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as LessonTicketListSupabaseClient,
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

function LessonTicketTable({ tickets }: { tickets: LessonTicketListRow[] }) {
  if (tickets.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 회차권이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="회차권 목록" className="min-w-[54rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">총 부여</TableHead>
            <TableHead className="px-4 py-3">잔여</TableHead>
            <TableHead className="px-4 py-3">유효기간</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.ticketId}>
              <TableCell className="px-4 py-3 font-medium">
                {ticket.studentName}
              </TableCell>
              <TableCell className="px-4 py-3">
                {ticket.instrumentName}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatCount(ticket.totalGrantedCount)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatCount(ticket.remainingCount)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {ticket.validFrom} ~ {ticket.validUntil}
              </TableCell>
              <TableCell className="px-4 py-3">
                <span className="flex flex-wrap gap-1">
                  {ticket.statuses.length > 0 ? (
                    ticket.statuses.map((status) => (
                      <Badge key={status} variant={getStatusVariant(status)}>
                        {formatLessonTicketStatus(status)}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">정상</Badge>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getStatusVariant(status: LessonTicketStatus) {
  return status === "expired" || status === "exhausted"
    ? "destructive"
    : "outline";
}

function formatCount(count: number) {
  return `${count}회`;
}

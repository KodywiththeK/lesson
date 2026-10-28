"use client";

import { useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/management/list-pagination";
import { ListStatusAlert } from "@/components/management/list-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildListView, type PageSizeOption } from "@/domain/common-list";
import { toFinanceDate } from "@/domain/finance-date";
import type { LessonTicketCancellationHistoryRow } from "@/lib/api/lesson-tickets";
import { fetchAllRows, type PagedSelectQuery } from "@/lib/api/paged-query";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

type HistoryRow = LessonTicketCancellationHistoryRow;
type HistoryClient = { from(table: "lesson_ticket_cancellation_history"): { select(columns: string): PagedSelectQuery<HistoryRow> } };

export function LessonTicketCancellationHistory({ academyId, client, rows, search, page, pageSize, onPageChange, onPageSizeChange }: {
  academyId: string; client: unknown; search: string; page: number; pageSize: PageSizeOption;
  rows?: HistoryRow[];
  onPageChange: (page: number) => void; onPageSizeChange: (size: PageSizeOption) => void;
}) {
  const query = useQuery({
    queryKey: [...queryKeys.academy(academyId), "lesson-tickets", "cancellation-history"],
    queryFn: () => fetchAllRows("사용취소 이력을 불러오지 못했습니다", (from, to) =>
      (client as HistoryClient).from("lesson_ticket_cancellation_history").select("id, mode, student_name, instrument_name, total_count, remaining_count, registered_at, valid_until, refund_amount, occurred_at")
        .eq("academy_id", academyId).order("occurred_at", { ascending: false }).order("id").range(from, to)),
    enabled: Boolean(client) && !rows,
  });
  if (!client && !rows) return <EmptyState>사용취소 이력을 불러올 수 없습니다.</EmptyState>;
  if (!rows && query.isLoading) return <EmptyState>사용취소 이력을 불러오는 중입니다.</EmptyState>;
  if (!rows && query.isError) return <ListStatusAlert message="사용취소 이력을 불러오지 못했습니다." detail={toUserMessage(query.error)} />;
  const view = buildListView(rows ?? query.data ?? [], {
    getName: (row) => row.student_name ?? "", getSortValue: (row) => row.occurred_at,
    sortDirection: "desc", getTieBreaker: (row) => row.id, search,
    searchFields: [(row) => row.student_name ?? "", (row) => row.instrument_name ?? "",
      (row) => row.registered_at ?? "", (row) => row.valid_until ?? "", (row) => toFinanceDate(row.occurred_at),
      (row) => row.mode === "refund" ? "환불" : "삭제"],
    page, pageSize,
  });
  return <>
    <Table aria-label="사용취소 이력"><TableHeader><TableRow>
      <TableHead>원생</TableHead><TableHead>악기</TableHead><TableHead>상태</TableHead><TableHead>부여 / 잔여</TableHead>
      <TableHead>등록일</TableHead><TableHead>만료일</TableHead><TableHead>환불액</TableHead><TableHead>처리일</TableHead>
    </TableRow></TableHeader><TableBody>{view.items.map((row) => <TableRow key={row.id}>
      <TableCell label="원생">{row.student_name ?? "알 수 없음"}</TableCell>
      <TableCell label="악기">{row.instrument_name ?? "알 수 없음"}</TableCell>
      <TableCell label="상태">{row.mode === "refund" ? "환불" : "삭제"}</TableCell>
      <TableCell label="부여 / 잔여">{row.total_count ?? "알 수 없음"} / {row.remaining_count ?? "알 수 없음"}</TableCell>
      <TableCell label="등록일">{row.registered_at ?? "알 수 없음"}</TableCell>
      <TableCell label="만료일">{row.valid_until ?? "알 수 없음"}</TableCell>
      <TableCell label="환불액">{row.refund_amount === null ? "알 수 없음" : `${row.refund_amount.toLocaleString("ko-KR")}원`}</TableCell>
      <TableCell label="처리일">{toFinanceDate(row.occurred_at)}</TableCell>
    </TableRow>)}</TableBody></Table>
    {view.totalItems === 0 ? <EmptyState>사용취소 이력이 없습니다.</EmptyState> : null}
    <ListPagination itemLabel="사용취소 이력" countUnit="건" view={view} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
  </>;
}

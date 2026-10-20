"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  fetchLessonAuditHistory,
  lessonAuditQueryKey,
  type LessonAuditKind,
  type LessonAuditSupabaseClient,
} from "@/lib/api/lesson-audit";

type LessonAuditHistoryProps = {
  academyId: string;
  date: string;
  lessonKind: LessonAuditKind;
  client: LessonAuditSupabaseClient;
};

const SEOUL_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatAuditTime(occurredAt: string): string {
  const parts = Object.fromEntries(
    SEOUL_TIME.formatToParts(new Date(occurredAt))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${Number(parts.month)}월 ${Number(parts.day)}일 ${parts.hour}:${parts.minute}`;
}

export function LessonAuditHistory({
  academyId,
  date,
  lessonKind,
  client,
}: LessonAuditHistoryProps) {
  const input = { academyId, date, lessonKind };
  const history = useQuery({
    queryKey: lessonAuditQueryKey(input),
    queryFn: () => fetchLessonAuditHistory(client, input),
  });

  return (
    <section aria-label="변경 이력" className="min-w-0 border-t border-border pt-3">
      <h3 className="mb-2 text-sm font-semibold">변경 이력</h3>
      {history.isPending ? <p className="text-sm text-muted-foreground">이력을 불러오는 중입니다.</p> : null}
      {history.isError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">{toUserMessage(history.error)}</p>
          <Button type="button" variant="outline" size="sm" disabled={history.isFetching} onClick={() => void history.refetch()}>
            <RefreshCw aria-hidden="true" /> 다시 시도
          </Button>
        </div>
      ) : null}
      {history.isSuccess && history.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">이날 변경 이력이 없습니다.</p>
      ) : null}
      {history.isSuccess && history.data.length > 0 ? (
        <ol className="divide-y divide-border text-sm">
          {history.data.map((entry) => (
            <li key={entry.id} className="space-y-1 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <strong className="font-medium">{entry.label}</strong>
                <time className="text-xs tabular-nums text-muted-foreground" dateTime={entry.occurredAt}>
                  {formatAuditTime(entry.occurredAt)}
                </time>
              </div>
              {entry.studentName ? <p>{entry.studentName}</p> : null}
              {entry.reason ? <p className="whitespace-pre-wrap break-words text-muted-foreground">{entry.reason}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

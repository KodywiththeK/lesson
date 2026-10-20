import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { compareCalendarEvents, getCalendarEventStatusLabel } from "./workspace-helpers";
import type { CalendarEvent } from "./workspace-types";

export function LessonCalendarSidePanel({
  date,
  events,
  memo,
  history,
  onOpenDay,
}: {
  date: string;
  events: CalendarEvent[];
  memo: ReactNode;
  history?: ReactNode;
  onOpenDay: () => void;
}) {
  const dateLabel = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
  const orderedEvents = [...events].sort(compareCalendarEvents);

  return (
    <aside aria-label={history ? "선택 날짜, 월별 메모와 변경 이력" : "선택 날짜와 월별 메모"} className="grid min-w-0 content-start gap-4 lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto">
      <section aria-label={`${dateLabel} 수업`} className="min-w-0 border-b border-border pb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{dateLabel} 수업</h3>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenDay} aria-label={`${dateLabel} 출석·메모 열기`}>
            열기 <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        {orderedEvents.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">이날 예정된 수업이 없습니다.</p>
        ) : (
          <ol className="divide-y divide-border">
            {orderedEvents.map((event) => (
              <li key={event.id} className="flex min-w-0 items-start gap-2 py-2 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                  {event.timeUnspecified ? "미정" : event.startTime}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <strong className="font-medium">{event.title}</strong>
                  {event.subtitle ? <span className="block text-xs text-muted-foreground">{event.subtitle}</span> : null}
                </span>
                <Badge variant={event.status === "absent" ? "destructive" : "secondary"}>{getCalendarEventStatusLabel(event.status)}</Badge>
              </li>
            ))}
          </ol>
        )}
      </section>
      {memo}
      {history}
    </aside>
  );
}

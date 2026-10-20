"use client";

import { FileText } from "lucide-react";
import { useId, useMemo, useState, type DragEvent } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { LessonMonthControl } from "@/features/lessons/lesson-toolbar";
import {
  buildCalendarDates,
  getTodayDate,
  getEventTone,
  getCalendarEventStatusLabel,
  isHiddenCalendarRecord,
} from "@/features/lessons/workspace-helpers";
import type { CalendarEvent } from "@/features/lessons/workspace-types";

const DRAG_DATA_TYPE = "text/plain";

export function LessonMonthCalendar({
  ariaLabel,
  selectedDate,
  events,
  memoCounts,
  variant,
  onChangeMonth,
  onSelectDate,
  onMoveEvent,
  onToday,
}: {
  ariaLabel: string;
  selectedDate: string;
  events: CalendarEvent[];
  memoCounts: Map<string, number>;
  variant: "academy" | "private";
  onChangeMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
  onToday?: () => void;
  /** 주면 `movable` 일정을 다른 날짜로 끌어 옮길 수 있다. 키보드·모바일은 날짜 다이얼로그의 이동을 쓴다. */
  onMoveEvent?: (eventId: string, targetDate: string) => void;
}) {
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const showAllId = useId();
  const calendarDates = buildCalendarDates(selectedDate);
  const selectedMonth = selectedDate.slice(0, 7);
  const today = getTodayDate();
  const variantLabel = variant === "academy" ? "학원 레슨 캘린더" : "개인레슨 캘린더";
  const hiddenCount = events.filter(isHiddenCalendarRecord).length;
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      if (!showAllRecords && isHiddenCalendarRecord(event)) continue;
      const dayEvents = grouped.get(event.date) ?? [];
      dayEvents.push(event);
      grouped.set(event.date, dayEvents);
    }
    return grouped;
  }, [events, showAllRecords]);
  const finishDrag = () => {
    setDraggingEventId(null);
    setDropTargetDate(null);
  };
  const dropOnDate = (event: DragEvent<HTMLElement>, date: string) => {
    event.preventDefault();
    const eventId = event.dataTransfer.getData(DRAG_DATA_TYPE) || draggingEventId;
    const draggedEvent = events.find((candidate) => candidate.id === eventId);

    finishDrag();

    if (draggedEvent && draggedEvent.date !== date) {
      onMoveEvent?.(draggedEvent.id, date);
    }
  };

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-2 sm:p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <LessonMonthControl
          variantLabel={variantLabel}
          selectedMonth={selectedMonth}
          onChangeMonth={onChangeMonth}
          onToday={onToday}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hiddenCount > 0 ? <span>숨긴 일정 {hiddenCount}건</span> : null}
          <Switch id={showAllId} aria-label="전체 기록 보기" checked={showAllRecords} onCheckedChange={setShowAllRecords} />
          <Label htmlFor={showAllId}>전체 기록 보기</Label>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        role="grid"
        aria-label={ariaLabel}
        className="grid grid-cols-7 gap-1 sm:gap-2"
      >
        {calendarDates.map((date) => {
          const dayEvents = eventsByDate.get(date) ?? [];
          const pendingCount = dayEvents.filter((event) => event.status === "pending" || event.status === "scheduled").length;
          const presentCount = dayEvents.filter((event) => event.status === "present").length;
          const absentCount = dayEvents.filter(isHiddenCalendarRecord).length;
          const isSelected = date === selectedDate;
          const memoCount = memoCounts.get(date) ?? 0;
          const isCurrentMonth = date.startsWith(selectedMonth);
          const isToday = date === today;
          const isDropTarget = date === dropTargetDate;

          return (
            // 칩을 끌어 옮기려면 칩이 버튼 안에 있으면 안 된다(Firefox는 버튼 안 드래그를 막는다).
            // 그래서 칸은 div로 두고, 날짜 선택은 칸 클릭과 칸 안의 버튼(키보드용)이 함께 맡는다.
            <div
              key={date}
              role="gridcell"
              aria-label={`${date}${isToday ? " 오늘" : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected}
              className={`flex min-h-16 min-w-0 cursor-pointer flex-col gap-1 rounded-md border bg-background p-1 text-left transition-colors hover:bg-accent/40 aria-selected:border-primary aria-selected:ring-2 aria-selected:ring-ring/25 sm:min-h-32 sm:p-2 ${isCurrentMonth ? "" : "opacity-45"} ${isToday ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"} ${isDropTarget ? "bg-accent ring-2 ring-primary" : ""}`}
              onClick={() => onSelectDate(date)}
              onDragOver={
                onMoveEvent && draggingEventId
                  ? (event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetDate(date);
                    }
                  : undefined
              }
              onDrop={onMoveEvent ? (event) => dropOnDate(event, date) : undefined}
            >
              <button
                type="button"
                aria-label={`${date} 일정 ${dayEvents.length}건${memoCount > 0 ? `, 메모 ${memoCount}건` : ""}`}
                className="flex w-full flex-col gap-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                  <span>{Number(date.slice(-2))}</span>
                  {isToday ? (
                    <span className="hidden rounded-sm bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground sm:inline">
                      오늘
                    </span>
                  ) : null}
                </span>
                {memoCount > 0 ? (
                  <span className="hidden w-fit items-center gap-1 rounded-sm bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                    <FileText aria-hidden="true" className="size-3" />
                    메모 {memoCount}
                  </span>
                ) : null}
                <span className="flex flex-col text-[10px] leading-tight sm:hidden">
                  {pendingCount > 0 ? <span className="text-primary">예정 {pendingCount}</span> : null}
                  {presentCount > 0 ? <span className="text-foreground">등원 {presentCount}</span> : null}
                  {absentCount > 0 ? <span className="text-destructive">결석 {absentCount}</span> : null}
                </span>
              </button>
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  draggable={onMoveEvent ? Boolean(event.movable) : undefined}
                  className={`hidden min-w-0 rounded-sm px-1 py-1 text-xs font-medium leading-4 sm:block sm:px-2 ${getEventTone(event.status, variant)} ${onMoveEvent && event.movable ? "cursor-grab active:cursor-grabbing" : ""} ${event.id === draggingEventId ? "opacity-50" : ""}`}
                  onDragStart={(dragEvent) => {
                    dragEvent.dataTransfer.setData(DRAG_DATA_TYPE, event.id);
                    dragEvent.dataTransfer.effectAllowed = "move";
                    setDraggingEventId(event.id);
                  }}
                  onDragEnd={finishDrag}
                >
                  {event.detailLabel ? (
                    <CalendarEventDetail event={event} />
                  ) : (
                    <>
                      <span className="hidden truncate sm:block">{event.title}</span>
                      <span className="hidden truncate font-normal opacity-80 sm:block">
                        {event.originLabel ? `[${event.originLabel}] ` : ""}
                        {event.timeUnspecified ? "시간 미정 · " : `${event.startTime} `}
                        {event.subtitle}
                      </span>
                    </>
                  )}
                  {isHiddenCalendarRecord(event) ? (
                    <span className="block text-[10px] font-normal">
                      {getCalendarEventStatusLabel(event.status)}
                    </span>
                  ) : null}
                </div>
              ))}
              {dayEvents.length > 3 ? (
                <span className="hidden text-xs text-muted-foreground sm:block">
                  +{dayEvents.length - 3}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 시간 앞에 보라색 점을 두고 `원생명 (악기) - 선생님명`을 보여 주는 상세 일정 표시. */
function CalendarEventDetail({ event }: { event: CalendarEvent }) {
  return (
    <>
      <span className="hidden items-center gap-1 truncate sm:flex">
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-purple-500"
        />
        {event.timeLabel}
        {event.sessionLabel ? (
          <span className="ml-auto font-normal opacity-80">{event.sessionLabel}</span>
        ) : null}
      </span>
      <span className="hidden truncate font-normal sm:block">{event.detailLabel}</span>
    </>
  );
}

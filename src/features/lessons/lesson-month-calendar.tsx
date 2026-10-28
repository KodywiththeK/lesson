"use client";

import { FileText } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";

import { SectionCard } from "@/components/shared/section-card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";
import { getInstrumentColorStyle } from "@/domain/instrument-color";
import type { KoreanHoliday } from "@/domain/korean-holiday";

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
const EXPAND_DELAY_MS = 350;
const PANEL_VIEWPORT_MARGIN = 16;

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
  headerActions,
  holidays = [],
  closures = [],
  instrumentColors,
}: {
  ariaLabel: string;
  selectedDate: string;
  events: CalendarEvent[];
  memoCounts: Map<string, number>;
  variant: "academy" | "private";
  holidays?: KoreanHoliday[];
  closures?: AcademyClosure[];
  instrumentColors?: Map<string, string>;
  onChangeMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
  onToday?: () => void;
  /** 달력 헤더에서 "오늘로 이동" 바로 뒤에 놓을 버튼(월별 메모지 등). */
  headerActions?: ReactNode;
  /** 주면 `movable` 일정을 다른 날짜로 끌어 옮길 수 있다. 키보드·모바일은 날짜 다이얼로그의 이동을 쓴다. */
  onMoveEvent?: (eventId: string, targetDate: string) => void;
}) {
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState<{ date: string; style: CSSProperties } | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingEventIdRef = useRef<string | null>(null);
  const showAllId = useId();
  const calendarDates = buildCalendarDates(selectedDate);
  const selectedMonth = selectedDate.slice(0, 7);
  const today = getTodayDate();
  const variantLabel = variant === "academy" ? "학원 레슨 캘린더" : "개인레슨 캘린더";
  const hiddenCount = events.filter(isHiddenCalendarRecord).length;
  const hiddenByStatus = {
    absent: events.filter((event) => event.status === "absent").length,
    passed: events.filter((event) => event.status === "passed").length,
    cancelled: events.filter((event) => event.status === "cancelled").length,
  };
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
  useEffect(() => () => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
  }, []);
  const stopExpandTimer = () => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    expandTimer.current = null;
  };
  const scheduleExpand = (date: string, eventCount: number, cell: HTMLElement) => {
    if (eventCount < 4 || draggingEventIdRef.current) return;
    stopExpandTimer();
    expandTimer.current = setTimeout(() => {
      setExpandedPanel({
        date,
        style: getExpandedPanelStyle(cell.getBoundingClientRect(), window.innerWidth, window.innerHeight),
      });
    }, EXPAND_DELAY_MS);
  };
  const finishDrag = () => {
    draggingEventIdRef.current = null;
    setDraggingEventId(null);
    setDropTargetDate(null);
    setExpandedPanel(null);
  };
  const dropOnDate = (event: DragEvent<HTMLElement>, date: string) => {
    event.preventDefault();
    if (!date.startsWith(selectedMonth)) { finishDrag(); return; }
    const eventId = event.dataTransfer.getData(DRAG_DATA_TYPE) || draggingEventIdRef.current;
    const draggedEvent = events.find((candidate) => candidate.id === eventId);

    finishDrag();

    if (draggedEvent && draggedEvent.date !== date) {
      onMoveEvent?.(draggedEvent.id, date);
    }
  };
  const renderEvent = (event: CalendarEvent) => {
    const colorStyle = getPrivateEventColorStyle(event, variant, instrumentColors);
    return <div
      key={event.id}
      draggable={onMoveEvent ? Boolean(event.movable) : undefined}
      className={`min-w-0 rounded-sm px-1 py-1 text-xs font-medium leading-4 sm:px-2 ${getEventTone(event.status, variant)} ${onMoveEvent && event.movable ? "cursor-grab active:cursor-grabbing" : ""} ${event.id === draggingEventId ? "opacity-50" : ""}`}
      style={colorStyle}
      onDragStart={(dragEvent) => {
        if (!onMoveEvent || !event.movable) return;
        dragEvent.dataTransfer.setData(DRAG_DATA_TYPE, event.id);
        dragEvent.dataTransfer.effectAllowed = "move";
        stopExpandTimer();
        draggingEventIdRef.current = event.id;
        setDraggingEventId(event.id);
      }}
      onDragEnd={finishDrag}
    >
      {event.detailLabel ? (
        <CalendarEventDetail event={event} dimSecondary={!colorStyle} />
      ) : (
        <>
          <span className="hidden truncate sm:block">{event.title}</span>
          <span className={`hidden truncate font-normal sm:block ${colorStyle ? "" : "opacity-80"}`}>
            {event.originLabel ? `[${event.originLabel}] ` : ""}
            {event.timeUnspecified ? "시간 미정 · " : `${event.startTime} `}
            {event.subtitle}
          </span>
        </>
      )}
      {variant === "private" || isHiddenCalendarRecord(event) ? (
        <span className="block text-2xs font-normal">
          {getDisplayedEventStatus(event, variant)}
        </span>
      ) : null}
    </div>;
  };

  return (
    <SectionCard className="min-w-0 p-2 sm:p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <LessonMonthControl
          variantLabel={variantLabel}
          selectedMonth={selectedMonth}
          onChangeMonth={onChangeMonth}
          onToday={onToday}
          trailing={headerActions}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hiddenCount > 0 ? <span>숨긴 일정 {hiddenCount}건</span> : null}
          <Switch id={showAllId} aria-label="전체 기록 보기" checked={showAllRecords} onCheckedChange={setShowAllRecords} />
          <Label htmlFor={showAllId}>전체 기록 보기</Label>
        </div>
      </div>
      {hiddenCount > 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">
          결석 {hiddenByStatus.absent}건 · 패스 {hiddenByStatus.passed}건 · 취소 {hiddenByStatus.cancelled}건은 기본 달력에서 숨깁니다. 전체 기록 보기로 확인할 수 있습니다.
        </p>
      ) : null}
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-calendar-muted">
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
          const dayHolidays = holidays.filter((holiday) => holiday.date === date);
          const dayClosures = getClosuresOnDate(closures, date);

          return (
            // 칩을 끌어 옮기려면 칩이 버튼 안에 있으면 안 된다(Firefox는 버튼 안 드래그를 막는다).
            // 그래서 칸은 div로 두고, 날짜 선택은 칸 클릭과 칸 안의 버튼(키보드용)이 함께 맡는다.
            <div
              key={date}
              role="gridcell"
              aria-label={`${date}${isToday ? " 오늘" : ""}`}
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected}
              className={`relative flex min-h-16 min-w-0 cursor-pointer flex-col gap-1 rounded-md border p-1 text-left transition-colors aria-selected:ring-2 aria-selected:ring-calendar-strong/20 sm:min-h-32 sm:p-2 ${expandedPanel?.date === date && !draggingEventId ? "z-30" : ""} ${isCurrentMonth ? "" : "opacity-45"} ${isToday ? "border-primary ring-1 ring-primary/30" : "border-calendar-line aria-selected:border-calendar-strong"} ${isDropTarget ? "bg-accent ring-2 ring-primary" : "bg-card hover:bg-calendar-hover"}`}
              onClick={() => onSelectDate(date)}
              onMouseEnter={(event) => scheduleExpand(date, dayEvents.length, event.currentTarget)}
              onMouseLeave={() => {
                stopExpandTimer();
                if (!draggingEventIdRef.current) setExpandedPanel(null);
              }}
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
                <span className="flex items-center gap-1 text-xs font-semibold text-calendar-muted">
                  <span>{Number(date.slice(-2))}</span>
                  {isToday ? (
                    <span className="hidden rounded-sm bg-primary px-1 py-0.5 text-2xs font-semibold text-primary-foreground sm:inline">
                      오늘
                    </span>
                  ) : null}
                </span>
                {memoCount > 0 ? (
                  <span className="hidden w-fit items-center gap-1 rounded-sm bg-calendar-hover px-1 py-0.5 text-xs font-medium text-calendar-muted sm:inline-flex">
                    <FileText aria-hidden="true" className="size-3" />
                    메모 {memoCount}
                  </span>
                ) : null}
                {dayHolidays.map((holiday) => <span key={holiday.name} className="text-2xs font-medium text-destructive">{holiday.name}</span>)}
                {dayClosures.map((closure) => <span key={closure.id} className="text-2xs font-medium text-amber-700 dark:text-amber-300">{closure.title}</span>)}
                <span className="flex flex-col text-2xs leading-tight sm:hidden">
                  {pendingCount > 0 ? <span className="text-primary">예정 {pendingCount}</span> : null}
                  {presentCount > 0 ? <span className="text-foreground">등원 {presentCount}</span> : null}
                  {absentCount > 0 ? <span className="text-destructive">결석 {absentCount}</span> : null}
                </span>
              </button>
              {dayEvents.slice(0, 3).map((event) => <div className="hidden sm:block" key={event.id}>{renderEvent(event)}</div>)}
              {dayEvents.length > 3 ? (
                <span className="hidden text-xs text-calendar-muted sm:block">
                  +{dayEvents.length - 3}
                </span>
              ) : null}
              {expandedPanel?.date === date && dayEvents.length > 3 ? (
                <div role="region" aria-label={`${date} 전체 일정`}
                  className={`hidden origin-center flex-col gap-1 overflow-y-auto rounded-lg border bg-card p-2 text-card-foreground shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200 sm:flex ${draggingEventId ? "-z-10 opacity-0" : "z-40"}`}
                  style={expandedPanel.style}>
                  <strong className="text-xs">{date} · 일정 {dayEvents.length}건</strong>
                  {dayEvents.map(renderEvent)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function getExpandedPanelStyle(cell: DOMRect, viewportWidth: number, viewportHeight: number): CSSProperties {
  const width = Math.min(Math.max(cell.width * 2, 240), viewportWidth - PANEL_VIEWPORT_MARGIN * 2);
  const height = Math.min(Math.max(cell.height * 2, 192), 288, viewportHeight - PANEL_VIEWPORT_MARGIN * 2);
  const left = Math.max(PANEL_VIEWPORT_MARGIN, Math.min(
    cell.left + (cell.width - width) / 2, viewportWidth - PANEL_VIEWPORT_MARGIN - width,
  ));
  const top = Math.max(PANEL_VIEWPORT_MARGIN, Math.min(
    cell.top + (cell.height - height) / 2, viewportHeight - PANEL_VIEWPORT_MARGIN - height,
  ));
  return { position: "fixed", left, top, width, height };
}

function getDisplayedEventStatus(event: CalendarEvent, variant: "academy" | "private") {
  if (variant === "private" && event.status === "present") return "등원";
  if (event.creditAuthorized && event.status === "scheduled") return "외상 예정";
  return getCalendarEventStatusLabel(event.status);
}

/** 시간 앞에 남보라 점을 두고 `원생명 (악기) - 선생님명`을 보여 주는 상세 일정 표시. */
function CalendarEventDetail({ event, dimSecondary }: { event: CalendarEvent; dimSecondary: boolean }) {
  return (
    <>
      <span className="hidden items-center gap-1 truncate sm:flex">
        <span
          aria-hidden="true"
          data-slot="calendar-event-dot"
          className="size-1.5 shrink-0 rounded-full bg-chart-3"
        />
        {event.timeLabel}
        {event.sessionLabel ? (
          <span className={`ml-auto font-normal ${dimSecondary ? "opacity-80" : ""}`}>{event.sessionLabel}</span>
        ) : null}
      </span>
      <span className="hidden truncate font-normal sm:block">{event.detailLabel}</span>
    </>
  );
}

function getPrivateEventColorStyle(
  event: CalendarEvent,
  variant: "academy" | "private",
  instrumentColors: Map<string, string> | undefined,
) {
  if (variant !== "private" || !event.instrumentId ||
    (event.status !== "scheduled" && event.status !== "present")) return undefined;
  return getInstrumentColorStyle(instrumentColors?.get(event.instrumentId), event.status);
}

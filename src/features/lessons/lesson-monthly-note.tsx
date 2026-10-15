"use client";

import { ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  getInitialMonthlyMemoPanelState,
  moveMonthlyMemoPanel,
  resizeMonthlyMemoPanel,
  type MonthlyMemoLessonKind,
  type MonthlyMemoPanelState,
} from "@/domain/monthly-memo";
import type { LessonMonthlyNote } from "@/lib/api/lesson-monthly-notes";
import { cn } from "@/lib/utils";

const LESSON_KIND_LABELS: Record<MonthlyMemoLessonKind, string> = {
  academy: "학원레슨",
  private: "개인레슨",
};

type PointerDelta = { dx: number; dy: number };

type LessonMonthlyNotePostitProps = {
  lessonKind: MonthlyMemoLessonKind;
  /** YYYY-MM */
  month: string;
  note: LessonMonthlyNote | null;
  isLoading?: boolean;
  isSaving?: boolean;
  isMarkingRead?: boolean;
  loadErrorMessage?: string;
  onSave: (content: string) => void;
  onMarkRead: () => void;
};

/**
 * 선택한 달의 특이사항을 적는 포스트잇.
 * 데스크톱(lg 이상)에서는 달력 위에 떠서 끌어 옮기고 크기를 바꿀 수 있고(새로고침하면 기본값),
 * 모바일에서는 이동·크기 조절 없이 일반 카드로 쌓인다. 부모는 `relative` 영역 안에 둔다.
 */
export function LessonMonthlyNotePostit({
  lessonKind,
  month,
  note,
  isLoading = false,
  isSaving = false,
  isMarkingRead = false,
  loadErrorMessage,
  onSave,
  onMarkRead,
}: LessonMonthlyNotePostitProps) {
  const [panel, setPanel] = useState<MonthlyMemoPanelState>(getInitialMonthlyMemoPanelState);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const moveHandlers = usePointerDrag((delta) =>
    setPanel((current) => moveMonthlyMemoPanel(current, delta)),
  );
  const resizeHandlers = usePointerDrag((delta) =>
    setPanel((current) => resizeMonthlyMemoPanel(current, delta)),
  );
  const monthNumber = Number(month.slice(5));
  const title = `${monthNumber}월 ${LESSON_KIND_LABELS[lessonKind]} 메모지`;
  const isUnread = note?.unread === true;

  return (
    <section
      aria-label={title}
      style={toPanelStyle(panel)}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-accent/40 shadow-sm",
        "lg:absolute lg:top-(--memo-y) lg:left-(--memo-x) lg:z-20 lg:w-(--memo-width) lg:shadow-lg",
        !isCollapsed && "lg:h-(--memo-height)",
      )}
    >
      <div
        {...moveHandlers}
        className="flex items-center gap-2 border-b border-border bg-accent/60 px-3 py-2 lg:cursor-grab lg:touch-none lg:select-none"
      >
        <StickyNote className="size-4 shrink-0" aria-hidden />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
        {isUnread ? <Badge variant="destructive">미확인</Badge> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={isCollapsed ? "메모지 펼치기" : "메모지 접기"}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((current) => !current)}
        >
          {isCollapsed ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
        </Button>
      </div>

      <div hidden={isCollapsed} className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <PostitBody
          month={month}
          monthNumber={monthNumber}
          note={note}
          isLoading={isLoading}
          isSaving={isSaving}
          isMarkingRead={isMarkingRead}
          loadErrorMessage={loadErrorMessage}
          onSave={onSave}
          onMarkRead={onMarkRead}
        />
      </div>

      <div
        {...resizeHandlers}
        title="메모지 크기 조절"
        className="absolute right-0 bottom-0 hidden size-4 cursor-nwse-resize touch-none rounded-tl-sm border-t border-l border-border bg-accent/80 lg:block"
      />
    </section>
  );
}

type PostitBodyProps = Pick<
  LessonMonthlyNotePostitProps,
  "note" | "isLoading" | "isSaving" | "isMarkingRead" | "loadErrorMessage" | "onSave" | "onMarkRead"
> & { month: string; monthNumber: number };

function PostitBody({
  month,
  monthNumber,
  note,
  isLoading,
  isSaving,
  isMarkingRead,
  loadErrorMessage,
  onSave,
  onMarkRead,
}: PostitBodyProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">메모를 불러오는 중입니다.</p>;
  }

  if (loadErrorMessage) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadErrorMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <PostitEditor
      // 달이 바뀌거나 저장·자동 기록으로 내용이 갱신되면 쓰던 초안을 버리고 새 내용으로 시작한다.
      key={`${month}:${note?.updatedAt ?? "empty"}`}
      monthNumber={monthNumber}
      note={note}
      isSaving={isSaving}
      isMarkingRead={isMarkingRead}
      onSave={onSave}
      onMarkRead={onMarkRead}
    />
  );
}

function PostitEditor({
  monthNumber,
  note,
  isSaving,
  isMarkingRead,
  onSave,
  onMarkRead,
}: Pick<
  PostitBodyProps,
  "monthNumber" | "note" | "isSaving" | "isMarkingRead" | "onSave" | "onMarkRead"
>) {
  const savedContent = note?.content ?? "";
  const [draft, setDraft] = useState(savedContent);
  const canSave = draft !== savedContent && !isSaving;

  return (
    <>
      {note === null ? (
        <p className="text-xs text-muted-foreground">이 달의 메모가 없습니다.</p>
      ) : null}
      <Textarea
        aria-label={`${monthNumber}월 메모 내용`}
        placeholder="예) ○○ 학부모님 전화 옴"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-24 flex-1 resize-none bg-background/70 lg:min-h-0"
      />
      <div className="flex justify-end gap-2">
        {note?.unread ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMarkingRead}
            onClick={onMarkRead}
          >
            확인
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!canSave} onClick={() => onSave(draft)}>
          저장
        </Button>
      </div>
    </>
  );
}

function usePointerDrag(onDrag: (delta: PointerDelta) => void) {
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const stopDrag = () => {
    lastPoint.current = null;
  };

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.target instanceof Element && event.target.closest("button")) {
        return;
      }

      lastPoint.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const previous = lastPoint.current;

      if (!previous) {
        return;
      }

      lastPoint.current = { x: event.clientX, y: event.clientY };
      onDrag({ dx: event.clientX - previous.x, dy: event.clientY - previous.y });
    },
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
  };
}

function toPanelStyle(panel: MonthlyMemoPanelState): CSSProperties {
  return {
    "--memo-x": `${panel.x}px`,
    "--memo-y": `${panel.y}px`,
    "--memo-width": `${panel.width}px`,
    "--memo-height": `${panel.height}px`,
  } as CSSProperties;
}

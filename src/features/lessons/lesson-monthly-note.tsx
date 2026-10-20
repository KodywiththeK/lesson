"use client";

import { ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MonthlyMemoLessonKind } from "@/domain/monthly-memo";
import type { LessonMonthlyNote } from "@/lib/api/lesson-monthly-notes";
import { cn } from "@/lib/utils";

const LESSON_KIND_LABELS: Record<MonthlyMemoLessonKind, string> = {
  academy: "학원레슨",
  private: "개인레슨",
};

type NoteDraft = { content: string; baseContent: string; baseVersion: string };

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
 * 월별 메모지는 캘린더 옆에 고정한다. 다른 달의 초안과 외부 갱신 충돌을 구분해 작성 중인 내용을 지킨다.
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, NoteDraft>>({});
  const draftKey = `${lessonKind}:${month}`;
  const savedContent = note?.content ?? "";
  const savedVersion = note?.updatedAt ?? "empty";
  const storedDraft = drafts[draftKey];
  const draft = storedDraft?.content === storedDraft?.baseContent ? savedContent : storedDraft?.content ?? savedContent;
  const hasConflict = Boolean(
    storedDraft &&
      storedDraft.content !== storedDraft.baseContent &&
      storedDraft.baseVersion !== savedVersion &&
      storedDraft.content !== savedContent,
  );
  const monthNumber = Number(month.slice(5));
  const title = `${monthNumber}월 ${LESSON_KIND_LABELS[lessonKind]} 메모지`;
  const isUnread = note?.unread === true;

  function changeDraft(content: string) {
    setDrafts((current) => {
      const previous = current[draftKey];
      const base = previous && previous.content !== savedContent
        ? previous
        : { baseContent: savedContent, baseVersion: savedVersion };
      return { ...current, [draftKey]: { ...base, content } };
    });
  }

  function useSavedContent() {
    setDrafts((current) => {
      const next = { ...current };
      delete next[draftKey];
      return next;
    });
  }

  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-accent/40",
      )}
    >
      <div
        className="flex items-center gap-2 border-b border-border bg-accent/60 px-3 py-2"
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
          monthNumber={monthNumber}
          note={note}
          isLoading={isLoading}
          isSaving={isSaving}
          isMarkingRead={isMarkingRead}
          loadErrorMessage={loadErrorMessage}
          onSave={onSave}
          onMarkRead={onMarkRead}
          draft={draft}
          hasConflict={hasConflict}
          savedContent={savedContent}
          onDraftChange={changeDraft}
          onUseSavedContent={useSavedContent}
        />
      </div>
    </section>
  );
}

type PostitBodyProps = Pick<
  LessonMonthlyNotePostitProps,
  "note" | "isLoading" | "isSaving" | "isMarkingRead" | "loadErrorMessage" | "onSave" | "onMarkRead"
> & {
  monthNumber: number;
  draft: string;
  savedContent: string;
  hasConflict: boolean;
  onDraftChange: (content: string) => void;
  onUseSavedContent: () => void;
};

function PostitBody({
  monthNumber,
  note,
  isLoading,
  isSaving,
  isMarkingRead,
  loadErrorMessage,
  onSave,
  onMarkRead,
  draft,
  savedContent,
  hasConflict,
  onDraftChange,
  onUseSavedContent,
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
      monthNumber={monthNumber}
      note={note}
      isSaving={isSaving}
      isMarkingRead={isMarkingRead}
      onSave={onSave}
      onMarkRead={onMarkRead}
      draft={draft}
      savedContent={savedContent}
      hasConflict={hasConflict}
      onDraftChange={onDraftChange}
      onUseSavedContent={onUseSavedContent}
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
  draft,
  savedContent,
  hasConflict,
  onDraftChange,
  onUseSavedContent,
}: Pick<
  PostitBodyProps,
  "monthNumber" | "note" | "isSaving" | "isMarkingRead" | "onSave" | "onMarkRead" |
  "draft" | "savedContent" | "hasConflict" | "onDraftChange" | "onUseSavedContent"
>) {
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
        onChange={(event) => onDraftChange(event.target.value)}
        className="min-h-24 flex-1 resize-y bg-background/70"
      />
      {hasConflict ? (
        <Alert variant="destructive">
          <AlertDescription>
            다른 저장본이 있습니다. 현재 저장된 내용: {savedContent || "(비어 있음)"}
          </AlertDescription>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onUseSavedContent}>서버 내용 사용</Button>
            <Button type="button" size="sm" disabled={isSaving} onClick={() => onSave(draft)}>내 초안 저장</Button>
          </div>
        </Alert>
      ) : null}
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
        <Button type="button" size="sm" disabled={!canSave || hasConflict} onClick={() => onSave(draft)}>
          저장
        </Button>
      </div>
    </>
  );
}

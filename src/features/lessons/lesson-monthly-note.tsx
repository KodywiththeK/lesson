"use client";

import { StickyNote } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MonthlyMemoLessonKind } from "@/domain/monthly-memo";
import { MEMO_LESSON_KIND_LABELS, MemoPaperDialog, RULED_PAPER_STYLE } from "@/features/lessons/memo-paper-dialog";
import type { LessonMonthlyNote } from "@/lib/api/lesson-monthly-notes";

type NoteDraft = { content: string; baseContent: string; baseVersion: string };

type LessonMonthlyNoteDialogProps = {
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
 * 선택한 달의 특이사항을 적는 메모지. 버튼을 누르면 노란 메모지 모양의 다이얼로그가 열린다.
 * 다이얼로그를 닫아도 적던 초안은 이 컴포넌트에 남고, 다른 달의 초안과 외부 갱신 충돌은 구분해 작성 중인 내용을 지킨다.
 */
export function LessonMonthlyNoteDialog({
  lessonKind,
  month,
  note,
  isLoading = false,
  isSaving = false,
  isMarkingRead = false,
  loadErrorMessage,
  onSave,
  onMarkRead,
}: LessonMonthlyNoteDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
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
  const title = `${monthNumber}월 ${MEMO_LESSON_KIND_LABELS[lessonKind]} 메모지`;
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
    <>
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        <StickyNote aria-hidden="true" />
        {monthNumber}월 메모지
        {isUnread ? <Badge variant="destructive">미확인</Badge> : null}
      </Button>
      <MemoPaperDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={title}
        description="이 달의 특이사항을 적어 두세요."
      >
        <div className="flex min-h-0 flex-col gap-2">
          <PostitBody
            monthNumber={monthNumber}
            note={note}
            isLoading={isLoading}
            isSaving={isSaving}
            isMarkingRead={isMarkingRead}
            loadErrorMessage={loadErrorMessage}
            onSave={onSave}
            onMarkRead={onMarkRead}
            onClose={() => setIsOpen(false)}
            draft={draft}
            hasConflict={hasConflict}
            savedContent={savedContent}
            onDraftChange={changeDraft}
            onUseSavedContent={useSavedContent}
          />
        </div>
      </MemoPaperDialog>
    </>
  );
}

type PostitBodyProps = Pick<
  LessonMonthlyNoteDialogProps,
  "note" | "isLoading" | "isSaving" | "isMarkingRead" | "loadErrorMessage" | "onSave" | "onMarkRead"
> & {
  monthNumber: number;
  onClose: () => void;
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
  onClose,
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
      onClose={onClose}
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
  onClose,
  draft,
  savedContent,
  hasConflict,
  onDraftChange,
  onUseSavedContent,
}: Pick<
  PostitBodyProps,
  "monthNumber" | "note" | "isSaving" | "isMarkingRead" | "onSave" | "onMarkRead" | "onClose" |
  "draft" | "savedContent" | "hasConflict" | "onDraftChange" | "onUseSavedContent"
>) {
  const canSave = draft !== savedContent && !isSaving;

  return (
    <>
      {note === null ? (
        <p className="text-xs text-warning-soft-foreground/80">이 달의 메모가 없습니다.</p>
      ) : null}
      <Textarea
        aria-label={`${monthNumber}월 메모 내용`}
        placeholder="예) ○○ 학부모님 전화 옴"
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        style={RULED_PAPER_STYLE}
        className="min-h-56 flex-1 resize-none rounded-sm border-warning/30 bg-transparent px-2 py-0 shadow-none focus-visible:border-warning focus-visible:ring-warning/30 dark:bg-transparent"
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          닫기
        </Button>
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

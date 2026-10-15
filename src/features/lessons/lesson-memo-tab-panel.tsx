"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  type LessonCalendarMemo,
  type LessonMemoKind,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import {
  createEmptyMemoDraft,
  toLessonMemoDraft,
  canSubmitLessonMemo,
  resolveLessonMemoTarget,
  toLessonMemoTargetBadges,
} from "@/features/lessons/workspace-memo-helpers";
import type {
  LessonMemoTargetOptions,
  LessonMemoDraft,
} from "@/features/lessons/workspace-types";

export function LessonMemoTabPanel({
  academyId,
  lessonKind,
  date,
  memos,
  targets,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
}: {
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  memos: LessonCalendarMemo[];
  targets: LessonMemoTargetOptions;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LessonMemoDraft>(() =>
    createEmptyMemoDraft(),
  );
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoToDelete, setMemoToDelete] = useState<LessonCalendarMemo | null>(null);
  const [isDeletingMemo, setIsDeletingMemo] = useState(false);
  const editingMemo = memos.find((memo) => memo.id === editingMemoId) ?? null;
  const canSubmit = canSubmitLessonMemo(draft, targets);
  const submitLabel = editingMemo ? "메모 수정 저장" : "메모 등록";

  const confirmDeleteMemo = async () => {
    if (!memoToDelete || isDeletingMemo) {
      return;
    }

    setIsDeletingMemo(true);
    try {
      await onDeleteMemo(memoToDelete.id);
    } catch {
      // 실패 안내는 삭제를 요청한 쪽에서 이미 보여 준다. 확인 창을 열어 둬서 다시 시도할 수 있게 한다.
      return;
    } finally {
      setIsDeletingMemo(false);
    }

    if (editingMemoId === memoToDelete.id) {
      setDraft(createEmptyMemoDraft());
      setEditingMemoId(null);
    }
    setMemoToDelete(null);
  };

  const submitMemo = () => {
    const resolvedTarget = resolveLessonMemoTarget(draft, targets);

    if (!resolvedTarget || !canSubmit) {
      return;
    }

    if (editingMemo) {
      onUpdateMemo({
        academyId,
        memoId: editingMemo.id,
        content: draft.content.trim(),
        ...resolvedTarget,
      });
    } else {
      onCreateMemo({
        academyId,
        lessonKind,
        date,
        content: draft.content.trim(),
        ...resolvedTarget,
      });
    }

    setDraft(createEmptyMemoDraft());
    setEditingMemoId(null);
  };

  return (
    <div className="grid gap-3">
      <form
        className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitMemo();
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Label className="grid gap-1 text-sm font-medium">
            <span>관련 원생</span>
            <NativeSelect
              aria-label="관련 원생"
              value={draft.studentId}
              onChange={(event) =>
                setDraft((current) =>
                  ({
                    ...current,
                    studentId: event.target.value,
                  }),
                )
              }
            >
              <NativeSelectOption value="">선택 안 함</NativeSelectOption>
              {targets.students.map((student) => (
                <NativeSelectOption key={student.id} value={student.id}>
                  {student.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-medium">
            <span>관련 선생님</span>
            <NativeSelect
              aria-label="관련 선생님"
              value={draft.teacherId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  teacherId: event.target.value,
                }))
              }
            >
              <NativeSelectOption value="">선택 안 함</NativeSelectOption>
              {targets.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
        </div>
        <Label className="grid gap-2 text-sm font-medium">
          <span>메모 내용</span>
          <Textarea
            aria-label="메모 내용"
            className="min-h-28"
            value={draft.content}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
          />
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSubmit}>
            <FileText aria-hidden="true" />
            {submitLabel}
          </Button>
          {editingMemo ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(createEmptyMemoDraft());
                setEditingMemoId(null);
              }}
            >
              수정 취소
            </Button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-2">
        {memos.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            선택한 날짜에 작성된 메모가 없습니다.
          </p>
        ) : null}
        {memos.map((memo) => (
          <article
            key={memo.id}
            className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1">
                {toLessonMemoTargetBadges(memo).map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
              <p className="whitespace-pre-wrap text-sm">{memo.content}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${memo.content} 메모 수정`}
                onClick={() => {
                  setDraft(toLessonMemoDraft(memo));
                  setEditingMemoId(memo.id);
                }}
              >
                수정
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${memo.content} 메모 삭제`}
                onClick={() => setMemoToDelete(memo)}
              >
                삭제
              </Button>
            </div>
          </article>
        ))}
      </div>
      <AlertDialog
        open={Boolean(memoToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingMemo) {
            setMemoToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 메모를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 메모는 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="line-clamp-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {memoToDelete?.content}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMemo}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingMemo}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteMemo();
              }}
            >
              {isDeletingMemo ? "삭제 중" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

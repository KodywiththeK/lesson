"use client";

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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatLessonTimeRange } from "@/features/lessons/workspace-helpers";
import type { DeleteLessonDraft } from "@/features/lessons/workspace-types";

/** 학원 일정 삭제. 사유를 입력해야 삭제할 수 있고, 원생 기본 정보와 정규 시간표는 바뀌지 않는다. */
export function AcademyLessonDeleteDialog({
  draft,
  isDeleting,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: DeleteLessonDraft | null;
  isDeleting: boolean;
  onChange: (draft: DeleteLessonDraft) => void;
  onClose: () => void;
  onConfirm: (draft: DeleteLessonDraft) => void;
}) {
  const canDelete = Boolean(draft?.reason.trim()) && !isDeleting;

  return (
    <AlertDialog open={Boolean(draft)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 일정을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {draft
              ? `${draft.row.studentName} · ${draft.row.date} ${formatLessonTimeRange(draft.row)} ${draft.row.instrumentName} 일정만 삭제합니다. 원생 기본 정보와 정규 시간표는 바뀌지 않습니다.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {draft ? (
          <Label className="grid gap-1 text-sm font-medium">
            <span>삭제 사유 (필수)</span>
            <Textarea
              aria-label="삭제 사유"
              value={draft.reason}
              placeholder="예: 휴원, 수업 취소"
              onChange={(event) => onChange({ ...draft, reason: event.target.value })}
            />
          </Label>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canDelete}
            onClick={(event) => {
              // 저장이 끝나기 전에는 닫지 않는다. 성공하면 호출한 쪽이 draft를 비운다.
              event.preventDefault();
              if (draft) {
                onConfirm(draft);
              }
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState } from "react";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";
import { DateField, TimeField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { checkAcademyLessonMoveTarget } from "@/domain/academy-lesson-attendance";
import { formatLessonTimeRange } from "@/features/lessons/workspace-helpers";
import type { MoveLessonDraft } from "@/features/lessons/workspace-types";

export function MoveAcademyLessonDialog({
  draft,
  onChange,
  onClose,
  onConfirm,
  closures = [],
}: {
  draft: MoveLessonDraft | null;
  onChange: (draft: MoveLessonDraft | null) => void;
  onClose: () => void;
  onConfirm: (draft: MoveLessonDraft) => void;
  closures?: AcademyClosure[];
}) {
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const matchingClosures = draft ? getClosuresOnDate(closures, draft.targetDate) : [];
  const moveTarget = draft ? checkAcademyLessonMoveTarget(draft.row, draft.targetDate) : null;
  const canSave =
    Boolean(draft) &&
    Boolean(draft?.targetDate) &&
    Boolean(draft?.startTime) &&
    Boolean(draft?.endTime) &&
    Boolean(draft && draft.endTime > draft.startTime) &&
    moveTarget?.ok === true &&
    (matchingClosures.length === 0 || closureConfirmed);

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.row.studentName ?? "원생"} 일정 이동</DialogTitle>
          <DialogDescription>
            정기 스케줄은 유지하고 선택한 이번 일정만 다른 날짜와 시간으로 옮깁니다.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{draft.row.studentName}</p>
              <p className="mt-1 text-muted-foreground">
                기존 {draft.row.date} {formatLessonTimeRange(draft.row)} ·{" "}
                {draft.row.instrumentName}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label className="grid gap-1 text-sm font-medium">
                <span>이동 날짜</span>
                <DateField
                  aria-label="이동 날짜"
                  value={draft.targetDate}
                  onValueChange={(nextValue) => {
                    setClosureConfirmed(false);
                    onChange({ ...draft, targetDate: nextValue });
                  }}
                />
              </Label>
              <Label className="grid gap-1 text-sm font-medium">
                <span>시작 시간</span>
                <TimeField
                  aria-label="시작 시간"
                  value={draft.startTime}
                  onValueChange={(nextValue) =>
                    onChange({ ...draft, startTime: nextValue })
                  }
                />
              </Label>
              <Label className="grid gap-1 text-sm font-medium">
                <span>종료 시간</span>
                <TimeField
                  aria-label="종료 시간"
                  value={draft.endTime}
                  onValueChange={(nextValue) =>
                    onChange({ ...draft, endTime: nextValue })
                  }
                />
              </Label>
            </div>
            {matchingClosures.length > 0 ? <div className="rounded-md border border-amber-500 p-2 text-sm">
              <p>휴원일: {matchingClosures.map((closure) => closure.title).join(", ")}</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={closureConfirmed} onChange={(event) => setClosureConfirmed(event.target.checked)} />휴원일 일정을 확인하고 이동</label>
            </div> : null}
            {moveTarget && !moveTarget.ok ? (
              <p role="alert" className="text-sm text-destructive">
                {moveTarget.reason}
              </p>
            ) : null}
            <Label className="grid gap-1 text-sm font-medium">
              <span>이동 사유 (선택)</span>
              <Textarea
                aria-label="이동 사유"
                value={draft.reason}
                onChange={(event) => onChange({ ...draft, reason: event.target.value })}
                placeholder="예: 콩쿠르 보충"
              />
            </Label>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => draft && onConfirm(draft)}
          >
            이동 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ABSENCE_REASON } from "@/domain/academy-lesson-attendance";
import {
  getPrivateAbsenceReasonError,
  PRIVATE_ABSENCE_REASON_MAX_LENGTH,
  type PrivateLesson,
} from "@/domain/private-lesson";

/**
 * 개인레슨 결석 사유 입력. 새로 결석 처리할 때와 이미 결석인 레슨의 사유를 고칠 때 같은 입력을 쓴다.
 * 사유는 선택이며, 비우면 서버가 기본 문구(결석 확인)로 저장한다.
 */
export function PrivateAbsenceReasonForm({
  lesson,
  disabled,
  onSubmit,
  onCancel,
}: {
  lesson: PrivateLesson;
  disabled: boolean;
  /** 앞뒤 공백을 지운 사유를 넘긴다. 비어 있으면 undefined다. */
  onSubmit: (reason: string | undefined) => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const isEditingReason = lesson.status === "absent";
  const [reason, setReason] = useState(
    lesson.absenceReason && lesson.absenceReason !== DEFAULT_ABSENCE_REASON
      ? lesson.absenceReason
      : "",
  );
  const error = getPrivateAbsenceReasonError(reason);

  return (
    <form
      className="grid gap-2 rounded-md bg-muted/50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (error) return;
        onSubmit(reason.trim() || undefined);
      }}
    >
      <Label htmlFor={inputId} className="text-sm font-medium">
        결석 사유 (선택)
      </Label>
      <Textarea
        id={inputId}
        value={reason}
        placeholder="예: 감기로 결석"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex flex-wrap items-start justify-between gap-2 text-xs">
        <p className="text-muted-foreground">
          개인정보는 적지 마세요. 비우면 &lsquo;{DEFAULT_ABSENCE_REASON}&rsquo;으로 저장됩니다.
          {isEditingReason ? " 사유만 바뀌고 회차권에는 영향이 없습니다." : ""}
        </p>
        <span className="text-muted-foreground">
          {reason.trim().length}/{PRIVATE_ABSENCE_REASON_MAX_LENGTH}
        </span>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={disabled || Boolean(error)}>
          {isEditingReason ? "사유 저장" : "결석 저장"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          사유 입력 취소
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  validateLessonTicketAdjustment,
  type LessonTicketAdjustmentInput,
  type LessonTicketListRow,
} from "@/domain/lesson-ticket";

import { parseNumberInput } from "./parse-number-input";

type LessonTicketAdjustDialogProps = {
  ticket: LessonTicketListRow;
  isSaving: boolean;
  ariaLabel?: string;
  /** 저장에 성공하면 `onSaved`를 불러 다이얼로그를 닫는다. */
  onAdjust: (
    ticket: LessonTicketListRow,
    input: LessonTicketAdjustmentInput,
    onSaved: () => void,
  ) => void;
};

/** 목록 행의 "수정" 버튼과 직접 수정 다이얼로그. 원생·악기는 바꿀 수 없다. */
export function LessonTicketAdjustDialog({
  ticket,
  isSaving,
  ariaLabel,
  onAdjust,
}: LessonTicketAdjustDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel ?? `${ticket.studentName} ${ticket.instrumentName} 회차권 수정`}
        >
          <Pencil aria-hidden="true" />
          수정
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(90dvh,42rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>회차권 수정</DialogTitle>
          <DialogDescription>
            잘못 입력한 회수와 만료일을 고칩니다. 원생과 악기는 바꿀 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <LessonTicketAdjustForm
          ticket={ticket}
          isSaving={isSaving}
          onSubmit={(input) => onAdjust(ticket, input, () => setOpen(false))}
        />
      </DialogContent>
    </Dialog>
  );
}

function LessonTicketAdjustForm({
  ticket,
  isSaving,
  onSubmit,
}: {
  ticket: LessonTicketListRow;
  isSaving: boolean;
  onSubmit: (input: LessonTicketAdjustmentInput) => void;
}) {
  const [totalGrantedCountText, setTotalGrantedCountText] = useState(String(ticket.totalGrantedCount));
  const [remainingCountText, setRemainingCountText] = useState(String(ticket.remainingCount));
  const [validUntil, setValidUntil] = useState(ticket.validUntil);
  const [reason, setReason] = useState("");
  const input: LessonTicketAdjustmentInput = {
    totalGrantedCount: parseNumberInput(totalGrantedCountText),
    remainingCount: parseNumberInput(remainingCountText),
    validUntil,
    reason: reason.trim(),
  };
  const validation = validateLessonTicketAdjustment(ticket, input);
  const canSubmit = validation.ok && !isSaving;

  return (
    <form
      aria-label="회차권 수정 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSubmit) {
          onSubmit(input);
        }
      }}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">원생</dt>
        <dd className="font-medium">{ticket.studentName}</dd>
        <dt className="text-muted-foreground">악기</dt>
        <dd className="font-medium">{ticket.instrumentName}</dd>
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>부여 회수</span>
          <Input
            aria-label="부여 회수"
            type="number"
            min={1}
            step={1}
            value={totalGrantedCountText}
            onChange={(event) => setTotalGrantedCountText(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>잔여 회수</span>
          <Input
            aria-label="잔여 회수"
            type="number"
            min={0}
            step={1}
            value={remainingCountText}
            onChange={(event) => setRemainingCountText(event.target.value)}
          />
        </Label>
      </div>

      <Label className="grid gap-1">
        <span>만료일</span>
        <DateField aria-label="만료일" required value={validUntil} onValueChange={setValidUntil} />
      </Label>

      <Label className="grid gap-1">
        <span>수정 사유</span>
        <Input
          aria-label="수정 사유"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="예: 수기 장부와 맞추기"
        />
      </Label>

      {validation.ok ? null : (
        <p className="text-sm text-destructive" aria-live="polite">
          {validation.reason}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving ? "저장 중" : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

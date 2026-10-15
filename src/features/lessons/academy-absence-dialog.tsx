"use client";

import { ClipboardCheck, Undo2 } from "lucide-react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_ABSENCE_REASON,
  type DailyAcademyAttendanceRow,
} from "@/domain/academy-lesson-attendance";
import { formatLessonTimeRange } from "@/features/lessons/workspace-helpers";

/**
 * 결석인원. 선택한 날짜에 결석으로 확인된 원생 중 아직 보강·패스로 확정하지 않은 원생만 보여 준다.
 * 결석확인은 사유서로 이어지고, 결석 취소는 출결을 대기 상태로 되돌린다.
 */
export function AcademyAbsenceDialog({
  open,
  date,
  rows,
  isBusy,
  onOpenChange,
  onChangeDate,
  onConfirmAbsence,
  onCancelAbsence,
}: {
  open: boolean;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeDate: (date: string) => void;
  onConfirmAbsence: (row: DailyAcademyAttendanceRow) => void;
  onCancelAbsence: (row: DailyAcademyAttendanceRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{date} 결석인원</DialogTitle>
          <DialogDescription>
            선택한 날짜에 결석으로 확인된 원생입니다. 결석확인을 누르면 사유서를 작성해 보강 또는
            패스로 처리합니다.
          </DialogDescription>
        </DialogHeader>
        <Label className="grid gap-1 text-sm font-medium sm:max-w-56">
          <span>결석 날짜</span>
          <DateField
            aria-label="결석인원 날짜"
            required
            value={date}
            onValueChange={onChangeDate}
          />
        </Label>
        <div className="grid gap-2">
          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              이 날짜에 처리할 결석이 없습니다.
            </p>
          ) : null}
          {rows.map((row) => (
            <div
              key={row.lessonEventId}
              className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{row.studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatLessonTimeRange(row)} · {row.instrumentName}
                  {row.absenceReason && row.absenceReason !== DEFAULT_ABSENCE_REASON
                    ? ` · ${row.absenceReason}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  aria-label={`${row.studentName} 결석확인`}
                  disabled={isBusy}
                  onClick={() => onConfirmAbsence(row)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  결석확인
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`${row.studentName} 결석 취소`}
                  disabled={isBusy}
                  onClick={() => onCancelAbsence(row)}
                >
                  <Undo2 aria-hidden="true" />
                  취소
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

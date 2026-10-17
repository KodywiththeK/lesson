"use client";

import { ClipboardCheck, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatAbsenceReason,
  type DailyAcademyAttendanceRow,
} from "@/domain/academy-lesson-attendance";
import { summarizeMonthlyAcademyAbsences } from "@/domain/monthly-lesson-absence";
import { LessonMonthControl } from "@/features/lessons/lesson-toolbar";
import { formatLessonTimeRange, formatMonthLabel } from "@/features/lessons/workspace-helpers";

/**
 * 결석인원. 조회 중인 달에 결석으로 확인된 원생을 날짜순으로 모아 보여 준다.
 * 아직 보강·패스로 확정하지 않은 결석만 결석확인(사유서)과 취소를 할 수 있고,
 * 이미 처리한 결석은 처리 결과만 표시한다.
 */
export function AcademyAbsenceDialog({
  open,
  month,
  absences,
  isBusy,
  onOpenChange,
  onChangeMonth,
  onConfirmAbsence,
  onCancelAbsence,
}: {
  open: boolean;
  month: string;
  absences: DailyAcademyAttendanceRow[];
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeMonth: (month: string) => void;
  onConfirmAbsence: (row: DailyAcademyAttendanceRow) => void;
  onCancelAbsence: (row: DailyAcademyAttendanceRow) => void;
}) {
  const summary = summarizeMonthlyAcademyAbsences(absences);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{formatMonthLabel(month)} 결석인원</DialogTitle>
          <DialogDescription>
            조회 중인 달에 결석으로 확인된 원생입니다. 결석확인을 누르면 사유서를 작성해 보강 또는
            패스로 처리합니다.
          </DialogDescription>
        </DialogHeader>
        <LessonMonthControl
          variantLabel="결석인원"
          selectedMonth={month}
          onChangeMonth={onChangeMonth}
        />
        <p className="text-sm text-muted-foreground">
          총 {summary.total}건 · 미처리 {summary.unresolved}건 · 보강 {summary.makeup}건 · 패스{" "}
          {summary.pass}건
        </p>
        <Table aria-label={`${formatMonthLabel(month)} 결석인원 표`} className="lg:min-w-[56rem]">
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">날짜</TableHead>
              <TableHead className="px-4 py-3">시간</TableHead>
              <TableHead className="px-4 py-3">원생</TableHead>
              <TableHead className="px-4 py-3">악기</TableHead>
              <TableHead className="px-4 py-3">선생님</TableHead>
              <TableHead className="px-4 py-3">사유</TableHead>
              <TableHead className="px-4 py-3">처리</TableHead>
              <TableHead className="px-4 py-3 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {absences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  이 달에는 결석 인원이 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
            {absences.map((row) => (
              <TableRow key={row.lessonEventId}>
                <TableCell label="날짜" className="px-4 py-3">{row.date}</TableCell>
                <TableCell label="시간" className="px-4 py-3">{formatLessonTimeRange(row)}</TableCell>
                <TableCell label="원생" className="px-4 py-3 font-medium">{row.studentName}</TableCell>
                <TableCell label="악기" className="px-4 py-3">{row.instrumentName}</TableCell>
                <TableCell label="선생님" className="px-4 py-3">{row.teacherName ?? "-"}</TableCell>
                <TableCell label="사유" className="px-4 py-3">{formatAbsenceReason(row.absenceReason)}</TableCell>
                <TableCell label="처리" className="px-4 py-3">
                  <ResolutionBadge resolution={row.absenceResolution} />
                </TableCell>
                <TableCell label="작업" className="px-4 py-3 text-right">
                  {row.absenceResolution ? (
                    "-"
                  ) : (
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        aria-label={`${row.studentName} 결석확인`}
                        disabled={isBusy}
                        onClick={() => onConfirmAbsence(row)}
                      >
                        <ClipboardCheck aria-hidden="true" />
                        결석확인
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        aria-label={`${row.studentName} 결석 취소`}
                        disabled={isBusy}
                        onClick={() => onCancelAbsence(row)}
                      >
                        <Undo2 aria-hidden="true" />
                        취소
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

function ResolutionBadge({ resolution }: { resolution: DailyAcademyAttendanceRow["absenceResolution"] }) {
  if (resolution === "makeup") {
    return <Badge>보강 완료</Badge>;
  }

  if (resolution === "pass") {
    return <Badge variant="secondary">패스 완료</Badge>;
  }

  return <Badge variant="destructive">미처리</Badge>;
}

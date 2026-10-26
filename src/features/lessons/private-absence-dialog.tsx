"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAbsenceReason } from "@/domain/academy-lesson-attendance";
import type { PrivateLesson } from "@/domain/private-lesson";
import { LessonMonthControl } from "@/features/lessons/lesson-toolbar";
import {
  formatMonthLabel,
  toSeoulDate,
  toSeoulHourMinute,
} from "@/features/lessons/workspace-helpers";

/**
 * 개인레슨 결석인원. 조회 중인 달의 결석을 날짜순으로 보여 주고 결석 취소를 제공한다.
 * 결석 사유 수정은 날짜의 출석 확인에서 한다.
 */
export function PrivateAbsenceDialog({
  open,
  month,
  absences,
  onOpenChange,
  onChangeMonth,
  onCancelAbsence,
}: {
  open: boolean;
  month: string;
  absences: PrivateLesson[];
  onOpenChange: (open: boolean) => void;
  onChangeMonth: (month: string) => void;
  onCancelAbsence?: (lesson: PrivateLesson) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{formatMonthLabel(month)} 개인레슨 결석인원</DialogTitle>
          <DialogDescription>
            조회 중인 달에 결석 처리된 개인레슨입니다. 결석 취소는 예정 상태로 되돌립니다.
            사유 수정은 날짜의 출석 확인에서 할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <LessonMonthControl
          variantLabel="결석인원"
          selectedMonth={month}
          onChangeMonth={onChangeMonth}
        />
        <p className="text-sm text-muted-foreground">총 {absences.length}건</p>
        <Table
          aria-label={`${formatMonthLabel(month)} 개인레슨 결석인원 표`}
          className="lg:min-w-[52rem]"
        >
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>시간</TableHead>
              <TableHead>원생</TableHead>
              <TableHead>악기</TableHead>
              <TableHead>선생님</TableHead>
              <TableHead>사유</TableHead>
              {onCancelAbsence ? <TableHead>처리</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {absences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onCancelAbsence ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                  이 달에는 결석 인원이 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
            {absences.map((lesson) => (
              <TableRow key={lesson.id}>
                <TableCell label="날짜">{toSeoulDate(lesson.startAt)}</TableCell>
                <TableCell label="시간">
                  {toSeoulHourMinute(lesson.startAt)}-{toSeoulHourMinute(lesson.endAt)}
                </TableCell>
                <TableCell label="원생" className="font-medium">{lesson.studentName}</TableCell>
                <TableCell label="악기">{lesson.instrumentName}</TableCell>
                <TableCell label="선생님">{lesson.teacherName}</TableCell>
                <TableCell label="사유">{formatAbsenceReason(lesson.absenceReason)}</TableCell>
                {onCancelAbsence ? <TableCell label="처리">
                  <Button type="button" variant="outline" size="sm" aria-label={`${lesson.studentName} 결석 취소`}
                    onClick={() => onCancelAbsence(lesson)}>결석 취소</Button>
                </TableCell> : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

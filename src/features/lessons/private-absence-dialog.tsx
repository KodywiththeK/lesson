"use client";

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
import { formatAbsenceReason } from "@/domain/academy-lesson-attendance";
import type { PrivateLesson } from "@/domain/private-lesson";
import { LessonMonthControl } from "@/features/lessons/lesson-toolbar";
import {
  formatMonthLabel,
  toSeoulDate,
  toSeoulHourMinute,
} from "@/features/lessons/workspace-helpers";

/**
 * 개인레슨 결석인원. 조회 중인 달에 결석 처리된 개인레슨을 날짜순으로 모아 보여 주는 조회 전용 목록이다.
 * 개인레슨은 보강·패스 처리 흐름이 없고, 출결과 결석 사유 변경은 날짜의 출석 확인에서 한다.
 */
export function PrivateAbsenceDialog({
  open,
  month,
  absences,
  onOpenChange,
  onChangeMonth,
}: {
  open: boolean;
  month: string;
  absences: PrivateLesson[];
  onOpenChange: (open: boolean) => void;
  onChangeMonth: (month: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{formatMonthLabel(month)} 개인레슨 결석인원</DialogTitle>
          <DialogDescription>
            조회 중인 달에 결석 처리된 개인레슨입니다. 출결이나 결석 사유를 바꾸려면 날짜를 눌러
            출석 확인에서 수정해 주세요.
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {absences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

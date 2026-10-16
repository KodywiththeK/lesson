"use client";

import { ClipboardCheck } from "lucide-react";

import { DateField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import { AttendanceBadge, OriginBadge } from "@/features/lessons/lesson-badges";
import { formatLessonTimeRange } from "@/features/lessons/workspace-helpers";

export function AcademyLessonTableView({
  selectedDate,
  rows,
  onChangeDate,
  onOpenDay,
}: {
  selectedDate: string;
  rows: DailyAcademyAttendanceRow[];
  onChangeDate: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">일별 학원 레슨</p>
          <h3 className="text-base font-semibold">{selectedDate}</h3>
        </div>
        <Label className="grid gap-1 text-sm font-medium sm:min-w-48">
          <span>테이블 날짜</span>
          <DateField
            aria-label="학원 레슨 테이블 날짜 선택"
            required
            value={selectedDate}
            onValueChange={onChangeDate}
          />
        </Label>
      </div>
      <Table
        aria-label={`${selectedDate} 학원 레슨 테이블`}
        className="lg:min-w-[54rem]"
      >
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">시간</TableHead>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">선생님</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
            <TableHead className="px-4 py-3 text-right">처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                선택한 날짜에 등록된 학원 레슨이 없습니다.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.lessonEventId} data-state="selected">
              <TableCell label="시간" className="px-4 py-3">
                {formatLessonTimeRange(row)}
              </TableCell>
              <TableCell label="원생" className="px-4 py-3 font-medium">
                {row.studentName}
              </TableCell>
              <TableCell label="악기" className="px-4 py-3">{row.instrumentName}</TableCell>
              <TableCell label="선생님" className="px-4 py-3">{row.teacherName ?? "-"}</TableCell>
              <TableCell label="상태" className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <OriginBadge label={row.originLabel} />
                  <AttendanceBadge status={row.status} />
                </div>
              </TableCell>
              <TableCell label="처리" className="px-4 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${row.studentName} 출석 확인 열기`}
                  onClick={() => onOpenDay(row.date)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  출석 확인
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

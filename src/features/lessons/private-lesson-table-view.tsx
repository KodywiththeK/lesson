"use client";

import { ClipboardCheck } from "lucide-react";

import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { paginateItems } from "@/domain/common-list";
import { type PrivateLesson } from "@/domain/private-lesson";
import { LessonMonthControl } from "@/features/lessons/lesson-toolbar";
import {
  formatMonthLabel,
  toSeoulDate,
  toSeoulHourMinute,
  formatPrivateLessonStatus,
} from "@/features/lessons/workspace-helpers";

export function PrivateLessonTableView({
  selectedMonth,
  selectedDate,
  lessons,
  onChangeMonth,
  onOpenDay,
}: {
  selectedMonth: string;
  selectedDate: string;
  lessons: PrivateLesson[];
  onChangeMonth: (month: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const monthLessons = lessons.filter((lesson) =>
    toSeoulDate(lesson.startAt).startsWith(selectedMonth),
  );
  const view = paginateItems(monthLessons, { page, pageSize });
  const changeMonth = (month: string) => {
    resetPage();
    onChangeMonth(month);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid gap-3 p-3">
        <LessonMonthControl
          variantLabel="개인레슨 테이블"
          selectedMonth={selectedMonth}
          onChangeMonth={changeMonth}
        />
        <Table
          aria-label={`${formatMonthLabel(selectedMonth)} 개인레슨 테이블`}
          className="lg:min-w-[54rem]"
        >
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">날짜</TableHead>
              <TableHead className="px-4 py-3">시간</TableHead>
              <TableHead className="px-4 py-3">원생</TableHead>
              <TableHead className="px-4 py-3">악기</TableHead>
              <TableHead className="px-4 py-3">선생님</TableHead>
              <TableHead className="px-4 py-3">상태</TableHead>
              <TableHead className="px-4 py-3 text-right">처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  해당 월에 등록된 개인레슨이 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
            {view.items.map((lesson) => {
              const date = toSeoulDate(lesson.startAt);

              return (
                <TableRow
                  key={lesson.id}
                  data-state={date === selectedDate ? "selected" : undefined}
                >
                  <TableCell label="날짜" className="px-4 py-3">{date}</TableCell>
                  <TableCell label="시간" className="px-4 py-3">
                    {toSeoulHourMinute(lesson.startAt)}-
                    {toSeoulHourMinute(lesson.endAt)}
                  </TableCell>
                  <TableCell label="원생" className="px-4 py-3 font-medium">
                    {lesson.studentName}
                  </TableCell>
                  <TableCell label="악기" className="px-4 py-3">{lesson.instrumentName}</TableCell>
                  <TableCell label="선생님" className="px-4 py-3">{lesson.teacherName}</TableCell>
                  <TableCell label="상태" className="px-4 py-3">
                    <Badge
                      variant={lesson.status === "present" ? "default" : "outline"}
                    >
                      {formatPrivateLessonStatus(lesson.status)}
                    </Badge>
                  </TableCell>
                  <TableCell label="처리" className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${lesson.studentName} 개인레슨 출석 확인 열기`}
                      onClick={() => onOpenDay(date)}
                    >
                      <ClipboardCheck aria-hidden="true" />
                      출석 확인
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        itemLabel="개인레슨"
        countUnit="건"
        view={view}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}

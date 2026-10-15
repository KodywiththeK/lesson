"use client";

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WeekdayAttendanceSummary } from "@/domain/academy-weekday-summary";
import { formatMonthLabel } from "@/features/lessons/workspace-helpers";

/** 요일별 인원확인. 선택한 달의 정규 일정 기준으로 월~금 등원 인원과 전체 인원을 접어서 보여 준다. */
export function AcademyWeekdaySummary({
  month,
  summary,
}: {
  month: string;
  summary: WeekdayAttendanceSummary;
}) {
  return (
    <Collapsible className="rounded-lg border border-border bg-card">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group h-auto w-full justify-between px-3 py-3"
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">요일별 인원확인</span>
            <Badge variant="secondary">전체 {summary.totalCount}명</Badge>
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-3 border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          {formatMonthLabel(month)} 정규 시간표 기준입니다. 보강·이동·비정기 일정은 포함하지 않고,
          여러 요일에 오는 원생도 전체 인원에서는 한 명으로 셉니다.
        </p>
        <div className="grid gap-2 sm:grid-cols-5">
          {summary.weekdays.map((day) => (
            <div
              key={day.weekday}
              role="group"
              aria-label={`${day.label}요일 ${day.count}명`}
              className="rounded-md border border-border bg-background p-2"
            >
              <p className="text-sm font-semibold">
                {day.label}요일 <span className="text-primary">{day.count}명</span>
              </p>
              {day.students.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">등원 원생 없음</p>
              ) : (
                <ul className="mt-1 grid gap-0.5 text-sm">
                  {day.students.map((student) => (
                    <li key={student.studentId}>{student.studentName}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

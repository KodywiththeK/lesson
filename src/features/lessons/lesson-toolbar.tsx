"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { type ReactNode } from "react";

import { SectionCard } from "@/components/shared/section-card";
import { DateField, MonthField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  shiftDate,
  shiftMonth,
  toLessonView,
  toControlId,
} from "@/features/lessons/workspace-helpers";
import type { LessonView } from "@/features/lessons/workspace-types";

export function LessonToolbar({
  ariaLabel,
  actions,
}: {
  ariaLabel: string;
  actions: ReactNode;
}) {
  return (
    <SectionCard
      role="toolbar"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        {actions}
      </div>
    </SectionCard>
  );
}

const VIEW_TAB_CLASS_NAME =
  "h-auto min-h-10 px-4 py-1.5 text-sm leading-tight whitespace-normal sm:text-base";

/** 좁은 화면에서는 레슨 종류와 보기 이름을 두 줄로 나눠, 글자 하나만 다음 줄로 떨어지는 일을 막는다. */
function ViewTabLabel({ prefix, name }: { prefix: string; name: string }) {
  return (
    <span className="flex flex-col items-center sm:flex-row sm:gap-1">
      <span>{prefix} </span>
      <span>{name}</span>
    </span>
  );
}

/** 월별 캘린더·일별 테이블 보기 전환 탭. `actions`를 주면 같은 줄의 오른쪽 끝에 둔다(좁은 화면에서는 줄바꿈). */
export function LessonViewTabs({
  labelPrefix,
  value,
  onValueChange,
  actions,
}: {
  labelPrefix: string;
  value: LessonView;
  onValueChange: (value: LessonView) => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Tabs
        value={value}
        onValueChange={(nextValue) => onValueChange(toLessonView(nextValue))}
        className="w-full gap-3 sm:w-auto"
      >
        <TabsList size="fit" className="grid w-full grid-cols-2 sm:w-fit">
          <TabsTrigger value="calendar" className={VIEW_TAB_CLASS_NAME}>
            <CalendarDays aria-hidden="true" />
            <ViewTabLabel prefix={labelPrefix} name="월별 캘린더뷰" />
          </TabsTrigger>
          <TabsTrigger value="table" className={VIEW_TAB_CLASS_NAME}>
            <Table2 aria-hidden="true" />
            <ViewTabLabel prefix={labelPrefix} name="일별 테이블뷰" />
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LessonMonthControl({
  variantLabel,
  selectedMonth,
  onChangeMonth,
  onToday,
  trailing,
}: {
  variantLabel: string;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  onToday?: () => void;
  /** "오늘로 이동" 바로 뒤에 놓을 버튼(월별 메모지 등). */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${variantLabel} 이전 달`}
          onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Label className="sr-only" htmlFor={`${toControlId(variantLabel)}-month`}>
          {variantLabel} 월 선택
        </Label>
        <MonthField
          id={`${toControlId(variantLabel)}-month`}
          aria-label={`${variantLabel} 월 선택`}
          required
          value={selectedMonth}
          onValueChange={onChangeMonth}
          className="w-40"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${variantLabel} 다음 달`}
          onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        {onToday ? (
          <Button type="button" variant="outline" size="sm" onClick={onToday}>
            오늘로 이동
          </Button>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}

/** 일별 보기의 날짜 컨트롤. 날짜 선택 칸과 이전·다음 날짜, 오늘로 이동을 한 줄에 두고 `trailing`을 그 뒤에 놓는다. */
export function LessonDayControl({
  variantLabel,
  selectedDate,
  onChangeDate,
  onToday,
  trailing,
}: {
  variantLabel: string;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  onToday: () => void;
  /** "오늘로 이동" 바로 뒤에 놓을 버튼(일별 메모지 등). */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${variantLabel} 이전 날짜`}
        onClick={() => onChangeDate(shiftDate(selectedDate, -1))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <DateField
        aria-label={`${variantLabel} 날짜 선택`}
        required
        value={selectedDate}
        onValueChange={onChangeDate}
        className="w-44"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${variantLabel} 다음 날짜`}
        onClick={() => onChangeDate(shiftDate(selectedDate, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onToday}>
        오늘로 이동
      </Button>
      {trailing}
    </div>
  );
}

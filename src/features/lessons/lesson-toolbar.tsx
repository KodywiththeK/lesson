"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Table2 } from "lucide-react";
import { type ReactNode } from "react";

import { MonthField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  shiftMonth,
  formatMonthLabel,
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
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        {actions}
      </div>
    </div>
  );
}

export function LessonViewTabs({
  labelPrefix,
  value,
  onValueChange,
}: {
  labelPrefix: string;
  value: LessonView;
  onValueChange: (value: LessonView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onValueChange(toLessonView(nextValue))}
      className="gap-3"
    >
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
        <TabsTrigger value="calendar">
          <CalendarDays aria-hidden="true" />
          {labelPrefix} 캘린더뷰
        </TabsTrigger>
        <TabsTrigger value="table">
          <Table2 aria-hidden="true" />
          {labelPrefix} 테이블뷰
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function LessonMonthControl({
  variantLabel,
  selectedMonth,
  onChangeMonth,
}: {
  variantLabel: string;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
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
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {formatMonthLabel(selectedMonth)}
      </p>
    </div>
  );
}

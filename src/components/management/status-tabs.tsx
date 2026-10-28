"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type StatusTabOption = { value: string; label: string; dotClassName: string };

/** Tabs 안에서 상태별 색상 점과 동일한 너비의 선택 항목을 표시한다. */
export function StatusTabs({ label, options, className }: {
  label: string; options: readonly StatusTabOption[]; className?: string;
}) {
  return <div className={cn("w-full overflow-x-auto", className)}>
    <TabsList aria-label={label} className="flex w-full min-w-max">
      {options.map((option) => <TabsTrigger key={option.value} value={option.value} className="min-w-max flex-1">
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", option.dotClassName)} />{option.label}
      </TabsTrigger>)}
    </TabsList>
  </div>;
}

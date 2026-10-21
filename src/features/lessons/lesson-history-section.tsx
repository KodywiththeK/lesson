"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** 일별 테이블뷰 아래의 접이식 "변경 이력". 접혀 있는 동안은 내용을 만들지 않아 이력을 불러오지 않는다. */
export function LessonHistorySection({ children }: { children: ReactNode }) {
  return (
    <SectionCard padded={false}>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" className="group w-full justify-between rounded-none px-4">
            변경 이력
            <ChevronDown
              aria-hidden="true"
              className="transition-transform group-data-[state=open]:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t border-border p-4">{children}</CollapsibleContent>
      </Collapsible>
    </SectionCard>
  );
}

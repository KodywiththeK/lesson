"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MakeupDateRecommendation } from "@/domain/academy-makeup-recommendation";

const RECOMMENDATION_CRITERIA = [
  "정규 등원 요일은 제외",
  "등원 인원이 적은 날 우선",
  "결석일 이후 가까운 날 우선",
];

export function AcademyMakeupRecommendation({
  recommendations,
  selectedDate,
  onSelectDate,
}: {
  recommendations: MakeupDateRecommendation[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium">추천 보강일</p>
        <RecommendationCriteriaHint />
      </div>
      {recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          추천할 수 있는 날짜가 없습니다. 아래 보강일에서 직접 선택해 주세요.
        </p>
      ) : (
        <RadioGroup
          aria-label="추천 보강일"
          value={selectedDate}
          onValueChange={onSelectDate}
          className="grid-cols-1 gap-1 sm:grid-cols-2"
        >
          {recommendations.map((recommendation) => (
            <Label
              key={recommendation.date}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background p-2 text-sm font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value={recommendation.date} aria-label={recommendation.label} />
              <span>{recommendation.label}</span>
              <Badge variant="secondary" className="ml-auto">
                추천
              </Badge>
            </Label>
          ))}
        </RadioGroup>
      )}
    </div>
  );
}

/**
 * 추천 기준 안내. 마우스를 올리거나 키보드로 초점을 두면 열리고, 눌러도 열린다.
 * Radix 툴팁은 눌림을 "닫기"로 처리해 터치 화면에서 열리지 않으므로 눌림은 직접 연다.
 */
function RecommendationCriteriaHint() {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger
          asChild
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="추천 기준 보기"
          >
            <Info aria-hidden="true" className="size-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        {/* 다이얼로그(z-[60]) 위에 보이도록 레이어를 올린다. */}
        <TooltipContent className="z-[90] max-w-64">
          <p className="font-medium">추천 기준</p>
          <ol className="mt-1 list-decimal pl-4">
            {RECOMMENDATION_CRITERIA.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ol>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

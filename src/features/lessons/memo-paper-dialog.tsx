"use client";

import { StickyNote } from "lucide-react";
import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** 메모지 제목에 쓰는 레슨 종류 이름. 월별·일별 메모지가 함께 쓴다. */
export const MEMO_LESSON_KIND_LABELS = { academy: "학원레슨", private: "개인레슨" } as const;

const PAPER_LINE_HEIGHT = 1.75;
const PAPER_RULE_THICKNESS = 0.0625;

/** 노트 종이처럼 줄이 그어진 배경. 줄 간격과 글자 줄 간격이 같은 값에서 나와 글씨가 줄 위에 앉는다. */
export const RULED_PAPER_STYLE = {
  backgroundImage: `repeating-linear-gradient(transparent 0 ${PAPER_LINE_HEIGHT - PAPER_RULE_THICKNESS}rem, color-mix(in oklch, var(--warning) 30%, transparent) ${PAPER_LINE_HEIGHT - PAPER_RULE_THICKNESS}rem ${PAPER_LINE_HEIGHT}rem)`,
  backgroundAttachment: "local",
  lineHeight: `${PAPER_LINE_HEIGHT}rem`,
} as const;

/** 월별·일별 메모지가 함께 쓰는 노란 메모지 모양 다이얼로그(위쪽 테이프 장식 포함). */
export function MemoPaperDialog({
  open,
  onOpenChange,
  title,
  description,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-3 rounded-md border-warning/30 bg-warning-soft shadow-lg sm:max-w-md",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 h-4 w-20 -translate-x-1/2 -rotate-2 rounded-sm bg-warning/25"
        />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-warning-soft-foreground">
            <StickyNote className="size-4" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-warning-soft-foreground/80">
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

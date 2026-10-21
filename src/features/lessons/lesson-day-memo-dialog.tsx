"use client";

import { StickyNote } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LessonMemoTabPanel } from "@/features/lessons/lesson-memo-tab-panel";
import { MEMO_LESSON_KIND_LABELS, MemoPaperDialog } from "@/features/lessons/memo-paper-dialog";
import type { LessonMemoTargetOptions } from "@/features/lessons/workspace-types";
import type {
  LessonCalendarMemo,
  LessonCalendarMemoPayload,
  UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";

/**
 * 일별 테이블뷰에서 선택한 날짜의 메모를 여는 메모지. 월별 메모지와 달리 날짜당 여러 개를 쓰고
 * 원생·선생님을 지정하는 기존 날짜별 메모를 그대로 쓴다(출석 확인 모달의 "메모" 탭과 같은 패널).
 */
export function LessonDayMemoDialog({
  academyId,
  lessonKind,
  date,
  memos,
  targets,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
}: {
  academyId: string;
  lessonKind: keyof typeof MEMO_LESSON_KIND_LABELS;
  /** YYYY-MM-DD */
  date: string;
  memos: LessonCalendarMemo[];
  targets: LessonMemoTargetOptions;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dateLabel = `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <StickyNote aria-hidden="true" />
        {dateLabel} 메모지
        {memos.length > 0 ? <Badge variant="secondary">{memos.length}</Badge> : null}
      </Button>
      <MemoPaperDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`${dateLabel} ${MEMO_LESSON_KIND_LABELS[lessonKind]} 메모지`}
        description="이 날짜의 특이사항을 여러 개 남길 수 있고, 원생이나 선생님을 지정할 수 있습니다."
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
      >
        {/* 노란 종이 위에서 메모 항목이 흰 쪽지로 보이도록 패널 안쪽 항목의 색만 바꾼다. */}
        <div className="[&_article]:border-warning/30 [&_article]:bg-card">
          <LessonMemoTabPanel
            academyId={academyId}
            lessonKind={lessonKind}
            date={date}
            memos={memos}
            targets={targets}
            onCreateMemo={onCreateMemo}
            onUpdateMemo={onUpdateMemo}
            onDeleteMemo={onDeleteMemo}
          />
        </div>
      </MemoPaperDialog>
    </>
  );
}

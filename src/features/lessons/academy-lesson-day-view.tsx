"use client";

import type { ReactNode } from "react";

import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import { AcademyAttendanceChecklist } from "@/features/lessons/academy-attendance-checklist";
import { LessonDayMemoDialog } from "@/features/lessons/lesson-day-memo-dialog";
import { LessonHistorySection } from "@/features/lessons/lesson-history-section";
import { LessonDayControl } from "@/features/lessons/lesson-toolbar";
import { useAcademyAttendanceDraft } from "@/features/lessons/use-academy-attendance-draft";
import type {
  AttendanceSelection,
  LessonMemoTargetOptions,
} from "@/features/lessons/workspace-types";
import type {
  LessonCalendarMemo,
  LessonCalendarMemoPayload,
  UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";

/**
 * 학원레슨 일별 테이블뷰. 출석 확인 모달에서 하던 일(출석 선택·저장, 이동·삭제·초기화, 메모, 변경 이력)을
 * 모달 없이 이 화면에서 모두 한다. 출결은 고른 뒤 확인해야 한꺼번에 저장된다.
 */
export function AcademyLessonDayView({
  academyId,
  date,
  rows,
  memos,
  memoTargets,
  canManage,
  history,
  isBusy,
  onChangeDate,
  onToday,
  onConfirmAttendance,
  onReset,
  onMove,
  onDelete,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
}: {
  academyId: string;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  /** false면 조회만 한다(선생님). 출결 선택·이동·삭제·초기화·메모를 보여 주지 않는다. */
  canManage: boolean;
  /** 이 날짜의 변경 이력. 있으면(관리 권한일 때만) 표 아래 접이식 섹션으로 보여 준다. */
  history?: ReactNode;
  isBusy: boolean;
  onChangeDate: (date: string) => void;
  onToday: () => void;
  onConfirmAttendance: (selections: AttendanceSelection[]) => Promise<boolean>;
  onReset: (row: DailyAcademyAttendanceRow) => void;
  onMove: (row: DailyAcademyAttendanceRow) => void;
  onDelete: (row: DailyAcademyAttendanceRow) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
}) {
  const draft = useAcademyAttendanceDraft({ date, rows, onConfirmAttendance });

  return (
    <div className="grid min-w-0 gap-4">
      <SectionCard className="grid gap-3 p-3">
        <LessonDayControl
          variantLabel="학원 레슨 테이블"
          selectedDate={date}
          onChangeDate={onChangeDate}
          onToday={onToday}
          trailing={
            canManage ? (
              <LessonDayMemoDialog
                academyId={academyId}
                lessonKind="academy"
                date={date}
                memos={memos}
                targets={memoTargets}
                onCreateMemo={onCreateMemo}
                onUpdateMemo={onUpdateMemo}
                onDeleteMemo={onDeleteMemo}
              />
            ) : undefined
          }
        />
        <AcademyAttendanceChecklist
          date={date}
          rows={rows}
          draft={draft.choices}
          canManage={canManage}
          isBusy={isBusy}
          isScrollable={false}
          onChoose={draft.choose}
          onChooseMany={draft.chooseMany}
          onReset={onReset}
          onMove={onMove}
          onDelete={onDelete}
        />
        {canManage ? (
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isBusy} onClick={draft.discard}>
              취소
            </Button>
            <Button
              type="button"
              disabled={isBusy || draft.selections.length === 0}
              onClick={() => void draft.confirm()}
            >
              확인
            </Button>
          </div>
        ) : null}
      </SectionCard>
      {canManage && history !== undefined ? <LessonHistorySection>{history}</LessonHistorySection> : null}
    </div>
  );
}

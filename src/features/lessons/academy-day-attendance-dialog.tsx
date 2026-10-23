"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import {
  type LessonCalendarMemo,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import { AcademyAttendanceChecklist } from "@/features/lessons/academy-attendance-checklist";
import { LessonMemoTabPanel } from "@/features/lessons/lesson-memo-tab-panel";
import { useAcademyAttendanceDraft } from "@/features/lessons/use-academy-attendance-draft";
import type {
  AttendanceSelection,
  LessonMemoTargetOptions,
} from "@/features/lessons/workspace-types";

type DayTab = "attendance" | "memos" | "history";

export function AcademyDayAttendanceDialog({
  open,
  academyId,
  date,
  rows,
  memos,
  memoTargets,
  canManage,
  history,
  isBusy,
  onOpenChange,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onConfirmAttendance,
  onReset,
  onMove,
  onDelete,
}: {
  open: boolean;
  academyId: string;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  /** false면 조회만 한다(선생님). 출결 선택·이동·삭제·초기화를 보여 주지 않는다. */
  canManage: boolean;
  /** 이 날짜의 변경 이력. 있으면(관리 권한일 때만) "변경 이력" 탭에서 보여 준다. */
  history?: ReactNode;
  isBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  /** 고른 출결을 한꺼번에 저장한다. 저장에 성공하면 true. */
  onConfirmAttendance: (selections: AttendanceSelection[]) => Promise<boolean>;
  onReset: (row: DailyAcademyAttendanceRow) => void;
  onMove: (row: DailyAcademyAttendanceRow) => void;
  onDelete: (row: DailyAcademyAttendanceRow) => void;
}) {
  const [tab, setTab] = useState<DayTab>("attendance");
  const draft = useAcademyAttendanceDraft({ date, rows, onConfirmAttendance });
  const isAttendanceTab = tab === "attendance" && canManage;
  const hasHistoryTab = canManage && history !== undefined;

  const closeAndDiscard = () => {
    draft.discard();
    setTab("attendance");
    onOpenChange(false);
  };
  const confirmAttendance = async () => {
    if (await draft.confirm()) {
      closeAndDiscard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : closeAndDiscard())}>
      <DialogContent className="max-h-[90vh] min-h-[60vh] grid-rows-[auto_1fr_auto] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{date} 출석 확인</DialogTitle>
          <DialogDescription>
            {canManage
              ? "원생별로 등원(O) 또는 결석(X)을 고르고 출석 저장을 누르면 한꺼번에 저장됩니다. 닫으면 저장하지 않은 출석 선택만 사라집니다. 일정 이동·삭제·초기화는 각 작업에서 바로 반영됩니다."
              : "선택한 날짜의 학원 수업과 메모를 확인합니다."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as DayTab)} className="gap-3">
          {canManage ? (
            <TabsList className={`grid h-auto w-full sm:w-fit ${hasHistoryTab ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="attendance">출석관리</TabsTrigger>
              <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
              {hasHistoryTab ? <TabsTrigger value="history">변경 이력</TabsTrigger> : null}
            </TabsList>
          ) : null}
          <TabsContent value="attendance" className="grid content-start gap-3 overflow-hidden">
            <AcademyAttendanceChecklist
              date={date}
              rows={rows}
              draft={draft.choices}
              canManage={canManage}
              isBusy={isBusy}
              onChoose={draft.choose}
              onChooseMany={draft.chooseMany}
              onReset={onReset}
              onMove={onMove}
              onDelete={onDelete}
            />
          </TabsContent>
          {canManage ? (
            <TabsContent value="memos">
              <LessonMemoTabPanel
                academyId={academyId}
                lessonKind="academy"
                date={date}
                memos={memos}
                targets={memoTargets}
                onCreateMemo={onCreateMemo}
                onUpdateMemo={onUpdateMemo}
                onDeleteMemo={onDeleteMemo}
              />
            </TabsContent>
          ) : null}
          {hasHistoryTab ? <TabsContent value="history">{history}</TabsContent> : null}
        </Tabs>
        <DialogFooter>
          {isAttendanceTab ? (
            <>
              <Button type="button" variant="outline" disabled={isBusy} onClick={closeAndDiscard}>
                닫기
              </Button>
              <Button
                type="button"
                disabled={isBusy || draft.selections.length === 0}
                onClick={() => void confirmAttendance()}
              >
                출석 저장
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={closeAndDiscard}>
              닫기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";

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
import {
  AcademyAttendanceChecklist,
  isAttendanceEditable,
  type AttendanceChoice,
  type AttendanceDraft,
} from "@/features/lessons/academy-attendance-checklist";
import { LessonMemoTabPanel } from "@/features/lessons/lesson-memo-tab-panel";
import type {
  AttendanceSelection,
  LessonMemoTargetOptions,
} from "@/features/lessons/workspace-types";

type DayTab = "attendance" | "memos";

type DateDraft = { date: string; choices: AttendanceDraft };

export function AcademyDayAttendanceDialog({
  open,
  academyId,
  date,
  rows,
  memos,
  memoTargets,
  canManage,
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
  const [dateDraft, setDateDraft] = useState<DateDraft>({ date, choices: {} });
  // 날짜가 바뀌면(일정 이동으로 다른 날을 보게 될 때) 이전 날짜에서 고른 값은 쓰지 않는다.
  const choices = dateDraft.date === date ? dateDraft.choices : NO_CHOICES;
  const selections = rows.flatMap((row) => {
    const status = choices[row.lessonEventId];

    return status && status !== row.status && isAttendanceEditable(row) ? [{ row, status }] : [];
  });
  const isAttendanceTab = tab === "attendance" && canManage;

  const updateChoices = (update: (current: AttendanceDraft) => AttendanceDraft) =>
    setDateDraft({ date, choices: update(choices) });
  const closeAndDiscard = () => {
    setDateDraft({ date, choices: {} });
    setTab("attendance");
    onOpenChange(false);
  };
  const confirmAttendance = async () => {
    if (await onConfirmAttendance(selections)) {
      closeAndDiscard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : closeAndDiscard())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{date} 출석 확인</DialogTitle>
          <DialogDescription>
            {canManage
              ? "원생별로 등원(O) 또는 결석(X)을 고르고 확인을 누르면 한꺼번에 저장됩니다. 취소하면 고른 내용은 저장되지 않습니다."
              : "선택한 날짜의 학원 수업과 메모를 확인합니다."}
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as DayTab)} className="gap-3">
          {canManage ? (
            <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
              <TabsTrigger value="attendance">출석관리</TabsTrigger>
              <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
            </TabsList>
          ) : null}
          <TabsContent value="attendance" className="grid gap-3 overflow-hidden">
            <AcademyAttendanceChecklist
              date={date}
              rows={rows}
              draft={choices}
              canManage={canManage}
              isBusy={isBusy}
              onChoose={(row, choice) =>
                updateChoices((current) => withChoice(current, [row], choice))
              }
              onChooseMany={(targetRows, choice) =>
                updateChoices((current) => withChoice(current, targetRows, choice))
              }
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
        </Tabs>
        <DialogFooter>
          {isAttendanceTab ? (
            <>
              <Button type="button" variant="outline" disabled={isBusy} onClick={closeAndDiscard}>
                취소
              </Button>
              <Button
                type="button"
                disabled={isBusy || selections.length === 0}
                onClick={() => void confirmAttendance()}
              >
                확인
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

const NO_CHOICES: AttendanceDraft = {};

/** choice가 null이면 그 원생의 임시 선택을 지워 저장된 상태로 되돌린다. */
function withChoice(
  current: AttendanceDraft,
  rows: DailyAcademyAttendanceRow[],
  choice: AttendanceChoice | null,
): AttendanceDraft {
  const next = { ...current };

  for (const row of rows) {
    if (choice) {
      next[row.lessonEventId] = choice;
    } else {
      delete next[row.lessonEventId];
    }
  }

  return next;
}

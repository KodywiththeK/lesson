"use client";

import { CalendarPlus } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
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
import { type PrivateLesson } from "@/domain/private-lesson";
import { getInstrumentColorStyle } from "@/domain/instrument-color";
import {
  type LessonCalendarMemo,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import type { AssignedLessonTicketBalance } from "@/lib/api/lesson-tickets";
import { OriginBadge } from "@/features/lessons/lesson-badges";
import { LessonMemoTabPanel } from "@/features/lessons/lesson-memo-tab-panel";
import { PrivateAbsenceReasonForm } from "@/features/lessons/private-absence-reason-form";
import {
  AssignedTicketBalanceNote,
  PrivateLessonAttendanceActions,
} from "@/features/lessons/private-lesson-attendance-actions";
import {
  type MarkPrivateLesson,
  usePrivateAbsenceReasonForm,
} from "@/features/lessons/use-private-absence-reason-form";
import {
  toSeoulHourMinute,
  formatPrivateLessonStatus,
} from "@/features/lessons/workspace-helpers";
import type { LessonMemoTargetOptions } from "@/features/lessons/workspace-types";

export function PrivateDayAttendanceDialog({
  open,
  academyId,
  date,
  lessons,
  sessionLabels,
  memos,
  memoTargets,
  canManage,
  history,
  pendingLessonIds,
  assignedTicketBalances = [],
  instrumentColors,
  onOpenChange,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onMark,
  onCancelAttendance,
  onEditLesson,
  onRegisterOnDate,
}: {
  open: boolean;
  academyId: string;
  date: string;
  lessons: PrivateLesson[];
  /** 레슨 id별 `1/4` 같은 현재/총 회차 표시 */
  sessionLabels: Map<string, string>;
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  /** 날짜 메모는 원장·데스크 전용이라 false면 메모 탭을 숨긴다. */
  canManage: boolean;
  /** 이 날짜의 변경 이력. 있으면(관리 권한일 때만) "변경 이력" 탭에서 보여 준다. */
  history?: ReactNode;
  pendingLessonIds: ReadonlySet<string>;
  assignedTicketBalances?: AssignedLessonTicketBalance[];
  instrumentColors?: Map<string, string>;
  onOpenChange: (open: boolean) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  onMark: MarkPrivateLesson;
  onCancelAttendance: (lesson: PrivateLesson) => void;
  onEditLesson?: (lesson: PrivateLesson) => void;
  /** 없으면(조회만 가능한 역할) 이 날짜에 등록하는 버튼을 보여 주지 않는다. */
  onRegisterOnDate?: () => void;
}) {
  const reasonForm = usePrivateAbsenceReasonForm({ date, onMark });
  const hasHistoryTab = canManage && history !== undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          reasonForm.close();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[90vh] min-h-[60vh] grid-rows-[auto_1fr_auto] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{date} 개인레슨 출석 확인</DialogTitle>
          <DialogDescription>
            수업 후 등원 확인을 누르면 원생의 같은 악기 회차권이 1회 차감되고, 취소하면 복구됩니다.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="attendance" className="gap-3">
          {canManage ? (
            <TabsList className={`grid h-auto w-full sm:w-fit ${hasHistoryTab ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="attendance">출석관리</TabsTrigger>
              <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
              {hasHistoryTab ? <TabsTrigger value="history">변경 이력</TabsTrigger> : null}
            </TabsList>
          ) : null}
          <TabsContent value="attendance" className="grid content-start gap-2">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                선택한 날짜에 개인레슨이 없습니다.
              </p>
            ) : null}
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="grid gap-3 rounded-md border border-border bg-background p-3"
                style={lesson.status === "scheduled" || lesson.status === "present"
                  ? getInstrumentColorStyle(instrumentColors?.get(lesson.instrumentId), lesson.status)
                  : undefined}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-sm">{lesson.studentName}</strong>
                      <OriginBadge label={lesson.originLabel} />
                      <Badge
                        variant={
                          lesson.status === "present" ? "default" : "outline"
                        }
                      >
                        {formatPrivateLessonStatus(lesson.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {toSeoulHourMinute(lesson.startAt)}-
                      {toSeoulHourMinute(lesson.endAt)} ·{" "}
                      {lesson.instrumentName} · {lesson.teacherName}
                      {sessionLabels.get(lesson.id) ? (
                        <>
                          {" "}
                          · <span>{sessionLabels.get(lesson.id)}</span>
                        </>
                      ) : null}
                    </p>
                    {!canManage ? (
                      <AssignedTicketBalanceNote
                        lesson={lesson}
                        balances={assignedTicketBalances}
                        className="mt-1"
                      />
                    ) : null}
                  </div>
                  <PrivateLessonAttendanceActions
                    lesson={lesson}
                    isPending={pendingLessonIds.has(lesson.id)}
                    onMark={onMark}
                    onCancelAttendance={onCancelAttendance}
                    onOpenReason={reasonForm.open}
                  />
                  {lesson.status === "scheduled" && onEditLesson ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => onEditLesson(lesson)}>
                      {lesson.studentName} 일정 수정
                    </Button>
                  ) : null}
                </div>
                {reasonForm.reasonLessonId === lesson.id ? (
                  <PrivateAbsenceReasonForm
                    lesson={lesson}
                    disabled={pendingLessonIds.has(lesson.id)}
                    onSubmit={(reason) => reasonForm.submit(lesson, reason)}
                    onCancel={reasonForm.close}
                  />
                ) : null}
              </div>
            ))}
          </TabsContent>
          {canManage ? (
            <TabsContent value="memos">
              <LessonMemoTabPanel
                academyId={academyId}
                lessonKind="private"
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
          {onRegisterOnDate ? (
            <Button type="button" onClick={onRegisterOnDate}>
              <CalendarPlus aria-hidden="true" />이 날짜에 개인레슨 등록
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

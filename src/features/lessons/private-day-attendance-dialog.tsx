"use client";

import { CalendarPlus, Check, RotateCcw, X } from "lucide-react";

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
import {
  type LessonCalendarMemo,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import { OriginBadge } from "@/features/lessons/lesson-badges";
import { LessonMemoTabPanel } from "@/features/lessons/lesson-memo-tab-panel";
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
  onOpenChange,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onMark,
  onCancelAttendance,
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
  onOpenChange: (open: boolean) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  onMark: (lesson: PrivateLesson, status: "present" | "absent") => void;
  onCancelAttendance: (lesson: PrivateLesson) => void;
  /** 없으면(조회만 가능한 역할) 이 날짜에 등록하는 버튼을 보여 주지 않는다. */
  onRegisterOnDate?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{date} 개인레슨 출석 확인</DialogTitle>
          <DialogDescription>
            수업 후 등원 확인을 누르면 원생의 같은 악기 회차권이 1회 차감되고, 취소하면 복구됩니다.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="attendance" className="gap-3">
          {canManage ? (
            <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
              <TabsTrigger value="attendance">출석관리</TabsTrigger>
              <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
            </TabsList>
          ) : null}
          <TabsContent value="attendance" className="grid gap-2">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                선택한 날짜에 개인레슨이 없습니다.
              </p>
            ) : null}
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">{lesson.studentName}</strong>
                    <OriginBadge label={lesson.originLabel} />
                    <Badge
                      variant={lesson.status === "present" ? "default" : "outline"}
                    >
                      {formatPrivateLessonStatus(lesson.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {toSeoulHourMinute(lesson.startAt)}-
                    {toSeoulHourMinute(lesson.endAt)} · {lesson.instrumentName} ·{" "}
                    {lesson.teacherName}
                    {sessionLabels.get(lesson.id) ? (
                      <>
                        {" "}
                        · <span>{sessionLabels.get(lesson.id)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lesson.status === "present" ? (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`${lesson.studentName} 개인레슨 등원 확인 취소`}
                      onClick={() => onCancelAttendance(lesson)}
                    >
                      <RotateCcw aria-hidden="true" />
                      등원 확인 취소
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      aria-label={`${lesson.studentName} 개인레슨 등원 확인`}
                      onClick={() => onMark(lesson, "present")}
                    >
                      <Check aria-hidden="true" />
                      등원 확인
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`${lesson.studentName} 개인레슨 결석`}
                    disabled={lesson.status === "absent"}
                    onClick={() => onMark(lesson, "absent")}
                  >
                    <X aria-hidden="true" />
                    결석
                  </Button>
                </div>
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
        </Tabs>
        <DialogFooter>
          {onRegisterOnDate ? (
            <Button type="button" onClick={onRegisterOnDate}>
              <CalendarPlus aria-hidden="true" />
              이 날짜에 개인레슨 등록
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

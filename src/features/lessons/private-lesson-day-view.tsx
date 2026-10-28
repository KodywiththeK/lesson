"use client";

import { CalendarPlus } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PrivateLesson } from "@/domain/private-lesson";
import { getInstrumentColorStyle } from "@/domain/instrument-color";
import { OriginBadge, PrivateLessonStatusBadge } from "@/features/lessons/lesson-badges";
import { LessonDayMemoDialog } from "@/features/lessons/lesson-day-memo-dialog";
import { LessonHistorySection } from "@/features/lessons/lesson-history-section";
import { LessonDayControl } from "@/features/lessons/lesson-toolbar";
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
  formatPrivateLessonStatus,
  toSeoulHourMinute,
} from "@/features/lessons/workspace-helpers";
import type { LessonMemoTargetOptions } from "@/features/lessons/workspace-types";
import type {
  LessonCalendarMemo,
  LessonCalendarMemoPayload,
  UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import type { AssignedLessonTicketBalance } from "@/lib/api/lesson-tickets";

/**
 * 개인레슨 일별 테이블뷰. 출석 확인 모달에서 하던 일(등원 확인·취소, 결석 사유 입력, 메모, 변경 이력, 날짜에 등록)을
 * 모달 없이 이 화면에서 모두 한다. 결석을 누르면 그 행 아래에 사유 입력이 펼쳐진다.
 */
export function PrivateLessonDayView({
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
  onChangeDate,
  onToday,
  onMark,
  onCancelAttendance,
  onEditLesson,
  onRegisterOnDate,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
}: {
  academyId: string;
  date: string;
  /** 선택한 날짜의 개인레슨. */
  lessons: PrivateLesson[];
  /** 레슨 id별 `1/4` 같은 현재/총 회차 표시 */
  sessionLabels: Map<string, string>;
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  /** 날짜 메모와 변경 이력은 원장·데스크 전용이라 false면 숨긴다. */
  canManage: boolean;
  /** 이 날짜의 변경 이력. 있으면(관리 권한일 때만) 표 아래 접이식 섹션으로 보여 준다. */
  history?: ReactNode;
  pendingLessonIds: ReadonlySet<string>;
  assignedTicketBalances?: AssignedLessonTicketBalance[];
  instrumentColors?: Map<string, string>;
  onChangeDate: (date: string) => void;
  onToday: () => void;
  onMark: MarkPrivateLesson;
  onCancelAttendance: (lesson: PrivateLesson) => void;
  onEditLesson?: (lesson: PrivateLesson) => void;
  /** 없으면(조회만 가능한 역할) 이 날짜에 등록하는 버튼을 보여 주지 않는다. */
  onRegisterOnDate?: () => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
}) {
  const reasonForm = usePrivateAbsenceReasonForm({ date, onMark });

  return (
    <div className="grid min-w-0 gap-4">
      <SectionCard className="grid gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <LessonDayControl
            variantLabel="개인레슨 테이블"
            selectedDate={date}
            onChangeDate={onChangeDate}
            onToday={onToday}
            trailing={
              canManage ? (
                <LessonDayMemoDialog
                  academyId={academyId}
                  lessonKind="private"
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
          {onRegisterOnDate ? (
            <Button type="button" onClick={onRegisterOnDate}>
              <CalendarPlus aria-hidden="true" />
              이 날짜에 개인레슨 등록
            </Button>
          ) : null}
        </div>
        <Table aria-label={`${date} 개인레슨 테이블`} className="lg:min-w-[54rem]">
          <TableHeader>
            <TableRow>
              <TableHead>시간</TableHead>
              <TableHead>원생</TableHead>
              <TableHead>악기</TableHead>
              <TableHead>선생님</TableHead>
              <TableHead>회차</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  선택한 날짜에 개인레슨이 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
            {lessons.map((lesson) => {
              const colorStyle = lesson.status === "scheduled" || lesson.status === "present"
                ? getInstrumentColorStyle(instrumentColors?.get(lesson.instrumentId), lesson.status)
                : undefined;
              return <Fragment key={lesson.id}>
                <TableRow>
                  <TableCell label="시간">
                    {toSeoulHourMinute(lesson.startAt)}-{toSeoulHourMinute(lesson.endAt)}
                  </TableCell>
                  <TableCell label="원생" className="font-medium">
                    {lesson.studentName}
                    {!canManage ? (
                      <AssignedTicketBalanceNote
                        lesson={lesson}
                        balances={assignedTicketBalances}
                        className="text-xs font-normal"
                      />
                    ) : null}
                  </TableCell>
                  <TableCell label="악기">{colorStyle ? <span className="inline-flex w-fit rounded-md border px-2 py-1 text-sm font-semibold"
                    style={colorStyle}>{lesson.instrumentName}</span> : lesson.instrumentName}</TableCell>
                  <TableCell label="선생님">{lesson.teacherName}</TableCell>
                  <TableCell label="회차">{sessionLabels.get(lesson.id) ?? "-"}</TableCell>
                  <TableCell label="상태">
                    <div className="flex flex-wrap gap-1">
                      <OriginBadge label={lesson.originLabel} />
                      <PrivateLessonStatusBadge status={lesson.status} label={formatPrivateLessonStatus(lesson.status)} />
                      {lesson.creditAuthorized && lesson.status === "scheduled" ? <Badge variant="warning" className="border-warning">외상 예정</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell label="처리" className="text-right">
                    {lesson.status === "scheduled" && onEditLesson ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => onEditLesson(lesson)}>
                        {lesson.studentName} 일정 수정
                      </Button>
                    ) : null}
                    <PrivateLessonAttendanceActions
                      lesson={lesson}
                      isPending={pendingLessonIds.has(lesson.id)}
                      onMark={onMark}
                      onCancelAttendance={onCancelAttendance}
                      onOpenReason={reasonForm.open}
                    />
                  </TableCell>
                </TableRow>
                {reasonForm.reasonLessonId === lesson.id ? (
                  <TableRow>
                    <TableCell colSpan={7} className="whitespace-normal bg-muted/30">
                      <PrivateAbsenceReasonForm
                        lesson={lesson}
                        disabled={pendingLessonIds.has(lesson.id)}
                        onSubmit={(reason) => reasonForm.submit(lesson, reason)}
                        onCancel={reasonForm.close}
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>;
            })}
          </TableBody>
        </Table>
      </SectionCard>
      {canManage && history !== undefined ? <LessonHistorySection>{history}</LessonHistorySection> : null}
    </div>
  );
}

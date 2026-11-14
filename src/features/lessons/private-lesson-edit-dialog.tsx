"use client";

import { useId, useState } from "react";

import { DateField, TimeField } from "@/components/operations/date-time-fields";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  addMinutesToDateTime,
  filterTeachersForInstrument,
  findPrivateLessonConflictNotice,
  MAX_LESSON_MINUTES,
  LESSON_MINUTES_RANGE_MESSAGE,
  MIN_LESSON_MINUTES,
  parseLessonMinutes,
  type PrivateLesson,
} from "@/domain/private-lesson";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";
import type { PrivateLessonRegistrationTeacherOption, UpdatePrivateLessonEventInput } from "@/lib/api/private-lessons";
import { toSeoulDate, toSeoulHourMinute, toSeoulIsoOffset } from "@/features/lessons/workspace-helpers";

const EDIT_STEPS = ["날짜", "악기", "원생", "선생님", "시간"];

/**
 * 개인레슨 일정 수정. 등록 화면과 같은 순서(날짜·악기·원생·선생님·시간)와 칸(시작 시간·레슨 시간(분)·종료 시간)을 쓴다.
 * 원생·악기는 연결된 회차권 때문에 보여 주기만 하고, 같은 선생님의 다른 원생 레슨과 겹치면 등록처럼 막는다.
 */
export function PrivateLessonEditDialog({
  lesson, teachers, existingLessons = [], initialDate, closures = [], isSaving, onClose, onSave, onDelete,
}: {
  lesson: PrivateLesson;
  teachers: PrivateLessonRegistrationTeacherOption[];
  /** 시간 겹침 확인용 일정. 수정 중인 일정 자신은 빼고 비교한다. */
  existingLessons?: PrivateLesson[];
  initialDate?: string;
  closures?: AcademyClosure[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: UpdatePrivateLessonEventInput) => void;
  onDelete: () => void;
}) {
  const [date, setDate] = useState(initialDate ?? toSeoulDate(lesson.startAt));
  const [startTime, setStartTime] = useState(toSeoulHourMinute(lesson.startAt));
  const [teacherId, setTeacherId] = useState(lesson.teacherId);
  const [minutesText, setMinutesText] = useState(
    String(Math.round((Date.parse(lesson.endAt) - Date.parse(lesson.startAt)) / 60_000)),
  );
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const matchingClosures = getClosuresOnDate(closures, date);
  const lessonMinutes = parseLessonMinutes(minutesText);
  const minutesErrorId = useId();
  const startAt = date && startTime ? `${date}T${startTime}` : "";
  const endAt = startAt && lessonMinutes ? addMinutesToDateTime(startAt, lessonMinutes) : "";
  const teacherChoices = filterTeachersForInstrument(lesson.instrumentName, teachers, lesson.teacherId);
  const conflictNotice = startAt && endAt && teacherId
    ? findPrivateLessonConflictNotice(
        existingLessons.filter((candidate) => candidate.id !== lesson.id),
        {
          academyId: lesson.academyId,
          studentId: lesson.studentId,
          instrumentId: lesson.instrumentId,
          teacherId,
          startAt: toSeoulIsoOffset(startAt),
          endAt: toSeoulIsoOffset(endAt),
        },
      )
    : undefined;
  const canSave = Boolean(startAt && endAt && teacherId) && !conflictNotice && !isSaving &&
    (matchingClosures.length === 0 || closureConfirmed);

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>개인레슨 일정 수정</DialogTitle>
            <DialogDescription>{lesson.studentName} · {lesson.instrumentName} 예정 일정을 등록할 때와 같은 칸으로 바꿉니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <ol className="flex flex-wrap gap-1" aria-label="개인레슨 일정 수정 단계">
              {EDIT_STEPS.map((label) => <li key={label}><Badge variant="outline">{label}</Badge></li>)}
            </ol>
            <Label className="grid gap-1"><span>날짜</span><DateField aria-label="수정 날짜" value={date} onValueChange={(nextDate) => { setDate(nextDate); setClosureConfirmed(false); }} /></Label>
            {matchingClosures.length > 0 ? <div className="grid gap-2 rounded-md border border-warning bg-warning-soft p-2 text-sm text-warning-soft-foreground">
              <p>휴원일: {matchingClosures.map((closure) => closure.title).join(", ")}</p>
              <Label className="flex items-center gap-2"><Checkbox checked={closureConfirmed} onCheckedChange={(checked) => setClosureConfirmed(checked === true)} />휴원일 일정을 확인하고 이동</Label>
            </div> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Label className="grid gap-1"><span>악기</span><Input aria-label="악기" readOnly value={lesson.instrumentName} /></Label>
              <Label className="grid gap-1"><span>원생</span><Input aria-label="원생" readOnly value={lesson.studentName} /></Label>
            </div>
            <p className="text-xs text-muted-foreground">원생과 악기는 연결된 회차권 때문에 바꿀 수 없습니다.</p>
            <Label className="grid gap-1"><span>선생님</span>
              <NativeSelect aria-label="수정 선생님" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                {teacherChoices.teachers.map((teacher) => <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}{teacher.part ? ` / ${teacher.part}` : ""}
                </NativeSelectOption>)}
              </NativeSelect>
              {teacherChoices.isFallback ? <p className="text-xs text-muted-foreground">이 악기를 담당하는 선생님이 없어 전체 선생님을 보여 줍니다.</p> : null}
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label className="grid gap-1"><span>시작 시간</span><TimeField aria-label="수정 시작 시간" value={startTime} onValueChange={setStartTime} /></Label>
              <Label className="grid gap-1"><span>레슨 시간(분)</span>
                <Input aria-label="레슨 시간(분)" type="number" inputMode="numeric" min={MIN_LESSON_MINUTES} max={MAX_LESSON_MINUTES} step={5}
                  value={minutesText} aria-invalid={!lessonMinutes} aria-describedby={lessonMinutes ? undefined : minutesErrorId}
                  onChange={(event) => setMinutesText(event.target.value)} />
                {lessonMinutes ? null : <span id={minutesErrorId} className="text-xs text-destructive">{LESSON_MINUTES_RANGE_MESSAGE}</span>}
              </Label>
              <Label className="grid gap-1"><span>종료 시간</span><Input aria-label="종료 시간" readOnly value={endAt ? endAt.slice(11, 16) : ""} placeholder="자동 계산" /></Label>
            </div>
            {conflictNotice ? <p className="text-sm font-medium text-destructive" role="alert">{conflictNotice}</p> : null}
            <Label className="grid gap-1"><span>수정 사유 (선택)</span><Textarea aria-label="수정 사유" value={reason} onChange={(event) => setReason(event.target.value)} /></Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" disabled={isSaving} onClick={() => setDeleteOpen(true)}>일정 삭제</Button>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="button" disabled={!canSave} onClick={() => onSave({
              academyId: lesson.academyId, eventId: lesson.id, teacherId,
              startAt: toSeoulIsoOffset(startAt), endAt: toSeoulIsoOffset(endAt), reason,
            })}>수정 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>개인레슨 일정을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>시간표에서 숨기고 예약 회차를 돌려놓습니다. 변경 이력은 남습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>취소</AlertDialogCancel>
            <AlertDialogAction disabled={isSaving} onClick={(event) => { event.preventDefault(); onDelete(); }}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

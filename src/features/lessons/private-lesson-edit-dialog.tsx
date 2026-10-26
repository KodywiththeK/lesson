"use client";

import { useState } from "react";

import { DateField, TimeField } from "@/components/operations/date-time-fields";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { addMinutesToDateTime, type PrivateLesson } from "@/domain/private-lesson";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";
import type { PrivateLessonRegistrationTeacherOption, UpdatePrivateLessonEventInput } from "@/lib/api/private-lessons";
import { toSeoulDate, toSeoulHourMinute } from "@/features/lessons/workspace-helpers";

export function PrivateLessonEditDialog({
  lesson, teachers, initialDate, closures = [], isSaving, onClose, onSave, onDelete,
}: {
  lesson: PrivateLesson;
  teachers: PrivateLessonRegistrationTeacherOption[];
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
  const [reason, setReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const matchingClosures = getClosuresOnDate(closures, date);
  const durationMinutes = Math.round((Date.parse(lesson.endAt) - Date.parse(lesson.startAt)) / 60_000);
  const startAt = date && startTime ? `${date}T${startTime}` : "";
  const endAt = startAt && durationMinutes > 0 ? addMinutesToDateTime(startAt, durationMinutes) : "";
  const canSave = Boolean(startAt && endAt && teacherId) && !isSaving && (matchingClosures.length === 0 || closureConfirmed);

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>개인레슨 일정 수정</DialogTitle>
            <DialogDescription>{lesson.studentName} · {lesson.instrumentName} 예정 일정의 날짜·시간·선생님을 바꿉니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1"><span>날짜</span><DateField aria-label="수정 날짜" value={date} onValueChange={(nextDate) => { setDate(nextDate); setClosureConfirmed(false); }} /></Label>
            {matchingClosures.length > 0 ? <div className="rounded-md border border-amber-500 p-2 text-sm">
              <p>휴원일: {matchingClosures.map((closure) => closure.title).join(", ")}</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={closureConfirmed} onChange={(event) => setClosureConfirmed(event.target.checked)} />휴원일 일정을 확인하고 이동</label>
            </div> : null}
            <Label className="grid gap-1"><span>시작 시간</span><TimeField aria-label="수정 시작 시간" value={startTime} onValueChange={setStartTime} /></Label>
            <p className="text-sm text-muted-foreground">수업 길이 {durationMinutes}분 · 종료 {endAt ? endAt.slice(11, 16) : "-"}</p>
            <Label className="grid gap-1"><span>선생님</span>
              <NativeSelect aria-label="수정 선생님" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
                {teachers.map((teacher) => <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>{teacher.teacherName}</NativeSelectOption>)}
              </NativeSelect>
            </Label>
            <Label className="grid gap-1"><span>수정 사유 (선택)</span><Textarea aria-label="수정 사유" value={reason} onChange={(event) => setReason(event.target.value)} /></Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="destructive" disabled={isSaving} onClick={() => setDeleteOpen(true)}>일정 삭제</Button>
            <Button type="button" variant="outline" onClick={onClose}>취소</Button>
            <Button type="button" disabled={!canSave} onClick={() => onSave({
              academyId: lesson.academyId, eventId: lesson.id, teacherId,
              startAt: `${startAt}:00+09:00`, endAt: `${endAt}:00+09:00`, reason,
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

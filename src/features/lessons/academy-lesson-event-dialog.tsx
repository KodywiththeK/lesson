"use client";

import { useState } from "react";
import { getClosuresOnDate, type AcademyClosure } from "@/domain/academy-closure";

import { DateTimeField } from "@/components/operations/date-time-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PrivateLessonRegistrationOptions } from "@/lib/api/private-lessons";
import { type CreateAcademyLessonEventInput } from "@/lib/api/lesson-workspace";
import { toSeoulIsoOffset } from "@/features/lessons/workspace-helpers";

export function AcademyLessonEventDialog({
  open,
  academyId,
  selectedDate,
  options,
  closures = [],
  onOpenChange,
  onSave,
}: {
  open: boolean;
  academyId: string;
  selectedDate: string;
  options: PrivateLessonRegistrationOptions;
  closures?: AcademyClosure[];
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateAcademyLessonEventInput) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [origin, setOrigin] = useState<"manual" | "special">("manual");
  const [startAt, setStartAt] = useState(`${selectedDate}T15:00`);
  const [endAt, setEndAt] = useState(`${selectedDate}T15:50`);
  const [reason, setReason] = useState("");
  const [closureConfirmed, setClosureConfirmed] = useState(false);
  const matchingClosures = getClosuresOnDate(closures, startAt.slice(0, 10));
  const selectedStudent = options.students.find(
    (student) => student.studentId === studentId,
  );
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const selectedTeacher = options.teachers.find(
    (teacher) => teacher.teacherId === teacherId,
  );
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    Boolean(selectedTeacher) &&
    Boolean(startAt) &&
    Boolean(endAt) &&
    reason.trim().length > 0 &&
    (matchingClosures.length === 0 || closureConfirmed);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setStartAt(`${selectedDate}T15:00`);
          setEndAt(`${selectedDate}T15:50`);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학원 일정 추가</DialogTitle>
          <DialogDescription>
            정기 일정과 별도로 캘린더에 표시할 학원 레슨을 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();

            if (!selectedStudent || !selectedInstrument || !selectedTeacher) {
              return;
            }

            onSave({
              academyId,
              studentId: selectedStudent.studentId,
              studentName: selectedStudent.studentName,
              studentInstrumentId: selectedInstrument.studentInstrumentId,
              instrumentId: selectedInstrument.instrumentId,
              instrumentName: selectedInstrument.instrumentName,
              teacherId: selectedTeacher.teacherId,
              teacherName: selectedTeacher.teacherName,
              startAt: toSeoulIsoOffset(startAt),
              endAt: toSeoulIsoOffset(endAt),
              origin,
              reason,
            });
          }}
        >
          <Label className="grid gap-1">
            <span>원생</span>
            <NativeSelect
              aria-label="원생"
              value={studentId}
              onChange={(event) => {
                const nextStudentId = event.target.value;
                const nextStudent = options.students.find(
                  (student) => student.studentId === nextStudentId,
                );

                setStudentId(nextStudentId);
                setInstrumentId(nextStudent?.instruments[0]?.instrumentId ?? "");
              }}
            >
              <NativeSelectOption value="">원생 선택</NativeSelectOption>
              {options.students.map((student) => (
                <NativeSelectOption key={student.studentId} value={student.studentId}>
                  {student.studentName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>악기</span>
            <NativeSelect
              aria-label="악기"
              value={instrumentId}
              disabled={!selectedStudent}
              onChange={(event) => setInstrumentId(event.target.value)}
            >
              <NativeSelectOption value="">악기 선택</NativeSelectOption>
              {(selectedStudent?.instruments ?? []).map((instrument) => (
                <NativeSelectOption
                  key={instrument.instrumentId}
                  value={instrument.instrumentId}
                >
                  {instrument.instrumentName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>선생님</span>
            <NativeSelect
              aria-label="선생님"
              value={teacherId}
              disabled={!selectedInstrument}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <NativeSelectOption value="">선생님 선택</NativeSelectOption>
              {options.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}
                  {teacher.part ? ` / ${teacher.part}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>일정 유형</span>
            <NativeSelect
              aria-label="일정 유형"
              value={origin}
              onChange={(event) =>
                setOrigin(event.target.value === "special" ? "special" : "manual")
              }
            >
              <NativeSelectOption value="manual">비정기</NativeSelectOption>
              <NativeSelectOption value="special">특강</NativeSelectOption>
            </NativeSelect>
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="grid gap-1">
              <span>시작 시간</span>
              <DateTimeField
                aria-label="시작 시간"
                value={startAt}
                onValueChange={(value) => { setStartAt(value); setClosureConfirmed(false); }}
              />
            </Label>
            <Label className="grid gap-1">
              <span>종료 시간</span>
              <DateTimeField
                aria-label="종료 시간"
                value={endAt}
                onValueChange={setEndAt}
              />
            </Label>
          </div>
          {matchingClosures.length > 0 ? <div className="rounded-md border border-amber-500 p-2 text-sm">
            <p>휴원일: {matchingClosures.map((closure) => closure.title).join(", ")}</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={closureConfirmed} onChange={(event) => setClosureConfirmed(event.target.checked)} />휴원일 일정을 확인하고 등록</label>
          </div> : null}
          <Label className="grid gap-1">
            <span>추가 사유</span>
            <Textarea
              aria-label="추가 사유"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Clipboard, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import type { PrivateLesson } from "@/domain/private-lesson";
import { formatTeacherMonthScheduleMessage } from "@/domain/teacher-schedule-message";
import type { PrivateLessonRegistrationOptions } from "@/lib/api/private-lessons";

export function ScheduleDialog({
  open,
  lessons,
  registrationOptions,
  selectedDate,
  onOpenChange,
}: {
  open: boolean;
  lessons: PrivateLesson[];
  registrationOptions: PrivateLessonRegistrationOptions;
  selectedDate: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const monthPrefix = selectedDate.slice(0, 7);
  const scheduleText = teacherId
    ? formatTeacherMonthScheduleMessage({ lessons, teacherId, month: monthPrefix })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>선생님별 레슨시간표</DialogTitle>
          <DialogDescription>{monthPrefix}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1 text-sm font-medium">
            <span>선생님</span>
            <NativeSelect
              aria-label="선생님 선택"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <NativeSelectOption value="">선생님을 선택하세요</NativeSelectOption>
              {registrationOptions.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          {teacherId ? (
            <Label className="grid gap-1 text-sm font-medium">
              <span>시간표 내용</span>
              <Textarea
                aria-label="시간표 내용"
                className="min-h-40 font-mono text-sm"
                readOnly
                value={scheduleText}
              />
            </Label>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              선생님을 선택하면 해당 월의 레슨 일정이 표시됩니다.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="success"
            disabled={!teacherId}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(scheduleText);
                toast.success("시간표를 복사했습니다. 메시지에 붙여넣어 보내세요.");
              } catch {
                toast.error("시간표를 복사하지 못했습니다.", {
                  description: "시간표 내용을 직접 선택해 복사해 주세요.",
                });
              }
            }}
          >
            <Clipboard aria-hidden="true" />
            복사
          </Button>
          <Button type="button" variant="secondary" onClick={() => setTeacherId("")}>
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

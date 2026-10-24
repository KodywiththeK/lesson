import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  changeLessonFeeLessonType,
  updateLessonFeeWeekdayCount,
} from "@/domain/lesson-fee-draft";
import { calculateLessonEndTime } from "@/domain/student-registration";
import type { StudentListInstrument } from "@/domain/student-list";
import type { TeacherListRow } from "@/domain/teacher-list";
import { cn } from "@/lib/utils";

import type { LessonTypeChoice } from "./student-enrollment-edit-state";
import {
  getEditTeacherChoices,
  getInstrumentScheduleError,
  type InstrumentEditDraft,
} from "./student-instrument-edit";
import { StudentInstrumentEndButton } from "./student-instrument-end-button";
import { StudentLessonFeeFields } from "./student-lesson-fee-fields";
import { STUDENT_LESSON_TYPE_LABELS } from "./student-registration-instrument";
import { WeeklyScheduleFields } from "./student-weekly-schedule-fields";

const SUNDAY = "sunday";

const INSTRUMENT_CHANGE_GUIDE = "다른 악기로 바꾸려면 이 악기를 종료하고 새 악기를 추가해 주세요.";

/**
 * 기존 악기 하나의 담당 선생님·수업 형태·요일별 시간·진도·레슨비·할인 입력과 [수강 종료].
 * 악기 칸은 읽기 전용이다. 악기가 여러 개일 때(`label`을 넘김)는 제목과 접근 가능한 이름에 악기를 붙여 섹션끼리 구분한다.
 */
export function StudentInstrumentEditSection({
  instrument,
  label,
  teachers,
  draft,
  lessonTypeChoices,
  referenceMonth,
  canEnd,
  onChange,
  onEnd,
}: {
  instrument: StudentListInstrument;
  /** 악기가 여러 개일 때만 넘긴다. 없으면 제목 없이 이름 접두사도 붙이지 않는다. */
  label?: string;
  teachers: TeacherListRow[];
  draft: InstrumentEditDraft;
  /** 고를 수 있는 수업 형태. 막힌 형태는 `disabledReason`을 함께 받아 안내한다. */
  lessonTypeChoices: LessonTypeChoice[];
  referenceMonth: string;
  /** 종료 예정으로 바꿀 수 있는지. 남는 활성 악기가 1개뿐이면 false다. */
  canEnd: boolean;
  onChange: (draft: InstrumentEditDraft) => void;
  onEnd: () => void;
}) {
  const guideId = useId();
  const lessonTypeGuideId = useId();
  const labelPrefix = label ? `${label} ` : "";
  // 이전 데이터에 일요일이 저장되어 있으면 수정 중에도 일요일 선택지를 유지한다.
  const [legacyWeekdays] = useState(() =>
    draft.schedules.some((schedule) => schedule.weekday === SUNDAY) ? [SUNDAY] : [],
  );
  const teacherChoices = getEditTeacherChoices(instrument, teachers);
  const blockedChoices = lessonTypeChoices.filter((choice) => choice.disabledReason);
  const scheduleError = getInstrumentScheduleError(draft);
  const feeContext = (lessonType: InstrumentEditDraft["lessonType"], weekdayCount: number) => ({
    instrumentName: instrument.instrumentName,
    lessonType,
    weekdayCount,
  });

  return (
    <section
      className={cn("grid gap-4", label && "rounded-md border border-border bg-background p-4")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label ? <h3 className="text-base font-semibold">[{label}] 수업 정보</h3> : <span />}
        {instrument.active ? (
          <StudentInstrumentEndButton
            instrumentName={instrument.instrumentName}
            labelPrefix={labelPrefix}
            canEnd={canEnd}
            onConfirm={onEnd}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>담당 선생님</span>
          <NativeSelect
            aria-label={`${labelPrefix}담당 선생님`}
            value={draft.teacherId}
            onChange={(event) => onChange({ ...draft, teacherId: event.target.value })}
          >
            <NativeSelectOption value="">미배정</NativeSelectOption>
            {teacherChoices.options.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {teacherChoices.isFallback ? (
            <span className="text-xs text-muted-foreground">
              {instrument.instrumentName} 파트 선생님이 없어 전체 선생님을 보여 줍니다.
            </span>
          ) : null}
        </Label>
        <div className="grid gap-1">
          <Label className="grid gap-1">
            <span>악기</span>
            <Input
              aria-label={`${labelPrefix}악기`}
              aria-describedby={guideId}
              readOnly
              value={instrument.instrumentName || "등록된 악기 없음"}
            />
          </Label>
          <p id={guideId} className="text-xs text-muted-foreground">
            {INSTRUMENT_CHANGE_GUIDE}
          </p>
        </div>
      </div>

      <div className="grid gap-1 sm:max-w-xs">
        <Label className="grid gap-1">
          <span>수업 형태</span>
          <NativeSelect
            aria-label={`${labelPrefix}수업 형태`}
            aria-describedby={blockedChoices.length > 0 ? lessonTypeGuideId : undefined}
            value={draft.lessonType}
            onChange={(event) => {
              const lessonType = event.target.value as InstrumentEditDraft["lessonType"];

              onChange({
                ...draft,
                lessonType,
                fee: changeLessonFeeLessonType(
                  draft.fee,
                  feeContext(lessonType, draft.schedules.length),
                ),
              });
            }}
          >
            {lessonTypeChoices.map(({ lessonType, disabledReason }) => (
              <NativeSelectOption key={lessonType} value={lessonType} disabled={Boolean(disabledReason)}>
                {STUDENT_LESSON_TYPE_LABELS[lessonType]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        {blockedChoices.length > 0 ? (
          <p id={lessonTypeGuideId} className="text-xs text-muted-foreground">
            {blockedChoices.map((choice) => choice.disabledReason).join(" ")}
          </p>
        ) : null}
      </div>

      <WeeklyScheduleFields
        legend={`${labelPrefix}정기 요일`}
        labelPrefix={labelPrefix}
        schedules={draft.schedules}
        legacyWeekdays={legacyWeekdays}
        lessonType={draft.lessonType}
        lessonDurationMinutes={draft.fee.minutes}
        onChange={(schedules) =>
          onChange({
            ...draft,
            schedules,
            fee: updateLessonFeeWeekdayCount(
              draft.fee,
              feeContext(draft.lessonType, schedules.length),
              draft.schedules.length,
            ),
          })
        }
      />
      {scheduleError ? (
        <p className="text-sm text-destructive">
          {label ? `${label}: ${scheduleError}` : scheduleError}
        </p>
      ) : null}

      <StudentLessonFeeFields
        labelPrefix={labelPrefix}
        context={feeContext(draft.lessonType, draft.schedules.length)}
        referenceMonth={referenceMonth}
        draft={draft.fee}
        onChange={(fee) => onChange({
          ...draft,
          fee,
          schedules: draft.lessonType === "private"
            ? draft.schedules.map((schedule) => ({
                ...schedule,
                endTime: calculateLessonEndTime(schedule.startTime, fee.minutes || undefined),
              }))
            : draft.schedules,
        })}
      />
    </section>
  );
}

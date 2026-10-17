import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { changeLessonFeeLessonType, repriceLessonFee } from "@/domain/lesson-fee-draft";
import type { TeacherListRow } from "@/domain/teacher-list";

import { getDefaultTeacherId, getTeacherCandidates } from "./student-form-options";
import { StudentLessonFeeFields } from "./student-lesson-fee-fields";
import {
  getInstrumentLessonTypes,
  STUDENT_LESSON_TYPE_LABELS,
  type StudentLessonType,
  type StudentRegistrationInstrumentDraft,
} from "./student-registration-instrument";
import { WeeklyScheduleFields } from "./student-weekly-schedule-fields";

/**
 * 악기 하나의 담당 선생님·레슨 형태·요일별 시간·진도·레슨비·할인 입력 카드. 원생 등록과 수정 화면의 악기 추가가 함께 쓴다.
 * `label`은 한 화면에 카드가 여러 개일 때 제목과 접근 가능한 이름을 구분한다(기본은 악기 이름).
 * `lessonTypes`로 고를 수 있는 레슨 형태를 좁힐 수 있고, 하나뿐이면 고르지 못한다.
 * `children`은 레슨 형태 아래에 놓는 추가 입력(예: 수강 시작일)이다.
 */
export function StudentRegistrationInstrumentCard({
  draft,
  label = draft.instrumentName,
  lessonTypes = getInstrumentLessonTypes(draft.instrumentName),
  teachers,
  referenceMonth,
  headerAction,
  children,
  onChange,
}: {
  draft: StudentRegistrationInstrumentDraft;
  label?: string;
  lessonTypes?: StudentLessonType[];
  teachers: TeacherListRow[];
  referenceMonth: string;
  headerAction?: ReactNode;
  children?: ReactNode;
  onChange: (draft: StudentRegistrationInstrumentDraft) => void;
}) {
  const teacherCandidates = getTeacherCandidates(draft.instrumentName, teachers);
  const effectiveTeacherId =
    draft.teacherId || getDefaultTeacherId(draft.instrumentName, teachers);
  const feeContext = (lessonType: StudentLessonType, weekdayCount: number) => ({
    instrumentName: draft.instrumentName,
    lessonType,
    weekdayCount,
  });

  return (
    <section className="grid gap-4 rounded-md border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">[{label}] 상세 설정</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {describeLessonTypes(lessonTypes)}
          </span>
          {headerAction}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>담당 선생님</span>
          <NativeSelect
            aria-label={`${label} 담당 선생님`}
            value={effectiveTeacherId}
            onChange={(event) => onChange({ ...draft, teacherId: event.target.value })}
          >
            <NativeSelectOption value="">미배정</NativeSelectOption>
            {teacherCandidates.map((teacher) => (
              <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.name} ({teacher.part})
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
        <Label className="grid gap-1">
          <span>레슨 형태</span>
          <NativeSelect
            aria-label={`${label} 레슨 형태`}
            value={draft.lessonType}
            disabled={lessonTypes.length < 2}
            onChange={(event) => {
              const lessonType = event.target.value as StudentLessonType;

              onChange({
                ...draft,
                lessonType,
                fee: changeLessonFeeLessonType(
                  draft.fee,
                  feeContext(lessonType, draft.weeklySchedules.length),
                ),
              });
            }}
          >
            {lessonTypes.map((lessonType) => (
              <NativeSelectOption key={lessonType} value={lessonType}>
                {STUDENT_LESSON_TYPE_LABELS[lessonType]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Label>
      </div>

      {children}

      <WeeklyScheduleFields
        legend="수강 요일"
        labelPrefix={`${label} `}
        schedules={draft.weeklySchedules}
        onChange={(weeklySchedules) =>
          onChange({
            ...draft,
            weeklySchedules,
            fee: repriceLessonFee(draft.fee, feeContext(draft.lessonType, weeklySchedules.length)),
          })
        }
      />

      <StudentLessonFeeFields
        labelPrefix={`${label} `}
        context={feeContext(draft.lessonType, draft.weeklySchedules.length)}
        referenceMonth={referenceMonth}
        draft={draft.fee}
        onChange={(fee) => onChange({ ...draft, fee })}
      />
    </section>
  );
}

function describeLessonTypes(lessonTypes: StudentLessonType[]) {
  return lessonTypes.length > 1
    ? lessonTypes.map((lessonType) => STUDENT_LESSON_TYPE_LABELS[lessonType]).join("/") + " 선택 가능"
    : `${STUDENT_LESSON_TYPE_LABELS[lessonTypes[0]]} 전용`;
}

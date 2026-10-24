import {
  createLessonFeeDraft,
  getLessonFeeSubmission,
  isReferralMonthMissing,
  type LessonFeeDraft,
} from "@/domain/lesson-fee-draft";
import { getLessonScheduleValidationError } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";

import { getDefaultTeacherId, instrumentOptions } from "./student-form-options";

export type StudentLessonType = "academy" | "private";

export type InstrumentOption = (typeof instrumentOptions)[number];

/** 원생 등록과 수정 화면의 악기 추가가 함께 쓰는, 악기 하나의 입력 상태. */
export type StudentRegistrationInstrumentDraft = {
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  lessonType: StudentLessonType;
  weeklySchedules: Array<{
    weekday: string;
    startTime?: string;
    endTime?: string;
  }>;
  fee: LessonFeeDraft;
};

const PIANO = "피아노";

export const STUDENT_LESSON_TYPE_LABELS: Record<StudentLessonType, string> = {
  academy: "학원레슨",
  private: "개인레슨",
};

/** 악기가 지원하는 수업 형태. 피아노만 학원레슨을 함께 쓰고 나머지는 개인레슨 전용이다. */
export function getInstrumentLessonTypes(instrumentName: string): StudentLessonType[] {
  return instrumentName === PIANO ? ["academy", "private"] : ["private"];
}

export function createRegistrationInstrumentDraft(
  instrument: InstrumentOption,
  teachers: TeacherListRow[],
  lessonType: StudentLessonType = getInstrumentLessonTypes(instrument.name)[0],
): StudentRegistrationInstrumentDraft {
  return {
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    teacherId: getDefaultTeacherId(instrument.name, teachers),
    lessonType,
    weeklySchedules: [],
    fee: createLessonFeeDraft({ instrumentName: instrument.name, lessonType, weekdayCount: 0 }),
  };
}

/** 담당 선생님을 고르지 않았으면 악기 파트의 유일한 선생님으로 정한다. */
function getEffectiveTeacherId(draft: StudentRegistrationInstrumentDraft, teachers: TeacherListRow[]) {
  return draft.teacherId || getDefaultTeacherId(draft.instrumentName, teachers);
}

export function isRegistrationInstrumentReady(
  draft: StudentRegistrationInstrumentDraft,
  teachers: TeacherListRow[],
  referenceMonth: string,
) {
  return (
    draft.weeklySchedules.length > 0 &&
    (draft.lessonType !== "private" || draft.fee.sessionsPerMonth > 0) &&
    draft.fee.lessonFee > 0 &&
    !isReferralMonthMissing(draft.fee, referenceMonth) &&
    !getLessonScheduleValidationError({
      lessonType: draft.lessonType,
      teacherId: getEffectiveTeacherId(draft, teachers),
      sessionsPerMonth: draft.fee.sessionsPerMonth,
      lessonDurationMinutes: draft.fee.minutes || undefined,
      weeklySchedules: draft.weeklySchedules,
    })
  );
}

/** 입력 상태를 저장 값으로 바꾼다. 진도를 비우면 "신규 등록"으로 저장한다. */
export function buildRegistrationInstrument(
  draft: StudentRegistrationInstrumentDraft,
  teachers: TeacherListRow[],
  referenceMonth: string,
) {
  const teacherId = getEffectiveTeacherId(draft, teachers);
  const teacher = teachers.find((option) => option.teacherId === teacherId);

  return {
    instrumentId: draft.instrumentId,
    instrumentName: draft.instrumentName,
    teacherId,
    teacherName: teacher?.name ?? "",
    lessonType: draft.lessonType,
    ...(draft.lessonType === "private"
      ? {
          sessionsPerMonth: draft.fee.sessionsPerMonth || undefined,
          lessonDurationMinutes: draft.fee.minutes || undefined,
        }
      : {}),
    weeklySchedules: draft.weeklySchedules,
    progress: draft.fee.progress.trim() || "신규 등록",
    ...getLessonFeeSubmission(draft.fee, referenceMonth),
  };
}

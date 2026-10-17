import {
  createLessonFeeDraftFromInstrument,
  getLessonFeeSubmission,
  type LessonFeeDraft,
} from "@/domain/lesson-fee-draft";
import type { StudentListInstrument, StudentListRow } from "@/domain/student-list";
import type { StudentEnrollmentFields } from "@/domain/student-enrollment-edit";
import { getAcademyScheduleValidationError } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";

import {
  getTeacherCandidates,
  toWeekdayLabel,
  toWeekdayValue,
  weekdayOptions,
} from "./student-form-options";
import { STUDENT_LESSON_TYPE_LABELS } from "./student-registration-instrument";
import type { WeeklyScheduleDraft } from "./student-weekly-schedule-fields";

/** 수정 폼에서 악기 하나가 들고 있는 입력 상태. */
export type InstrumentEditDraft = {
  teacherId: string;
  lessonType: "academy" | "private";
  schedules: WeeklyScheduleDraft[];
  fee: LessonFeeDraft;
};

/** 기존 수강 하나를 고치는 저장 값. 악기(`instrumentId`)는 읽기 전용이라 그대로 보낸다. */
export type InstrumentUpdateFields = StudentEnrollmentFields & { studentInstrumentId: string };

/** 수정할 악기. 활성 악기를 모두 보여 주고, 활성 악기가 없으면 첫 악기를 대신 보여 준다. */
export function getEditableInstruments(student: StudentListRow): StudentListInstrument[] {
  const instruments = student.instruments ?? [];
  const activeInstruments = instruments.filter((instrument) => instrument.active);

  return activeInstruments.length > 0 ? activeInstruments : instruments.slice(0, 1);
}

/**
 * 폼 제목과 접근 가능한 이름에 쓰는 악기 구분 이름. 같은 악기를 학원·개인으로 함께 수강하면
 * 이름이 겹치므로 수업 형태를 덧붙인다.
 */
export function getInstrumentSectionLabels(instruments: StudentListInstrument[]): string[] {
  return instruments.map((instrument) => {
    const hasSameName =
      instruments.filter((other) => other.instrumentName === instrument.instrumentName).length > 1;

    return hasSameName
      ? `${instrument.instrumentName}(${formatLessonTypeLabel(instrument.lessonType)})`
      : instrument.instrumentName;
  });
}

export function createInstrumentEditDraft(
  student: StudentListRow,
  instrument: StudentListInstrument,
): InstrumentEditDraft {
  return {
    teacherId: instrument.teacherId ?? "",
    lessonType: instrument.lessonType === "private" ? "private" : "academy",
    schedules: toInitialSchedules(student, instrument),
    fee: createLessonFeeDraftFromInstrument(instrument),
  };
}

export function getInstrumentScheduleError(draft: InstrumentEditDraft) {
  return getAcademyScheduleValidationError({
    lessonType: draft.lessonType,
    teacherId: draft.teacherId,
    weeklySchedules: draft.schedules,
  });
}

export function buildInstrumentUpdate({
  instrument,
  draft,
  teachers,
  referenceMonth,
}: {
  instrument: StudentListInstrument;
  draft: InstrumentEditDraft;
  teachers: TeacherListRow[];
  referenceMonth: string;
}): InstrumentUpdateFields {
  const { options } = getEditTeacherChoices(instrument, teachers);
  const selectedTeacher = options.find((teacher) => teacher.teacherId === draft.teacherId);

  return {
    studentInstrumentId: instrument.studentInstrumentId,
    teacherId: selectedTeacher?.teacherId,
    teacherName: selectedTeacher?.name,
    instrumentId: (instrument.instrumentId || toInstrumentId(instrument.instrumentName)).trim(),
    instrumentName: instrument.instrumentName.trim(),
    lessonType: draft.lessonType,
    weeklySchedules: toWeeklyScheduleChanges(draft.schedules),
    progress: draft.fee.progress,
    ...getLessonFeeSubmission(draft.fee, referenceMonth),
  };
}

/** 폼의 요일별 시간을 저장 값으로 바꾼다. 요일은 월~일 순서로 정렬하고 이름으로 보낸다. */
export function toWeeklyScheduleChanges(schedules: WeeklyScheduleDraft[]) {
  return sortWeeklySchedules(schedules).map((schedule) => ({
    weekdayLabel: toWeekdayLabel(schedule.weekday),
    startTime: schedule.startTime || undefined,
    endTime: schedule.endTime || undefined,
  }));
}

/**
 * 수정 폼의 담당 선생님 후보. 악기 파트와 같은 선생님을 보여 주고(없으면 전체),
 * 이미 담당 중인 선생님이 휴직·퇴사로 목록에 없어도 선택지로 남겨 조용히 바뀌지 않게 한다.
 */
export function getEditTeacherChoices(
  instrument: Pick<StudentListInstrument, "instrumentName" | "teacherId" | "teacherName">,
  teachers: TeacherListRow[],
) {
  const partTeachers = getTeacherCandidates(instrument.instrumentName, teachers);
  const isFallback = partTeachers.length === 0 && teachers.length > 0;
  const options = isFallback ? [...teachers] : [...partTeachers];
  const currentTeacherId = instrument.teacherId ?? undefined;

  if (currentTeacherId && !options.some((teacher) => teacher.teacherId === currentTeacherId)) {
    const currentTeacher = teachers.find((teacher) => teacher.teacherId === currentTeacherId);

    options.push(
      currentTeacher ??
        ({
          teacherId: currentTeacherId,
          name: instrument.teacherName || "기존 담당 선생님",
        } as TeacherListRow),
    );
  }

  return { options, isFallback };
}

/** 저장된 요일별 시간을 폼 상태로 바꾼다. 요일별 행이 없는 이전 데이터는 대표 시간을 모든 요일에 쓴다. */
function toInitialSchedules(
  student: StudentListRow,
  instrument: StudentListInstrument,
): WeeklyScheduleDraft[] {
  const storedSchedules = instrument.weeklySchedules ?? [];

  if (storedSchedules.length > 0) {
    return storedSchedules.map((schedule) => ({
      weekday: toWeekdayValue(schedule.weekdayLabel || schedule.weekday),
      startTime: schedule.startTime || undefined,
      endTime: schedule.endTime || undefined,
    }));
  }

  const labels = instrument.weekdayLabels?.length ? instrument.weekdayLabels : student.weekdayLabels;

  return labels.map((label) => ({
    weekday: toWeekdayValue(label),
    startTime: instrument.startTime || undefined,
    endTime: instrument.endTime || undefined,
  }));
}

function sortWeeklySchedules(schedules: WeeklyScheduleDraft[]) {
  const order = (weekday: string) => weekdayOptions.findIndex((option) => option.value === weekday);

  return [...schedules].sort((left, right) => order(left.weekday) - order(right.weekday));
}

function formatLessonTypeLabel(lessonType: string) {
  return STUDENT_LESSON_TYPE_LABELS[lessonType === "private" ? "private" : "academy"];
}

function toInstrumentId(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, "-");
}

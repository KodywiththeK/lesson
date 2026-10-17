import { getFinanceToday } from "@/domain/finance-date";
import type { StudentEnrollment } from "@/domain/student-registration";
import {
  applyStudentEnrollmentSave,
  findActiveEnrollmentConflict,
  getStudentEnrollmentValidationError,
  LAST_INSTRUMENT_END_MESSAGE,
  type StudentEnrollmentChange,
  type StudentEnrollmentFields,
  type StudentEnrollmentSaveResult,
  type UpdateStudentEnrollmentsInput,
} from "@/domain/student-enrollment-edit";
import type { StudentListInstrument } from "@/domain/student-list";

import {
  buildAcademySheets,
  mergeSheets,
  toWeekdayValue,
  type DemoAcademyState,
} from "./academy-demo-state";

/**
 * 원생 수정(이름·기본 정보·악기 수정/추가/종료) 데모 상태 전이.
 * 서버 RPC(`supabase/migrations/20261020090000_student_enrollment_edit.sql`의 `update_student_with_enrollments`)와
 * 같은 순서(종료 → 수정 → 추가)와 같은 한국어 문구로 검사한다. 규칙에 어긋나면 던지고, 던지기 전에는 상태를 바꾸지 않는다.
 * 데모는 종료한 수강의 이력을 남기지 않고 목록에서 뺀다.
 */
export function updateDemoStudentEnrollments(
  state: DemoAcademyState,
  input: UpdateStudentEnrollmentsInput,
): { state: DemoAcademyState; result: StudentEnrollmentSaveResult } {
  const validationError = getStudentEnrollmentValidationError(input);

  if (validationError) {
    throw new Error(validationError);
  }

  const student = state.students.find((candidate) => candidate.studentId === input.studentId);

  if (!student) {
    throw new Error("원생을 찾지 못했습니다. 목록을 새로고침해 주세요.");
  }

  const today = getFinanceToday();
  const before = student.instruments ?? [];
  const { endedInstruments, result } = planChanges(state, input, before, today);
  const nextStudent = {
    ...applyStudentEnrollmentSave(student, input, result),
    status: student.status,
  };

  if (before.length > 0 && (nextStudent.instruments ?? []).length < 1) {
    throw new Error(LAST_INSTRUMENT_END_MESSAGE);
  }

  const addedChanges = input.changes.filter(
    (change): change is Extract<StudentEnrollmentChange, { action: "add" }> => change.action === "add",
  );
  const enrollments = nextEnrollments(state, input, before, endedInstruments, result);
  const sheetNames = (rows: DemoAcademyState["academySheets"][string]["rows"]) =>
    rows.map((row) => (row.studentId === input.studentId ? { ...row, studentName: input.name.trim() } : row));
  const endedAcademy = endedInstruments.filter((instrument) => instrument.lessonType === "academy");
  const regenerated = addedChanges
    .filter((change) => change.lessonType === "academy")
    .reduce(
      (sheets, change) => ({
        ...sheets,
        ...dropRowsBefore(
          buildAcademySheets(enrollments, state.academyId, change.startedOn.slice(0, 7)),
          input.studentId,
          change.instrumentId,
          change.startedOn,
        ),
      }),
      {} as DemoAcademyState["academySheets"],
    );
  const academySheets = Object.fromEntries(
    Object.entries(mergeSheets(state.academySheets, regenerated)).map(([date, sheet]) => [
      date,
      {
        ...sheet,
        rows: sheetNames(sheet.rows).filter(
          (row) =>
            !(
              date >= today &&
              row.studentId === input.studentId &&
              endedAcademy.some((instrument) => instrument.instrumentId === row.instrumentId)
            ),
        ),
      },
    ]),
  );

  return {
    result,
    state: {
      ...state,
      students: state.students.map((candidate) => (candidate.studentId === input.studentId ? nextStudent : candidate)),
      enrollments,
      tickets: state.tickets.map((ticket) =>
        ticket.studentId === input.studentId ? { ...ticket, studentName: input.name.trim() } : ticket,
      ),
      privateLessons: state.privateLessons.map((lesson) =>
        lesson.studentId === input.studentId ? { ...lesson, studentName: input.name.trim() } : lesson,
      ),
      academySheets,
    },
  };
}

/** 종료 → 수정 → 추가 순서로 규칙을 검사하고, 저장 결과(추가·종료한 수강 id)를 만든다. */
function planChanges(
  state: DemoAcademyState,
  input: UpdateStudentEnrollmentsInput,
  before: StudentListInstrument[],
  today: string,
) {
  let instruments = before;
  const endedInstruments: StudentListInstrument[] = [];
  const ended: StudentEnrollmentSaveResult["ended"] = [];
  const addedStudentInstrumentIds: string[] = [];

  for (const change of input.changes) {
    if (change.action !== "end") {
      continue;
    }

    const target = instruments.find((instrument) => instrument.studentInstrumentId === change.studentInstrumentId);

    if (!target) {
      throw new Error("종료할 수강 정보를 찾지 못했습니다.");
    }

    instruments = instruments.filter((instrument) => instrument !== target);
    endedInstruments.push(target);
    ended.push({
      studentInstrumentId: target.studentInstrumentId,
      remainingEventCount: countRemainingPrivateLessons(state, input.studentId, target, today),
    });
  }

  for (const change of input.changes) {
    if (change.action !== "update") {
      continue;
    }

    const target = instruments.find((instrument) => instrument.studentInstrumentId === change.studentInstrumentId);

    if (!target) {
      throw new Error("수정할 원생 수강 정보를 찾지 못했습니다.");
    }

    if (target.instrumentId !== change.instrumentId) {
      throw new Error("악기는 바꿀 수 없습니다. 기존 악기를 종료하고 새 악기를 추가해 주세요.");
    }

    if (
      target.lessonType !== change.lessonType &&
      findActiveEnrollmentConflict(
        instruments.filter((instrument) => instrument !== target),
        change,
      )
    ) {
      throw new Error("같은 악기·수업 형태의 수강 정보가 이미 있어 수업 형태를 바꿀 수 없습니다.");
    }

    // 뒤에 오는 수정과 추가는 바뀐 수업 형태를 기준으로 충돌을 검사한다(서버는 수정을 모두 적용한 뒤 추가한다).
    instruments = instruments.map((instrument) =>
      instrument === target ? { ...instrument, lessonType: change.lessonType } : instrument,
    );
  }

  for (const change of input.changes) {
    if (change.action !== "add") {
      continue;
    }

    if (findActiveEnrollmentConflict(instruments, change)) {
      throw new Error("이미 수강 중인 악기와 수업 형태입니다.");
    }

    // 서버처럼 항상 새 수강 행을 만든다. 같은 저장에서 종료한 수강과 id가 겹치지 않게 순번을 붙인다.
    const baseId = `${input.studentId}:${change.instrumentId}:${change.lessonType}`;
    const takenIds = [...before.map((instrument) => instrument.studentInstrumentId), ...addedStudentInstrumentIds];
    let studentInstrumentId = baseId;

    for (let sequence = 2; takenIds.includes(studentInstrumentId); sequence += 1) {
      studentInstrumentId = `${baseId}:${sequence}`;
    }

    addedStudentInstrumentIds.push(studentInstrumentId);
  }

  return { endedInstruments, result: { addedStudentInstrumentIds, ended } };
}

/** 종료한 개인레슨 수강에 남은 오늘 이후 예정 레슨 수. 학원 수업의 정기 일정은 종료할 때 함께 빠진다. */
function countRemainingPrivateLessons(
  state: DemoAcademyState,
  studentId: string,
  instrument: StudentListInstrument,
  today: string,
) {
  if (instrument.lessonType !== "private") {
    return 0;
  }

  return state.privateLessons.filter(
    (lesson) =>
      lesson.studentId === studentId &&
      lesson.instrumentId === instrument.instrumentId &&
      lesson.status === "scheduled" &&
      lesson.startAt.slice(0, 10) >= today,
  ).length;
}

function nextEnrollments(
  state: DemoAcademyState,
  input: UpdateStudentEnrollmentsInput,
  before: StudentListInstrument[],
  endedInstruments: StudentListInstrument[],
  result: StudentEnrollmentSaveResult,
): StudentEnrollment[] {
  const name = input.name.trim();
  const sameInstrument = (enrollment: StudentEnrollment, instrument: { instrumentId: string; lessonType: string }) =>
    enrollment.studentId === input.studentId &&
    enrollment.instrumentId === instrument.instrumentId &&
    enrollment.lessonType === instrument.lessonType;
  let enrollments = state.enrollments
    .filter((enrollment) => !endedInstruments.some((ended) => sameInstrument(enrollment, ended)))
    .map((enrollment) => (enrollment.studentId === input.studentId ? { ...enrollment, studentName: name } : enrollment));
  let addedIndex = 0;

  for (const change of input.changes) {
    if (change.action === "update") {
      const stored = before.find((instrument) => instrument.studentInstrumentId === change.studentInstrumentId);

      enrollments = enrollments.map((enrollment) =>
        stored && sameInstrument(enrollment, stored)
          ? toEnrollment(state.academyId, input.studentId, name, change.studentInstrumentId, change)
          : enrollment,
      );
    }

    if (change.action === "add") {
      const studentInstrumentId = result.addedStudentInstrumentIds[addedIndex];

      addedIndex += 1;
      enrollments = [
        ...enrollments.filter((enrollment) => !sameInstrument(enrollment, change)),
        toEnrollment(state.academyId, input.studentId, name, studentInstrumentId, change),
      ];
    }
  }

  return enrollments;
}

function toEnrollment(
  academyId: string,
  studentId: string,
  studentName: string,
  enrollmentId: string,
  fields: StudentEnrollmentFields,
): StudentEnrollment {
  const weeklySchedules = fields.weeklySchedules.map((schedule) => ({
    weekday: toWeekdayValue(schedule.weekdayLabel),
    startTime: schedule.startTime || undefined,
    endTime: schedule.endTime || undefined,
  }));
  const timed = weeklySchedules.find((schedule) => schedule.startTime && schedule.endTime);

  return {
    academyId,
    enrollmentId,
    studentId,
    studentName,
    instrumentId: fields.instrumentId,
    instrumentName: fields.instrumentName,
    teacherId: fields.teacherId ?? "",
    teacherName: fields.teacherName ?? "",
    lessonType: fields.lessonType,
    active: true,
    weekdays: weeklySchedules.map((schedule) => schedule.weekday),
    weeklySchedules,
    startTime: timed?.startTime,
    endTime: timed?.endTime,
    progress: fields.progress,
    lessonFee: fields.lessonFee,
    discountTotal: fields.discountTotal,
    discountLabel: fields.discountLabel,
    finalMonthlyFee: fields.finalMonthlyFee,
  };
}

/** 새로 추가한 악기가 시작일 이전 날짜의 레슨표에 나타나지 않게 뺀다. */
function dropRowsBefore(
  sheets: DemoAcademyState["academySheets"],
  studentId: string,
  instrumentId: string,
  startedOn: string,
): DemoAcademyState["academySheets"] {
  return Object.fromEntries(
    Object.entries(sheets).map(([date, sheet]) => [
      date,
      {
        ...sheet,
        rows: sheet.rows.filter(
          (row) => !(date < startedOn && row.studentId === studentId && row.instrumentId === instrumentId),
        ),
      },
    ]),
  );
}

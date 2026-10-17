import { isReferralMonthMissing } from "@/domain/lesson-fee-draft";
import {
  canEndStudentInstrument,
  type StudentEnrollmentChange,
} from "@/domain/student-enrollment-edit";
import type { StudentListInstrument, StudentListRow } from "@/domain/student-list";
import type { TeacherListRow } from "@/domain/teacher-list";

import { instrumentOptions } from "./student-form-options";
import {
  buildInstrumentUpdate,
  createInstrumentEditDraft,
  getEditableInstruments,
  getInstrumentScheduleError,
  getInstrumentSectionLabels,
  toWeeklyScheduleChanges,
  type InstrumentEditDraft,
} from "./student-instrument-edit";
import {
  buildRegistrationInstrument,
  createRegistrationInstrumentDraft,
  getInstrumentLessonTypes,
  isRegistrationInstrumentReady,
  STUDENT_LESSON_TYPE_LABELS,
  type InstrumentOption,
  type StudentLessonType,
  type StudentRegistrationInstrumentDraft,
} from "./student-registration-instrument";

/** 수정 화면에서 새로 추가하는 악기. 저장하기 전까지는 `key`로만 구분한다. */
export type AddedInstrument = {
  key: string;
  startedOn: string;
  draft: StudentRegistrationInstrumentDraft;
};

/**
 * 원생 수정 폼의 수강 편집 상태. 기존 악기는 `studentInstrumentId`를 키로 한 초안 맵에 두어
 * 악기를 추가하거나 종료해도 다른 악기의 입력이 섞이지 않는다.
 */
export type EnrollmentEdits = {
  /** 폼을 연 때 보여 준 악기. 종료 예정이어도 목록에는 남는다. */
  instruments: StudentListInstrument[];
  drafts: Record<string, InstrumentEditDraft>;
  /** 저장하면 종료할 수강. 초안은 지우지 않아 되돌리면 입력이 그대로 남는다. */
  endedIds: string[];
  added: AddedInstrument[];
  nextAddedKey: number;
};

export type EnrollmentEditAction =
  | { type: "updateInstrument"; studentInstrumentId: string; draft: InstrumentEditDraft }
  | { type: "endInstrument"; studentInstrumentId: string }
  | { type: "restoreInstrument"; studentInstrumentId: string }
  | {
      type: "addInstrument";
      instrument: InstrumentOption;
      teachers: TeacherListRow[];
      startedOn: string;
    }
  | {
      type: "updateAdded";
      key: string;
      patch: Partial<Pick<AddedInstrument, "startedOn" | "draft">>;
    }
  | { type: "removeAdded"; key: string };

export function createEnrollmentEdits(student: StudentListRow): EnrollmentEdits {
  const instruments = getEditableInstruments(student);

  return {
    instruments,
    drafts: Object.fromEntries(
      instruments.map((instrument) => [
        instrument.studentInstrumentId,
        createInstrumentEditDraft(student, instrument),
      ]),
    ),
    endedIds: [],
    added: [],
    nextAddedKey: 1,
  };
}

export function enrollmentEditsReducer(
  edits: EnrollmentEdits,
  action: EnrollmentEditAction,
): EnrollmentEdits {
  switch (action.type) {
    case "updateInstrument":
      return {
        ...edits,
        drafts: { ...edits.drafts, [action.studentInstrumentId]: action.draft },
      };
    case "endInstrument":
      return canEndInstrument(edits, action.studentInstrumentId)
        ? { ...edits, endedIds: [...edits.endedIds, action.studentInstrumentId] }
        : edits;
    case "restoreInstrument":
      return {
        ...edits,
        endedIds: edits.endedIds.filter((id) => id !== action.studentInstrumentId),
      };
    case "addInstrument":
      return addInstrument(edits, action);
    case "updateAdded":
      return {
        ...edits,
        added: edits.added.map((added) =>
          added.key === action.key ? { ...added, ...action.patch } : added,
        ),
      };
    case "removeAdded":
      return canRemoveAdded(edits, action.key)
        ? { ...edits, added: edits.added.filter((added) => added.key !== action.key) }
        : edits;
  }
}

/** 남는 활성 악기(종료 예정 제외, 새로 추가한 악기 포함)가 1개뿐이면 종료할 수 없다. */
export function canEndInstrument(edits: EnrollmentEdits, studentInstrumentId: string) {
  const target = edits.instruments.find(
    (instrument) => instrument.studentInstrumentId === studentInstrumentId,
  );

  if (!target?.active || edits.endedIds.includes(studentInstrumentId)) {
    return false;
  }

  return edits.added.length > 0 || canEndStudentInstrument(getRemainingInstruments(edits));
}

/** 추가한 악기를 지워서 남는 활성 악기가 없어지면(기존 악기를 모두 종료 예정으로 둔 경우) 지울 수 없다. */
export function canRemoveAdded(edits: EnrollmentEdits, key: string) {
  return edits.added.some((added) => added.key === key) && countRemainingInstruments(edits) > 1;
}

/** 저장 후에 활성으로 남는 수강 하나의 (악기, 수업 형태). `ownerId`는 기존 수강 id 또는 추가 섹션 key다. */
export type EffectiveEnrollmentKey = {
  ownerId: string;
  instrumentId: string;
  lessonType: StudentLessonType;
};

/** 기존 수강 섹션에서 고를 수 있는 수업 형태 하나. 고를 수 없으면 이유를 함께 준다. */
export type LessonTypeChoice = { lessonType: StudentLessonType; disabledReason?: string };

const LESSON_TYPE_ORDER: StudentLessonType[] = ["academy", "private"];

/**
 * 저장 후 활성으로 남는 수강의 (악기, 수업 형태). 종료 예정이 아닌 기존 수강은 현재 초안의 수업 형태,
 * 종료 예정 수강은 저장된 형태(저장 전까지는 보수적으로 계속 막는다), 추가 섹션은 고른 형태를 쓴다.
 */
export function getEffectiveEnrollmentKeys(edits: EnrollmentEdits): EffectiveEnrollmentKey[] {
  const existing = edits.instruments
    .filter((instrument) => instrument.active)
    .map((instrument): EffectiveEnrollmentKey => {
      const { studentInstrumentId } = instrument;
      const isEnding = edits.endedIds.includes(studentInstrumentId);

      return {
        ownerId: studentInstrumentId,
        instrumentId: instrument.instrumentId,
        lessonType: isEnding
          ? toLessonType(instrument.lessonType)
          : edits.drafts[studentInstrumentId].lessonType,
      };
    });
  const added = edits.added.map(
    ({ key, draft }): EffectiveEnrollmentKey => ({
      ownerId: key,
      instrumentId: draft.instrumentId,
      lessonType: draft.lessonType,
    }),
  );

  return [...existing, ...added];
}

/**
 * 악기에서 추가로 고를 수 있는 수업 형태. 저장 후 모습에서 이미 쓰는 조합은 뺀다.
 * `exceptKey`는 그 추가 섹션 자신의 선택을 계산에서 빼 현재 값을 계속 고를 수 있게 한다.
 */
export function getAvailableLessonTypes(
  edits: EnrollmentEdits,
  instrument: InstrumentOption,
  exceptKey?: string,
): StudentLessonType[] {
  return getInstrumentLessonTypes(instrument.name).filter(
    (lessonType) => !isLessonTypeTaken(edits, instrument.id, lessonType, exceptKey),
  );
}

/**
 * 기존 수강 섹션의 수업 형태 선택지. 악기가 지원하는 형태에 현재 값을 더하고(이전 데이터는 유지),
 * 다른 수강·추가 섹션이 이미 쓰는 조합은 이유와 함께 막는다.
 */
export function getLessonTypeChoices(
  edits: EnrollmentEdits,
  studentInstrumentId: string,
): LessonTypeChoice[] {
  const instrument = edits.instruments.find(
    (candidate) => candidate.studentInstrumentId === studentInstrumentId,
  );

  if (!instrument) {
    return [];
  }

  const currentLessonType = edits.drafts[studentInstrumentId].lessonType;
  const candidates = [...getInstrumentLessonTypes(instrument.instrumentName), currentLessonType];

  return LESSON_TYPE_ORDER.filter((lessonType) => candidates.includes(lessonType)).map(
    (lessonType) =>
      isLessonTypeTaken(edits, instrument.instrumentId, lessonType, studentInstrumentId)
        ? {
            lessonType,
            disabledReason: `이미 같은 악기를 ${STUDENT_LESSON_TYPE_LABELS[lessonType]}으로 수강 중이라 선택할 수 없습니다.`,
          }
        : { lessonType },
  );
}

/** 추가할 수 있는(고를 수업 형태가 하나라도 남은) 악기. */
export function getAddableInstruments(edits: EnrollmentEdits) {
  return instrumentOptions.filter(
    (instrument) => getAvailableLessonTypes(edits, instrument).length > 0,
  );
}

/** 추가 섹션의 이름. 같은 악기를 수업 형태만 달리해 추가하면 수업 형태를 덧붙인다. */
export function getAddedInstrumentLabels(added: AddedInstrument[]) {
  return added.map(({ draft }) => {
    const name = `새 ${draft.instrumentName}`;
    const hasSameName =
      added.filter((other) => other.draft.instrumentName === draft.instrumentName).length > 1;

    return hasSameName ? `${name}(${STUDENT_LESSON_TYPE_LABELS[draft.lessonType]})` : name;
  });
}

/** 수강 시작일이 속한 달. 지인 소개 할인 달의 기본값으로 쓴다. */
export function getAddedReferenceMonth(startedOn: string) {
  return /^\d{4}-\d{2}/.test(startedOn) ? startedOn.slice(0, 7) : "";
}

/** 저장을 막는 섹션의 이름. 종료 예정 섹션은 저장되지 않으므로 검사하지 않는다. */
export function getBlockedSectionLabels(
  edits: EnrollmentEdits,
  teachers: TeacherListRow[],
  referenceMonth: string,
) {
  const existingLabels = getInstrumentSectionLabels(edits.instruments);
  const blockedExisting = existingLabels.filter((_, index) => {
    const { studentInstrumentId } = edits.instruments[index];
    const draft = edits.drafts[studentInstrumentId];

    return (
      !edits.endedIds.includes(studentInstrumentId) &&
      (getInstrumentScheduleError(draft) !== null || isReferralMonthMissing(draft.fee, referenceMonth))
    );
  });
  const blockedAdded = getAddedInstrumentLabels(edits.added).filter((_, index) => {
    const { startedOn, draft } = edits.added[index];

    return (
      !startedOn.trim() ||
      !isRegistrationInstrumentReady(draft, teachers, getAddedReferenceMonth(startedOn))
    );
  });

  return [...blockedExisting, ...blockedAdded];
}

/**
 * 폼을 연 때의 상태(`initial`)와 비교해 바뀐 수강만 저장 변경으로 만든다. 배열은 update, add, end 순으로 안정 정렬한다.
 * 서버는 배열 순서와 무관하게 종료 → 수정 → 추가로 처리하고 활성 악기 수는 마지막에 한 번만 확인한다.
 */
export function buildEnrollmentChanges({
  initial,
  edits,
  teachers,
  referenceMonth,
  initialReferenceMonth,
}: {
  initial: EnrollmentEdits;
  edits: EnrollmentEdits;
  teachers: TeacherListRow[];
  referenceMonth: string;
  initialReferenceMonth: string;
}): StudentEnrollmentChange[] {
  const updates = edits.instruments.flatMap((instrument): StudentEnrollmentChange[] => {
    const { studentInstrumentId } = instrument;

    if (edits.endedIds.includes(studentInstrumentId)) {
      return [];
    }

    const update = buildInstrumentUpdate({
      instrument,
      draft: edits.drafts[studentInstrumentId],
      teachers,
      referenceMonth,
    });
    const initialUpdate = buildInstrumentUpdate({
      instrument,
      draft: initial.drafts[studentInstrumentId],
      teachers,
      referenceMonth: initialReferenceMonth,
    });

    return JSON.stringify(update) === JSON.stringify(initialUpdate)
      ? []
      : [{ ...update, action: "update" }];
  });
  const adds = edits.added.map((added): StudentEnrollmentChange => {
    const instrument = buildRegistrationInstrument(
      added.draft,
      teachers,
      getAddedReferenceMonth(added.startedOn),
    );

    return {
      ...instrument,
      action: "add",
      startedOn: added.startedOn,
      weeklySchedules: toWeeklyScheduleChanges(added.draft.weeklySchedules),
    };
  });
  const ends = edits.endedIds.map(
    (studentInstrumentId): StudentEnrollmentChange => ({ action: "end", studentInstrumentId }),
  );

  return [...updates, ...adds, ...ends];
}

function addInstrument(
  edits: EnrollmentEdits,
  { instrument, teachers, startedOn }: Extract<EnrollmentEditAction, { type: "addInstrument" }>,
): EnrollmentEdits {
  const [lessonType] = getAvailableLessonTypes(edits, instrument);

  if (!lessonType) {
    return edits;
  }

  return {
    ...edits,
    added: [
      ...edits.added,
      {
        key: `added-${edits.nextAddedKey}`,
        startedOn,
        draft: createRegistrationInstrumentDraft(instrument, teachers, lessonType),
      },
    ],
    nextAddedKey: edits.nextAddedKey + 1,
  };
}

function isLessonTypeTaken(
  edits: EnrollmentEdits,
  instrumentId: string,
  lessonType: StudentLessonType,
  exceptOwnerId?: string,
) {
  return getEffectiveEnrollmentKeys(edits).some(
    (key) =>
      key.ownerId !== exceptOwnerId &&
      key.instrumentId === instrumentId &&
      key.lessonType === lessonType,
  );
}

function toLessonType(lessonType: string): StudentLessonType {
  return lessonType === "private" ? "private" : "academy";
}

function getRemainingInstruments(edits: EnrollmentEdits) {
  return edits.instruments.filter(
    (instrument) => !edits.endedIds.includes(instrument.studentInstrumentId),
  );
}

function countRemainingInstruments(edits: EnrollmentEdits) {
  return (
    getRemainingInstruments(edits).filter((instrument) => instrument.active).length +
    edits.added.length
  );
}

import { getFinanceToday } from "./finance-date";
import {
  type StudentListContact,
  type StudentListInstrument,
  type StudentListRow,
  mergeStudentUpdate,
  withInstruments,
} from "./student-list";
import {
  getLessonScheduleValidationError,
  type StudentInstrumentDiscountSelection,
} from "./student-registration";

export const LAST_INSTRUMENT_END_MESSAGE =
  "수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.";

/** 이름·수강 정보와 따로 저장하는 원생 기본 정보. 등록 폼의 필드와 같다. */
export type StudentBasicInfoInput = {
  registeredOn: string;
  age?: number;
  birthYear?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  contactRelationship: string;
  contactPhone: string;
  secondaryContactRelationship?: string;
  secondaryContactPhone?: string;
};

export type StudentWeeklyScheduleChange = {
  weekdayLabel: string;
  startTime?: string;
  endTime?: string;
};

/** 수강 한 건의 저장 값. 수정과 추가가 같은 필드를 쓴다. */
export type StudentEnrollmentFields = StudentInstrumentDiscountSelection & {
  teacherId?: string | null;
  teacherName?: string;
  lessonType: "academy" | "private";
  sessionsPerMonth?: number;
  lessonDurationMinutes?: 40 | 60;
  instrumentId: string;
  instrumentName: string;
  weeklySchedules: StudentWeeklyScheduleChange[];
  progress: string;
  lessonFee: number;
  discountTotal: number;
  /** 표시용 할인 라벨. 할인 종류(`discountKinds`)를 보낼 때 함께 저장한다. */
  discountLabel?: string;
  finalMonthlyFee: number;
};

export type StudentEnrollmentChange =
  /** 악기(`instrumentId`)는 바꿀 수 없다. 다른 악기로 바꾸려면 종료하고 추가한다. */
  | ({ action: "update"; studentInstrumentId: string; effectiveFrom?: string } & StudentEnrollmentFields)
  /** 종료한 같은 악기·수업 형태를 다시 추가해도 서버가 새 수강 행을 만든다(종료한 수강은 보존). */
  | ({ action: "add"; startedOn: string } & StudentEnrollmentFields)
  | { action: "end"; studentInstrumentId: string };

/** 원생 수정 한 번의 저장 요청. 이름·기본 정보·수강 변경이 한 트랜잭션으로 저장된다. */
export type UpdateStudentEnrollmentsInput = {
  academyId: string;
  studentId: string;
  name: string;
  basicInfo?: StudentBasicInfoInput;
  changes: StudentEnrollmentChange[];
};

export type StudentEnrollmentSaveResult = {
  /** `add` 변경과 같은 순서로 만든 새 수강 id. */
  addedStudentInstrumentIds: string[];
  /** 종료한 수강과, 종료 뒤에도 남은 예정 일정(이동·보강·개인레슨 등) 건수. */
  ended: Array<{ studentInstrumentId: string; remainingEventCount: number }>;
};

type EnrollmentKey = { instrumentId: string; lessonType: string };

const WEEKDAY_VALUES: Record<string, string> = {
  월: "monday",
  화: "tuesday",
  수: "wednesday",
  목: "thursday",
  금: "friday",
  토: "saturday",
  일: "sunday",
};

export function findActiveEnrollmentConflict(
  instruments: readonly StudentListInstrument[],
  candidate: EnrollmentKey,
) {
  return instruments.find(
    (instrument) =>
      instrument.active &&
      instrument.instrumentId === candidate.instrumentId &&
      instrument.lessonType === candidate.lessonType,
  );
}

/** 마지막 활성 악기는 종료할 수 없다. 모두 종료하려면 휴원·퇴원 처리를 한다. */
export function canEndStudentInstrument(instruments: readonly StudentListInstrument[]) {
  return instruments.filter((instrument) => instrument.active).length > 1;
}

export function getRemainingEventNotice(result: StudentEnrollmentSaveResult) {
  const remaining = result.ended.reduce((sum, ended) => sum + ended.remainingEventCount, 0);

  return remaining > 0
    ? `종료한 수강에 정기 외 예정 일정 ${remaining}건이 남아 있습니다. 이동·보강·개인레슨 일정은 레슨 시간표에서 확인해 정리해 주세요.`
    : null;
}

export function getStudentEnrollmentValidationError(
  input: UpdateStudentEnrollmentsInput,
): string | null {
  if (!input.name.trim()) {
    return "원생명은 필수입니다.";
  }

  const addedKeys = new Set<string>();

  for (const change of input.changes) {
    if (change.action === "end") {
      continue;
    }

    const scheduleError = getLessonScheduleValidationError({
      lessonType: change.lessonType,
      teacherId: change.teacherId,
      sessionsPerMonth: change.sessionsPerMonth,
      lessonDurationMinutes: change.lessonDurationMinutes,
      weeklySchedules: change.weeklySchedules,
    });

    if (scheduleError) {
      return scheduleError;
    }

    if (change.action !== "add") {
      continue;
    }

    if (!change.instrumentId.trim() || !change.instrumentName.trim()) {
      return "악기를 선택해 주세요.";
    }

    if (!change.startedOn.trim()) {
      return "수강 시작일을 입력해 주세요.";
    }

    const key = `${change.instrumentId}:${change.lessonType}`;

    if (addedKeys.has(key)) {
      return "같은 악기와 수업 형태를 두 번 추가할 수 없습니다.";
    }

    addedKeys.add(key);
  }

  return null;
}

/**
 * 저장 요청을 화면에 있는 행에 합칠 수 있는 모양으로 바꾼다. 수정·추가한 악기만 담고 종료한 악기는 담지 않는다.
 * 서버가 새 수강 id를 알려 주지 않으면(`result` 없음) 악기·수업 형태로 임시 id를 만든다. 다시 불러오면 실제 id로 바뀐다.
 */
export function buildStudentEnrollmentPatch(
  input: UpdateStudentEnrollmentsInput,
  result?: StudentEnrollmentSaveResult,
): StudentListRow {
  let addedIndex = 0;
  const instruments: StudentListInstrument[] = [];

  for (const change of input.changes) {
    if (change.action === "end") {
      continue;
    }

    if (change.action === "update") {
      instruments.push(toStudentListInstrument(change.studentInstrumentId, change));
      continue;
    }

    const studentInstrumentId =
      result?.addedStudentInstrumentIds[addedIndex] ?? `new:${change.instrumentId}:${change.lessonType}`;

    addedIndex += 1;
    instruments.push(toStudentListInstrument(studentInstrumentId, change));
  }

  return {
    ...withInstruments(
      {
        academyId: input.academyId,
        studentId: input.studentId,
        name: input.name.trim(),
        teacherNames: [],
        instrumentNames: [],
        weekdayLabels: [],
      },
      instruments,
    ),
    ...(input.basicInfo ? toBasicInfoFields(input.basicInfo) : {}),
  };
}

/** 저장 결과를 현재 행에 합친다. 수정·추가한 악기는 바꿔 넣고 종료한 악기는 뺀다. */
export function applyStudentEnrollmentSave(
  current: StudentListRow | null | undefined,
  input: UpdateStudentEnrollmentsInput,
  result?: StudentEnrollmentSaveResult,
): StudentListRow {
  const patch = buildStudentEnrollmentPatch(input, result);
  const merged = withContactsUpdated(current, mergeStudentUpdate(current, patch), patch, input.basicInfo);
  const endedIds = input.changes.flatMap((change) =>
    change.action === "end" ? [change.studentInstrumentId] : [],
  );

  if (!current || endedIds.length === 0) {
    return merged;
  }

  return withInstruments(
    merged,
    (merged.instruments ?? []).filter((instrument) => !endedIds.includes(instrument.studentInstrumentId)),
  );
}

/** 저장 요청의 연락처 목록을 기존 ID와 합쳐 수정·삭제 결과를 즉시 보여 준다. */
function withContactsUpdated(
  current: StudentListRow | null | undefined,
  merged: StudentListRow,
  patch: StudentListRow,
  basicInfo?: StudentBasicInfoInput,
): StudentListRow {
  const currentContacts = current?.contacts ?? [];
  const savedContacts = patch.contacts;
  if (!savedContacts) return merged;

  return {
    ...merged,
    contacts: [
      ...savedContacts.map((contact, index) => ({
        ...contact,
        contactId: currentContacts[index]?.contactId ?? contact.contactId,
      })),
      ...(basicInfo?.secondaryContactRelationship === undefined
        && basicInfo?.secondaryContactPhone === undefined
        ? currentContacts.slice(savedContacts.length)
        : []),
    ],
  };
}

function toStudentListInstrument(
  studentInstrumentId: string,
  fields: StudentEnrollmentFields,
): StudentListInstrument {
  const weeklySchedules = fields.weeklySchedules.map((schedule) => ({
    weekday: WEEKDAY_VALUES[schedule.weekdayLabel] ?? schedule.weekdayLabel,
    weekdayLabel: schedule.weekdayLabel,
    startTime: schedule.startTime ?? "",
    endTime: schedule.endTime ?? "",
  }));

  return {
    studentInstrumentId,
    teacherId: fields.teacherId ?? null,
    teacherName: fields.teacherName ?? "",
    instrumentId: fields.instrumentId,
    instrumentName: fields.instrumentName,
    lessonType: fields.lessonType,
    weekdayLabels: [...new Set(weeklySchedules.map((schedule) => schedule.weekdayLabel))],
    startTime: weeklySchedules.find((schedule) => schedule.startTime && schedule.endTime)?.startTime ?? "",
    endTime: weeklySchedules.find((schedule) => schedule.startTime && schedule.endTime)?.endTime ?? "",
    progress: fields.progress,
    lessonFee: fields.lessonFee,
    discountTotal: fields.discountTotal,
    discountLabel: fields.discountLabel?.trim() || undefined,
    ...(fields.discountKinds
      ? {
          discountKinds: fields.discountKinds,
          referralDiscountMonth: fields.discountKinds.includes("referral")
            ? fields.referralDiscountMonth
            : undefined,
          referralDiscountAmount: fields.discountKinds.includes("referral")
            ? (fields.referralDiscountAmount ?? 0)
            : 0,
        }
      : {}),
    finalMonthlyFee: fields.finalMonthlyFee,
    active: true,
    weeklySchedules,
  };
}

function toBasicInfoFields(basicInfo: StudentBasicInfoInput): Partial<StudentListRow> {
  const contactPhone = basicInfo.contactPhone.trim();
  const contact: StudentListContact = {
    contactId: "",
    relationship: basicInfo.contactRelationship.trim() || "본인",
    phone: contactPhone,
    phoneLast4: contactPhone.replace(/\D/g, "").slice(-4) || undefined,
  };

  return {
    registeredOn: basicInfo.registeredOn,
    age: basicInfo.age,
    ageAsOfYear: basicInfo.age === undefined ? undefined : Number(getFinanceToday().slice(0, 4)),
    grade: basicInfo.grade?.trim() || undefined,
    gradeAsOfYear: basicInfo.grade ? Number(getFinanceToday().slice(0, 4)) : undefined,
    school: basicInfo.school?.trim() || undefined,
    occupation: basicInfo.occupation?.trim() || undefined,
    contacts: [
      ...(contactPhone ? [contact] : []),
      ...(basicInfo.secondaryContactRelationship?.trim() && basicInfo.secondaryContactPhone?.trim()
        ? [{
            contactId: "",
            relationship: basicInfo.secondaryContactRelationship.trim(),
            phone: basicInfo.secondaryContactPhone.trim(),
            phoneLast4: basicInfo.secondaryContactPhone.replace(/\D/g, "").slice(-4) || undefined,
          }]
        : []),
    ],
  };
}

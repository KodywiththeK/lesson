import { formatAbsenceResolutionMemoLine } from "./monthly-memo";

export type AcademyLessonAbsence = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  originalDate: string;
};

export type AbsenceResolution =
  | {
      type: "makeup";
      reason?: string;
      makeupDate: string;
      makeupTime?: string;
      confirmedAt: string;
    }
  | {
      type: "pass";
      reason?: string;
      confirmedAt: string;
    };

export type ResolvedAcademyLessonAbsence = AcademyLessonAbsence & {
  status: "resolved";
  resolvedAs: AbsenceResolution["type"];
  reason: string;
  confirmedAt: string;
};

export type MakeupLesson = {
  academyId: string;
  sourceAbsenceLessonEventId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  date: string;
  time?: string;
  title: string;
};

export type MonthlyMemo = {
  academyId: string;
  month: string;
  content: string;
  unread: boolean;
};

export type ResolveAcademyLessonAbsenceResult = {
  resolvedAbsence: ResolvedAcademyLessonAbsence;
  makeupLesson?: MakeupLesson;
  monthlyMemo: MonthlyMemo;
  ticketUsage?: never;
};

export function resolveAcademyLessonAbsence(
  absence: AcademyLessonAbsence,
  resolution: AbsenceResolution,
): ResolveAcademyLessonAbsenceResult {
  if (resolution.type === "makeup" && !resolution.makeupDate) {
    throw new Error("보강 날짜는 필수입니다.");
  }

  const resolvedAbsence: ResolvedAcademyLessonAbsence = {
    ...absence,
    status: "resolved",
    resolvedAs: resolution.type,
    reason: resolution.reason?.trim() ?? "",
    confirmedAt: resolution.confirmedAt,
  };

  if (resolution.type === "pass") {
    return {
      resolvedAbsence,
      monthlyMemo: {
        academyId: absence.academyId,
        month: toMonth(absence.originalDate),
        content: formatAbsenceResolutionMemoLine({
          studentName: absence.studentName,
          resolution: "pass",
          absentDate: absence.originalDate,
          reason: resolution.reason,
        }),
        unread: true,
      },
    };
  }

  const makeupLesson: MakeupLesson = {
    academyId: absence.academyId,
    sourceAbsenceLessonEventId: absence.lessonEventId,
    studentId: absence.studentId,
    studentName: absence.studentName,
    instrumentId: absence.instrumentId,
    instrumentName: absence.instrumentName,
    date: resolution.makeupDate,
    time: resolution.makeupTime,
    title: `[보강 수업] ${absence.studentName} ${absence.instrumentName}`,
  };

  return {
    resolvedAbsence,
    makeupLesson,
    monthlyMemo: {
      academyId: absence.academyId,
      month: toMonth(absence.originalDate),
      content: formatAbsenceResolutionMemoLine({
        studentName: absence.studentName,
        resolution: "makeup",
        absentDate: absence.originalDate,
        makeupDate: resolution.makeupDate,
        makeupTime: resolution.makeupTime,
        reason: resolution.reason,
      }),
      unread: true,
    },
  };
}

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-\d{2}$/);

  if (!match) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

export type MakeupLessonTimes =
  | { ok: true; startTime: string; endTime: string; timeUnspecified: boolean }
  | { ok: false; reason: string };

/**
 * 보강 시간을 정한다. 시간을 입력하지 않으면(랜덤 방문) 원본 시간을 임시로 두고 화면에서 숨긴다.
 * 시작 시간만 입력하므로 종료 시간은 원본 수업 길이만큼 뒤로 잡는다.
 */
export function buildMakeupLessonTimes(
  source: { startTime: string; endTime: string },
  makeupStartTime: string | undefined,
): MakeupLessonTimes {
  if (!makeupStartTime) {
    return {
      ok: true,
      startTime: source.startTime,
      endTime: source.endTime,
      timeUnspecified: true,
    };
  }

  const durationMinutes = toMinutes(source.endTime) - toMinutes(source.startTime);
  const endMinutes = toMinutes(makeupStartTime) + durationMinutes;

  if (endMinutes >= MINUTES_PER_DAY) {
    return {
      ok: false,
      reason: "보강 시간이 너무 늦어 수업이 하루를 넘깁니다. 더 이른 시간을 선택해 주세요.",
    };
  }

  return {
    ok: true,
    startTime: makeupStartTime,
    endTime: toHourMinute(endMinutes),
    timeUnspecified: false,
  };
}

export type AbsenceResolutionInputCheck =
  | { ok: true; resolution: AbsenceResolution["type"] }
  | { ok: false; reason: string };

/** 사유서의 필수 입력을 검사한다. 사유(보강/패스)와 보강일만 필수이고 보강 시간·사유 메모는 선택이다. */
export function checkAbsenceResolutionInput(
  input: { resolution: AbsenceResolution["type"] | ""; targetDate: string; startTime: string },
  source: { startTime: string; endTime: string },
): AbsenceResolutionInputCheck {
  if (input.resolution === "") {
    return { ok: false, reason: "사유(보강 또는 패스)를 선택해 주세요." };
  }

  if (input.resolution === "pass") {
    return { ok: true, resolution: "pass" };
  }

  if (!input.targetDate) {
    return { ok: false, reason: "보강 날짜를 선택해 주세요." };
  }

  const times = buildMakeupLessonTimes(source, input.startTime);

  return times.ok ? { ok: true, resolution: "makeup" } : { ok: false, reason: times.reason };
}

const MINUTES_PER_DAY = 24 * 60;

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function toHourMinute(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

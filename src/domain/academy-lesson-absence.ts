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
      reason: string;
      makeupDate: string;
      makeupTime?: string;
      confirmedAt: string;
    }
  | {
      type: "pass";
      reason: string;
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
    reason: resolution.reason,
    confirmedAt: resolution.confirmedAt,
  };

  if (resolution.type === "pass") {
    return {
      resolvedAbsence,
      monthlyMemo: {
        academyId: absence.academyId,
        month: toMonth(absence.originalDate),
        content: `${absence.studentName} 패스 / 원래 결석일 ${absence.originalDate} / 사유: ${resolution.reason}`,
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
      content: formatMakeupMemoContent(absence, resolution),
      unread: true,
    },
  };
}

function formatMakeupMemoContent(
  absence: AcademyLessonAbsence,
  resolution: Extract<AbsenceResolution, { type: "makeup" }>,
) {
  const makeupTime = resolution.makeupTime ? ` ${resolution.makeupTime}` : "";

  return `${absence.studentName} 보강 ${resolution.makeupDate}${makeupTime} / 원래 결석일 ${absence.originalDate} / 사유: ${resolution.reason}`;
}

function toMonth(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-\d{2}$/);

  if (!match) {
    throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  }

  return `${match[1]}-${match[2]}`;
}

export type LessonType = "academy" | "private";

export type PrivateLessonStatus =
  | "scheduled"
  | "present"
  | "absent"
  | "cancelled"
  | "makeup";

export type PrivateLesson = {
  id: string;
  academyId: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  startAt: string;
  endAt: string;
  status: PrivateLessonStatus;
};

export type PrivateLessonRegistrationDraft = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
};

export type PrivateLessonRegistrationBlocker =
  | {
      type: "invalid-time-range";
      message: string;
    }
  | {
      type: "teacher-time-overlap";
      lessonId: string;
      message: string;
    };

export type StudentInstrumentEnrollment = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  instrumentName: string;
  lessonType: LessonType;
  active: boolean;
};

export type PrivateLessonInstrumentOption = {
  instrumentId: string;
  instrumentName: string;
};

export type StudentInstrumentContext = {
  academyId: string;
  studentId: string;
};

export type PrivateLessonScheduleMessageInput = {
  targetName: string;
  targetRole: "student" | "teacher";
  lessons: PrivateLesson[];
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function findPrivateLessonRegistrationBlocker(
  existingLessons: PrivateLesson[],
  draft: PrivateLessonRegistrationDraft,
): PrivateLessonRegistrationBlocker | undefined {
  const draftStart = toTimestamp(draft.startAt);
  const draftEnd = toTimestamp(draft.endAt);

  if (!Number.isFinite(draftStart) || !Number.isFinite(draftEnd)) {
    return {
      type: "invalid-time-range",
      message: "개인레슨 시작 시간과 종료 시간을 확인해 주세요.",
    };
  }

  if (draftEnd <= draftStart) {
    return {
      type: "invalid-time-range",
      message: "개인레슨 종료 시간은 시작 시간보다 늦어야 합니다.",
    };
  }

  const overlappingLesson = existingLessons.find((lesson) => {
    if (lesson.status === "cancelled") {
      return false;
    }

    if (
      lesson.academyId !== draft.academyId ||
      lesson.teacherId !== draft.teacherId
    ) {
      return false;
    }

    return timeRangesOverlap(
      toTimestamp(lesson.startAt),
      toTimestamp(lesson.endAt),
      draftStart,
      draftEnd,
    );
  });

  if (!overlappingLesson) {
    return undefined;
  }

  return {
    type: "teacher-time-overlap",
    lessonId: overlappingLesson.id,
    message: "선택한 선생님의 해당 시간에 이미 개인레슨이 있습니다.",
  };
}

export function getSelectablePrivateLessonInstruments(
  enrollments: StudentInstrumentEnrollment[],
  context: StudentInstrumentContext,
): PrivateLessonInstrumentOption[] {
  return enrollments
    .filter(
      (enrollment) =>
        enrollment.academyId === context.academyId &&
        enrollment.studentId === context.studentId &&
        enrollment.active &&
        enrollment.lessonType === "private",
    )
    .map((enrollment) => ({
      instrumentId: enrollment.instrumentId,
      instrumentName: enrollment.instrumentName,
    }));
}

export function formatPrivateLessonScheduleMessage({
  targetName,
  targetRole,
  lessons,
}: PrivateLessonScheduleMessageInput) {
  const roleLabel = targetRole === "student" ? "원생" : "선생님";
  const header = `${targetName} ${roleLabel} 개인레슨 시간표`;
  const lessonLines = [...lessons]
    .sort((left, right) => toTimestamp(left.startAt) - toTimestamp(right.startAt))
    .map((lesson) => {
      const dateLabel = formatKoreanDate(lesson.startAt);
      const timeLabel = `${formatTime(lesson.startAt)}-${formatTime(lesson.endAt)}`;
      const detail =
        targetRole === "student"
          ? `${lesson.instrumentName} / ${lesson.teacherName}`
          : `${lesson.studentName} / ${lesson.instrumentName}`;

      return `- ${dateLabel} ${timeLabel} ${detail}`;
    });

  return [header, ...lessonLines].join("\n");
}

function timeRangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function toTimestamp(dateTime: string) {
  return new Date(dateTime).getTime();
}

function formatKoreanDate(dateTime: string) {
  const { year, month, day } = parseIsoLocalParts(dateTime);
  const weekday =
    WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${month}월 ${day}일(${weekday})`;
}

function formatTime(dateTime: string) {
  const { hour, minute } = parseIsoLocalParts(dateTime);

  return `${hour}:${minute}`;
}

function parseIsoLocalParts(dateTime: string) {
  const match = dateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  );

  if (!match) {
    throw new Error("날짜 시간은 ISO 형식이어야 합니다.");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: match[4],
    minute: match[5],
  };
}

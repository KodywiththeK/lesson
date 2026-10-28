import { compareKoreanNames } from "./common-list";

export type LessonType = "academy" | "private";
export type LessonEventOrigin =
  | "regular"
  | "manual"
  | "makeup"
  | "private"
  | "special"
  | "rescheduled";

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
  creditAuthorized?: boolean;
  ticketGrantId?: string;
  ticketSessionNumber?: number;
  ticketTotalCount?: number;
  /** 결석 사유. 결석이 아니면 없다. 사유를 비우고 저장한 결석은 기본 문구(결석 확인)다. */
  absenceReason?: string;
  origin?: LessonEventOrigin;
  originLabel?: string;
};

export const PRIVATE_ABSENCE_REASON_MAX_LENGTH = 100;

/** 결석 사유는 선택이며 100자까지 입력할 수 있다. */
export function getPrivateAbsenceReasonError(reason: string | undefined) {
  return (reason?.trim().length ?? 0) > PRIVATE_ABSENCE_REASON_MAX_LENGTH
    ? `사유는 ${PRIVATE_ABSENCE_REASON_MAX_LENGTH}자 이하로 입력해 주세요.`
    : null;
}

export type PrivateLessonRegistrationDraft = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
};

export type PrivateLessonRegistrationStepId =
  | "student"
  | "instrument"
  | "teacher"
  | "time";

export type PrivateLessonRegistrationStepStatus =
  | "complete"
  | "current"
  | "locked";

export type PrivateLessonRegistrationStep = {
  id: PrivateLessonRegistrationStepId;
  label: string;
};

export type PrivateLessonRegistrationFlowStep =
  PrivateLessonRegistrationStep & {
    status: PrivateLessonRegistrationStepStatus;
  };

export type PrivateLessonRegistrationFlowState = {
  currentStepId: PrivateLessonRegistrationStepId;
  steps: PrivateLessonRegistrationFlowStep[];
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

export type PrivateLessonStudentCandidate = {
  academyId: string;
  studentId: string;
  studentName: string;
};

export type PrivateLessonTicketSearchBalance = {
  academyId: string;
  studentId: string;
  instrumentId: string;
  instrumentName: string;
  remainingCount: number;
  /** 유효한 회차권에 부여된 총 회차. 알 수 없으면 비워 두고, 회차 표시는 "n회차"로 줄인다. */
  totalGrantedCount?: number;
  /** 유효한 회차권 기간 안에서 조회한 달 이전에 잡힌 레슨 수. 있으면 회차를 이어서 센다. */
  priorLessonCount?: number;
};

export type PrivateLessonSearchResultTicket = {
  instrumentId: string;
  instrumentName: string;
  remainingCount: number;
};

export type PrivateLessonSearchResultRecentLesson = {
  lessonId: string;
  date: string;
  instrumentName: string;
  status: PrivateLessonStatus;
  statusLabel: string;
};

export type PrivateLessonSearchResultScheduleItem = {
  lessonId: string;
  /** 서울 기준 날짜 `YYYY-MM-DD` */
  date: string;
  weekdayLabel: string;
  /** `1/4` 같은 현재/총 회차 */
  sessionLabel: string;
};

export type PrivateLessonStudentSearchResult = {
  studentId: string;
  studentName: string;
  remainingTickets: PrivateLessonSearchResultTicket[];
  recentLesson?: PrivateLessonSearchResultRecentLesson;
  /** 조회된 기간 안의 취소되지 않은 레슨을 날짜 오름차순으로 담는다. */
  schedule: PrivateLessonSearchResultScheduleItem[];
};

export type BuildPrivateLessonStudentSearchResultsOptions = {
  academyId: string;
  search?: string;
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

/** 원생관리에 레슨 시간대가 없을 때 쓰는 개인레슨 기본 길이(분). */
export const DEFAULT_PRIVATE_LESSON_MINUTES = 30;

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const PRIVATE_LESSON_STATUS_LABELS: Record<PrivateLessonStatus, string> = {
  scheduled: "예정",
  present: "출석",
  absent: "결석",
  cancelled: "취소",
  makeup: "보강",
};

export const PRIVATE_LESSON_REGISTRATION_STEPS: PrivateLessonRegistrationStep[] =
  [
    { id: "student", label: "원생" },
    { id: "instrument", label: "악기" },
    { id: "teacher", label: "선생님" },
    { id: "time", label: "시간" },
  ];

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

export function getPrivateLessonRegistrationFlowState(
  draft: Partial<PrivateLessonRegistrationDraft>,
): PrivateLessonRegistrationFlowState {
  const currentStepId = getCurrentPrivateLessonRegistrationStepId(draft);
  const currentStepIndex = PRIVATE_LESSON_REGISTRATION_STEPS.findIndex(
    (step) => step.id === currentStepId,
  );

  return {
    currentStepId,
    steps: PRIVATE_LESSON_REGISTRATION_STEPS.map((step, index) => ({
      ...step,
      status: getRegistrationStepStatus(draft, step.id, index, currentStepIndex),
    })),
  };
}

export function buildPrivateLessonStudentSearchResults(
  students: PrivateLessonStudentCandidate[],
  ticketBalances: PrivateLessonTicketSearchBalance[],
  lessons: PrivateLesson[],
  options: BuildPrivateLessonStudentSearchResultsOptions,
): PrivateLessonStudentSearchResult[] {
  const search = options.search?.trim().toLocaleLowerCase("ko-KR");
  const sessionLabels = buildPrivateLessonSessionLabels(lessons, ticketBalances);

  return students
    .filter((student) => student.academyId === options.academyId)
    .filter((student) =>
      search
        ? student.studentName.toLocaleLowerCase("ko-KR").includes(search)
        : true,
    )
    .sort((left, right) =>
      compareKoreanNames(left.studentName, right.studentName),
    )
    .map((student) => ({
      studentId: student.studentId,
      studentName: student.studentName,
      remainingTickets: getStudentRemainingTickets(student, ticketBalances),
      recentLesson: getRecentPrivateLesson(student, lessons),
      schedule: getStudentSchedule(student, lessons, sessionLabels),
    }));
}

/**
 * 구매 권에 연결된 일정은 저장된 권별 회차 번호를 보여 준다.
 * 이전 데이터처럼 번호가 없으면 같은 원생·악기의 레슨을 시간순으로 세고
 * 이전 달까지의 수(`priorLessonCount`)를 더한다.
 */
export function buildPrivateLessonSessionLabels(
  lessons: PrivateLesson[],
  ticketBalances: PrivateLessonTicketSearchBalance[],
): Map<string, string> {
  const lessonsByStudentInstrument = new Map<string, PrivateLesson[]>();
  const labels = new Map<string, string>();

  for (const lesson of lessons) {
    if (lesson.status === "cancelled") {
      continue;
    }
    if (lesson.ticketSessionNumber && lesson.ticketTotalCount) {
      labels.set(lesson.id, `${lesson.ticketSessionNumber}/${lesson.ticketTotalCount}`);
      continue;
    }

    const key = toStudentInstrumentKey(lesson);
    lessonsByStudentInstrument.set(key, [
      ...(lessonsByStudentInstrument.get(key) ?? []),
      lesson,
    ]);
  }

  for (const [key, group] of lessonsByStudentInstrument) {
    const balance = ticketBalances.find((ticket) => toStudentInstrumentKey(ticket) === key);
    const totalGrantedCount = balance?.totalGrantedCount;
    const priorLessonCount = balance?.priorLessonCount ?? 0;
    const ordered = [...group].sort(
      (left, right) =>
        toTimestamp(left.startAt) - toTimestamp(right.startAt) ||
        left.id.localeCompare(right.id),
    );

    ordered.forEach((lesson, index) => {
      const current = priorLessonCount + index + 1;
      labels.set(
        lesson.id,
        totalGrantedCount && totalGrantedCount > 0
          ? `${current}/${totalGrantedCount}`
          : `${current}회차`,
      );
    });
  }

  return labels;
}

/** 레슨원생 검색의 복사 버튼이 클립보드에 넣는 `8/4 (화) - 1/4` 줄 단위 텍스트를 만든다. */
export function formatPrivateLessonScheduleCopyText(
  schedule: PrivateLessonSearchResultScheduleItem[],
) {
  return [...schedule]
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((item) => {
      const month = Number(item.date.slice(5, 7));
      const day = Number(item.date.slice(8, 10));

      return `${month}/${day} (${item.weekdayLabel}) - ${item.sessionLabel}`;
    })
    .join("\n");
}

/** 원생관리의 레슨 시작·종료 시각(`HH:mm` 또는 `HH:mm:ss`)에서 레슨 길이(분)를 구한다. */
export function deriveLessonMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  fallback = DEFAULT_PRIVATE_LESSON_MINUTES,
) {
  const start = toMinutesOfDay(startTime);
  const end = toMinutesOfDay(endTime);

  if (start === undefined || end === undefined || end <= start) {
    return fallback;
  }

  return end - start;
}

/** `YYYY-MM-DDTHH:mm`에 분을 더해 같은 형식으로 돌려준다. 시간대 변환 없이 달력 숫자만 계산한다. */
export function addMinutesToDateTime(dateTime: string, minutes: number) {
  const { year, month, day, hour, minute } = parseIsoLocalParts(dateTime);
  const next = new Date(
    Date.UTC(year, month - 1, day, Number(hour), Number(minute) + minutes),
  );
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}`;
}

/**
 * 악기를 담당하는 선생님만 고른다. 원생의 담당 선생님은 파트가 달라도 포함한다.
 * 해당 선생님이 한 명도 없으면 전체를 돌려주고 대체 목록임을 알려 화면이 안내하게 한다.
 */
export function filterTeachersForInstrument<
  TTeacher extends { teacherId: string; part: string },
>(
  instrumentName: string,
  teachers: TTeacher[],
  assignedTeacherId?: string,
): { teachers: TTeacher[]; isFallback: boolean } {
  const matched = teachers.filter(
    (teacher) =>
      teacher.teacherId === assignedTeacherId ||
      isTeacherPartForInstrument(teacher.part, instrumentName),
  );

  return matched.length > 0
    ? { teachers: matched, isFallback: false }
    : { teachers, isFallback: true };
}

/** 등록하려는 시간이 같은 선생님의 다른 원생 레슨과 겹치면 겹치는 원생 이름을 넣은 안내를 돌려준다. */
export function findPrivateLessonConflictNotice(
  existingLessons: PrivateLesson[],
  draft: PrivateLessonRegistrationDraft,
): string | undefined {
  const blocker = findPrivateLessonRegistrationBlocker(existingLessons, draft);

  if (blocker?.type !== "teacher-time-overlap") {
    return undefined;
  }

  const conflictingLesson = existingLessons.find(
    (lesson) => lesson.id === blocker.lessonId,
  );

  return `이미 같은 시간대에 ${conflictingLesson?.studentName ?? "다른"} 원생 레슨이 있습니다.`;
}

/** `14:00`을 `오후 2시`, `14:30`을 `오후 2:30`처럼 달력에 쓰는 말투로 바꾼다. */
export function formatKoreanTimeLabel(time: string) {
  const minutesOfDay = toMinutesOfDay(time);

  if (minutesOfDay === undefined) {
    return time;
  }

  const hour24 = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  const meridiem = hour24 < 12 ? "오전" : "오후";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return minute === 0
    ? `${meridiem} ${hour12}시`
    : `${meridiem} ${hour12}:${String(minute).padStart(2, "0")}`;
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

function getCurrentPrivateLessonRegistrationStepId(
  draft: Partial<PrivateLessonRegistrationDraft>,
): PrivateLessonRegistrationStepId {
  if (!draft.studentId) {
    return "student";
  }

  if (!draft.instrumentId) {
    return "instrument";
  }

  if (!draft.teacherId) {
    return "teacher";
  }

  return "time";
}

function getRegistrationStepStatus(
  draft: Partial<PrivateLessonRegistrationDraft>,
  stepId: PrivateLessonRegistrationStepId,
  stepIndex: number,
  currentStepIndex: number,
): PrivateLessonRegistrationStepStatus {
  if (isPrivateLessonRegistrationStepComplete(draft, stepId)) {
    return "complete";
  }

  if (stepIndex === currentStepIndex) {
    return "current";
  }

  return "locked";
}

function isPrivateLessonRegistrationStepComplete(
  draft: Partial<PrivateLessonRegistrationDraft>,
  stepId: PrivateLessonRegistrationStepId,
) {
  if (stepId === "student") {
    return Boolean(draft.studentId);
  }

  if (stepId === "instrument") {
    return Boolean(draft.studentId && draft.instrumentId);
  }

  if (stepId === "teacher") {
    return Boolean(draft.studentId && draft.instrumentId && draft.teacherId);
  }

  return Boolean(
    draft.studentId &&
      draft.instrumentId &&
      draft.teacherId &&
      draft.startAt &&
      draft.endAt,
  );
}

function getStudentRemainingTickets(
  student: PrivateLessonStudentCandidate,
  ticketBalances: PrivateLessonTicketSearchBalance[],
) {
  return ticketBalances
    .filter(
      (ticket) =>
        ticket.academyId === student.academyId &&
        ticket.studentId === student.studentId,
    )
    .sort((left, right) =>
      compareKoreanNames(left.instrumentName, right.instrumentName),
    )
    .map((ticket) => ({
      instrumentId: ticket.instrumentId,
      instrumentName: ticket.instrumentName,
      remainingCount: ticket.remainingCount,
    }));
}

function getRecentPrivateLesson(
  student: PrivateLessonStudentCandidate,
  lessons: PrivateLesson[],
): PrivateLessonSearchResultRecentLesson | undefined {
  const recentLesson = lessons
    .filter(
      (lesson) =>
        lesson.academyId === student.academyId &&
        lesson.studentId === student.studentId,
    )
    .sort((left, right) => toTimestamp(right.startAt) - toTimestamp(left.startAt))
    .at(0);

  if (!recentLesson) {
    return undefined;
  }

  return {
    lessonId: recentLesson.id,
    date: toSeoulDateKey(recentLesson.startAt),
    instrumentName: recentLesson.instrumentName,
    status: recentLesson.status,
    statusLabel: PRIVATE_LESSON_STATUS_LABELS[recentLesson.status],
  };
}

function getStudentSchedule(
  student: PrivateLessonStudentCandidate,
  lessons: PrivateLesson[],
  sessionLabels: Map<string, string>,
): PrivateLessonSearchResultScheduleItem[] {
  return lessons
    .filter(
      (lesson) =>
        lesson.academyId === student.academyId &&
        lesson.studentId === student.studentId &&
        lesson.status !== "cancelled",
    )
    .sort((left, right) => toTimestamp(left.startAt) - toTimestamp(right.startAt))
    .map((lesson) => {
      const date = toSeoulDateKey(lesson.startAt);

      return {
        lessonId: lesson.id,
        date,
        weekdayLabel: toWeekdayLabel(date),
        sessionLabel: sessionLabels.get(lesson.id) ?? "",
      };
    });
}

function toStudentInstrumentKey(target: {
  academyId: string;
  studentId: string;
  instrumentId: string;
}) {
  return `${target.academyId}:${target.studentId}:${target.instrumentId}`;
}

function toSeoulDateKey(dateTime: string) {
  return seoulDateFormatter.format(new Date(dateTime));
}

function toWeekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function toMinutesOfDay(time: string | null | undefined) {
  const match = time?.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

  if (!match) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  return hour > 23 || minute > 59 ? undefined : hour * 60 + minute;
}

function isTeacherPartForInstrument(part: string, instrumentName: string) {
  return (
    part.trim() !== "" &&
    (instrumentName.includes(part) || part.includes(instrumentName))
  );
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

/** 출석 처리 결과가 회차권에 준 실제 변화를 사용자에게 알리는 문구를 만든다. */
export function describePrivateAttendanceChange(
  previous: PrivateLessonStatus,
  next: "present" | "absent",
): string {
  if (previous === next) {
    return next === "present" ? "이미 출석 처리된 수업입니다." : "이미 결석 처리된 수업입니다.";
  }

  if (next === "present") {
    return "출석 처리하고 회차권 1회를 차감했습니다.";
  }

  return previous === "present"
    ? "결석으로 바꾸고 회차권 1회를 복구했습니다."
    : "결석 처리했습니다. 회차권은 차감되지 않습니다.";
}

/** 등원 확인을 취소했을 때 회차권에 생긴 변화를 알리는 문구다. */
export function describePrivateAttendanceCancellation(result: {
  cancelled: boolean;
  restoredTicket: boolean;
}): string {
  if (!result.cancelled) return "취소할 등원 확인 기록이 없습니다.";
  return result.restoredTicket
    ? "등원 확인을 취소하고 회차권 1회를 복구했습니다."
    : "등원 확인을 취소했습니다. 복구할 회차권 사용 기록은 없었습니다.";
}

/**
 * 원생이 선택한 악기에 맞는 선생님을 기본값으로 고른다.
 * 악기별 담당 선생님이 재직 중이면 그 선생님, 아니면 파트가 악기와 같은 선생님이 정확히 한 명일 때만 고른다.
 */
export function pickDefaultTeacherId(
  instrument: { instrumentName: string; teacherId?: string },
  teachers: Array<{ teacherId: string; part: string }>,
): string {
  if (instrument.teacherId && teachers.some((teacher) => teacher.teacherId === instrument.teacherId)) {
    return instrument.teacherId;
  }

  const samePartTeachers = teachers.filter((teacher) =>
    isTeacherPartForInstrument(teacher.part, instrument.instrumentName),
  );

  return samePartTeachers.length === 1 ? samePartTeachers[0].teacherId : "";
}

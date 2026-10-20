import { compareKoreanNames } from "./common-list";

export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type AcademyLessonEnrollment = {
  academyId: string;
  enrollmentId?: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  lessonType: "academy" | "private";
  active: boolean;
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
};

export type GenerateAcademyLessonEventsOptions = {
  academyId: string;
  month: string;
};

export type AcademyLessonEvent = {
  id?: string;
  academyId: string;
  enrollmentId?: string;
  studentId: string;
  studentName: string;
  instrumentId: string;
  instrumentName: string;
  date: string;
  startTime: string;
  endTime: string;
  generatedFromEnrollment: boolean;
  timeUnspecified?: boolean;
  status?: "scheduled" | "deleted";
};

export type MoveAcademyLessonInput = {
  targetDate: string;
  targetStartTime: string;
  targetEndTime: string;
};

export type MoveAcademyLessonResult = {
  movedEvent: AcademyLessonEvent;
  enrollmentScheduleChanged: false;
};

export type DeleteAcademyLessonInput = {
  reason: string;
  deletedAt: string;
  deletedBy: string;
};

export type DeletedAcademyLessonEvent = AcademyLessonEvent & {
  status: "deleted";
  deletionReason: string;
  deletedAt: string;
  deletedBy: string;
};

export type DeleteAcademyLessonResult = {
  deletedEvent: DeletedAcademyLessonEvent;
  enrollmentScheduleChanged: false;
};

const WEEKDAY_INDEX: Record<Weekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function generateAcademyLessonEvents(
  enrollments: AcademyLessonEnrollment[],
  options: GenerateAcademyLessonEventsOptions,
): AcademyLessonEvent[] {
  const monthDays = getMonthDays(options.month);

  return enrollments
    .filter(
      (enrollment) =>
        enrollment.academyId === options.academyId &&
        enrollment.active &&
        enrollment.lessonType === "academy",
    )
    .flatMap((enrollment) =>
      monthDays
        .filter((date) => enrollment.weekdays.includes(getWeekday(date)))
        .map((date) => ({
          academyId: enrollment.academyId,
          enrollmentId: enrollment.enrollmentId,
          studentId: enrollment.studentId,
          studentName: enrollment.studentName,
          instrumentId: enrollment.instrumentId,
          instrumentName: enrollment.instrumentName,
          date,
          startTime: enrollment.startTime,
          endTime: enrollment.endTime,
          generatedFromEnrollment: true,
          timeUnspecified: !enrollment.startTime && !enrollment.endTime,
        })),
    )
    .sort(compareAcademyLessonEvents);
}

export function moveAcademyLessonWithinMonth(
  event: AcademyLessonEvent,
  input: MoveAcademyLessonInput,
): MoveAcademyLessonResult {
  if (toMonth(event.date) !== toMonth(input.targetDate)) {
    throw new Error("일정 이동은 같은 월 안에서만 가능합니다.");
  }

  return {
    movedEvent: {
      ...event,
      date: input.targetDate,
      startTime: input.targetStartTime,
      endTime: input.targetEndTime,
      generatedFromEnrollment: false,
    },
    enrollmentScheduleChanged: false,
  };
}

export function deleteAcademyLessonWithReason(
  event: AcademyLessonEvent,
  input: DeleteAcademyLessonInput,
): DeleteAcademyLessonResult {
  const deletionReason = input.reason.trim();

  if (!deletionReason) {
    throw new Error("일정 삭제 사유는 필수입니다.");
  }

  return {
    deletedEvent: {
      ...event,
      status: "deleted",
      deletionReason,
      deletedAt: input.deletedAt,
      deletedBy: input.deletedBy,
      generatedFromEnrollment: false,
    },
    enrollmentScheduleChanged: false,
  };
}

function getMonthDays(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new Error("월은 YYYY-MM 형식이어야 합니다.");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  return Array.from({ length: daysInMonth }, (_, index) =>
    formatDate(year, monthIndex + 1, index + 1),
  );
}

function getWeekday(date: string): Weekday {
  const [year, month, day] = date.split("-").map(Number);
  const weekdayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = Object.entries(WEEKDAY_INDEX).find(
    ([, index]) => index === weekdayIndex,
  )?.[0];

  if (!weekday) {
    throw new Error("요일을 계산할 수 없습니다.");
  }

  return weekday as Weekday;
}

function compareAcademyLessonEvents(
  left: AcademyLessonEvent,
  right: AcademyLessonEvent,
) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.studentName, right.studentName)
  );
}

function toMonth(date: string) {
  return date.slice(0, 7);
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

import { toFinanceDate } from "./finance-date";
import { comparePrivateLessonStartAt, type PrivateLesson } from "./private-lesson";

const ACADEMY_MESSAGE_NAME = "더 클래식 음악학원";
const EMPTY_SCHEDULE_MESSAGE = "해당 월에 등록된 레슨이 없습니다.";

const seoulTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * 선생님께 보낼 월 스케줄표 문자. 선택한 선생님의 해당 월(한국 시간 기준) 일정을 날짜별로 묶는다.
 * 취소된 일정은 열리지 않는 수업이라 뺀다. 일정이 하나도 없으면 안내 문구만 돌려준다.
 */
export function formatTeacherMonthScheduleMessage(input: {
  lessons: PrivateLesson[];
  teacherId: string;
  /** `YYYY-MM` */
  month: string;
}): string {
  const dated = input.lessons
    .filter((lesson) => lesson.teacherId === input.teacherId && lesson.status !== "cancelled")
    .map((lesson) => ({ lesson, date: toFinanceDate(lesson.startAt) }))
    .filter(({ date }) => date.startsWith(input.month))
    .sort((left, right) => comparePrivateLessonStartAt(left.lesson.startAt, right.lesson.startAt));

  if (dated.length === 0) {
    return EMPTY_SCHEDULE_MESSAGE;
  }

  const lineGroups: string[][] = [];
  let previousDate = "";

  for (const { lesson, date } of dated) {
    if (date !== previousDate) {
      lineGroups.push([]);
      previousDate = date;
    }

    lineGroups[lineGroups.length - 1].push(formatLessonLine(lesson, date));
  }

  return [
    `[${ACADEMY_MESSAGE_NAME}]`,
    "",
    "안녕하세요, 음악학원입니다",
    `${Number(input.month.slice(5, 7))}월 선생님 스케줄표 입니다`,
    "",
    ...lineGroups.flatMap((lines) => [...lines, ""]),
    "스케줄 변동사항이 있으시면 연락 부탁드립니다!",
  ].join("\n");
}

function formatLessonLine(lesson: PrivateLesson, date: string) {
  const day = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const time = seoulTimeFormatter.format(new Date(lesson.startAt));

  return `${day} ${lesson.studentName} ${time} ${lesson.instrumentName}`;
}

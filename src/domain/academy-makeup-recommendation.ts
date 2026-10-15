/** 결석일 다음 날부터 이 일수 안에서 보강일을 추천한다. */
export const MAKEUP_RECOMMENDATION_WINDOW_DAYS = 14;
export const MAKEUP_RECOMMENDATION_LIMIT = 5;

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;
const MONDAY = 1;
const FRIDAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MakeupDateRecommendation = {
  date: string;
  weekdayLabel: string;
  attendeeCount: number;
  /** 화면에 그대로 보여 주는 문구. 예: `8/14 (금) · 3명` */
  label: string;
};

export type RecommendMakeupDatesInput = {
  /** 결석한 수업의 날짜(YYYY-MM-DD) */
  absentDate: string;
  /** 그 원생의 정규 등원 요일(0=일 ... 6=토). 이 요일은 추천하지 않는다. */
  regularWeekdays: readonly number[];
  /** 날짜별 등원 인원. 목록에 없는 날은 0명으로 본다. */
  attendeeCountByDate: Readonly<Record<string, number>>;
};

/**
 * 보강일 후보를 만든다.
 * 후보: 결석일 다음 날부터 14일 이내 월~금 중 그 원생의 정규 등원 요일이 아닌 날.
 * 정렬: 등원 인원이 적은 순, 같으면 결석일에 가까운 순. 상위 5개만 돌려준다.
 */
export function recommendMakeupDates({
  absentDate,
  regularWeekdays,
  attendeeCountByDate,
}: RecommendMakeupDatesInput): MakeupDateRecommendation[] {
  const absentTime = parseDate(absentDate);
  const candidates: MakeupDateRecommendation[] = [];

  for (let offset = 1; offset <= MAKEUP_RECOMMENDATION_WINDOW_DAYS; offset += 1) {
    const candidate = new Date(absentTime + offset * DAY_MS);
    const weekday = candidate.getUTCDay();
    const isSchoolDay = weekday >= MONDAY && weekday <= FRIDAY;

    if (!isSchoolDay || regularWeekdays.includes(weekday)) {
      continue;
    }

    const date = formatDate(candidate);
    const attendeeCount = attendeeCountByDate[date] ?? 0;

    candidates.push({
      date,
      weekdayLabel: WEEKDAY_LABELS[weekday],
      attendeeCount,
      label: `${formatMakeupDateLabel(date)} · ${attendeeCount}명`,
    });
  }

  // 같은 인원이면 날짜가 이르다 = 결석일에 가깝다. 후보는 이미 날짜순이고 sort는 안정 정렬이다.
  return candidates
    .sort((left, right) => left.attendeeCount - right.attendeeCount)
    .slice(0, MAKEUP_RECOMMENDATION_LIMIT);
}

/** 보강일 추천이 살펴보는 기간이 걸치는 달들. 결석일이 속한 달이 먼저 온다. */
export function findMakeupWindowMonths(absentDate: string): string[] {
  const absentMonth = absentDate.slice(0, 7);
  const lastDate = formatDate(
    new Date(parseDate(absentDate) + MAKEUP_RECOMMENDATION_WINDOW_DAYS * DAY_MS),
  );
  const lastMonth = lastDate.slice(0, 7);

  return lastMonth === absentMonth ? [absentMonth] : [absentMonth, lastMonth];
}

/** 날짜를 `8/14 (금)`처럼 보여 준다. */
export function formatMakeupDateLabel(date: string) {
  const parsed = new Date(parseDate(date));

  return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()} (${WEEKDAY_LABELS[parsed.getUTCDay()]})`;
}

/** 그 원생의 정규 일정(보강·이동·비정기 제외)에서 등원 요일을 모은다. 이미 오름차순이다. */
export function findRegularWeekdays(
  rows: ReadonlyArray<{ studentId: string; date: string; origin?: string }>,
  studentId: string,
): number[] {
  const weekdays = new Set<number>();

  for (const row of rows) {
    const isRegular = row.origin === undefined || row.origin === "regular";

    if (row.studentId === studentId && isRegular) {
      weekdays.add(new Date(parseDate(row.date)).getUTCDay());
    }
  }

  return [...weekdays].sort((left, right) => left - right);
}

function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

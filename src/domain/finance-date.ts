const FINANCE_TIME_ZONE = "Asia/Seoul";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 학원 기준(Asia/Seoul) 오늘 날짜 `YYYY-MM-DD`. */
export function getFinanceToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: FINANCE_TIME_ZONE });
}

/** 학원 기준(Asia/Seoul) 이번 달 `YYYY-MM`. */
export function getFinanceCurrentMonth(): string {
  return getFinanceToday().slice(0, 7);
}

/**
 * 날짜 또는 시각 문자열을 학원 기준(Asia/Seoul) 날짜 `YYYY-MM-DD`로 바꾼다.
 * DB가 UTC(`...Z`)로 돌려줘도 한국 시간 월 경계가 어긋나지 않는다.
 */
export function toFinanceDate(value: string): string {
  if (DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) {
    throw new Error("날짜 형식을 확인해 주세요.");
  }

  return new Date(time).toLocaleDateString("sv-SE", { timeZone: FINANCE_TIME_ZONE });
}

export function toFinanceMonth(value: string): string {
  return toFinanceDate(value).slice(0, 7);
}

/** `YYYY-MM`의 첫날과 마지막 날. */
export function toMonthDateRange(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

const seoulTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: FINANCE_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const seoulDateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: FINANCE_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 시각 문자열 → 학원 기준(Asia/Seoul) `M월 D일 HH:mm`. 처리 기록·변경 이력에 쓴다. */
export function formatSeoulDateTime(value: string) {
  const parts = Object.fromEntries(
    seoulDateTimeFormatter
      .formatToParts(new Date(value))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, part]),
  );

  return `${Number(parts.month)}월 ${Number(parts.day)}일 ${parts.hour}:${parts.minute}`;
}

/** 시각 문자열 → 학원 기준(Asia/Seoul) `HH:mm`. */
export function formatSeoulTime(value: string) {
  return seoulTimeFormatter.format(new Date(value));
}

/** `YYYY-MM-DD`에 날짜를 더한다(달·해 경계 포함). */
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → `M/D`. */
export function formatMonthDay(date: string) {
  const [, month, day] = date.slice(0, 10).split("-");

  return `${Number(month)}/${Number(day)}`;
}

/** `YYYY-MM-DD` → `M월 D일(요)`. */
export function formatKoreanDateLabel(date: string) {
  const [, month, day] = date.split("-").map(Number);

  return `${month}월 ${day}일(${WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()]})`;
}

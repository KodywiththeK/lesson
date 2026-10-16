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

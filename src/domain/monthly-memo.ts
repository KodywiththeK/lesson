export type MonthlyMemoLessonKind = "academy" | "private";

export type MonthlyMemo = {
  academyId: string;
  lessonKind: MonthlyMemoLessonKind;
  month: string;
  content: string;
  unread: boolean;
  updatedAt: string;
};

export type SaveMonthlyMemoInput = {
  academyId: string;
  lessonKind: MonthlyMemoLessonKind;
  month: string;
  content: string;
  updatedAt: string;
};

export type MarkMonthlyMemoReadInput = {
  academyId: string;
  lessonKind: MonthlyMemoLessonKind;
  month: string;
};

export type MonthlyMemoPanelState = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_MONTHLY_MEMO_PANEL_STATE: MonthlyMemoPanelState = {
  x: 24,
  y: 88,
  width: 360,
  height: 300,
};

const MONTHLY_MEMO_PANEL_LIMITS = {
  minWidth: 240,
  minHeight: 160,
  maxWidth: 640,
  maxHeight: 640,
};

export function saveMonthlyMemo(
  memos: MonthlyMemo[],
  input: SaveMonthlyMemoInput,
): MonthlyMemo[] {
  assertMonth(input.month);

  const nextMemo: MonthlyMemo = {
    academyId: input.academyId,
    lessonKind: input.lessonKind,
    month: input.month,
    content: input.content,
    unread: true,
    updatedAt: input.updatedAt,
  };
  const replaced = memos.some((memo) => isSameMonthlyMemo(memo, input));

  if (!replaced) {
    return [...memos, nextMemo];
  }

  return memos.map((memo) => (isSameMonthlyMemo(memo, input) ? nextMemo : memo));
}

export function markMonthlyMemoRead(
  memos: MonthlyMemo[],
  input: MarkMonthlyMemoReadInput,
): MonthlyMemo[] {
  return memos.map((memo) =>
    isSameMonthlyMemo(memo, input) ? { ...memo, unread: false } : memo,
  );
}

/**
 * 사유서 자동 기록처럼 기존 메모 끝에 한 줄을 이어 붙인다.
 * DB 함수 `resolve_academy_lesson_absence`의 이어 붙이기 규칙과 같아야 한다(데모와 실서비스 일치).
 */
export function appendMonthlyMemoLine(content: string, line: string): string {
  return content.trim() === "" ? line : `${content}\n${line}`;
}

export function moveMonthlyMemoPanel(
  state: MonthlyMemoPanelState,
  delta: { dx: number; dy: number },
): MonthlyMemoPanelState {
  return {
    ...state,
    x: Math.max(0, state.x + delta.dx),
    y: Math.max(0, state.y + delta.dy),
  };
}

export function resizeMonthlyMemoPanel(
  state: MonthlyMemoPanelState,
  delta: { dx: number; dy: number },
): MonthlyMemoPanelState {
  return {
    ...state,
    width: clamp(state.width + delta.dx, MONTHLY_MEMO_PANEL_LIMITS.minWidth, MONTHLY_MEMO_PANEL_LIMITS.maxWidth),
    height: clamp(state.height + delta.dy, MONTHLY_MEMO_PANEL_LIMITS.minHeight, MONTHLY_MEMO_PANEL_LIMITS.maxHeight),
  };
}

export function getInitialMonthlyMemoPanelState(
  previousState?: MonthlyMemoPanelState,
): MonthlyMemoPanelState {
  void previousState;

  return { ...DEFAULT_MONTHLY_MEMO_PANEL_STATE };
}

function isSameMonthlyMemo(
  memo: MonthlyMemo,
  input: Pick<MonthlyMemo, "academyId" | "lessonKind" | "month">,
) {
  return (
    memo.academyId === input.academyId &&
    memo.lessonKind === input.lessonKind &&
    memo.month === input.month
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function assertMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("월은 YYYY-MM 형식이어야 합니다.");
  }
}

export type AbsenceResolutionMemoInput = {
  studentName: string;
  resolution: "makeup" | "pass";
  /** 결석한 수업의 날짜(YYYY-MM-DD) */
  absentDate: string;
  /** 보강일(YYYY-MM-DD). 보강일 때 필수 */
  makeupDate?: string;
  /** 보강 시간(HH:mm). 입력하지 않으면 기록하지 않는다 */
  makeupTime?: string;
  reason?: string;
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/**
 * 결석 사유서 완료 시 월별 포스트잇에 자동으로 남기는 한 줄을 만든다.
 * DB 함수 `resolve_academy_lesson_absence`가 만드는 문자열과 같은 형식이어야 한다(데모와 실서비스 일치).
 * 보강: `김동성, 8/14 [금요일] 15:00 보강 - 8/12 [수요일] 사유` (앞=보강일, 뒤=결석일, 시간은 입력한 경우만)
 * 패스: `김동성, 8/12 [수요일] 사유없음` (날짜=결석일)
 */
export function formatAbsenceResolutionMemoLine(input: AbsenceResolutionMemoInput): string {
  const reason = input.reason?.trim() ?? "";
  const absentLabel = formatMemoDate(input.absentDate);

  if (input.resolution === "pass") {
    return `${input.studentName}, ${absentLabel} ${reason === "" ? "사유없음" : reason}`;
  }

  if (!input.makeupDate) {
    throw new Error("보강 날짜는 필수입니다.");
  }

  const makeupLabel = `${formatMemoDate(input.makeupDate)}${input.makeupTime ? ` ${input.makeupTime}` : ""}`;

  return `${input.studentName}, ${makeupLabel} 보강 - ${absentLabel}${reason === "" ? "" : ` ${reason}`}`;
}

function formatMemoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${month}/${day} [${weekday}요일]`;
}

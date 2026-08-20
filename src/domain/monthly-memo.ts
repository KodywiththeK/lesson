export type MonthlyMemo = {
  academyId: string;
  month: string;
  content: string;
  unread: boolean;
  updatedAt: string;
};

export type SaveMonthlyMemoInput = {
  academyId: string;
  month: string;
  content: string;
  updatedAt: string;
};

export type MarkMonthlyMemoReadInput = {
  academyId: string;
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

export function saveMonthlyMemo(
  memos: MonthlyMemo[],
  input: SaveMonthlyMemoInput,
): MonthlyMemo[] {
  assertMonth(input.month);

  const nextMemo: MonthlyMemo = {
    academyId: input.academyId,
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

export function getInitialMonthlyMemoPanelState(
  previousState?: MonthlyMemoPanelState,
): MonthlyMemoPanelState {
  void previousState;

  return { ...DEFAULT_MONTHLY_MEMO_PANEL_STATE };
}

function isSameMonthlyMemo(
  memo: MonthlyMemo,
  input: Pick<MonthlyMemo, "academyId" | "month">,
) {
  return memo.academyId === input.academyId && memo.month === input.month;
}

function assertMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("월은 YYYY-MM 형식이어야 합니다.");
  }
}

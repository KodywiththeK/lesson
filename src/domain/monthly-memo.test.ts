import { describe, expect, it } from "vitest";

import {
  DEFAULT_MONTHLY_MEMO_PANEL_STATE,
  getInitialMonthlyMemoPanelState,
  markMonthlyMemoRead,
  saveMonthlyMemo,
} from "./monthly-memo";

describe("saveMonthlyMemo", () => {
  it("월별 메모는 학원과 월 기준으로 저장하고 다른 학원과 월은 건드리지 않는다", () => {
    const memos = saveMonthlyMemo(
      [
        {
          academyId: "academy-1",
          month: "2026-07",
          content: "7월 메모",
          unread: false,
          updatedAt: "2026-07-31T18:00:00+09:00",
        },
        {
          academyId: "academy-2",
          month: "2026-08",
          content: "다른 학원 메모",
          unread: false,
          updatedAt: "2026-08-01T10:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
        content: "김민지 보강 2026-08-27",
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    );

    expect(memos).toContainEqual({
      academyId: "academy-1",
      month: "2026-08",
      content: "김민지 보강 2026-08-27",
      unread: true,
      updatedAt: "2026-08-20T18:00:00+09:00",
    });
    expect(memos.find((memo) => memo.academyId === "academy-2")).toMatchObject({
      content: "다른 학원 메모",
    });
  });

  it("같은 학원과 월의 메모를 다시 저장하면 내용을 갱신하고 읽지 않음으로 표시한다", () => {
    const memos = saveMonthlyMemo(
      [
        {
          academyId: "academy-1",
          month: "2026-08",
          content: "이전 메모",
          unread: false,
          updatedAt: "2026-08-19T18:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
        content: "수정된 메모",
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    );

    expect(memos).toEqual([
      {
        academyId: "academy-1",
        month: "2026-08",
        content: "수정된 메모",
        unread: true,
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    ]);
  });
});

describe("markMonthlyMemoRead", () => {
  it("월별 메모를 읽으면 읽지 않음 표시를 해제한다", () => {
    const memos = markMonthlyMemoRead(
      [
        {
          academyId: "academy-1",
          month: "2026-08",
          content: "보강 메모",
          unread: true,
          updatedAt: "2026-08-20T18:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(memos[0]).toMatchObject({ unread: false });
  });
});

describe("getInitialMonthlyMemoPanelState", () => {
  it("새로고침 후 월별 메모 패널 위치와 크기는 기본값으로 초기화한다", () => {
    const previousState = {
      x: 320,
      y: 180,
      width: 520,
      height: 420,
    };

    expect(getInitialMonthlyMemoPanelState(previousState)).toEqual(
      DEFAULT_MONTHLY_MEMO_PANEL_STATE,
    );
  });
});

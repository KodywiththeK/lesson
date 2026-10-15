import { describe, expect, it } from "vitest";

import {
  DEFAULT_MONTHLY_MEMO_PANEL_STATE,
  formatAbsenceResolutionMemoLine,
  appendMonthlyMemoLine,
  getInitialMonthlyMemoPanelState,
  moveMonthlyMemoPanel,
  resizeMonthlyMemoPanel,
  markMonthlyMemoRead,
  saveMonthlyMemo,
} from "./monthly-memo";

describe("saveMonthlyMemo", () => {
  it("월별 메모는 학원과 월 기준으로 저장하고 다른 학원과 월은 건드리지 않는다", () => {
    const memos = saveMonthlyMemo(
      [
        {
          academyId: "academy-1",
          lessonKind: "academy",
          month: "2026-07",
          content: "7월 메모",
          unread: false,
          updatedAt: "2026-07-31T18:00:00+09:00",
        },
        {
          academyId: "academy-2",
          lessonKind: "academy",
          month: "2026-08",
          content: "다른 학원 메모",
          unread: false,
          updatedAt: "2026-08-01T10:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
        content: "김민지 보강 2026-08-27",
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    );

    expect(memos).toContainEqual({
      academyId: "academy-1",
      lessonKind: "academy",
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
          lessonKind: "academy",
          month: "2026-08",
          content: "이전 메모",
          unread: false,
          updatedAt: "2026-08-19T18:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
        content: "수정된 메모",
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    );

    expect(memos).toEqual([
      {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
        content: "수정된 메모",
        unread: true,
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    ]);
  });
});

describe("saveMonthlyMemo 레슨 종류", () => {
  it("같은 학원과 월이어도 학원레슨과 개인레슨 메모지는 따로 저장한다", () => {
    const memos = saveMonthlyMemo(
      [
        {
          academyId: "academy-1",
          lessonKind: "academy",
          month: "2026-08",
          content: "학원 메모",
          unread: false,
          updatedAt: "2026-08-19T18:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        lessonKind: "private",
        month: "2026-08",
        content: "개인레슨 메모",
        updatedAt: "2026-08-20T18:00:00+09:00",
      },
    );

    expect(memos).toHaveLength(2);
    expect(memos.find((memo) => memo.lessonKind === "academy")).toMatchObject({
      content: "학원 메모",
      unread: false,
    });
    expect(memos.find((memo) => memo.lessonKind === "private")).toMatchObject({
      content: "개인레슨 메모",
      unread: true,
    });
  });

  it("읽음 처리는 같은 레슨 종류의 메모만 해제한다", () => {
    const memos = markMonthlyMemoRead(
      [
        {
          academyId: "academy-1",
          lessonKind: "academy",
          month: "2026-08",
          content: "학원 메모",
          unread: true,
          updatedAt: "2026-08-19T18:00:00+09:00",
        },
        {
          academyId: "academy-1",
          lessonKind: "private",
          month: "2026-08",
          content: "개인레슨 메모",
          unread: true,
          updatedAt: "2026-08-19T18:00:00+09:00",
        },
      ],
      { academyId: "academy-1", lessonKind: "private", month: "2026-08" },
    );

    expect(memos.map((memo) => memo.unread)).toEqual([true, false]);
  });
});

describe("appendMonthlyMemoLine", () => {
  it("기존 내용이 있으면 줄바꿈 뒤에 이어 붙인다", () => {
    expect(appendMonthlyMemoLine("김동성 학부모님 전화 옴", "이서윤, 8/12 [수요일] 사유없음")).toBe(
      "김동성 학부모님 전화 옴\n이서윤, 8/12 [수요일] 사유없음",
    );
  });

  it("내용이 비어 있으면 줄바꿈 없이 그 줄로 시작한다", () => {
    expect(appendMonthlyMemoLine("  ", "이서윤, 8/12 [수요일] 사유없음")).toBe(
      "이서윤, 8/12 [수요일] 사유없음",
    );
  });
});

describe("markMonthlyMemoRead", () => {
  it("월별 메모를 읽으면 읽지 않음 표시를 해제한다", () => {
    const memos = markMonthlyMemoRead(
      [
        {
          academyId: "academy-1",
          lessonKind: "academy",
          month: "2026-08",
          content: "보강 메모",
          unread: true,
          updatedAt: "2026-08-20T18:00:00+09:00",
        },
      ],
      {
        academyId: "academy-1",
        lessonKind: "academy",
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

describe("메모지 이동과 크기 조절", () => {
  const panel = { x: 100, y: 100, width: 360, height: 300 };

  it("이동은 화면 왼쪽과 위쪽 밖으로 나가지 않는다", () => {
    expect(moveMonthlyMemoPanel(panel, { dx: 40, dy: -30 })).toEqual({
      ...panel,
      x: 140,
      y: 70,
    });
    expect(moveMonthlyMemoPanel(panel, { dx: -500, dy: -500 })).toEqual({
      ...panel,
      x: 0,
      y: 0,
    });
  });

  it("크기 조절은 최소와 최대 크기 안으로 보정한다", () => {
    expect(resizeMonthlyMemoPanel(panel, { dx: 40, dy: 20 })).toEqual({
      ...panel,
      width: 400,
      height: 320,
    });
    expect(resizeMonthlyMemoPanel(panel, { dx: -1000, dy: -1000 })).toMatchObject({
      width: 240,
      height: 160,
    });
    expect(resizeMonthlyMemoPanel(panel, { dx: 1000, dy: 1000 })).toMatchObject({
      width: 640,
      height: 640,
    });
  });
});

describe("formatAbsenceResolutionMemoLine", () => {
  it("보강은 `원생명, 보강일 [요일] 시간 보강 - 결석일 [요일] 사유` 형식이다", () => {
    expect(
      formatAbsenceResolutionMemoLine({
        studentName: "김동성",
        resolution: "makeup",
        absentDate: "2026-08-12",
        makeupDate: "2026-08-14",
        makeupTime: "15:00",
        reason: "가족 여행으로 인한 보충",
      }),
    ).toBe("김동성, 8/14 [금요일] 15:00 보강 - 8/12 [수요일] 가족 여행으로 인한 보충");
  });

  it("보강 시간을 입력하지 않으면 시간을 쓰지 않고, 사유가 없으면 사유 부분을 비운다", () => {
    expect(
      formatAbsenceResolutionMemoLine({
        studentName: "김동성",
        resolution: "makeup",
        absentDate: "2026-08-12",
        makeupDate: "2026-08-14",
      }),
    ).toBe("김동성, 8/14 [금요일] 보강 - 8/12 [수요일]");
  });

  it("패스는 결석일과 사유를 쓰고 사유가 없으면 '사유없음'으로 기록한다", () => {
    expect(
      formatAbsenceResolutionMemoLine({
        studentName: "김동성",
        resolution: "pass",
        absentDate: "2026-08-12",
      }),
    ).toBe("김동성, 8/12 [수요일] 사유없음");
    expect(
      formatAbsenceResolutionMemoLine({
        studentName: "김동성",
        resolution: "pass",
        absentDate: "2026-08-12",
        reason: "  감기  ",
      }),
    ).toBe("김동성, 8/12 [수요일] 감기");
  });

  it("보강인데 보강일이 없으면 잘못된 입력으로 거부한다", () => {
    expect(() =>
      formatAbsenceResolutionMemoLine({
        studentName: "김동성",
        resolution: "makeup",
        absentDate: "2026-08-12",
      }),
    ).toThrow("보강 날짜");
  });
});

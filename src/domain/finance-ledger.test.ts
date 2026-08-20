import { describe, expect, it } from "vitest";

import {
  buildIncomeExpenseGraph,
  createManualLedgerEntry,
} from "./finance-ledger";

describe("createManualLedgerEntry", () => {
  it("권한 있는 사용자는 수동 수입 또는 지출을 입력할 수 있다", () => {
    const entry = createManualLedgerEntry(
      {
        academyId: "academy-1",
        ledgerId: "manual-1",
        occurredOn: "2026-08-21",
        type: "expense",
        amount: 30000,
        description: "조율비",
        createdBy: "user-owner",
      },
      {
        canCreateManualLedger: true,
      },
    );

    expect(entry).toEqual({
      academyId: "academy-1",
      ledgerId: "manual-1",
      occurredOn: "2026-08-21",
      type: "expense",
      source: "manual",
      amount: 30000,
      description: "조율비",
      refId: "manual-1",
      createdBy: "user-owner",
    });
  });

  it("권한이 없거나 금액이 0 이하이면 수동 입력을 막는다", () => {
    expect(() =>
      createManualLedgerEntry(
        {
          academyId: "academy-1",
          ledgerId: "manual-1",
          occurredOn: "2026-08-21",
          type: "income",
          amount: 10000,
          description: "대관료",
          createdBy: "teacher-1",
        },
        {
          canCreateManualLedger: false,
        },
      ),
    ).toThrow("수동 입출입 입력 권한이 없습니다.");

    expect(() =>
      createManualLedgerEntry(
        {
          academyId: "academy-1",
          ledgerId: "manual-1",
          occurredOn: "2026-08-21",
          type: "income",
          amount: 0,
          description: "대관료",
          createdBy: "user-owner",
        },
        {
          canCreateManualLedger: true,
        },
      ),
    ).toThrow("금액은 1 이상의 정수여야 합니다.");
  });
});

describe("buildIncomeExpenseGraph", () => {
  it("연도/월 기준 전체 악기, 개별 악기, 학원 수입, 지출 비교 데이터를 만든다", () => {
    const graph = buildIncomeExpenseGraph(
      [
        {
          academyId: "academy-1",
          ledgerId: "tuition-1",
          occurredOn: "2026-08-03",
          type: "income",
          source: "tuition",
          amount: 120000,
          description: "피아노 수강료",
          refId: "tuition-1",
          instrumentId: "piano",
          instrumentName: "피아노",
        },
        {
          academyId: "academy-1",
          ledgerId: "tuition-2",
          occurredOn: "2026-08-04",
          type: "income",
          source: "tuition",
          amount: 150000,
          description: "바이올린 수강료",
          refId: "tuition-2",
          instrumentId: "violin",
          instrumentName: "바이올린",
        },
        {
          academyId: "academy-1",
          ledgerId: "manual-income-1",
          occurredOn: "2026-08-05",
          type: "income",
          source: "manual",
          amount: 50000,
          description: "연습실 대관",
          refId: "manual-income-1",
        },
        {
          academyId: "academy-1",
          ledgerId: "expense-1",
          occurredOn: "2026-08-10",
          type: "expense",
          source: "manual",
          amount: 30000,
          description: "조율비",
          refId: "expense-1",
        },
        {
          academyId: "academy-2",
          ledgerId: "other-1",
          occurredOn: "2026-08-03",
          type: "income",
          source: "tuition",
          amount: 999999,
          description: "다른 학원",
          refId: "other-1",
        },
      ],
      {
        academyId: "academy-1",
        year: 2026,
      },
    );

    expect(graph.months).toContainEqual({
      month: "2026-08",
      totalInstrumentIncome: 270000,
      instrumentBreakdown: [
        { instrumentId: "violin", instrumentName: "바이올린", amount: 150000 },
        { instrumentId: "piano", instrumentName: "피아노", amount: 120000 },
      ],
      academyIncome: 50000,
      expense: 30000,
      netIncome: 290000,
    });
  });
});

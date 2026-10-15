import { describe, expect, it } from "vitest";

import {
  buildFinanceCalendarDays,
  buildFinanceLedgerList,
  buildIncomeExpenseGraph,
  createManualLedgerEntry,
  exportFinanceLedgerCsv,
  formatLedgerEntrySource,
  formatLedgerEntryType,
  ledgerCategoryOptions,
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
      category: "other",
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

describe("finance ledger filters and export", () => {
  const entries = [
    {
      academyId: "academy-1",
      ledgerId: "ledger-1",
      occurredOn: "2026-08-06",
      type: "income" as const,
      source: "tuition" as const,
      category: "tuition" as const,
      amount: 140000,
      description: "김민지 8월 피아노 수강료",
      refId: "tuition-1",
    },
    {
      academyId: "academy-1",
      ledgerId: "ledger-2",
      occurredOn: "2026-08-20",
      type: "expense" as const,
      source: "manual" as const,
      category: "tuning-repair" as const,
      amount: 70000,
      description: "피아노 조율비",
      refId: "manual-1",
    },
  ];

  it("기간, 고정 분류, 금액 정렬 기준으로 입출금 내역을 만든다", () => {
    expect(ledgerCategoryOptions.map((category) => category.label)).toEqual([
      "수강료",
      "회차권",
      "교재판매",
      "급여",
      "교재발주",
      "임대료",
      "관리비",
      "조율/수리",
      "소모품",
      "세금",
      "기타",
    ]);

    const result = buildFinanceLedgerList(entries, {
      academyId: "academy-1",
      dateRange: {
        from: "2026-08-01",
        to: "2026-08-31",
      },
      filters: {
        category: "tuning-repair",
      },
      sort: {
        field: "amount",
        direction: "desc",
      },
    });

    expect(result.map((entry) => entry.ledgerId)).toEqual(["ledger-2"]);
  });

  it("월 캘린더 일자별 수입/지출 합계를 계산한다", () => {
    const calendarDays = buildFinanceCalendarDays(entries, {
      academyId: "academy-1",
      month: "2026-08",
    });

    expect(calendarDays.find((day) => day.date === "2026-08-06")).toMatchObject({
      income: 140000,
      expense: 0,
      netIncome: 140000,
      entries: [entries[0]],
    });
    expect(calendarDays.find((day) => day.date === "2026-08-20")).toMatchObject({
      income: 0,
      expense: 70000,
      netIncome: -70000,
      entries: [entries[1]],
    });
  });

  it("현재 필터 결과를 엑셀에서 열 수 있는 CSV로 내보낸다", () => {
    const csv = exportFinanceLedgerCsv(entries);

    expect(csv).toContain(
      "발생일,유형,출처,분류,금액,설명,참조 ID",
    );
    expect(csv).toContain(
      "2026-08-06,수입,수강료,수강료,140000,김민지 8월 피아노 수강료,tuition-1",
    );
  });
});

describe("buildFinanceLedgerList", () => {
  it("현재 학원의 수입/지출 내역을 최신순으로 보여주고 검색과 유형 필터를 적용한다", () => {
    const list = buildFinanceLedgerList(
      [
        {
          academyId: "academy-1",
          ledgerId: "ledger-1",
          occurredOn: "2026-08-20",
          type: "income",
          source: "book-sale",
          category: "book-sale",
          amount: 12000,
          description: "교재 판매: 바이엘 2 / 김민지",
          refId: "sale-1",
        },
        {
          academyId: "academy-1",
          ledgerId: "ledger-2",
          occurredOn: "2026-08-21",
          type: "expense",
          source: "manual",
          category: "tuning-repair",
          amount: 30000,
          description: "조율비",
          refId: "manual-1",
        },
        {
          academyId: "academy-2",
          ledgerId: "ledger-3",
          occurredOn: "2026-08-21",
          type: "income",
          source: "tuition",
          category: "tuition",
          amount: 999999,
          description: "다른 학원 수강료",
          refId: "tuition-1",
        },
      ],
      {
        academyId: "academy-1",
        search: "조율",
        filters: {
          type: "expense",
        },
      },
    );

    expect(list).toEqual([
      {
        academyId: "academy-1",
        ledgerId: "ledger-2",
        occurredOn: "2026-08-21",
        type: "expense",
        source: "manual",
        category: "tuning-repair",
        amount: 30000,
        description: "조율비",
        refId: "manual-1",
      },
    ]);
  });

  it("입출입 유형과 출처를 운영자가 읽는 한국어로 표시한다", () => {
    expect(formatLedgerEntryType("income")).toBe("수입");
    expect(formatLedgerEntryType("expense")).toBe("지출");
    expect(formatLedgerEntrySource("tuition")).toBe("수강료");
    expect(formatLedgerEntrySource("book-sale")).toBe("교재");
    expect(formatLedgerEntrySource("payroll")).toBe("급여");
    expect(formatLedgerEntrySource("manual")).toBe("수동");
  });
});

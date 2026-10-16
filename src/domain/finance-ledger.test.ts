import { describe, expect, it } from "vitest";

import type { LedgerEntry } from "./book-sale";
import {
  buildFinanceCalendarDays,
  buildFinanceLedgerList,
  buildFinanceLedgerPage,
  buildFinanceLedgerCsvFileName,
  buildIncomeExpenseGraph,
  buildLedgerMonthTotals,
  escapeCsvCell,
  exportFinanceLedgerCsv,
  formatLedgerEntrySource,
  formatLedgerEntryType,
  getLedgerCategoryOptions,
  getLedgerDraftBlockReason,
  isLedgerCategoryAllowed,
  ledgerCategoryOptions,
  LEDGER_AMOUNT_LIMIT,
  toDefaultLedgerCategoryForType,
} from "./finance-ledger";

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

    // 내부 식별자(참조 ID)는 사용자가 열어 보는 파일에 넣지 않는다.
    expect(csv).toContain("발생일,유형,출처,분류,금액,설명");
    expect(csv).not.toContain("참조 ID");
    expect(csv).toContain("2026-08-06,수입,수강료,수강료,140000,김민지 8월 피아노 수강료");
    expect(csv).not.toContain("tuition-1");
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

describe("buildFinanceLedgerList 정렬 안정성", () => {
  const baseEntry: LedgerEntry = {
    academyId: "academy-1",
    ledgerId: "ledger-a",
    occurredOn: "2026-08-20",
    type: "expense",
    source: "manual",
    category: "other",
    amount: 30000,
    description: "조율비",
    refId: "manual-a",
  };
  const sameEverythingExceptId = ["ledger-c", "ledger-a", "ledger-b"].map(
    (ledgerId) => ({ ...baseEntry, ledgerId, refId: ledgerId }),
  );

  it("날짜와 설명이 같아도 ledgerId로 순서를 고정해 새로 조회해도 페이지 경계가 흔들리지 않는다", () => {
    const options = { academyId: "academy-1" };

    expect(
      buildFinanceLedgerList(sameEverythingExceptId, options).map((entry) => entry.ledgerId),
    ).toEqual(["ledger-a", "ledger-b", "ledger-c"]);
    expect(
      buildFinanceLedgerList([...sameEverythingExceptId].reverse(), options).map(
        (entry) => entry.ledgerId,
      ),
    ).toEqual(["ledger-a", "ledger-b", "ledger-c"]);
  });

  it("금액이 같으면 최신 날짜 순으로, 그래도 같으면 ledgerId로 순서를 고정한다", () => {
    const entries: LedgerEntry[] = [
      { ...baseEntry, ledgerId: "ledger-old", occurredOn: "2026-08-01", description: "가" },
      { ...baseEntry, ledgerId: "ledger-new-b", occurredOn: "2026-08-20", description: "다" },
      { ...baseEntry, ledgerId: "ledger-new-a", occurredOn: "2026-08-20", description: "나" },
    ];

    expect(
      buildFinanceLedgerList(entries, {
        academyId: "academy-1",
        sort: { field: "amount", direction: "desc" },
      }).map((entry) => entry.ledgerId),
    ).toEqual(["ledger-new-a", "ledger-new-b", "ledger-old"]);
  });
});

describe("buildFinanceLedgerPage", () => {
  const entries: LedgerEntry[] = Array.from({ length: 25 }, (_, index) => ({
    academyId: "academy-1",
    ledgerId: `ledger-${index + 1}`,
    occurredOn: "2026-08-20",
    type: "income",
    source: "manual",
    category: "other",
    amount: (index + 1) * 1000,
    description: `내역 ${index + 1}`,
    refId: `manual-${index + 1}`,
  }));

  it("받은 순서를 그대로 두고 10건씩 잘라 총 건수와 이동 가능 여부를 알려준다", () => {
    const firstPage = buildFinanceLedgerPage(entries, { page: 1, pageSize: 10 });

    expect(firstPage.items.map((entry) => entry.ledgerId)).toEqual(
      entries.slice(0, 10).map((entry) => entry.ledgerId),
    );
    expect(firstPage).toMatchObject({
      page: 1,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });

  it("마지막 페이지는 남은 건수만 보여주고 다음 페이지가 없다", () => {
    const lastPage = buildFinanceLedgerPage(entries, { page: 3, pageSize: 10 });

    expect(lastPage.items).toHaveLength(5);
    expect(lastPage).toMatchObject({ page: 3, hasPreviousPage: true, hasNextPage: false });
  });

  it("20건이나 30건씩 볼 수 있고 지원하지 않는 크기는 10건으로 본다", () => {
    expect(buildFinanceLedgerPage(entries, { page: 1, pageSize: 20 }).items).toHaveLength(20);
    expect(buildFinanceLedgerPage(entries, { page: 1, pageSize: 30 }).items).toHaveLength(25);
    expect(buildFinanceLedgerPage(entries, { page: 1, pageSize: 7 })).toMatchObject({
      pageSize: 10,
      totalPages: 3,
    });
  });

  it("범위를 벗어난 페이지는 가장 가까운 페이지로 맞추고 빈 목록도 1페이지로 본다", () => {
    expect(buildFinanceLedgerPage(entries, { page: 99, pageSize: 10 }).page).toBe(3);
    expect(buildFinanceLedgerPage(entries, { page: 0, pageSize: 10 }).page).toBe(1);
    expect(buildFinanceLedgerPage([], { page: 4, pageSize: 10 })).toMatchObject({
      items: [],
      page: 1,
      totalItems: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });
});

describe("buildLedgerMonthTotals", () => {
  const base: LedgerEntry = {
    academyId: "academy-1",
    ledgerId: "ledger-1",
    occurredOn: "2026-08-10",
    type: "income",
    source: "manual",
    category: "other",
    amount: 100000,
    description: "추가 수강료",
    refId: "manual-1",
  };

  it("선택한 월의 입금과 출금을 각각 합산하고 다른 달은 제외한다", () => {
    const entries: LedgerEntry[] = [
      base,
      { ...base, ledgerId: "ledger-2", occurredOn: "2026-08-31", amount: 50000 },
      { ...base, ledgerId: "ledger-3", type: "expense", amount: 30000 },
      { ...base, ledgerId: "ledger-4", type: "expense", occurredOn: "2026-08-01", amount: 20000 },
      { ...base, ledgerId: "ledger-5", occurredOn: "2026-07-31", amount: 999999 },
      { ...base, ledgerId: "ledger-6", type: "expense", occurredOn: "2026-09-01", amount: 888888 },
    ];

    expect(buildLedgerMonthTotals(entries, "2026-08")).toEqual({ income: 150000, expense: 50000 });
  });

  it("내역이 없으면 0원으로 계산한다", () => {
    expect(buildLedgerMonthTotals([], "2026-08")).toEqual({ income: 0, expense: 0 });
  });
});

describe("입출금 분류 후보", () => {
  it("수입이면 수입 분류만, 지출이면 지출 분류만 보여 준다", () => {
    expect(getLedgerCategoryOptions("income").map((option) => option.value)).toEqual([
      "tuition",
      "lesson-ticket",
      "book-sale",
      "other",
    ]);
    expect(getLedgerCategoryOptions("expense").map((option) => option.value)).toEqual([
      "payroll",
      "book-order",
      "rent",
      "utilities",
      "tuning-repair",
      "supplies",
      "tax",
      "other",
    ]);
  });

  it("유형을 바꾸면 그 유형의 기본 분류는 기타다", () => {
    expect(toDefaultLedgerCategoryForType("income")).toBe("other");
    expect(toDefaultLedgerCategoryForType("expense")).toBe("other");
  });

  it("수입+임대료 같은 모순 조합을 허용하지 않는다", () => {
    expect(isLedgerCategoryAllowed("income", "rent")).toBe(false);
    expect(isLedgerCategoryAllowed("expense", "tuition")).toBe(false);
    expect(isLedgerCategoryAllowed("expense", "rent")).toBe(true);
    expect(isLedgerCategoryAllowed("income", "other")).toBe(true);
  });

  it("이미 저장된 분류가 후보에 없어도 수정 화면에서 보이도록 현재 분류를 후보에 더한다", () => {
    expect(
      getLedgerCategoryOptions("income", "rent").map((option) => option.value),
    ).toEqual(["tuition", "lesson-ticket", "book-sale", "other", "rent"]);
  });
});

describe("getLedgerDraftBlockReason", () => {
  const valid = { occurredOn: "2026-08-14", amountText: "70000", description: "조율비" };

  it("모두 채워지면 막을 이유가 없다", () => {
    expect(getLedgerDraftBlockReason(valid)).toBeNull();
  });

  it("비어 있거나 잘못된 입력은 다음 행동을 알려 준다", () => {
    expect(getLedgerDraftBlockReason({ ...valid, occurredOn: "" })).toBe("날짜를 입력해 주세요.");
    expect(getLedgerDraftBlockReason({ ...valid, amountText: "" })).toBe("금액을 입력해 주세요.");
    expect(getLedgerDraftBlockReason({ ...valid, amountText: "0" })).toBe(
      "금액은 1원 이상의 정수로 입력해 주세요.",
    );
    expect(getLedgerDraftBlockReason({ ...valid, amountText: "1.5" })).toBe(
      "금액은 1원 이상의 정수로 입력해 주세요.",
    );
    expect(getLedgerDraftBlockReason({ ...valid, description: "  " })).toBe("설명을 입력해 주세요.");
  });

  it("20억 원 미만만 허용한다", () => {
    expect(LEDGER_AMOUNT_LIMIT).toBe(2_000_000_000);
    expect(getLedgerDraftBlockReason({ ...valid, amountText: "1999999999" })).toBeNull();
    expect(getLedgerDraftBlockReason({ ...valid, amountText: "2000000000" })).toBe(
      "금액은 20억 원 미만으로 입력해 주세요.",
    );
  });
});

describe("CSV 내보내기 안전장치", () => {
  it("수식으로 읽힐 수 있는 =, +, -, @ 시작 값 앞에 작은따옴표를 붙인다", () => {
    expect(escapeCsvCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell("+82 10")).toBe("'+82 10");
    expect(escapeCsvCell("-1")).toBe("'-1");
    expect(escapeCsvCell("@cmd")).toBe("'@cmd");
  });

  it("일반 값은 그대로 두고 쉼표나 따옴표가 있으면 감싼다", () => {
    expect(escapeCsvCell("조율비")).toBe("조율비");
    expect(escapeCsvCell("가, 나")).toBe('"가, 나"');
    expect(escapeCsvCell('"인용"')).toBe('"""인용"""');
    expect(escapeCsvCell("=1,2")).toBe('"\'=1,2"');
  });

  it("내보내기 행에도 수식 방어를 적용한다", () => {
    const csv = exportFinanceLedgerCsv([
      {
        academyId: "academy-1",
        ledgerId: "ledger-1",
        occurredOn: "2026-08-14",
        type: "expense",
        source: "manual",
        category: "other",
        amount: 1000,
        description: "=HYPERLINK(\"x\")",
        refId: "manual-1",
      },
    ]);

    expect(csv).toContain("'=HYPERLINK");
  });

  it("파일명에 조회 기간을 넣는다", () => {
    expect(buildFinanceLedgerCsvFileName({ from: "2026-08-01", to: "2026-08-31" })).toBe(
      "입출입내역_2026-08-01_2026-08-31.csv",
    );
  });
});

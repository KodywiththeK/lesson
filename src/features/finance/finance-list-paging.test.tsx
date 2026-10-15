import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BookSale, LedgerEntry } from "@/domain/book-sale";
import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import type { TeacherListRow } from "@/domain/teacher-list";
import type { TuitionRecord } from "@/domain/tuition-income";

import {
  FinanceBooksScreen,
  FinanceLedgerListScreen,
  FinanceLessonIncomeScreen,
  FinancePayrollScreen,
  type FinanceLedgerListQueryOptionsFactory,
  type FinanceManagementData,
} from "./finance-ledger-list-screen";

/** 가나다순으로 이미 정렬된 이름 12개. 10건 단위 페이지가 2페이지로 나뉘는 최소 규모다. */
const SORTED_NAMES = [
  "강하늘",
  "김민지",
  "나은서",
  "박지후",
  "서윤아",
  "안도윤",
  "유채원",
  "이서준",
  "장하은",
  "정우진",
  "최서연",
  "한서아",
];
const FIRST_PAGE_NAMES = SORTED_NAMES.slice(0, 10);
const SECOND_PAGE_NAMES = SORTED_NAMES.slice(10);

const emptyFinanceData: FinanceManagementData = {
  ledgerEntries: [],
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [],
};

beforeEach(() => vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00")));
afterEach(() => vi.useRealTimers());

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
  );
}

function columnTexts(table: HTMLElement, columnIndex: number) {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[columnIndex]?.textContent ?? "");
}

function expectCurrentPage(page: number) {
  expect(screen.getByRole("button", { name: `${page}페이지` })).toHaveAttribute(
    "aria-current",
    "page",
  );
}

describe("입출금 내역 목록 나누기", () => {
  function buildLedgerEntries(
    month: string,
    count: number,
    overrides: (day: number) => Partial<LedgerEntry> = () => ({}),
  ): LedgerEntry[] {
    return Array.from({ length: count }, (_, index) => {
      const day = index + 1;

      return {
        academyId: "academy-1",
        ledgerId: `ledger-${month}-${day}`,
        occurredOn: `${month}-${String(day).padStart(2, "0")}`,
        type: "income",
        source: "manual",
        category: "other",
        amount: day * 1000,
        description: `내역 ${String(day).padStart(2, "0")}`,
        refId: `manual-${month}-${day}`,
        ...overrides(day),
      };
    });
  }

  function renderLedger(entries: LedgerEntry[]) {
    const queryOptionsFactory: FinanceLedgerListQueryOptionsFactory = (options) => ({
      queryKey: [
        "ledger-paging",
        options.academyId,
        options.search ?? "",
        options.filters?.type ?? "",
        options.filters?.source ?? "",
        options.filters?.category ?? "",
        options.dateRange?.from ?? "",
        options.dateRange?.to ?? "",
        options.sort?.field ?? "",
        options.sort?.direction ?? "",
      ],
      queryFn: async () => buildFinanceLedgerList(entries, options),
    });

    return renderWithQueryClient(
      <FinanceLedgerListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={queryOptionsFactory}
      />,
    );
  }

  async function goToThirdPage(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByRole("table", { name: "입출금 내역" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    expectCurrentPage(3);
  }

  it("총 건수를 보여주고 날짜 최신순을 유지한 채 10건씩 다음 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    renderLedger(buildLedgerEntries("2026-08", 25));

    const table = await screen.findByRole("table", { name: "입출금 내역" });
    expect(screen.getByText("총 25건")).toBeInTheDocument();
    expect(columnTexts(table, 5)).toEqual(
      Array.from({ length: 10 }, (_, index) => `내역 ${25 - index}`),
    );

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expectCurrentPage(2);
    expect(columnTexts(screen.getByRole("table", { name: "입출금 내역" }), 5)).toEqual(
      Array.from({ length: 10 }, (_, index) => `내역 ${String(15 - index).padStart(2, "0")}`),
    );
  });

  it("페이지당 20건을 고르면 1페이지로 돌아가 20건을 보여준다", async () => {
    const user = userEvent.setup();
    renderLedger(buildLedgerEntries("2026-08", 25));

    await goToThirdPage(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "페이지당 입출금 내역 수" }),
      "20",
    );

    expectCurrentPage(1);
    expect(
      columnTexts(screen.getByRole("table", { name: "입출금 내역" }), 5),
    ).toHaveLength(20);
  });

  it("검색하면 1페이지로 돌아가 검색 결과 건수를 보여준다", async () => {
    const user = userEvent.setup();
    renderLedger(
      buildLedgerEntries("2026-08", 25, (day) => ({
        type: day % 2 === 1 ? "expense" : "income",
      })),
    );

    await goToThirdPage(user);
    await user.type(screen.getByRole("searchbox", { name: "입출금 내역 검색" }), "지출");

    expect(await screen.findByText("총 13건")).toBeInTheDocument();
    expectCurrentPage(1);
    expect(
      columnTexts(screen.getByRole("table", { name: "입출금 내역" }), 5),
    ).toHaveLength(10);
  });

  it("월을 바꾸면 1페이지로 돌아가 그 달의 건수를 보여준다", async () => {
    const user = userEvent.setup();
    renderLedger([
      ...buildLedgerEntries("2026-08", 25),
      ...buildLedgerEntries("2026-07", 12),
    ]);

    await goToThirdPage(user);
    fireEvent.change(screen.getByLabelText("입출금 월 선택"), {
      target: { value: "2026-07" },
    });

    expect(await screen.findByText("총 12건")).toBeInTheDocument();
    expectCurrentPage(1);
  });

  it.each([
    {
      name: "유형 필터",
      change: () =>
        fireEvent.change(screen.getByLabelText("유형 필터"), { target: { value: "income" } }),
    },
    {
      name: "출처 필터",
      change: () =>
        fireEvent.change(screen.getByLabelText("출처 필터"), { target: { value: "manual" } }),
    },
    {
      name: "분류 필터",
      change: () =>
        fireEvent.change(screen.getByLabelText("분류 필터"), { target: { value: "other" } }),
    },
    {
      name: "정렬",
      change: () =>
        fireEvent.change(screen.getByLabelText("입출금 정렬"), {
          target: { value: "occurredOn-asc" },
        }),
    },
    {
      name: "시작일",
      change: () =>
        fireEvent.change(screen.getByLabelText("입출금 시작일"), {
          target: { value: "2026-07-31" },
        }),
    },
    {
      name: "종료일",
      change: () =>
        fireEvent.change(screen.getByLabelText("입출금 종료일"), {
          target: { value: "2026-09-01" },
        }),
    },
    {
      name: "초기화 버튼",
      change: () => fireEvent.click(screen.getByRole("button", { name: "초기화" })),
    },
  ])("$name을 바꾸면 결과가 같아도 1페이지로 돌아간다", async ({ change }) => {
    const user = userEvent.setup();
    renderLedger(buildLedgerEntries("2026-08", 25));

    await goToThirdPage(user);
    change();

    expect(await screen.findByText("총 25건")).toBeInTheDocument();
    expectCurrentPage(1);
  });

  it("캘린더는 목록 페이지와 상관없이 그 달 전체 입출금을 보여준다", async () => {
    const user = userEvent.setup();
    renderLedger(buildLedgerEntries("2026-08", 25));

    await screen.findByRole("table", { name: "입출금 내역" });
    expect(screen.queryByText("내역 01")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "캘린더" }));

    const calendar = screen.getByRole("grid", { name: "2026년 8월 입출금 캘린더" });
    expect(within(calendar).getByText("+1,000원")).toBeInTheDocument();
    expect(within(calendar).getByText("+25,000원")).toBeInTheDocument();
  });

  it("CSV 내보내기는 현재 페이지가 아니라 필터 결과 전체를 담는다", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:ledger-csv";
    });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    try {
      renderLedger(buildLedgerEntries("2026-08", 25));
      await screen.findByRole("table", { name: "입출금 내역" });
      await user.click(screen.getByRole("button", { name: "CSV 내보내기" }));

      const csvText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(createObjectURL.mock.calls[0][0]);
      });
      expect(csvText.split("\n")).toHaveLength(26);
      expect(csvText).toContain("내역 01");
    } finally {
      anchorClick.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });
});

describe("학원 레슨수입 목록 나누기", () => {
  function buildTuition(
    name: string,
    index: number,
    month: string,
    overrides: Partial<TuitionRecord> = {},
  ): TuitionRecord {
    return {
      academyId: "academy-1",
      tuitionId: `snapshot-${month}-${index}`,
      month,
      studentId: `student-${index}`,
      studentName: name,
      enrollmentId: `enrollment-${index}`,
      instrumentId: "piano",
      instrumentName: "피아노",
      progress: "체르니 100",
      lessonFee: 160000,
      discountTotal: 10000,
      amount: 150000,
      dueOn: `${month}-06`,
      status: "unpaid",
      ...overrides,
    };
  }

  function renderLessonIncome(snapshotsByMonth: (month: string) => TuitionRecord[]) {
    return renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={emptyFinanceData}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition-paging", month],
          queryFn: async () => snapshotsByMonth(month),
        })}
      />,
    );
  }

  /** 원본 순서를 거꾸로 줘서 화면이 가나다순으로 직접 정렬하는지 확인한다. */
  function twelveTuitions(month: string) {
    return [...SORTED_NAMES]
      .reverse()
      .map((name, index) => buildTuition(name, index, month));
  }

  async function renderLoadedLessonIncome() {
    renderLessonIncome(twelveTuitions);
    await screen.findByText("총 12건");

    return screen.getByRole("table", { name: "학원 레슨수입" });
  }

  it("총 건수를 보여주고 원생 이름 가나다순으로 10건씩 나눠 다음 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    const table = await renderLoadedLessonIncome();

    expect(columnTexts(table, 0)).toEqual(FIRST_PAGE_NAMES);

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(columnTexts(screen.getByRole("table", { name: "학원 레슨수입" }), 0)).toEqual(
      SECOND_PAGE_NAMES,
    );
    expectCurrentPage(2);
  });

  it("같은 원생은 악기 이름 순서로 보여준다", async () => {
    renderLessonIncome((month) => [
      buildTuition("한서아", 1, month),
      buildTuition("김민지", 2, month, {
        instrumentId: "cello",
        instrumentName: "첼로",
      }),
      buildTuition("김민지", 3, month, {
        instrumentId: "violin",
        instrumentName: "바이올린",
      }),
    ]);
    await screen.findByText("총 3건");

    const table = screen.getByRole("table", { name: "학원 레슨수입" });
    expect(columnTexts(table, 0)).toEqual(["김민지", "김민지", "한서아"]);
    expect(columnTexts(table, 2)).toEqual(["바이올린", "첼로", "피아노"]);
  });

  it("페이지당 20건을 고르면 1페이지로 돌아가 12건을 모두 보여준다", async () => {
    const user = userEvent.setup();
    await renderLoadedLessonIncome();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "페이지당 레슨수입 수" }),
      "20",
    );

    expectCurrentPage(1);
    expect(columnTexts(screen.getByRole("table", { name: "학원 레슨수입" }), 0)).toEqual(
      SORTED_NAMES,
    );
  });

  it("원생명이나 악기로 검색하면 1페이지로 돌아가고 월 전체 합계는 그대로 둔다", async () => {
    const user = userEvent.setup();
    await renderLoadedLessonIncome();
    expect(screen.getByText("1,800,000원")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await user.type(screen.getByRole("searchbox", { name: "레슨수입 검색" }), "피아노");

    expectCurrentPage(1);
    expect(screen.getByText("총 12건")).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "레슨수입 검색" }));
    await user.type(screen.getByRole("searchbox", { name: "레슨수입 검색" }), "한서아");

    expect(screen.getByText("총 1건")).toBeInTheDocument();
    expect(columnTexts(screen.getByRole("table", { name: "학원 레슨수입" }), 0)).toEqual([
      "한서아",
    ]);
    expect(screen.getByText("1,800,000원")).toBeInTheDocument();
  });

  it("검색 결과가 없으면 안내 문구와 총 0건을 보여준다", async () => {
    const user = userEvent.setup();
    await renderLoadedLessonIncome();

    await user.type(screen.getByRole("searchbox", { name: "레슨수입 검색" }), "없는 이름");

    expect(screen.getByText("조건에 맞는 레슨수입이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0건")).toBeInTheDocument();
  });

  it("월을 바꾸면 1페이지로 돌아가 그 달의 건수를 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonIncome((month) =>
      month === "2026-08"
        ? twelveTuitions(month)
        : twelveTuitions(month).slice(0, 11),
    );
    await screen.findByText("총 12건");

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    fireEvent.change(screen.getByLabelText("월별 전체 레슨수입 월 선택"), {
      target: { value: "2026-07" },
    });

    expect(await screen.findByText("총 11건")).toBeInTheDocument();
    expectCurrentPage(1);
  });

  it("월별 수강료를 불러오는 중에는 총 건수 대신 불러오는 중 안내만 보여준다", () => {
    renderLessonIncome(() => []);

    expect(screen.getByText("월별 수강료를 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByText("총 0건")).not.toBeInTheDocument();
  });

  it("월별 수강료를 불러오지 못하면 사용자 문구만 보여준다", async () => {
    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={emptyFinanceData}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition-paging", month, "failed"],
          queryFn: async () => {
            throw new Error("permission denied for table fixed_income_snapshots");
          },
        })}
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("월별 수강료를 불러오지 못했습니다.");
    expect(alert).toHaveTextContent("이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.");
    expect(alert).not.toHaveTextContent("permission denied");
    expect(screen.queryByText("조건에 맞는 레슨수입이 없습니다.")).not.toBeInTheDocument();
  });

  it("수납 처리는 다음 페이지의 원생도 할 수 있다", async () => {
    const user = userEvent.setup();
    const markTuitionPaid = vi.fn().mockResolvedValue({ status: "paid" });
    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={emptyFinanceData}
        markTuitionPaid={markTuitionPaid}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition-paging", month],
          queryFn: async () => twelveTuitions(month),
        })}
      />,
    );
    await screen.findByText("총 12건");

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    const table = screen.getByRole("table", { name: "학원 레슨수입" });
    await user.click(within(table).getByRole("button", { name: "한서아 수납 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "수납 처리" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markTuitionPaid).toHaveBeenCalledWith(
        expect.objectContaining({ academyId: "academy-1", tuitionId: "snapshot-2026-08-0" }),
      ),
    );
  });
});

describe("교재내역 목록 나누기", () => {
  function buildSale(overrides: Partial<BookSale> & { saleId: string }): BookSale {
    return {
      academyId: "academy-1",
      bookId: "book-1",
      bookTitle: "바이엘 1",
      studentId: "student-1",
      studentName: "김민지",
      price: 12000,
      shippedAt: "2026-08-10",
      status: "payment-pending",
      ...overrides,
    } as BookSale;
  }

  function renderBooks(bookSales: BookSale[]) {
    return renderWithQueryClient(
      <FinanceBooksScreen
        academyId="academy-1"
        financeData={{ ...emptyFinanceData, bookSales }}
      />,
    );
  }

  /** 원본 순서를 거꾸로 줘서 화면이 가나다순으로 직접 정렬하는지 확인한다. 다른 학원 판매 1건은 총 건수에서 빠진다. */
  function twelveSales() {
    return [
      ...[...SORTED_NAMES].reverse().map((name, index) =>
        buildSale({
          saleId: `sale-${index}`,
          studentId: `student-${index}`,
          studentName: name,
          bookTitle: `교재 ${String(index + 1).padStart(2, "0")}`,
        }),
      ),
      buildSale({ saleId: "other-academy", academyId: "academy-2", studentName: "가나다" }),
    ];
  }

  it("총 건수를 보여주고 원생 이름 가나다순으로 10건씩 나눠 다음 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    renderBooks(twelveSales());

    expect(screen.getByText("총 12건")).toBeInTheDocument();
    expect(columnTexts(screen.getByRole("table", { name: "교재내역" }), 0)).toEqual(
      FIRST_PAGE_NAMES,
    );

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(columnTexts(screen.getByRole("table", { name: "교재내역" }), 0)).toEqual(
      SECOND_PAGE_NAMES,
    );
    expectCurrentPage(2);
  });

  it("같은 원생은 출고일이 이른 순서로 보여준다", () => {
    renderBooks([
      buildSale({ saleId: "sale-1", studentName: "한서아", shippedAt: "2026-08-01" }),
      buildSale({
        saleId: "sale-2",
        studentName: "김민지",
        bookTitle: "체르니 100",
        shippedAt: "2026-08-20",
      }),
      buildSale({
        saleId: "sale-3",
        studentName: "김민지",
        bookTitle: "바이엘 2",
        shippedAt: "2026-08-05",
      }),
    ]);

    const table = screen.getByRole("table", { name: "교재내역" });
    expect(columnTexts(table, 0)).toEqual(["김민지", "김민지", "한서아"]);
    expect(columnTexts(table, 4)).toEqual(["2026-08-05", "2026-08-20", "2026-08-01"]);
  });

  it("페이지당 20건을 고르면 1페이지로 돌아가 12건을 모두 보여준다", async () => {
    const user = userEvent.setup();
    renderBooks(twelveSales());

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "페이지당 교재내역 수" }),
      "20",
    );

    expectCurrentPage(1);
    expect(columnTexts(screen.getByRole("table", { name: "교재내역" }), 0)).toEqual(
      SORTED_NAMES,
    );
  });

  it("원생명이나 교재명으로 검색하면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    renderBooks(twelveSales());
    const searchbox = screen.getByRole("searchbox", { name: "교재내역 검색" });

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await user.type(searchbox, "교재");

    expectCurrentPage(1);
    expect(screen.getByText("총 12건")).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, "한서아");
    expect(screen.getByText("총 1건")).toBeInTheDocument();

    await user.clear(searchbox);
    await user.type(searchbox, "교재 03");
    expect(screen.getByText("총 1건")).toBeInTheDocument();
  });

  it("검색 결과가 없으면 안내 문구와 총 0건을 보여준다", async () => {
    const user = userEvent.setup();
    renderBooks(twelveSales());

    await user.type(screen.getByRole("searchbox", { name: "교재내역 검색" }), "없는 교재");

    expect(screen.getByText("조건에 맞는 교재내역이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0건")).toBeInTheDocument();
  });
});

describe("선생님 월급 목록 나누기", () => {
  const MONTHLY_SALARY = 1_000_000;
  const NET_PAY_PER_TEACHER = 967_000;
  const NET_PAY_OF_ALL_TWELVE = 11_604_000;

  function buildTeacher(name: string, index: number): TeacherListRow {
    return {
      academyId: "academy-1",
      teacherId: `teacher-${index}`,
      name,
      part: "피아노",
      contact: "010-0000-0000",
      registeredAt: "2026-01-01",
      payType: "monthly",
      monthlySalary: MONTHLY_SALARY,
    };
  }

  /** 원본 순서를 거꾸로 줘서 화면이 가나다순으로 직접 정렬하는지 확인한다. */
  function renderPayroll(teacherNames = [...SORTED_NAMES].reverse()) {
    return renderWithQueryClient(
      <FinancePayrollScreen
        academyId="academy-1"
        financeData={{
          ...emptyFinanceData,
          teachers: teacherNames.map(buildTeacher),
        }}
      />,
    );
  }

  it("총 인원을 보여주고 선생님 이름 가나다순으로 10명씩 나눠 다음 페이지로 이동한다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    expect(screen.getByText("총 12명")).toBeInTheDocument();
    expect(columnTexts(screen.getByRole("table", { name: "선생님 월급" }), 0)).toEqual(
      FIRST_PAGE_NAMES,
    );

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(columnTexts(screen.getByRole("table", { name: "선생님 월급" }), 0)).toEqual(
      SECOND_PAGE_NAMES,
    );
    expectCurrentPage(2);
  });

  it("지급 예정 급여 합계는 페이지나 검색과 상관없이 선생님 12명 전체로 계산한다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    expect(screen.getByText(formatWon(NET_PAY_OF_ALL_TWELVE))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    expect(screen.getByText(formatWon(NET_PAY_OF_ALL_TWELVE))).toBeInTheDocument();
    const lastPageCells = within(screen.getByRole("table", { name: "선생님 월급" })).getAllByRole(
      "cell",
      { name: formatWon(NET_PAY_PER_TEACHER) },
    );
    expect(lastPageCells).toHaveLength(SECOND_PAGE_NAMES.length);

    await user.type(screen.getByRole("searchbox", { name: "선생님 월급 검색" }), "한서아");
    expect(screen.getByText("총 1명")).toBeInTheDocument();
    expect(screen.getByText(formatWon(NET_PAY_OF_ALL_TWELVE))).toBeInTheDocument();
  });

  it("페이지당 20명을 고르면 1페이지로 돌아가 12명을 모두 보여준다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "페이지당 선생님 월급 수" }),
      "20",
    );

    expectCurrentPage(1);
    expect(columnTexts(screen.getByRole("table", { name: "선생님 월급" }), 0)).toEqual(
      SORTED_NAMES,
    );
  });

  it("선생님 이름으로 검색하면 일치하는 선생님만 가나다순으로 보여준다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    await user.type(screen.getByRole("searchbox", { name: "선생님 월급 검색" }), "서");

    expect(screen.getByText("총 5명")).toBeInTheDocument();
    expect(columnTexts(screen.getByRole("table", { name: "선생님 월급" }), 0)).toEqual([
      "나은서",
      "서윤아",
      "이서준",
      "최서연",
      "한서아",
    ]);
  });

  it("검색해도 결과가 여러 페이지면 1페이지로 돌아가 첫 10명을 보여준다", async () => {
    const user = userEvent.setup();
    renderPayroll(
      Array.from({ length: 23 }, (_, index) => `선생님${String(index + 1).padStart(2, "0")}`),
    );

    await user.click(screen.getByRole("button", { name: "3페이지" }));
    expectCurrentPage(3);
    await user.type(screen.getByRole("searchbox", { name: "선생님 월급 검색" }), "1");

    expect(screen.getByText("총 12명")).toBeInTheDocument();
    expectCurrentPage(1);
    expect(columnTexts(screen.getByRole("table", { name: "선생님 월급" }), 0)).toHaveLength(10);
  });

  it("검색 결과가 없으면 안내 문구와 총 0명을 보여준다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    await user.type(screen.getByRole("searchbox", { name: "선생님 월급 검색" }), "없는 선생님");

    expect(screen.getByText("조건에 맞는 선생님이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0명")).toBeInTheDocument();
  });

  it("월을 바꾸면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    renderPayroll();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    fireEvent.change(screen.getByLabelText("월별 지급 예정 급여 월 선택"), {
      target: { value: "2026-07" },
    });

    expectCurrentPage(1);
  });
});

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

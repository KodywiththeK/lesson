import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TuitionRecord } from "@/domain/tuition-income";

import { resetFinanceMonthForTest } from "./finance-shared";
import { FinanceOverviewScreen, type FinanceManagementData } from "./finance-management-screens";

const financeData: FinanceManagementData = {
  ledgerEntries: [
    {
      academyId: "academy-1",
      ledgerId: "ledger-1",
      occurredOn: "2026-03-05",
      type: "income",
      source: "tuition",
      amount: 300000,
      description: "3월 수강료",
      refId: "tuition-1",
    },
    {
      academyId: "academy-1",
      ledgerId: "ledger-2",
      occurredOn: "2026-03-20",
      type: "expense",
      source: "payroll",
      amount: 120000,
      description: "3월 급여",
      refId: "payroll-1",
    },
    {
      academyId: "academy-1",
      ledgerId: "ledger-3",
      occurredOn: "2026-05-02",
      type: "expense",
      source: "manual",
      amount: 50000,
      description: "악기 수리",
      refId: "manual-1",
    },
  ],
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [],
};

function buildTuition(overrides: Partial<TuitionRecord>): TuitionRecord {
  return {
    academyId: "academy-1",
    tuitionId: "tuition",
    month: "2026-10",
    studentId: "student-1",
    studentName: "김민지",
    enrollmentId: "enrollment-1",
    instrumentId: "piano",
    instrumentName: "피아노",
    progress: "",
    lessonFee: 140000,
    discountTotal: 0,
    amount: 140000,
    dueOn: "2026-10-05",
    status: "paid",
    ...overrides,
  };
}

type OverviewProps = Partial<React.ComponentProps<typeof FinanceOverviewScreen>>;

function renderOverview(props: OverviewProps = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <FinanceOverviewScreen academyId="academy-1" financeData={financeData} initialYear={2026} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T12:00:00+09:00"));
  resetFinanceMonthForTest();
  // jsdom에는 레이아웃이 없어 차트 크기가 0이라는 recharts 경고가 나온다. 접근성 표로 검증하므로 소음만 줄인다.
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("FinanceOverviewScreen 연도별 원장 조회", () => {
  it("선택한 연도의 원장을 연도 단위 조회로 읽어 월 데이터와 무관하게 연간 합계를 낸다", async () => {
    const user = userEvent.setup();
    const yearlyLedgerQueryOptionsFactory = vi.fn((year: number) => ({
      queryKey: ["ledger-year", year],
      queryFn: async () =>
        financeData.ledgerEntries.filter((entry) => entry.occurredOn.startsWith(`${year}-`)),
    }));
    // financeData(화면에 이미 있는 한 달치 데이터)는 비워 두어도 연간 합계가 나와야 한다.
    renderOverview({
      financeData: { ...financeData, ledgerEntries: [] },
      yearlyLedgerQueryOptionsFactory,
    });

    const summary = await screen.findByRole("region", { name: "연간 요약" });
    await waitFor(() => expect(within(summary).getByText("300,000원")).toBeInTheDocument());
    expect(within(summary).getByText("170,000원")).toBeInTheDocument();
    expect(yearlyLedgerQueryOptionsFactory).toHaveBeenCalledWith(2026);

    await user.selectOptions(screen.getByLabelText("연도"), "2025");

    await waitFor(() => expect(yearlyLedgerQueryOptionsFactory).toHaveBeenCalledWith(2025));
  });

  it("연도별 원장을 읽는 동안에는 0원 요약 대신 불러오는 중이라고 알린다", async () => {
    renderOverview({
      yearlyLedgerQueryOptionsFactory: (year) => ({
        queryKey: ["ledger-year-loading", year],
        queryFn: () => new Promise(() => undefined),
      }),
    });

    expect(await screen.findByText("연간 입출입내역을 불러오는 중입니다.")).toBeInTheDocument();
  });

  it("연도별 원장 조회가 실패하면 오류를 알리고 다시 불러올 수 있다", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    renderOverview({
      yearlyLedgerQueryOptionsFactory: (year) => ({
        queryKey: ["ledger-year-error", year],
        queryFn: async () => {
          attempts += 1;
          throw new Error("permission denied");
        },
      }),
    });

    expect(await screen.findByText("연간 입출입내역을 불러오지 못했습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));

    await waitFor(() => expect(attempts).toBeGreaterThan(1));
  });
});

describe("FinanceOverviewScreen 연간 요약", () => {
  it("선택한 연도의 수입·지출·순수익을 연간 합계와 월별 표로 함께 보여준다", () => {
    renderOverview();

    const summary = screen.getByRole("region", { name: "연간 요약" });
    expect(within(summary).getByText("수입").nextElementSibling).toHaveTextContent("300,000원");
    expect(within(summary).getByText("지출").nextElementSibling).toHaveTextContent("170,000원");
    expect(within(summary).getByText("순수익").nextElementSibling).toHaveTextContent("130,000원");
    expect(within(summary).getByText("300,000원")).toHaveClass("text-income");
    expect(within(summary).getByText("170,000원")).toHaveClass("text-expense");
    expect(within(summary).getByText("130,000원")).toHaveClass("text-total");

    const table = screen.getByRole("table", { name: "월별 수입·지출·순수익" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    const march = within(table).getByRole("row", { name: /2026-03/ });
    expect(within(march).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "2026-03",
      "300,000원",
      "120,000원",
      "180,000원",
    ]);
    const may = within(table).getByRole("row", { name: /2026-05/ });
    expect(within(may).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "2026-05",
      "0원",
      "50,000원",
      "-50,000원",
    ]);
  });

  it("분류별 수입에는 지출 내역을 섞지 않는다", () => {
    renderOverview();

    const categories = screen.getByRole("region", { name: "분류별 수입" });
    expect(within(categories).queryByText(/악기 수리|급여/)).not.toBeInTheDocument();
  });

  it("분류별 수입도 선택한 연도의 수입만 합산한다", () => {
    renderOverview({
      financeData: {
        ...financeData,
        ledgerEntries: [
          ...financeData.ledgerEntries,
          {
            academyId: "academy-1",
            ledgerId: "ledger-old",
            occurredOn: "2025-11-10",
            type: "income",
            source: "tuition",
            amount: 900000,
            description: "작년 수강료",
            refId: "tuition-old",
          },
        ],
      },
    });

    const categories = screen.getByRole("region", { name: "분류별 수입" });
    expect(categories).toHaveTextContent("300,000원");
    expect(categories).not.toHaveTextContent("900,000원");
    expect(categories).not.toHaveTextContent("1,200,000원");
  });
});

describe("FinanceOverviewScreen 연도 선택", () => {
  it("올해부터 최근 6개 연도만 고를 수 있고 기본은 올해다", () => {
    renderOverview({ initialYear: undefined });

    const select = screen.getByRole("combobox", { name: "연도" });
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "2026년",
      "2025년",
      "2024년",
      "2023년",
      "2022년",
      "2021년",
    ]);
    expect(select).toHaveValue("2026");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("연도를 바꾸면 그 연도의 합계와 월별 표를 다시 보여준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview({
      financeData: {
        ...financeData,
        ledgerEntries: [
          ...financeData.ledgerEntries,
          {
            academyId: "academy-1",
            ledgerId: "ledger-2025",
            occurredOn: "2025-11-10",
            type: "income",
            source: "manual",
            amount: 900000,
            description: "작년 수입",
            refId: "manual-2025",
          },
        ],
      },
    });

    await user.selectOptions(screen.getByRole("combobox", { name: "연도" }), "2025");

    const summary = screen.getByRole("region", { name: "연간 요약" });
    expect(within(summary).getByText("수입").nextElementSibling).toHaveTextContent("900,000원");
    expect(within(summary).getByText("지출").nextElementSibling).toHaveTextContent("0원");
  });
});

describe("FinanceOverviewScreen 수납/미납 현황", () => {
  const monthSnapshots = [
    buildTuition({ tuitionId: "a", studentId: "s1", studentName: "김민지", amount: 140000, status: "paid" }),
    buildTuition({ tuitionId: "b", studentId: "s2", studentName: "박서준", amount: 100000, status: "unpaid" }),
    buildTuition({ tuitionId: "c", studentId: "s3", studentName: "이하늘", amount: 90000, status: "overdue", instrumentName: "바이올린" }),
    buildTuition({ tuitionId: "d", studentId: "s3", studentName: "이하늘", amount: 60000, status: "overdue", instrumentName: "첼로" }),
  ];

  function snapshotsFactory(records = monthSnapshots) {
    return vi.fn((month: string) => ({
      queryKey: ["tuition-snapshots", month],
      queryFn: async () => records.filter((record) => record.month === month),
    }));
  }

  it("선택한 월의 입금 완료·미입금·미납 인원과 금액을 보여 준다", async () => {
    const factory = snapshotsFactory();
    renderOverview({ tuitionSnapshotsQueryOptionsFactory: factory });

    const status = await screen.findByRole("region", { name: "수납 현황" });
    await waitFor(() => expect(within(status).getByText("입금 완료").parentElement).toHaveTextContent("1명"));
    expect(within(status).getByText("입금 완료").parentElement).toHaveTextContent("140,000원");
    expect(within(status).getByText("미입금").parentElement).toHaveTextContent("1명");
    expect(within(status).getByText("미입금").parentElement).toHaveTextContent("100,000원");
    expect(within(status).getByText("미납").parentElement).toHaveTextContent("1명");
    expect(within(status).getByText("미납").parentElement).toHaveTextContent("150,000원");
    expect(factory).toHaveBeenCalledWith("2026-10");
  });

  it("미납 인원 목록에 원생·악기·금액을 보여 주고 같은 원생의 여러 악기는 한 명으로 센다", async () => {
    renderOverview({ tuitionSnapshotsQueryOptionsFactory: snapshotsFactory() });

    expect(await screen.findByText("미납 인원 1명")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "미납 인원" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "이하늘 · 바이올린90,000원",
      "이하늘 · 첼로60,000원",
    ]);
  });

  it("미납이 없으면 미납 인원 0명과 안내를 보여 준다", async () => {
    renderOverview({
      tuitionSnapshotsQueryOptionsFactory: snapshotsFactory([buildTuition({ status: "paid" })]),
    });

    expect(await screen.findByText("미납 인원 0명")).toBeInTheDocument();
    expect(screen.getByText("미납 인원이 없습니다.")).toBeInTheDocument();
  });

  it("월을 바꾸면 그 달 snapshot을 다시 읽는다", async () => {
    const factory = snapshotsFactory([
      ...monthSnapshots,
      buildTuition({ tuitionId: "sep", month: "2026-09", status: "overdue", studentName: "정지우", amount: 70000 }),
    ]);
    renderOverview({ tuitionSnapshotsQueryOptionsFactory: factory });
    await screen.findByText("미납 인원 1명");

    fireEvent.change(screen.getByLabelText("수납 현황 월 선택"), { target: { value: "2026-09" } });

    await waitFor(() => expect(factory).toHaveBeenCalledWith("2026-09"));
    expect(await screen.findByText("정지우 · 피아노")).toBeInTheDocument();
  });

  it("snapshot을 읽지 못하면 원인과 다시 불러오기를 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let shouldFail = true;
    renderOverview({
      tuitionSnapshotsQueryOptionsFactory: (month) => ({
        queryKey: ["tuition-snapshots", month],
        queryFn: async () => {
          if (shouldFail) {
            throw new Error("failed to fetch");
          }
          return monthSnapshots;
        },
      }),
    });

    expect(await screen.findByText("월 수납 현황을 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByText("네트워크 연결을 확인한 뒤 다시 시도해 주세요.")).toBeInTheDocument();

    shouldFail = false;
    await user.click(screen.getByRole("button", { name: "다시 불러오기" }));

    expect(await screen.findByText("미납 인원 1명")).toBeInTheDocument();
  });

  it("실제 데이터가 없는 화면에서는 한 줄 안내로 대체한다", () => {
    renderOverview();

    expect(screen.getByText("수납 현황은 실제 데이터에서만 볼 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByText(/미납 인원 \d+명/)).not.toBeInTheDocument();
  });
});

describe("FinanceOverviewScreen 월별 그래프", () => {
  it("지표마다 집계 기준이 다르다는 것을 그래프 아래에 알려 준다", async () => {
    renderOverview();

    expect(
      await screen.findByText(
        "악기 지표는 입금 완료된 월 수강료(청구월), 학원 수입·지출은 입출입내역(발생일) 기준입니다.",
      ),
    ).toBeInTheDocument();
  });

  const yearSnapshots = [
    buildTuition({ tuitionId: "p3", month: "2026-03", amount: 140000, instrumentId: "piano", instrumentName: "피아노" }),
    buildTuition({ tuitionId: "v3", month: "2026-03", amount: 100000, instrumentId: "violin", instrumentName: "바이올린" }),
    buildTuition({ tuitionId: "v4", month: "2026-04", amount: 90000, instrumentId: "violin", instrumentName: "바이올린" }),
    buildTuition({ tuitionId: "u4", month: "2026-04", amount: 50000, instrumentId: "violin", instrumentName: "바이올린", status: "unpaid" }),
    buildTuition({ tuitionId: "old", month: "2025-04", amount: 777000, instrumentId: "piano", instrumentName: "피아노" }),
  ];

  function yearlyFactory() {
    return vi.fn((year: number) => ({
      queryKey: ["yearly-tuition", year],
      queryFn: async () => yearSnapshots.filter((record) => record.month.startsWith(`${year}-`)),
    }));
  }

  function chartTable(name: string) {
    return screen.getByRole("table", { name });
  }

  it("기본 지표는 학원 수입이고 지표 4가지를 하나만 고를 수 있다", () => {
    renderOverview();

    const group = screen.getByRole("radiogroup", { name: "그래프 지표" });
    const items = within(group).getAllByRole("radio");
    expect(items.map((item) => item.textContent)).toEqual(["악기 전체", "악기별", "학원 수입", "지출"]);
    expect(within(group).getByRole("radio", { name: "학원 수입" })).toBeChecked();
    expect(within(chartTable("2026년 학원 수입 월별 금액")).getByRole("row", { name: "3월 300,000원" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "악기" })).not.toBeInTheDocument();
  });

  it("지출을 고르면 월별 지출을 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview();

    await user.click(screen.getByRole("radio", { name: "지출" }));

    const table = chartTable("2026년 지출 월별 금액");
    expect(within(table).getByRole("row", { name: "3월 120,000원" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "5월 50,000원" })).toBeInTheDocument();
  });

  it("이미 고른 지표를 다시 눌러도 선택이 풀리지 않는다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview();

    await user.click(screen.getByRole("radio", { name: "학원 수입" }));

    expect(screen.getByRole("radio", { name: "학원 수입" })).toBeChecked();
    expect(chartTable("2026년 학원 수입 월별 금액")).toBeInTheDocument();
  });

  it("악기 전체는 연간 수강료 snapshot에서 수납 완료 금액만 월별로 더한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const factory = yearlyFactory();
    renderOverview({ yearlyTuitionQueryOptionsFactory: factory });

    await user.click(screen.getByRole("radio", { name: "악기 전체" }));

    await waitFor(() => expect(factory).toHaveBeenCalledWith(2026));
    const table = chartTable("2026년 악기 전체 월별 금액");
    await waitFor(() => expect(within(table).getByRole("row", { name: "3월 240,000원" })).toBeInTheDocument());
    expect(within(table).getByRole("row", { name: "4월 90,000원" })).toBeInTheDocument();
  });

  it("악기별은 악기를 고르는 select를 보여 주고 고른 악기 하나의 월별 금액을 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview({ yearlyTuitionQueryOptionsFactory: yearlyFactory() });

    await user.click(screen.getByRole("radio", { name: "악기별" }));

    const select = await screen.findByRole("combobox", { name: "악기" });
    await waitFor(() =>
      expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["바이올린", "피아노"]),
    );
    // 첫 악기(가나다순 바이올린)를 기본으로 보여 준다.
    expect(within(chartTable("2026년 악기별 월별 금액")).getByRole("row", { name: "3월 100,000원" })).toBeInTheDocument();

    await user.selectOptions(select, "piano");

    const table = chartTable("2026년 악기별 월별 금액");
    expect(within(table).getByRole("row", { name: "3월 140,000원" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: "4월 0원" })).toBeInTheDocument();
  });

  it("연도를 바꾸면 그 연도의 연간 수강료를 다시 읽는다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const factory = yearlyFactory();
    renderOverview({ yearlyTuitionQueryOptionsFactory: factory });
    await user.click(screen.getByRole("radio", { name: "악기 전체" }));
    await waitFor(() => expect(factory).toHaveBeenCalledWith(2026));

    await user.selectOptions(screen.getByRole("combobox", { name: "연도" }), "2025");

    await waitFor(() => expect(factory).toHaveBeenCalledWith(2025));
    await waitFor(() =>
      expect(within(chartTable("2025년 악기 전체 월별 금액")).getByRole("row", { name: "4월 777,000원" })).toBeInTheDocument(),
    );
  });

  it("악기 지표인데 실제 데이터가 없는 화면이면 안내를 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview();

    await user.click(screen.getByRole("radio", { name: "악기별" }));

    expect(screen.getByText("연간 수강료 데이터는 실제 데이터에서만 볼 수 있습니다.")).toBeInTheDocument();
  });

  it("연간 수강료를 읽지 못하면 원인과 다시 불러오기를 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderOverview({
      yearlyTuitionQueryOptionsFactory: (year) => ({
        queryKey: ["yearly-tuition", year],
        queryFn: async () => {
          throw new Error("failed to fetch");
        },
      }),
    });

    await user.click(screen.getByRole("radio", { name: "악기 전체" }));

    expect(await screen.findByText("연간 수강료를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeInTheDocument();
  });
});

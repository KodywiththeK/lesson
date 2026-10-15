import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFinanceLedgerList } from "@/domain/finance-ledger";
import type { LedgerEntry } from "@/domain/book-sale";
import type { FinanceManagementData } from "./finance-ledger-list-screen";

import {
  FinanceBooksScreen,
  FinanceLedgerListScreen,
  FinanceLessonIncomeScreen,
  FinancePayrollScreen,
  type FinanceLedgerListQueryOptionsFactory,
} from "./finance-ledger-list-screen";

const ledgerEntries: LedgerEntry[] = [
  {
    academyId: "academy-1",
    ledgerId: "ledger-1",
    occurredOn: "2026-08-20",
    type: "income",
    source: "book-sale",
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
    amount: 30000,
    description: "조율비",
    refId: "manual-1",
  },
];

function renderFinanceLedgerListScreen(
  queryOptionsFactory: FinanceLedgerListQueryOptionsFactory,
) {
  return renderWithQueryClient(
    <FinanceLedgerListScreen
      academyId="academy-1"
      academyName="더 클래식"
      queryOptionsFactory={queryOptionsFactory}
    />,
  );
}

function renderWithQueryClient(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>,
  );
}

const financeData: FinanceManagementData = {
  ledgerEntries,
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [
    {
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "바이올린",
      contact: "010-0000-0000",
      registeredAt: "2026-01-01",
      payType: "monthly",
      monthlySalary: 840000,
    },
  ],
};

beforeEach(() => vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00")));
afterEach(() => vi.useRealTimers());

describe("FinanceLedgerListScreen", () => {
  it("기본 월과 수동 입력 날짜를 현재 날짜로 시작한다", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00+09:00"));
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.dateRange?.from],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    }));

    expect(screen.getByLabelText("입출금 월 선택")).toHaveValue("2026-10");
    expect(screen.getByLabelText("입출금 시작일")).toHaveValue("2026-10-01");
    await userEvent.setup().click(screen.getByRole("button", { name: "수동 입출금 등록" }));
    expect(screen.getByLabelText("발생일")).toHaveValue("2026-10-15");
  });

  it("입출입 내역을 표로 보여주고 발생일, 유형, 출처, 금액, 설명을 표시한다", async () => {
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.academyId, options.search ?? ""],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    }));

    const table = await screen.findByRole("table", { name: "입출금 내역" });
    expect(
      within(table).getByRole("cell", { name: "2026-08-21" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "지출" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "수동" })).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "30,000원" }),
    ).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "조율비" })).toBeInTheDocument();
  });

  it("검색어와 유형/출처 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<FinanceLedgerListQueryOptionsFactory>[0][] =
      [];

    renderFinanceLedgerListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "finance",
          options.academyId,
          options.search ?? "",
          options.filters?.type ?? "",
          options.filters?.source ?? "",
        ],
        queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
      };
    });

    await screen.findByRole("cell", { name: "교재 판매: 바이엘 2 / 김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "입출금 내역 검색" }),
      "조율",
    );
    await user.selectOptions(screen.getByLabelText("유형 필터"), "expense");
    await user.selectOptions(screen.getByLabelText("출처 필터"), "manual");

    expect(await screen.findByRole("cell", { name: "조율비" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "교재 판매: 바이엘 2 / 김민지" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "조율",
      filters: {
        type: "expense",
        source: "manual",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "입출금 내역을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });

  it("월수강료 수납 확인 시 수납 mutation을 호출한다", async () => {
    const user = userEvent.setup();
    const markTuitionPaid = vi.fn().mockResolvedValue({
      tuitionId: "snapshot-1",
      status: "paid",
    });

    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={financeData}
        markTuitionPaid={markTuitionPaid}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month],
          queryFn: async () => [
            {
              academyId: "academy-1",
              tuitionId: "snapshot-1",
              month,
              studentId: "student-1",
              studentName: "김민지",
              enrollmentId: "enrollment-1",
              instrumentId: "piano",
              instrumentName: "피아노",
              progress: "체르니 100",
              lessonFee: 160000,
              discountTotal: 10000,
              amount: 150000,
              dueOn: "2026-08-06",
              status: "unpaid",
            },
          ],
        })}
      />,
    );

    const incomeTable = screen.getByRole("table", { name: "학원 레슨수입" });
    await user.click(await within(incomeTable).findByRole("button", { name: "김민지 수납 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "수납 처리" });
    fireEvent.change(within(dialog).getByLabelText("수납일"), {
      target: { value: "2026-08-25" },
    });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markTuitionPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        tuitionId: "snapshot-1",
        paidAt: "2026-08-25",
      }),
    );
  });

  it("월수강료 조회 실패 시 임시 항목으로 수납하지 않는다", async () => {
    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={{ ...financeData, enrollments: [{
          academyId: "academy-1", enrollmentId: "enrollment-1",
          studentId: "student-1", studentName: "김민지",
          instrumentId: "piano", instrumentName: "피아노",
          teacherId: "teacher-1", teacherName: "박선생",
          lessonType: "academy", active: true, weekdays: [], weeklySchedules: [],
          progress: "바이엘", lessonFee: 140000, discountTotal: 0,
          finalMonthlyFee: 140000,
        }] }}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month, "failed"],
          queryFn: async () => { throw new Error("조회 실패"); },
        })}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("조회 실패");
    expect(screen.queryByRole("button", { name: /수납 처리/ })).not.toBeInTheDocument();
  });

  it("월별 미납인원은 같은 원생의 여러 수강 항목을 한 명으로 센다", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={financeData}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month, "unpaid-count"],
          queryFn: async () => ["piano", "violin"].map((instrumentId) => ({
            academyId: "academy-1", tuitionId: `snapshot-${instrumentId}`,
            month, studentId: "student-1", studentName: "김민지",
            enrollmentId: `enrollment-${instrumentId}`, instrumentId,
            instrumentName: instrumentId === "piano" ? "피아노" : "바이올린",
            progress: "신규", lessonFee: 140000, discountTotal: 0,
            amount: 140000, dueOn: "2026-08-06", status: "unpaid" as const,
          })),
        })}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "미납인원 1명" }));
    const dialog = screen.getByRole("dialog", { name: "미납인원" });
    expect(within(dialog).getByText("김민지 · 피아노")).toBeInTheDocument();
    expect(within(dialog).getByText("김민지 · 바이올린")).toBeInTheDocument();
  });

  it("월수강료 미수납 확인 시 미수납 mutation을 호출한다", async () => {
    const user = userEvent.setup();
    const markTuitionUnpaid = vi.fn().mockResolvedValue({
      tuitionId: "snapshot-1",
      status: "unpaid",
    });

    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={financeData}
        markTuitionUnpaid={markTuitionUnpaid}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month],
          queryFn: async () => [
            {
              academyId: "academy-1",
              tuitionId: "snapshot-1",
              month,
              studentId: "student-1",
              studentName: "김민지",
              enrollmentId: "enrollment-1",
              instrumentId: "piano",
              instrumentName: "피아노",
              progress: "체르니 100",
              lessonFee: 160000,
              discountTotal: 10000,
              amount: 150000,
              dueOn: "2026-08-06",
              status: "paid",
              paidAt: "2026-08-25",
            },
          ],
        })}
      />,
    );

    const incomeTable = screen.getByRole("table", { name: "학원 레슨수입" });
    await user.click(await within(incomeTable).findByRole("button", { name: "김민지 미수납 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "미수납 처리" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markTuitionUnpaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        tuitionId: "snapshot-1",
      }),
    );
  });

  it("급여 지급 확인 시 지급 확정 mutation을 호출한다", async () => {
    const user = userEvent.setup();
    const markPayrollPaid = vi.fn().mockResolvedValue({
      payrollId: "settlement-1",
      status: "paid",
    });

    renderWithQueryClient(
      <FinancePayrollScreen
        academyId="academy-1"
        financeData={financeData}
        markPayrollPaid={markPayrollPaid}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "박선생 급여 지급 확정" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    fireEvent.change(within(dialog).getByLabelText("지급일"), {
      target: { value: "2026-08-31" },
    });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markPayrollPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        paidAt: "2026-08-31",
        payroll: expect.objectContaining({
          teacherId: "teacher-1",
          payType: "monthly",
          netPay: 812280,
        }),
      }),
    );
  });

  it("이미 지급한 급여는 저장된 지급액과 완료 상태를 보여준다", () => {
    renderWithQueryClient(
      <FinancePayrollScreen
        academyId="academy-1"
        financeData={{
          ...financeData,
          salarySettlements: [{
            academyId: "academy-1", payrollId: "settlement-1",
            teacherId: "teacher-1", teacherName: "박선생", month: "2026-08",
            payType: "monthly", basePay: 840000, withholdingTax: 27720,
            netPay: 812280, status: "paid", paidAt: "2026-08-31",
            lessonEventIds: [],
          }],
        }}
      />,
    );

    expect(screen.getByText("지급 완료")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "박선생 급여 지급 확정" })).not.toBeInTheDocument();
  });

  it("발주 기록이 없는 교재는 출고일을 발주일로 표시하지 않는다", () => {
    renderWithQueryClient(
      <FinanceBooksScreen academyId="academy-1" financeData={{
        ...financeData,
        bookSales: [{
          academyId: "academy-1", saleId: "sale-1", bookId: "book-1",
          bookTitle: "바이엘", studentId: "student-1", studentName: "김민지",
          price: 12000, shippedAt: "2026-08-20", status: "payment-pending",
        }],
      }} />,
    );

    const row = screen.getByRole("row", { name: /김민지/ });
    expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("-");
  });
});

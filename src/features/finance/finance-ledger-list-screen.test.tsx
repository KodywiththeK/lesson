import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
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
import { resetFinanceMonthForTest } from "./finance-shared";

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
  props: Partial<ComponentProps<typeof FinanceLedgerListScreen>> = {},
) {
  return renderWithQueryClient(
    <FinanceLedgerListScreen
      academyId="academy-1"
      academyName="더 클래식"
      queryOptionsFactory={queryOptionsFactory}
      {...props}
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

beforeEach(() => {
  resetFinanceMonthForTest();
  vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00"));
});
afterEach(() => vi.useRealTimers());

describe("FinanceLedgerListScreen", () => {
  it("기본 월과 수동 입력 날짜를 현재 날짜로 시작한다", async () => {
    vi.setSystemTime(new Date("2026-10-15T12:00:00+09:00"));
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.dateRange?.from],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    }));

    const user = userEvent.setup();

    expect(screen.getByLabelText("입출금 월 선택")).toHaveValue("2026-10");
    await user.click(screen.getByRole("button", { name: "상세 필터" }));
    expect(screen.getByLabelText("입출금 시작일")).toHaveValue("2026-10-01");
    await user.click(screen.getByRole("button", { name: "수동 입출금 등록" }));
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
    await user.click(screen.getByRole("button", { name: "상세 필터" }));
    await user.selectOptions(screen.getByLabelText("출처 필터"), "manual");

    expect(await screen.findByRole("cell", { name: "조율비" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "교재 판매: 바이엘 2 / 김민지" }),
    ).not.toBeInTheDocument();
    // 월 합계 조회는 검색·필터 없이 따로 호출되므로, 목록 조회 입력만 골라 확인한다.
    expect(seenOptions.filter((options) => options.search === "조율").at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "조율",
      filters: {
        type: "expense",
        source: "manual",
      },
    });
  });

  describe("입출금 삭제 확인", () => {
    const ledgerListQueryOptions: FinanceLedgerListQueryOptionsFactory = (options) => ({
      queryKey: ["finance", options.academyId, "delete-confirm"],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    });

    async function openDeleteConfirmation(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole("button", { name: "2026-08-21 조율비 30,000원 삭제" }));

      return screen.findByRole("alertdialog", { name: "이 입출금 내역을 삭제할까요?" });
    }

    it("삭제를 누르면 확인 창을 먼저 보여주고 취소하면 삭제하지 않는다", async () => {
      const user = userEvent.setup();
      const deleteLedgerEntry = vi.fn();
      renderFinanceLedgerListScreen(ledgerListQueryOptions, { deleteLedgerEntry });

      const dialog = await openDeleteConfirmation(user);

      expect(dialog).toHaveTextContent(
        "삭제하면 되돌릴 수 없습니다. 수강료·교재·급여로 자동 기록된 내역은 원래 기록과의 연결이 끊어질 수 있습니다.",
      );
      expect(within(dialog).getByText("2026-08-21 · 조율비 · 30,000원")).toBeInTheDocument();
      expect(deleteLedgerEntry).not.toHaveBeenCalled();

      await user.click(within(dialog).getByRole("button", { name: "취소" }));

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      expect(deleteLedgerEntry).not.toHaveBeenCalled();
    });

    it("확인하면 고른 입출금 내역을 삭제하고 확인 창을 닫는다", async () => {
      const user = userEvent.setup();
      const deleteLedgerEntry = vi.fn().mockResolvedValue(undefined);
      renderFinanceLedgerListScreen(ledgerListQueryOptions, { deleteLedgerEntry });

      const dialog = await openDeleteConfirmation(user);
      await user.click(within(dialog).getByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(deleteLedgerEntry).toHaveBeenCalledExactlyOnceWith({ ledgerId: "ledger-2" }),
      );
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
    });

    it("삭제하는 동안에는 확인 버튼을 다시 눌러도 한 번만 삭제한다", async () => {
      const user = userEvent.setup();
      let finishDeleting: () => void = () => undefined;
      const deleteLedgerEntry = vi.fn(
        () => new Promise<void>((resolve) => (finishDeleting = resolve)),
      );
      renderFinanceLedgerListScreen(ledgerListQueryOptions, { deleteLedgerEntry });

      const dialog = await openDeleteConfirmation(user);
      await user.click(within(dialog).getByRole("button", { name: "삭제" }));

      const pendingButton = await within(dialog).findByRole("button", { name: "삭제 중" });
      expect(pendingButton).toBeDisabled();
      await user.click(pendingButton);
      expect(deleteLedgerEntry).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      finishDeleting();
      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
    });

    it("삭제에 실패하면 확인 창을 닫고 다시 시도할 수 있게 한다", async () => {
      const user = userEvent.setup();
      const deleteLedgerEntry = vi
        .fn()
        .mockRejectedValueOnce(new Error("permission denied"))
        .mockResolvedValueOnce(undefined);
      renderFinanceLedgerListScreen(ledgerListQueryOptions, { deleteLedgerEntry });

      const dialog = await openDeleteConfirmation(user);
      await user.click(within(dialog).getByRole("button", { name: "삭제" }));

      await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
      );
      const retryDialog = await openDeleteConfirmation(user);
      await user.click(within(retryDialog).getByRole("button", { name: "삭제" }));
      await waitFor(() => expect(deleteLedgerEntry).toHaveBeenCalledTimes(2));
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
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });

  it("월수강료 입금 확인 시 입금 mutation을 호출한다", async () => {
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
    await user.click(await within(incomeTable).findByRole("button", { name: "김민지 피아노 입금 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "입금 처리" });
    fireEvent.change(within(dialog).getByLabelText("입금일"), {
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

  it("월수강료 조회 실패 시 임시 항목으로 입금하지 않는다", async () => {
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
    expect(screen.queryByRole("button", { name: /입금 처리/ })).not.toBeInTheDocument();
  });

  it("월별 미납 인원은 같은 원생의 여러 수강 항목을 한 명으로 센다", async () => {
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
            amount: 140000, dueOn: "2026-08-06", status: "overdue" as const,
          })),
        })}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "미납 인원 1명" }));
    const dialog = screen.getByRole("dialog", { name: "미납 인원" });
    expect(within(dialog).getByText("김민지 · 피아노")).toBeInTheDocument();
    expect(within(dialog).getByText("김민지 · 바이올린")).toBeInTheDocument();
  });

  it("월수강료 입금 취소 확인 시 미입금 mutation을 호출한다", async () => {
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
    await user.click(await within(incomeTable).findByRole("button", { name: "김민지 피아노 입금 취소" }));
    const dialog = await screen.findByRole("alertdialog", { name: "입금을 취소할까요?" });
    await user.click(within(dialog).getByRole("button", { name: "입금 취소" }));

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

  it("결제 대기 교재는 출고일이 이번 달이어도 교재내역에 보이지 않는다", () => {
    renderWithQueryClient(
      <FinanceBooksScreen academyId="academy-1" financeData={{
        ...financeData,
        bookSales: [{
          academyId: "academy-1", saleId: "sale-1", bookId: "book-1",
          bookTitle: "바이엘", studentId: "student-1", studentName: "김민지",
          price: 12000, quantity: 1, shippedAt: "2026-08-20", status: "payment-pending",
        }],
      }} />,
    );

    expect(screen.queryByRole("row", { name: /김민지/ })).not.toBeInTheDocument();
    expect(screen.getByText("결제 완료된 교재 내역이 없습니다.")).toBeInTheDocument();
  });
});

describe("FinanceLessonIncomeScreen 회차권 수입", () => {
  it("등록 건별 원장 금액을 보여주고 0원·삭제된 원장을 입금 완료와 구분한다", async () => {
    const ticket = {
      academyId: "academy-1", ticketId: "ticket-1", studentId: "student-1",
      studentName: "김민지", instrumentId: "piano", instrumentName: "피아노",
      totalGrantedCount: 12, remainingCount: 12,
      validFrom: "2026-07-01", validUntil: "2026-09-01",
      registeredAt: "2026-08-01", paidAmount: 240000,
    };
    const registrations = [
      { registrationId: "registration-july", academyId: "academy-1", ticketId: "ticket-1",
        registeredAt: "2026-07-01", grantedCount: 4, validUntil: "2026-08-01",
        originalPaidAmount: 100000, ledgerEntryId: "ledger-july" },
      { registrationId: "registration-paid", academyId: "academy-1", ticketId: "ticket-1",
        registeredAt: "2026-08-01", grantedCount: 4, validUntil: "2026-09-01",
        originalPaidAmount: 140000, ledgerEntryId: "ledger-paid" },
      { registrationId: "registration-free", academyId: "academy-1", ticketId: "ticket-1",
        registeredAt: "2026-08-10", grantedCount: 4, validUntil: "2026-09-10",
        originalPaidAmount: 0, ledgerEntryId: null },
      { registrationId: "registration-missing", academyId: "academy-1", ticketId: "ticket-1",
        registeredAt: "2026-08-15", grantedCount: 4, validUntil: "2026-09-15",
        originalPaidAmount: 120000, ledgerEntryId: "ledger-deleted" },
    ];

    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={{
          ...financeData,
          tickets: [ticket],
          ticketRegistrations: registrations,
          ledgerEntries: [
            ...ledgerEntries,
            { academyId: "academy-1", ledgerId: "ledger-july", occurredOn: "2026-07-01",
              type: "income", source: "lesson-ticket", amount: 100000,
              description: "7월 회차권", refId: "ticket-1" },
            { academyId: "academy-1", ledgerId: "ledger-paid", occurredOn: "2026-08-01",
              type: "income", source: "lesson-ticket", amount: 130000,
              description: "8월 회차권", refId: "ticket-1" },
          ],
        }}
        tuitionSnapshotsQueryOptionsFactory={() => ({
          queryKey: ["tuition", "ticket-income"], queryFn: async () => [],
        })}
      />,
    );

    await screen.findAllByText("130,000원");
    const table = screen.getByRole("table", { name: "학원 레슨수입" });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getAllByText("130,000원")).toHaveLength(2);
    expect(within(table).queryByText("240,000원")).not.toBeInTheDocument();
    expect(within(table).getByText("0원 등록")).toBeInTheDocument();
    expect(within(table).getByText("원장 기록 없음")).toBeInTheDocument();
    expect(within(table).getAllByText("입금 완료")).toHaveLength(1);
  });
});

describe("재무 목록 반응형 표", () => {
  function expectRowLabels(row: HTMLElement, labels: string[]) {
    expect(within(row).getAllByRole("cell").map((cell) =>
      cell.getAttribute("data-label"),
    )).toEqual(labels);
  }

  it("레슨수입을 한 표에 한 번만 렌더링하고 모든 값에 항목명을 제공한다", async () => {
    renderWithQueryClient(
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={financeData}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month, "responsive"],
          queryFn: async () => [{
            academyId: "academy-1", tuitionId: "snapshot-responsive", month,
            studentId: "student-1", studentName: "김민지",
            enrollmentId: "enrollment-1", instrumentId: "piano",
            instrumentName: "피아노", progress: "체르니 100",
            lessonFee: 160000, discountTotal: 10000, amount: 150000,
            dueOn: "2026-08-06", status: "unpaid" as const,
          }],
        })}
      />,
    );

    const table = screen.getByRole("table", { name: "학원 레슨수입" });
    const row = await within(table).findByRole("row", { name: /김민지/ });
    expectRowLabels(row, ["이름", "최초 등록일", "레슨종류", "악기", "진도", "레슨비", "할인", "최종금액", "입금 상태"]);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("학원 레슨수입 간략 목록")).not.toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "김민지 피아노 입금 처리" })).toBeInTheDocument();
  });

  it("교재내역의 모든 값에 항목명을 제공한다", () => {
    renderWithQueryClient(
      <FinanceBooksScreen academyId="academy-1" financeData={{
        ...financeData,
        bookSales: [{
          academyId: "academy-1", saleId: "sale-responsive", bookId: "book-1",
          bookTitle: "바이엘", studentId: "student-1", studentName: "김민지",
          price: 12000, quantity: 1, shippedAt: "2026-08-20", status: "paid",
          paidAt: "2026-08-21", permanent: true,
        }],
      }} />,
    );

    const table = screen.getByRole("table", { name: "교재내역" });
    expectRowLabels(within(table).getByRole("row", { name: /김민지/ }),
      ["이름", "도서명", "가격", "수량", "금액", "출고일", "입금일"]);
  });

  it("선생님 월급의 모든 값에 항목명을 제공하고 지급 동작을 유지한다", () => {
    renderWithQueryClient(<FinancePayrollScreen academyId="academy-1" financeData={financeData} />);

    const table = screen.getByRole("table", { name: "선생님 월급" });
    expectRowLabels(within(table).getByRole("row", { name: /박선생/ }),
      ["선생님", "담당 파트", "급여 형태·설정", "기본급여(세전)", "원천징수(3.3%)", "최종지급액(세후)", "산출 근거", "지급 상태", "관리"]);
    expect(within(table).getByRole("button", { name: "박선생 급여 지급 확정" })).toBeInTheDocument();
  });

  it("입출금 내역의 모든 값에 항목명을 제공하고 관리 동작을 유지한다", async () => {
    renderFinanceLedgerListScreen((options) => ({
      queryKey: ["finance", options.academyId, "responsive"],
      queryFn: async () => buildFinanceLedgerList(ledgerEntries, options),
    }));

    const table = await screen.findByRole("table", { name: "입출금 내역" });
    const row = within(table).getByRole("row", { name: /조율비/ });
    expectRowLabels(row, ["발생일", "유형", "출처", "분류", "금액", "설명", "관리"]);
    expect(within(row).getByRole("button", { name: "2026-08-21 조율비 30,000원 수정" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "2026-08-21 조율비 30,000원 삭제" })).toBeInTheDocument();
  });
});

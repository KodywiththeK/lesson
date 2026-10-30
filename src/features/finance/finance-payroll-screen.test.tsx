import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PayrollLessonSource, PayrollRecord } from "@/domain/payroll";
import type { TeacherListRow } from "@/domain/teacher-list";

import { hasLessonRecordChangedSincePayment } from "./finance-payroll-changes";
import { FinancePayrollScreen } from "./finance-payroll-screen";
import { resetFinanceMonthForTest } from "./finance-shared";
import type { FinanceManagementData } from "./finance-types";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const BASE_TEACHER: Omit<TeacherListRow, "teacherId" | "name" | "payType"> = {
  academyId: "academy-1",
  part: "바이올린",
  contact: "010-0000-0000",
  registeredAt: "2026-01-01",
};

const ratioTeacher: TeacherListRow = {
  ...BASE_TEACHER,
  teacherId: "teacher-ratio",
  name: "김동성",
  payType: "ratio",
  ratioTeacherShare: 60,
};
const monthlyTeacher: TeacherListRow = {
  ...BASE_TEACHER,
  teacherId: "teacher-monthly",
  name: "박월급",
  part: "피아노",
  payType: "monthly",
  monthlySalary: 2_600_000,
};
const hourlyTeacher: TeacherListRow = {
  ...BASE_TEACHER,
  teacherId: "teacher-hourly",
  name: "이시급",
  part: "첼로",
  payType: "hourly",
  hourlyRate: 30_000,
};

/** 월요일 10:00-18:00 출근, 계약 2026년 한 해. 2026-08에는 월요일이 5번(3·10·17·24·31)이라 40시간이다. */
const scheduledHourlyTeacher: TeacherListRow = {
  ...hourlyTeacher,
  contractStartOn: "2026-01-01",
  contractEndOn: "2026-12-31",
  workSchedules: [{ weekday: "월", weekdayLabel: "월", startTime: "10:00", endTime: "18:00" }],
};

/** 한 달 4회 수업, 레슨비 140,000원, 모두 등원 확인: 140,000 ÷ 4 × 0.6 × 4 = 84,000원. */
const ratioLessons: PayrollLessonSource[] = ["06", "13", "20", "27"].map((day) => ({
  academyId: "academy-1",
  lessonEventId: `lesson-${day}`,
  teacherId: "teacher-ratio",
  studentId: "student-1",
  studentName: "김민지",
  instrumentName: "바이올린",
  lessonKind: "academy",
  status: "present",
  startedAt: `2026-08-${day}T09:00:00+09:00`,
  endedAt: `2026-08-${day}T10:00:00+09:00`,
  monthlyLessonFee: 140_000,
}));
const ratioLessonEventIds = ratioLessons.map((lesson) => lesson.lessonEventId);

function buildFinanceData(overrides: Partial<FinanceManagementData> = {}): FinanceManagementData {
  return {
    ledgerEntries: [],
    enrollments: [],
    tickets: [],
    bookSales: [],
    teachers: [ratioTeacher, monthlyTeacher],
    payrollLessonSources: ratioLessons,
    ...overrides,
  };
}

function buildPaidSettlement(overrides: Partial<PayrollRecord> = {}): PayrollRecord {
  return {
    academyId: "academy-1",
    payrollId: "2026-08:teacher-ratio",
    teacherId: "teacher-ratio",
    teacherName: "김동성",
    month: "2026-08",
    payType: "ratio",
    basePay: 84_000,
    withholdingTax: 2_772,
    netPay: 81_228,
    status: "paid",
    paidAt: "2026-08-31",
    lessonEventIds: ratioLessonEventIds,
    ledgerEntryId: "ledger-1",
    ...overrides,
  };
}

function renderPayroll(
  financeData: FinanceManagementData,
  handlers: Partial<React.ComponentProps<typeof FinancePayrollScreen>> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    wrap(<FinancePayrollScreen academyId="academy-1" financeData={financeData} {...handlers} />),
  );
}

function getRow(name: string) {
  return within(screen.getByRole("table", { name: "선생님 월급" })).getByRole("row", { name: new RegExp(name) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00"));
  resetFinanceMonthForTest();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

afterEach(() => vi.useRealTimers());

describe("hasLessonRecordChangedSincePayment", () => {
  it("지급 때 반영한 수업과 지금 계산에 쓰이는 수업이 같으면 순서와 상관없이 바뀌지 않은 것이다", () => {
    expect(hasLessonRecordChangedSincePayment(["lesson-1", "lesson-2"], ["lesson-2", "lesson-1"])).toBe(false);
    expect(hasLessonRecordChangedSincePayment([], [])).toBe(false);
  });

  it("수업이 늘거나 줄거나 다른 수업으로 바뀌면 바뀐 것이다", () => {
    expect(hasLessonRecordChangedSincePayment(["lesson-1"], ["lesson-1", "lesson-2"])).toBe(true);
    expect(hasLessonRecordChangedSincePayment(["lesson-1", "lesson-2"], ["lesson-1"])).toBe(true);
    expect(hasLessonRecordChangedSincePayment(["lesson-1"], ["lesson-3"])).toBe(true);
  });
});

describe("FinancePayrollScreen 표", () => {
  it("선생님 행에서 정산 문자를 작성하고 학생별 내역을 확인한다", async () => {
    const user = userEvent.setup();
    renderPayroll(buildFinanceData());
    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" }));
    const text = screen.getByLabelText("정산 문자 내용") as HTMLTextAreaElement;
    expect(text.value).toContain("김동성");
    expect(text.value).toContain("김민지");
    expect(text.value).toContain("84,000");
    expect(text.value).toContain("2026-08-06");
    expect(text.value).toContain("평균 회당 21,000원");
  });

  it("기존 지급 급여의 학생별 내역을 현재 수업에서 추측하지 않는다", async () => {
    const user = userEvent.setup();
    renderPayroll(buildFinanceData({ salarySettlements: [buildPaidSettlement()] }));
    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" }));
    expect(screen.getByText(/지급 당시 학생별 내역/)).toBeInTheDocument();
    expect((screen.getByLabelText("정산 문자 내용") as HTMLTextAreaElement).value).not.toContain("김민지");
    expect((screen.getByLabelText("정산 문자 내용") as HTMLTextAreaElement).value).toContain("확인 필요 강사료 정산 안내");
  });

  it("지급 당시 보존한 상세를 현재 등원 기록과 무관하게 문자에 사용한다", async () => {
    const user = userEvent.setup();
    renderPayroll(buildFinanceData({ payrollLessonSources: [], salarySettlements: [buildPaidSettlement({
      studentBreakdown: [{ studentId: "old-student", studentName: "당시원생", instrumentName: "첼로", count: 1, dates: ["2026-08-01"], amount: 84000 }],
    })] }));
    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" }));
    const text = screen.getByLabelText("정산 문자 내용") as HTMLTextAreaElement;
    expect(text.value).toContain("당시원생");
    expect(text.value).toContain("2026-08-01");
    expect(text.value).toContain("총 수업 횟수: 1회");
    expect(screen.queryByText(/지급 당시 학생별 내역을 확인할 수 없습니다/)).not.toBeInTheDocument();
  });

  it("공휴일 일정이 준비되지 않으면 재시도를 안내하고 급여 지급 확정을 막는다", async () => {
    const user = userEvent.setup();
    const refetchFinanceData = vi.fn().mockResolvedValue(undefined);
    renderPayroll(buildFinanceData({ holidayScheduleReady: false }), { refetchFinanceData });
    expect(screen.getByText(/공휴일.*준비/)).toBeInTheDocument();
    expect(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" })).toBeDisabled();
    expect(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "공휴일 일정 다시 확인" }));
    await waitFor(() => expect(refetchFinanceData).toHaveBeenCalled());
  });
  it("급여 설정에 문제가 있는 미지급 행은 0원 문자 작성을 막는다", () => {
    renderPayroll(buildFinanceData({ teachers: [{ ...ratioTeacher, ratioTeacherShare: undefined }] }));
    expect(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" })).toBeDisabled();
  });
  it("공휴일이 미준비여도 이미 지급된 정산 문자는 확인할 수 있다", () => {
    renderPayroll(buildFinanceData({ holidayScheduleReady: false, salarySettlements: [buildPaidSettlement()] }));
    expect(within(getRow("김동성")).getByRole("button", { name: "김동성 정산 문자 작성" })).toBeEnabled();
  });
  it("제목·설명과 선생님별 담당 파트·급여 형태·세전·원천징수·세후·산출 근거·지급 상태를 보여 준다", () => {
    renderPayroll(buildFinanceData());

    expect(screen.getByRole("heading", { name: "선생님 월급 관리" })).toBeInTheDocument();
    expect(screen.getByText("등록된 선생님별 급여를 설정하고 관리합니다.")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "선생님 월급" });
    expect(
      within(table).getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "선생님",
      "담당 파트",
      "급여 형태·설정",
      "기본급여(세전)",
      "원천징수(3.3%)",
      "최종지급액(세후)",
      "산출 근거",
      "지급 상태",
      "관리",
    ]);

    const ratioRow = getRow("김동성");
    expect(within(ratioRow).getByRole("cell", { name: "바이올린" })).toBeInTheDocument();
    expect(within(ratioRow).getByRole("cell", { name: "비율제 · 선생님 60%" })).toBeInTheDocument();
    expect(within(ratioRow).getByRole("cell", { name: "84,000원" })).toBeInTheDocument();
    expect(within(ratioRow).getByRole("cell", { name: "2,772원" })).toBeInTheDocument();
    expect(within(ratioRow).getByRole("cell", { name: "81,228원" })).toBeInTheDocument();
    expect(within(ratioRow).getByText("등원 4회 / 예정 4회")).toBeInTheDocument();
    expect(within(ratioRow).getByText("미지급")).toBeInTheDocument();

    const monthlyRow = getRow("박월급");
    expect(within(monthlyRow).getByRole("cell", { name: "피아노" })).toBeInTheDocument();
    expect(within(monthlyRow).getByRole("cell", { name: "월급제 · 2,600,000원" })).toBeInTheDocument();
  });

  it("시급제 설정은 시급을 보여 준다", () => {
    renderPayroll(buildFinanceData({ teachers: [hourlyTeacher] }));

    expect(within(getRow("이시급")).getByRole("cell", { name: "시급제 · 30,000원" })).toBeInTheDocument();
  });

  it("모든 값에 좁은 화면용 항목명을 붙인다", () => {
    renderPayroll(buildFinanceData());

    const labels = within(getRow("김동성"))
      .getAllByRole("cell")
      .map((cell) => cell.getAttribute("data-label"));
    expect(labels).toEqual([
      "선생님",
      "담당 파트",
      "급여 형태·설정",
      "기본급여(세전)",
      "원천징수(3.3%)",
      "최종지급액(세후)",
      "산출 근거",
      "지급 상태",
      "관리",
    ]);
  });

  it("선생님이 없으면 등록된 선생님이 없다고 알리고, 검색 결과가 없으면 조건에 맞는 선생님이 없다고 알린다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = renderPayroll(buildFinanceData({ teachers: [] }));

    expect(screen.getByText("등록된 선생님이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("조건에 맞는 선생님이 없습니다.")).not.toBeInTheDocument();
    unmount();

    renderPayroll(buildFinanceData());
    await user.type(screen.getByRole("searchbox", { name: "선생님 월급 검색" }), "없는 선생님");

    expect(screen.getByText("조건에 맞는 선생님이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("등록된 선생님이 없습니다.")).not.toBeInTheDocument();
  });
});

describe("FinancePayrollScreen 합계", () => {
  it("지급 예정 급여와 지급 완료 급여를 나눠 보여 주고 설정 확인이 필요하거나 0원인 행은 예정에서 뺀다", () => {
    const brokenTeacher: TeacherListRow = { ...BASE_TEACHER, teacherId: "teacher-broken", name: "최미설정", payType: "monthly" };
    renderPayroll(
      buildFinanceData({
        teachers: [ratioTeacher, monthlyTeacher, hourlyTeacher, brokenTeacher],
        salarySettlements: [buildPaidSettlement({ teacherId: "teacher-monthly", teacherName: "박월급", payrollId: "2026-08:teacher-monthly", payType: "monthly", netPay: 2_514_200, basePay: 2_600_000, withholdingTax: 85_800, lessonEventIds: [] })],
      }),
    );

    // 비율제 81,228원만 예정이다. 시급제(출근 일정 없음 → 설정 확인)와 설정 미완료는 빠진다.
    const expected = screen.getByText("지급 예정 급여").parentElement;
    expect(expected).toHaveTextContent("81,228원");
    const done = screen.getByText("지급 완료 급여").parentElement;
    expect(done).toHaveTextContent("2,514,200원");
  });

  it("조회 월은 이번 달로 시작하고 월을 바꾸면 그 달 등원 기록으로 다시 계산한다", () => {
    renderPayroll(buildFinanceData());

    const monthField = screen.getByLabelText("지급 예정 급여 월 선택");
    expect(monthField).toHaveValue("2026-08");

    fireEvent.change(monthField, { target: { value: "2026-07" } });

    const row = getRow("김동성");
    expect(within(row).getByText("등원 0회 / 예정 0회")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "김동성 급여 지급 확정" })).toBeDisabled();
    expect(screen.getByText("지급 예정 급여").parentElement).toHaveTextContent("2,514,200원");
  });
});

describe("FinancePayrollScreen 시급제(출근 일정 기준)", () => {
  it("시급 × 그 달 출근 일정 합계로 계산하고 산출 근거에 근무 시간(출근 일정 기준)을 보여 준다", () => {
    renderPayroll(buildFinanceData({ teachers: [scheduledHourlyTeacher] }));

    const row = getRow("이시급");
    // 40시간 × 30,000원 = 1,200,000원, 세금 39,600원
    expect(within(row).getByRole("cell", { name: "1,200,000원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "39,600원" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "1,160,400원" })).toBeInTheDocument();
    expect(within(row).getByText("근무 40시간 (출근 일정 기준)")).toBeInTheDocument();
    expect(within(row).queryByText(/등원/)).not.toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "이시급 급여 지급 확정" })).toBeEnabled();
  });

  it("출근 요일·시간이 없으면 등록을 안내하고 지급 버튼을 숨긴다", () => {
    renderPayroll(buildFinanceData({ teachers: [hourlyTeacher] }));

    const row = getRow("이시급");
    expect(
      within(row).getByText(
        "설정 확인 필요: 출근 요일·시간을 설정해 주세요. 선생님 정보에서 출근 일정을 등록하면 시급을 계산할 수 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /지급/ })).not.toBeInTheDocument();
  });

  it("출근 요일만 있고 시간이 비어 있으면 출근 시간 설정을 안내한다", () => {
    renderPayroll(
      buildFinanceData({
        teachers: [{ ...scheduledHourlyTeacher, workSchedules: [{ weekday: "수", weekdayLabel: "수" }] }],
      }),
    );

    expect(
      within(getRow("이시급")).getByText("설정 확인 필요: 출근 시간을 설정해 주세요. 수요일의 시작·종료 시간이 비어 있습니다."),
    ).toBeInTheDocument();
  });

  it("지급 확정 때 수업 목록 없이 계산된 금액을 보낸다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn().mockResolvedValue(buildPaidSettlement());
    renderPayroll(buildFinanceData({ teachers: [scheduledHourlyTeacher] }), { markPayrollPaid });

    await user.click(within(getRow("이시급")).getByRole("button", { name: "이시급 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markPayrollPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        paidAt: "2026-08-21",
        payroll: expect.objectContaining({
          teacherId: "teacher-hourly",
          payType: "hourly",
          basePay: 1_200_000,
          netPay: 1_160_400,
          lessonEventIds: [],
        }),
      }),
    );
  });

  it("지급 직전에 다시 불러온 출근 일정으로 금액이 달라졌으면 출근 일정이 바뀌었다고 알리고 지급하지 않는다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn();
    const changed = {
      ...scheduledHourlyTeacher,
      workSchedules: [{ weekday: "월", weekdayLabel: "월", startTime: "10:00", endTime: "17:00" }],
    };
    const refetchFinanceData = vi.fn().mockResolvedValue(buildFinanceData({ teachers: [changed] }));
    renderPayroll(buildFinanceData({ teachers: [scheduledHourlyTeacher] }), { markPayrollPaid, refetchFinanceData });

    await user.click(within(getRow("이시급")).getByRole("button", { name: "이시급 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("급여 지급 확정에 실패했습니다.", {
        description: "출근 일정이 바뀌어 금액이 달라졌습니다. 새 금액을 확인한 뒤 다시 확정해 주세요.",
      }),
    );
    expect(markPayrollPaid).not.toHaveBeenCalled();
  });
});

describe("FinancePayrollScreen 지급 확정", () => {
  it("설정 확인이 필요한 행은 안내를 보여 주고 지급 버튼을 숨긴다", () => {
    const brokenTeacher: TeacherListRow = { ...BASE_TEACHER, teacherId: "teacher-broken", name: "최미설정", payType: "monthly" };
    renderPayroll(buildFinanceData({ teachers: [brokenTeacher] }));

    const row = getRow("최미설정");
    expect(within(row).getByText("설정 확인 필요: 월 급여 설정을 확인해 주세요.")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /지급/ })).not.toBeInTheDocument();
  });

  it("최종지급액이 0원이면 지급 버튼을 비활성하고 이유를 문장으로 연결한다", () => {
    renderPayroll(buildFinanceData({ payrollLessonSources: [] }));

    fireEvent.change(screen.getByLabelText("지급 예정 급여 월 선택"), { target: { value: "2026-07" } });

    const button = within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("이번 달 등원 확인이 없어 지급할 금액이 없습니다.");
  });

  it("시급제는 등원 확인이 아니라 출근 일정 기준이라 0원 이유도 근무 시간으로 안내한다", () => {
    // 계약이 7월에 끝나 8월에는 출근일이 없다.
    renderPayroll(buildFinanceData({ teachers: [{ ...scheduledHourlyTeacher, contractEndOn: "2026-07-31" }] }));

    const button = within(getRow("이시급")).getByRole("button", { name: "이시급 급여 지급 확정" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("이번 달 출근 일정에 해당하는 근무 시간이 없어 지급할 금액이 없습니다.");
  });

  it("지급일을 고르면 지급 확정 handler를 부르고 성공 토스트를 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn().mockResolvedValue(buildPaidSettlement());
    renderPayroll(buildFinanceData(), { markPayrollPaid });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    expect(within(dialog).getByText("확인하면 입출입내역에 지출이 기록됩니다.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("지급일")).toHaveValue("2026-08-21");
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markPayrollPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        paidAt: "2026-08-21",
        payroll: expect.objectContaining({ teacherId: "teacher-ratio", month: "2026-08", netPay: 81_228 }),
      }),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("급여 지급을 확정했습니다."));
    expect(screen.queryByRole("dialog", { name: "급여 지급 확정" })).not.toBeInTheDocument();
  });

  it("지급 확정 직전에 최신 데이터를 다시 불러와 금액이 그대로일 때만 지급을 요청한다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn().mockResolvedValue(buildPaidSettlement());
    const refetchFinanceData = vi.fn().mockResolvedValue(buildFinanceData());
    renderPayroll(buildFinanceData(), { markPayrollPaid, refetchFinanceData });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(markPayrollPaid).toHaveBeenCalledOnce());
    expect(refetchFinanceData).toHaveBeenCalledOnce();
  });

  it("다시 불러온 등원 기록으로 금액이 달라졌으면 지급하지 않고 새 금액을 확인하라고 알린다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn();
    // 그 사이 다른 화면에서 4회 중 1회가 결석으로 바뀌었다.
    const changedLessons = ratioLessons.map((lesson, index) =>
      index === 3 ? { ...lesson, status: "absent" as const } : lesson,
    );
    const refetchFinanceData = vi
      .fn()
      .mockResolvedValue(buildFinanceData({ payrollLessonSources: changedLessons }));
    renderPayroll(buildFinanceData(), { markPayrollPaid, refetchFinanceData });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("급여 지급 확정에 실패했습니다.", {
        description: "등원 기록이 바뀌어 금액이 달라졌습니다. 새 금액을 확인한 뒤 다시 확정해 주세요.",
      }),
    );
    expect(markPayrollPaid).not.toHaveBeenCalled();
  });

  it("월 수강료는 그 달 월 snapshot 금액을 우선해 계산한다", () => {
    renderPayroll(
      buildFinanceData({
        monthTuitionSnapshots: [
          {
            academyId: "academy-1",
            tuitionId: "snapshot-1",
            month: "2026-08",
            studentId: "student-1",
            studentName: "김민지",
            enrollmentId: "enrollment-1",
            instrumentId: "violin",
            instrumentName: "바이올린",
            progress: "",
            lessonFee: 100_000,
            discountTotal: 0,
            amount: 100_000,
            dueOn: "2026-08-01",
            status: "paid",
          },
        ],
      }),
    );

    // 수업에 붙은 현재 수강료는 140,000원이지만 그 달 snapshot은 100,000원: 100,000 × 60% = 60,000원
    expect(within(getRow("김동성")).getByText("60,000원")).toBeInTheDocument();
  });

  it("처리 중에는 확인 버튼이 막혀 중복 지급을 요청하지 않는다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn(() => new Promise<PayrollRecord>(() => undefined));
    renderPayroll(buildFinanceData(), { markPayrollPaid });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    const pendingButton = await within(dialog).findByRole("button", { name: "처리 중" });
    expect(pendingButton).toBeDisabled();
    await user.click(pendingButton);
    expect(markPayrollPaid).toHaveBeenCalledTimes(1);
  });

  it("지급 handler가 없는 화면에서는 성공 대신 처리할 수 없다는 오류를 알린다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPayroll(buildFinanceData());

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    const dialog = await screen.findByRole("dialog", { name: "급여 지급 확정" });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("급여 지급 확정에 실패했습니다.", {
        description: "이 화면에서는 처리할 수 없습니다.",
      }),
    );
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("지급 handler가 실패하면 사용자 문구로 원인을 알린다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const markPayrollPaid = vi.fn().mockRejectedValue(new Error("permission denied for table"));
    renderPayroll(buildFinanceData(), { markPayrollPaid });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 확정" }));
    await user.click(within(await screen.findByRole("dialog", { name: "급여 지급 확정" })).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("급여 지급 확정에 실패했습니다.", {
        description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
      }),
    );
  });
});

describe("FinancePayrollScreen 지급 완료 행", () => {
  it("지급 완료 배지와 지급일, 지급 취소 버튼을 보여 주고 지급 확정 버튼은 숨긴다", () => {
    renderPayroll(buildFinanceData({ salarySettlements: [buildPaidSettlement()] }));

    const row = getRow("김동성");
    expect(within(row).getByText("지급 완료")).toBeInTheDocument();
    expect(within(row).getByText("지급일 2026-08-31")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "김동성 급여 지급 취소" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "김동성 급여 지급 확정" })).not.toBeInTheDocument();
    expect(within(row).queryByText("원장 기록 없음")).not.toBeInTheDocument();
  });

  it("지급 취소는 확인을 거친 뒤 handler를 부르고 성공 토스트를 보여 준다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const cancelPayrollPaid = vi.fn().mockResolvedValue({});
    renderPayroll(buildFinanceData({ salarySettlements: [buildPaidSettlement()] }), { cancelPayrollPaid });

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 취소" }));
    const dialog = await screen.findByRole("alertdialog", { name: "지급을 취소할까요?" });
    expect(
      within(dialog).getByText("연결된 입출입내역(지출) 1건이 삭제되고 미지급 상태로 돌아갑니다."),
    ).toBeInTheDocument();
    expect(cancelPayrollPaid).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "지급 취소" }));

    await waitFor(() =>
      expect(cancelPayrollPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        teacherId: "teacher-ratio",
        month: "2026-08",
      }),
    );
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("급여 지급을 취소했습니다."));
  });

  it("취소 handler가 없는 화면에서는 처리할 수 없다는 오류를 알린다", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPayroll(buildFinanceData({ salarySettlements: [buildPaidSettlement()] }));

    await user.click(within(getRow("김동성")).getByRole("button", { name: "김동성 급여 지급 취소" }));
    const dialog = await screen.findByRole("alertdialog", { name: "지급을 취소할까요?" });
    await user.click(within(dialog).getByRole("button", { name: "지급 취소" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("급여 지급 취소에 실패했습니다.", {
        description: "이 화면에서는 처리할 수 없습니다.",
      }),
    );
  });

  it("원장 연결이 null인 지급 건에만 원장 기록 없음 배지를 보여 준다", () => {
    renderPayroll(
      buildFinanceData({
        salarySettlements: [
          buildPaidSettlement({ ledgerEntryId: null }),
          buildPaidSettlement({
            teacherId: "teacher-monthly",
            teacherName: "박월급",
            payrollId: "2026-08:teacher-monthly",
            payType: "monthly",
            lessonEventIds: [],
            ledgerEntryId: undefined,
          }),
        ],
      }),
    );

    expect(within(getRow("김동성")).getByText("원장 기록 없음")).toBeInTheDocument();
    expect(within(getRow("박월급")).queryByText("원장 기록 없음")).not.toBeInTheDocument();
  });

  it("지급 후 그 달 등원 기록이 바뀌었으면 지급액은 그대로라고 경고한다", () => {
    renderPayroll(
      buildFinanceData({
        salarySettlements: [buildPaidSettlement({ lessonEventIds: ["lesson-06", "lesson-13", "lesson-20"] })],
      }),
    );

    const row = getRow("김동성");
    expect(
      within(row).getByText("지급 후 등원 기록이 변경되었습니다. 지급액은 그대로입니다."),
    ).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "81,228원" })).toBeInTheDocument();
  });

  it("지급 후 선생님의 급여 형태가 바뀌어도 등원 기록이 바뀐 것처럼 경고하지 않는다", () => {
    // 월급제로 지급(수업 목록 없음)한 뒤 선생님이 시급제로 바뀌었다. 형태가 다르면 수업 목록을 비교하지 않는다.
    renderPayroll(
      buildFinanceData({
        teachers: [{ ...hourlyTeacher, teacherId: "teacher-ratio", name: "김동성" }],
        salarySettlements: [
          buildPaidSettlement({ payType: "monthly", lessonEventIds: [], basePay: 2_000_000, netPay: 1_934_000 }),
        ],
      }),
    );

    expect(
      within(getRow("김동성")).queryByText("지급 후 등원 기록이 변경되었습니다. 지급액은 그대로입니다."),
    ).not.toBeInTheDocument();
  });

  it("등원 기록이 지급 때와 같으면 경고하지 않는다", () => {
    renderPayroll(buildFinanceData({ salarySettlements: [buildPaidSettlement()] }));

    expect(screen.queryByText(/지급 후 등원 기록이 변경되었습니다/)).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TuitionRecord } from "@/domain/tuition-income";

import { FinanceLessonIncomeScreen } from "./finance-lesson-income-screen";
import { resetFinanceMonthForTest } from "./finance-shared";
import type { FinanceManagementData } from "./finance-types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const emptyFinanceData: FinanceManagementData = {
  ledgerEntries: [],
  enrollments: [],
  tickets: [],
  bookSales: [],
  teachers: [],
};

function buildTuition(overrides: Partial<TuitionRecord> = {}): TuitionRecord {
  return {
    academyId: "academy-1",
    tuitionId: "snapshot-1",
    month: "2026-08",
    studentId: "student-1",
    studentName: "김민지",
    enrollmentId: "enrollment-1",
    instrumentId: "piano",
    instrumentName: "피아노",
    progress: "체르니 100",
    lessonFee: 160000,
    discountTotal: 10000,
    amount: 150000,
    registeredOn: "2026-01-04",
    dueOn: "2026-08-06",
    status: "unpaid",
    ...overrides,
  };
}

type ScreenProps = Partial<ComponentProps<typeof FinanceLessonIncomeScreen>>;

function renderScreen(
  tuitions: TuitionRecord[] | ((month: string) => TuitionRecord[]),
  props: ScreenProps = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const readTuitions = typeof tuitions === "function" ? tuitions : () => tuitions;
  const element = (
    <QueryClientProvider client={queryClient}>
      <FinanceLessonIncomeScreen
        academyId="academy-1"
        financeData={emptyFinanceData}
        tuitionSnapshotsQueryOptionsFactory={(month) => ({
          queryKey: ["tuition", month],
          queryFn: async () => readTuitions(month),
        })}
        {...props}
      />
    </QueryClientProvider>
  );

  return { ...render(element), element, invalidateQueries };
}

function getIncomeTable() {
  return screen.getByRole("table", { name: "학원 레슨수입" });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-21T12:00:00+09:00"));
  resetFinanceMonthForTest();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => vi.useRealTimers());

describe("학원 고정 수입 화면 구성", () => {
  it("레슨수입 표에 원생의 학원 최초 등록일을 보여 준다", async () => {
    renderScreen([buildTuition()]);

    await screen.findByText("김민지");
    const row = within(getIncomeTable()).getByRole("row", { name: /김민지/ });
    expect(within(row).getByRole("cell", { name: "2026-01-04" })).toHaveAttribute("data-label", "최초 등록일");
  });

  it("명세의 제목과 설명, 파란색 전체 금액 합산을 보여 준다", async () => {
    renderScreen([
      buildTuition({ amount: 150000 }),
      buildTuition({ tuitionId: "snapshot-2", studentId: "student-2", studentName: "이서윤", amount: 100000 }),
    ]);

    expect(screen.getByRole("heading", { name: "학원 고정 수입 (원생 레슨 수입)" })).toBeInTheDocument();
    expect(
      screen.getByText("원생/선생님 관리에서 작성된 레슨비 및 할인 정보를 직관적으로 보여줍니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("전체 금액 합산")).toBeInTheDocument();
    expect(await screen.findByText("250,000원")).toHaveClass("text-total");
  });

  it("보던 월은 다른 탭으로 옮겨도 이어지고 이번 달보다 뒤의 달은 고를 수 없다", async () => {
    const requestedMonths: string[] = [];
    const readTuitions = (month: string) => {
      requestedMonths.push(month);
      return [buildTuition()];
    };
    const first = renderScreen(readTuitions);
    await screen.findByText("김민지");

    fireEvent.change(screen.getByLabelText("전체 금액 합산 월 선택"), { target: { value: "2026-07" } });
    await waitFor(() => expect(requestedMonths).toContain("2026-07"));

    first.unmount();
    renderScreen(readTuitions);
    expect(screen.getByLabelText("전체 금액 합산 월 선택")).toHaveValue("2026-07");

    fireEvent.change(screen.getByLabelText("전체 금액 합산 월 선택"), { target: { value: "2026-12" } });
    await screen.findByText("김민지");
    expect(requestedMonths).not.toContain("2026-12");
  });

  it("그 달 데이터가 아예 없으면 등록 안내를, 검색 결과만 없으면 조건 안내를 따로 보여 준다", async () => {
    const user = userEvent.setup();
    const { unmount } = renderScreen([]);

    expect(await screen.findByText("등록된 원생 레슨 수입 정보가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("조건에 맞는 레슨수입이 없습니다.")).not.toBeInTheDocument();
    unmount();

    renderScreen([buildTuition()]);
    await screen.findByText("김민지");
    await user.type(screen.getByRole("searchbox", { name: "레슨수입 검색" }), "없는 이름");

    expect(screen.getByText("조건에 맞는 레슨수입이 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("등록된 원생 레슨 수입 정보가 없습니다.")).not.toBeInTheDocument();
  });

  it("월별 수강료를 불러오지 못하면 다시 불러오기로 한 번 더 조회한다", async () => {
    const user = userEvent.setup();
    let attempts = 0;
    renderScreen(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("permission denied for table fixed_income_snapshots");
      }
      return [buildTuition()];
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.");
    await user.click(within(alert).getByRole("button", { name: "다시 불러오기" }));

    expect(await screen.findByText("김민지")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("학원 고정 수입 입금 상태", () => {
  const threeStatuses = [
    buildTuition({ tuitionId: "snapshot-unpaid", studentId: "student-1", studentName: "김민지", status: "unpaid" }),
    buildTuition({ tuitionId: "snapshot-overdue", studentId: "student-2", studentName: "이서윤", status: "overdue" }),
    buildTuition({
      tuitionId: "snapshot-paid",
      studentId: "student-3",
      studentName: "박지후",
      status: "paid",
      paidAt: "2026-08-10",
      paidLedgerEntryId: "ledger-1",
    }),
  ];

  it("상태 배지와 상태별 버튼을 원생 이름·악기가 들어간 이름으로 보여 준다", async () => {
    renderScreen(threeStatuses);

    const table = getIncomeTable();
    const unpaidRow = await within(table).findByRole("row", { name: /김민지/ });
    expect(within(unpaidRow).getByText("미입금")).toBeInTheDocument();
    expect(within(unpaidRow).getByRole("button", { name: "김민지 피아노 입금 처리" })).toBeEnabled();
    expect(within(unpaidRow).getByRole("button", { name: "김민지 피아노 미납 처리" })).toBeEnabled();
    expect(within(unpaidRow).queryByRole("button", { name: /입금 취소|미납 해제/ })).not.toBeInTheDocument();

    const overdueRow = within(table).getByRole("row", { name: /이서윤/ });
    expect(within(overdueRow).getByText("미납")).toBeInTheDocument();
    expect(within(overdueRow).getByRole("button", { name: "이서윤 피아노 입금 처리" })).toBeEnabled();
    expect(within(overdueRow).getByRole("button", { name: "이서윤 피아노 미납 해제" })).toBeEnabled();
    expect(within(overdueRow).queryByRole("button", { name: "이서윤 피아노 미납 처리" })).not.toBeInTheDocument();

    const paidRow = within(table).getByRole("row", { name: /박지후/ });
    expect(within(paidRow).getByText("입금 완료")).toBeInTheDocument();
    expect(within(paidRow).getByRole("button", { name: "박지후 피아노 입금 취소" })).toBeEnabled();
    expect(within(paidRow).queryByRole("button", { name: /입금 처리|미납/ })).not.toBeInTheDocument();
  });

  it("'수납' 용어를 쓰지 않는다", async () => {
    renderScreen(threeStatuses);

    await screen.findByText("김민지");
    expect(document.body).not.toHaveTextContent("수납");
  });

  it("입금 완료 항목에 결제 방식을 표시하고 과거 항목은 미기록으로 표시한다", async () => {
    renderScreen([
      buildTuition({ status: "paid", paymentMethod: "remote" }),
      buildTuition({ tuitionId: "old", studentId: "old", studentName: "이서윤", status: "paid" }),
    ]);
    const table = getIncomeTable();
    expect(within(await within(table).findByRole("row", { name: /김민지/ })).getByText("비대면결제")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /이서윤/ })).getByText("결제 방식 미기록")).toBeInTheDocument();
  });

  it("입금은 입금일을 받고 입출입내역에 기록된다고 안내한 뒤 입금 처리한다", async () => {
    const user = userEvent.setup();
    const markTuitionPaid = vi.fn().mockResolvedValue(buildTuition({ status: "paid" }));
    const { invalidateQueries } = renderScreen([buildTuition()], { markTuitionPaid });

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 입금 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "입금 처리" });
    expect(dialog).toHaveTextContent("확인하면 입출입내역에 수입이 기록됩니다.");
    expect(within(dialog).getByLabelText("입금일")).toHaveValue("2026-08-21");
    expect(within(dialog).getByRole("button", { name: "확인" })).toBeDisabled();
    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "card");

    fireEvent.change(within(dialog).getByLabelText("입금일"), { target: { value: "2026-09-02" } });
    expect(within(dialog).getByText("입금일이 속한 9월 입출입내역으로 기록됩니다.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("입금일"), { target: { value: "2026-08-25" } });
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markTuitionPaid).toHaveBeenCalledWith({
        academyId: "academy-1",
        tuitionId: "snapshot-1",
        paidAt: "2026-08-25",
        paymentMethod: "card",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("입금 처리했습니다.");
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["academy", "academy-1", "finance"] });
  });

  it("미납 처리는 확인 없이 바로 기록하고 미납으로 기록했다고 알린다", async () => {
    const user = userEvent.setup();
    const markTuitionOverdue = vi.fn().mockResolvedValue(buildTuition({ status: "overdue" }));
    renderScreen([buildTuition()], { markTuitionOverdue });

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 미납 처리" }));

    await waitFor(() =>
      expect(markTuitionOverdue).toHaveBeenCalledWith({ academyId: "academy-1", tuitionId: "snapshot-1" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("미납으로 기록했습니다.");
  });

  it("미납 해제는 입금일 확인 후 수납 완료로 처리한다", async () => {
    const user = userEvent.setup();
    const markTuitionPaid = vi.fn().mockResolvedValue(buildTuition({ status: "paid" }));
    const markTuitionUnpaid = vi.fn();
    renderScreen([buildTuition({ status: "overdue" })], { markTuitionPaid, markTuitionUnpaid });

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 미납 해제" }));
    const dialog = await screen.findByRole("dialog", { name: "미납 수강료 입금 확인" });
    expect(dialog).toHaveTextContent("김민지");
    expect(dialog).toHaveTextContent("피아노");
    await user.clear(within(dialog).getByRole("textbox", { name: "입금일" }));
    await user.type(within(dialog).getByRole("textbox", { name: "입금일" }), "2026-08-25");
    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "transfer");
    await user.click(within(dialog).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(markTuitionPaid).toHaveBeenCalledWith({
      academyId: "academy-1", tuitionId: "snapshot-1", paidAt: "2026-08-25", paymentMethod: "transfer",
    }));
    expect(markTuitionUnpaid).not.toHaveBeenCalled();
  });

  it("입금 취소는 연결된 입출입내역이 삭제된다고 알리고 확인을 받은 뒤 처리한다", async () => {
    const user = userEvent.setup();
    const markTuitionUnpaid = vi.fn().mockResolvedValue(buildTuition({ status: "unpaid" }));
    renderScreen([buildTuition({ status: "paid", paidAt: "2026-08-10", paidLedgerEntryId: "ledger-1" })], {
      markTuitionUnpaid,
    });

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 입금 취소" }));
    const dialog = await screen.findByRole("alertdialog", { name: "입금을 취소할까요?" });
    expect(dialog).toHaveTextContent("연결된 입출입내역 1건이 삭제되고 미입금 상태로 돌아갑니다.");
    expect(markTuitionUnpaid).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(markTuitionUnpaid).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "김민지 피아노 입금 취소" }));
    const secondDialog = await screen.findByRole("alertdialog", { name: "입금을 취소할까요?" });
    await user.click(within(secondDialog).getByRole("button", { name: "입금 취소" }));

    await waitFor(() =>
      expect(markTuitionUnpaid).toHaveBeenCalledWith({ academyId: "academy-1", tuitionId: "snapshot-1" }),
    );
    expect(toast.success).toHaveBeenCalledWith("입금을 취소했습니다.");
  });

  it("0원 수강료는 입금 버튼을 막고 이유를 화면과 접근성 설명으로 알린다", async () => {
    renderScreen([buildTuition({ amount: 0, lessonFee: 0, discountTotal: 0 })]);

    const payButton = await screen.findByRole("button", { name: "김민지 피아노 입금 처리" });
    expect(payButton).toBeDisabled();
    expect(payButton).toHaveAccessibleDescription("결제 금액이 0원이어서 입금 처리할 수 없습니다.");
    expect(screen.getByText("결제 금액이 0원이어서 입금 처리할 수 없습니다.")).toBeVisible();
    expect(screen.getByRole("button", { name: "김민지 피아노 미납 처리" })).toBeEnabled();
  });

  it("입금 완료인데 연결된 입출입내역이 사라졌으면 원장 기록 없음 배지를 보여 준다", async () => {
    renderScreen([
      buildTuition({ tuitionId: "snapshot-lost", studentName: "김민지", status: "paid", paidLedgerEntryId: null }),
      buildTuition({
        tuitionId: "snapshot-ok",
        studentId: "student-2",
        studentName: "이서윤",
        status: "paid",
        paidLedgerEntryId: "ledger-1",
      }),
      buildTuition({
        tuitionId: "snapshot-unknown",
        studentId: "student-3",
        studentName: "박지후",
        status: "paid",
      }),
    ]);

    const table = getIncomeTable();
    expect(within(await within(table).findByRole("row", { name: /김민지/ })).getByText("원장 기록 없음")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /이서윤/ })).queryByText("원장 기록 없음")).not.toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /박지후/ })).queryByText("원장 기록 없음")).not.toBeInTheDocument();
  });

  it("처리 중에는 모든 행의 버튼을 막아 중복 처리를 방지한다", async () => {
    const user = userEvent.setup();
    let finish: (value: TuitionRecord) => void = () => undefined;
    const markTuitionOverdue = vi.fn(
      () => new Promise<TuitionRecord>((resolve) => { finish = resolve; }),
    );
    renderScreen(
      [
        buildTuition(),
        buildTuition({ tuitionId: "snapshot-2", studentId: "student-2", studentName: "이서윤" }),
      ],
      { markTuitionOverdue },
    );

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 미납 처리" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "이서윤 피아노 입금 처리" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "이서윤 피아노 미납 처리" })).toBeDisabled();
    expect(markTuitionOverdue).toHaveBeenCalledTimes(1);

    finish(buildTuition({ status: "overdue" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "이서윤 피아노 입금 처리" })).toBeEnabled());
  });

  it("처리에 실패하면 사용자 문구로 알리고 성공 안내는 하지 않는다", async () => {
    const user = userEvent.setup();
    const markTuitionOverdue = vi.fn().mockRejectedValue(new Error("permission denied"));
    renderScreen([buildTuition()], { markTuitionOverdue });

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 미납 처리" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith("미납 처리에 실패했습니다.", {
      description: "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("처리 핸들러가 없는 환경에서는 성공 대신 처리할 수 없다고 알린다", async () => {
    const user = userEvent.setup();
    renderScreen([buildTuition()]);

    await user.click(await screen.findByRole("button", { name: "김민지 피아노 입금 처리" }));
    const dialog = await screen.findByRole("dialog", { name: "입금 처리" });
    await user.selectOptions(within(dialog).getByLabelText("결제 방식"), "remote");
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("입금 처리에 실패했습니다.", {
        description: "이 화면에서는 처리할 수 없습니다.",
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("미납 인원", () => {
  it("미납을 누른 원생만 원생·악기·금액과 합계로 보여 주고 미입금은 세지 않는다", async () => {
    const user = userEvent.setup();
    renderScreen([
      buildTuition({ tuitionId: "snapshot-1", studentName: "김민지", status: "overdue" }),
      buildTuition({
        tuitionId: "snapshot-2",
        enrollmentId: "enrollment-2",
        instrumentId: "violin",
        instrumentName: "바이올린",
        studentName: "김민지",
        amount: 100000,
        status: "overdue",
      }),
      buildTuition({ tuitionId: "snapshot-3", studentId: "student-2", studentName: "이서윤", status: "unpaid" }),
    ]);

    await user.click(await screen.findByRole("button", { name: "미납 인원 1명" }));
    const dialog = await screen.findByRole("dialog", { name: "미납 인원" });

    expect(within(dialog).getByText("김민지 · 피아노")).toBeInTheDocument();
    expect(within(dialog).getByText("김민지 · 바이올린")).toBeInTheDocument();
    expect(within(dialog).queryByText(/이서윤/)).not.toBeInTheDocument();
    expect(within(dialog).getByText("150,000원")).toBeInTheDocument();
    expect(within(dialog).getByText("100,000원")).toBeInTheDocument();
    expect(within(dialog).getByText("합계")).toBeInTheDocument();
    expect(within(dialog).getByText("250,000원")).toBeInTheDocument();
  });

  it("미납한 원생이 없으면 0명으로 보여 주고 안내 문구를 띄운다", async () => {
    const user = userEvent.setup();
    renderScreen([buildTuition({ status: "unpaid" })]);

    await user.click(await screen.findByRole("button", { name: "미납 인원 0명" }));

    expect(within(await screen.findByRole("dialog", { name: "미납 인원" })).getByText("미납 인원이 없습니다.")).toBeInTheDocument();
  });

  it("월별 수강료를 불러오기 전에는 미납 인원 버튼을 보여 주지 않는다", () => {
    renderScreen(() => []);

    expect(screen.queryByRole("button", { name: /미납 인원/ })).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";

import type { TodayTaskProcessing } from "./today-task-processing";
import { TodayTasks, type TodayTasksDataAccess } from "./today-tasks";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let isMobile = false;

beforeEach(() => {
  isMobile = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: isMobile,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
});

const motherContact = { relationship: "어머니", phone: "010-1234-5678" };

const source: DailyTaskSource = {
  unresolvedAbsences: [
    {
      attendanceId: "att-1",
      lessonEventId: "event-1",
      lessonDate: "2026-11-18",
      startsAt: "2026-11-18T06:00:00.000Z",
      endsAt: "2026-11-18T06:50:00.000Z",
      studentId: "stu-1",
      studentName: "유나",
      teacherIds: ["teacher-kim"],
      teacherName: "김선생",
      instrumentId: "violin",
      instrumentName: "바이올린",
      origin: "regular",
      absenceReason: null,
      regularWeekdays: [3],
      contact: motherContact,
    },
  ],
  tuitions: [
    {
      snapshotId: "tui-1",
      studentName: "단율",
      instrumentName: "피아노",
      month: "2026-11",
      dueOn: "2026-11-10",
      status: "unpaid",
      amount: 150000,
      contact: null,
    },
  ],
  lessonTickets: [],
  unpaidBookReleases: [],
  lessonChanges: [
    {
      auditEventId: "audit-1",
      changeType: "rescheduled",
      lessonKind: "academy",
      studentName: "유나",
      teacherIds: ["teacher-kim"],
      previousStartsAt: "2026-11-19T05:00:00.000Z",
      nextStartsAt: "2026-11-19T06:30:00.000Z",
      previousTeacherName: null,
      nextTeacherName: null,
      contact: motherContact,
    },
  ],
  consultations: [],
  pendingBookOrders: [{ orderId: "order-1", vendorName: "음악사", orderedOn: "2026-11-15" }],
};

function createProcessing(): TodayTaskProcessing {
  return {
    loadCardFeeRates: vi.fn(async () => []),
    markTuitionPaid: vi.fn(async () => undefined),
    changeTicketPayment: vi.fn(async () => undefined),
    loadBookOrder: vi.fn(async () => null),
    receiveBookOrder: vi.fn(async () => undefined),
    loadTicketRegistrationOptions: vi.fn(async () => []),
    registerLessonTicket: vi.fn(async () => undefined),
    loadAttendeeCounts: vi.fn(async () => ({})),
    resolveAbsence: vi.fn(async () => undefined),
  };
}

function renderTasks({
  role = "owner",
  states = [],
  taskSource = source,
}: {
  role?: "owner" | "desk" | "teacher";
  states?: DailyTaskState[];
  taskSource?: DailyTaskSource;
} = {}) {
  let savedStates = [...states];
  let currentSource = taskSource;
  const dataAccess: TodayTasksDataAccess = {
    loadSource: vi.fn(async () => currentSource),
    loadStates: vi.fn(async () => savedStates),
    saveState: vi.fn(async ({ taskKey, state }) => {
      savedStates = savedStates.filter((item) => item.taskKey !== taskKey);
      if (state) {
        savedStates.push({ taskKey, state, updatedByName: "원장", updatedAt: "2026-11-19T01:00:00Z" });
      }
    }),
  };
  const processing = createProcessing();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <TodayTasks
        academyId="academy-1"
        permissionContext={{ role, teacherId: role === "teacher" ? "teacher-kim" : undefined }}
        today="2026-11-19"
        dataAccess={dataAccess}
        processing={processing}
      />
    </QueryClientProvider>,
  );

  return {
    dataAccess,
    processing,
    replaceSource: (next: DailyTaskSource) => {
      currentSource = next;
    },
  };
}

async function openGroup(name: RegExp) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("TodayTasks 요약 칸", () => {
  it("원장은 업무 5칸과 답변 대기 칸에 건수만 보고, 0건 칸은 누를 수 없다", async () => {
    renderTasks();

    const cells = within(await screen.findByRole("list", { name: "오늘 할 일 칸" })).getAllByRole("button");
    expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "돈 챙길 일 1건",
      "학부모 연락 1건",
      "상담 연락 0건",
      "보강 잡기 1건",
      "교재 입고 1건",
      "답변 대기 0건",
    ]);
    expect(screen.getByRole("button", { name: "상담 연락 0건" })).toBeDisabled();
    expect(screen.queryByText("단율 피아노 11월 수강료 입금 확인")).not.toBeInTheDocument();
  });

  it("설치한 앱 아이콘 배지를 오늘 할 일 수(답변 대기 제외)로 맞춘다", async () => {
    const setAppBadge = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "setAppBadge", { configurable: true, value: setAppBadge });
    renderTasks({
      states: [{ taskKey: "lesson-change:audit-1", state: "waiting_reply", updatedByName: "데스크", updatedAt: "2026-11-19T01:00:00Z" }],
    });

    await waitFor(() => expect(setAppBadge).toHaveBeenLastCalledWith(3));
    Reflect.deleteProperty(navigator, "setAppBadge");
  });

  it("선생님은 보강 잡기·학부모 연락·답변 대기 칸만 본다", async () => {
    renderTasks({ role: "teacher" });

    const cells = within(await screen.findByRole("list", { name: "오늘 할 일 칸" })).getAllByRole("button");
    expect(cells.map((cell) => cell.getAttribute("aria-label"))).toEqual([
      "보강 잡기 1건",
      "학부모 연락 1건",
      "답변 대기 0건",
    ]);
  });
});

describe("TodayTasks 모달", () => {
  it("칸을 누르면 그 칸의 할 일을 모달로 보여 주고, 원장은 금액과 입금 확인 버튼을 본다", async () => {
    renderTasks();
    const { dialog } = await openGroup(/돈 챙길 일/);

    expect(within(dialog).getByText("단율 피아노 11월 수강료 입금 확인")).toBeInTheDocument();
    expect(within(dialog).getByText(/150,000원/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "입금 확인" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "수강료 화면으로" })).toHaveAttribute("href", "/finance/lesson-income");
  });

  it("데스크는 수강료 입금을 처리할 수 없어(원장만) 처리 버튼이 없다", async () => {
    renderTasks({
      role: "desk",
      taskSource: { ...source, tuitions: source.tuitions.map((tuition) => ({ ...tuition, amount: null })) },
    });
    const { dialog } = await openGroup(/돈 챙길 일/);

    expect(within(dialog).getByText("단율 피아노 11월 수강료 입금 확인")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "입금 확인" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/150,000원/)).not.toBeInTheDocument();
  });

  it("학부모 연락은 대표 연락처의 전화·문자 버튼과 답변 대기·완료 버튼을 둔다", async () => {
    renderTasks();
    const { dialog } = await openGroup(/학부모 연락/);

    expect(within(dialog).getByRole("link", { name: "유나 학부모님께 변경 시간 안내 전화" })).toHaveAttribute(
      "href",
      "tel:01012345678",
    );
    expect(within(dialog).getByRole("link", { name: "유나 학부모님께 변경 시간 안내 문자" })).toHaveAttribute(
      "href",
      "sms:01012345678",
    );
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeInTheDocument();
  });

  it("'답변 대기로'를 누르면 칸 건수가 답변 대기로 옮겨 가고, 답변 대기 칸에서 처리한 사람을 본다", async () => {
    const { dataAccess } = renderTasks();
    const { user, dialog } = await openGroup(/학부모 연락/);

    await user.click(within(dialog).getByRole("button", { name: "답변 대기로" }));

    expect(dataAccess.saveState).toHaveBeenCalledWith({ taskKey: "lesson-change:audit-1", state: "waiting_reply" });
    await waitFor(() => expect(within(dialog).getByText("학부모님께 연락할 일이 없습니다.")).toBeInTheDocument());
    await user.keyboard("{Escape}");

    const { dialog: waiting } = await openGroup(/답변 대기 1건/);
    expect(within(waiting).getByText("유나 학부모님께 변경 시간 안내")).toBeInTheDocument();
    expect(within(waiting).getByText(/원장/)).toBeInTheDocument();
    expect(within(waiting).getByRole("button", { name: "할 일로 되돌리기" })).toBeInTheDocument();
  });

  it("수강료 입금 확인은 입금 창에서 저장하고, 처리하면 원천을 다시 읽어 칸이 줄어든다", async () => {
    const { processing, replaceSource } = renderTasks();
    const { user, dialog } = await openGroup(/돈 챙길 일/);

    await user.click(within(dialog).getByRole("button", { name: "입금 확인" }));
    const paymentDialog = await screen.findByRole("dialog", { name: "수강료 입금 확인" });
    await user.selectOptions(within(paymentDialog).getByLabelText("결제 방식"), "transfer");
    replaceSource({ ...source, tuitions: [] });
    await user.click(within(paymentDialog).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(processing.markTuitionPaid).toHaveBeenCalledWith(
        expect.objectContaining({ snapshotId: "tui-1", paymentMethod: "transfer" }),
      ),
    );
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("button", { name: "돈 챙길 일 0건" })).toBeDisabled();
  });

  it("보강 잡기는 결석 사유서 창을 열고 추천 날짜에 정규 등원 요일을 뺀다", async () => {
    const { processing } = renderTasks();
    const { user, dialog } = await openGroup(/보강 잡기/);

    await user.click(within(dialog).getByRole("button", { name: "보강·패스 정하기" }));

    const resolution = await screen.findByRole("dialog", { name: "결석 사유서" });
    expect(processing.loadAttendeeCounts).toHaveBeenCalledWith("2026-11");
    expect(processing.loadAttendeeCounts).toHaveBeenCalledWith("2026-12");
    await user.click(within(resolution).getByRole("radio", { name: "보강" }));
    // 결석일(수) 다음 날부터 월~금 중 수요일을 빼고 추천한다.
    const recommended = await within(resolution).findByRole("radiogroup", { name: "추천 보강일" });
    expect(within(recommended).queryByRole("radio", { name: /11\/25 \(수\)/ })).not.toBeInTheDocument();
    expect(within(recommended).getByRole("radio", { name: /11\/19 \(목\)/ })).toBeInTheDocument();
  });

  it("회차권 재등록은 학생·악기를 미리 고른 등록 창에서 저장한다", async () => {
    const { processing } = renderTasks({
      taskSource: {
        ...source,
        lessonTickets: [
          {
            grantId: "grant-low",
            studentId: "stu-2",
            instrumentId: "piano",
            studentName: "서준",
            instrumentName: "피아노",
            paymentStatus: "paid",
            dueOn: "2026-10-01",
            remainingCount: 1,
            validUntil: "2026-12-31",
            amount: 320000,
            contact: null,
          },
        ],
      },
    });
    vi.mocked(processing.loadTicketRegistrationOptions).mockResolvedValue([
      { studentId: "stu-2", studentName: "서준", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] },
    ]);
    const { user, dialog } = await openGroup(/학부모 연락/);

    await user.click(within(dialog).getByRole("button", { name: "재등록" }));
    const form = await screen.findByRole("form", { name: "회차권 등록 입력" });
    await waitFor(() => expect(within(form).getByLabelText("원생")).toHaveValue("stu-2"));
    await user.type(within(form).getByRole("textbox", { name: "결제 금액" }), "320000");
    await user.click(within(form).getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(processing.registerLessonTicket).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: "stu-2", instrumentId: "piano", paidAmount: 320000 }),
      ),
    );
  });

  it("휴대폰 폭에서는 같은 목록을 아래에서 올라오는 시트로 연다", async () => {
    isMobile = true;
    renderTasks();
    const { dialog } = await openGroup(/교재 입고/);

    expect(dialog).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(within(dialog).getByRole("button", { name: "입고 확인" })).toBeInTheDocument();
  });
});

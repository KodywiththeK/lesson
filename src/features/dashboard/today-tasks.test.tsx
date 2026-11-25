import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";

import { TodayTasks, type TodayTasksDataAccess } from "./today-tasks";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const source: DailyTaskSource = {
  unresolvedAbsences: [
    {
      attendanceId: "att-1",
      lessonDate: "2026-11-18",
      studentId: "stu-1",
      studentName: "유나",
      teacherIds: ["teacher-kim"],
      instrumentName: "바이올린",
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
    },
  ],
  consultations: [],
  pendingBookOrders: [],
};

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
  const dataAccess: TodayTasksDataAccess = {
    loadSource: vi.fn(async () => taskSource),
    loadStates: vi.fn(async () => savedStates),
    saveState: vi.fn(async ({ taskKey, state }) => {
      savedStates = savedStates.filter((item) => item.taskKey !== taskKey);
      if (state) {
        savedStates.push({ taskKey, state, updatedByName: "원장", updatedAt: "2026-11-19T01:00:00Z" });
      }
    }),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <TodayTasks
        academyId="academy-1"
        permissionContext={{ role, teacherId: role === "teacher" ? "teacher-kim" : undefined }}
        today="2026-11-19"
        dataAccess={dataAccess}
      />
    </QueryClientProvider>,
  );

  return dataAccess;
}

describe("TodayTasks", () => {
  it("오늘 할 일과 답변 대기 건수를 탭에 보여 주고, 원장은 금액까지 본다", async () => {
    renderTasks();

    const list = await screen.findByRole("list", { name: "할 일 목록" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /할 일 3/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /답변 대기 0/ })).toBeInTheDocument();
    expect(within(list).getByText(/150,000원/)).toBeInTheDocument();
  });

  it("데스크는 수납 할 일을 금액 없이 본다(서버가 금액을 비워 보낸다)", async () => {
    renderTasks({
      role: "desk",
      taskSource: { ...source, tuitions: source.tuitions.map((tuition) => ({ ...tuition, amount: null })) },
    });

    const list = await screen.findByRole("list", { name: "할 일 목록" });
    expect(within(list).getByText("단율 피아노 11월 수강료 입금 확인")).toBeInTheDocument();
    expect(within(list).queryByText(/150,000원/)).not.toBeInTheDocument();
  });

  it("'답변 대기로'를 누르면 공유 상태로 저장하고 답변 대기 탭으로 옮긴다", async () => {
    const user = userEvent.setup();
    const dataAccess = renderTasks();
    const list = await screen.findByRole("list", { name: "할 일 목록" });
    const item = within(list).getByText("유나 학부모님께 변경 시간 안내").closest("li") as HTMLElement;

    await user.click(within(item).getByRole("button", { name: "답변 대기로" }));

    expect(dataAccess.saveState).toHaveBeenCalledWith({ taskKey: "lesson-change:audit-1", state: "waiting_reply" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /답변 대기 1/ })).toBeInTheDocument());

    await user.click(screen.getByRole("tab", { name: /답변 대기 1/ }));
    const waiting = await screen.findByRole("list", { name: "답변 대기 목록" });
    expect(within(waiting).getByText("유나 학부모님께 변경 시간 안내")).toBeInTheDocument();
    expect(within(waiting).getByText(/원장/)).toBeInTheDocument();
  });

  it("완료 버튼은 사람이 확인해야 하는 할 일에만 있고, 자동 할 일은 바로가기만 둔다", async () => {
    renderTasks();
    const list = await screen.findByRole("list", { name: "할 일 목록" });

    const manual = within(list).getByText("유나 학부모님께 변경 시간 안내").closest("li") as HTMLElement;
    const auto = within(list).getByText("유나 바이올린 보강 날짜 잡기").closest("li") as HTMLElement;

    expect(within(manual).getByRole("button", { name: "완료" })).toBeInTheDocument();
    expect(within(auto).queryByRole("button", { name: "완료" })).not.toBeInTheDocument();
    expect(within(auto).getByRole("link", { name: /보강 날짜 잡기/ })).toHaveAttribute("href", "/lessons/academy");
  });

  it("선생님은 담당 학생 할 일을 보기만 하고 상태를 바꾸는 버튼이 없다(학부모 연락은 원장·데스크)", async () => {
    renderTasks({ role: "teacher" });

    const list = await screen.findByRole("list", { name: "할 일 목록" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("상태는 원장·데스크가 바꿉니다.")).toBeInTheDocument();
  });

  it("할 일이 없으면 빈 안내를 보여 준다", async () => {
    renderTasks({
      taskSource: { ...source, unresolvedAbsences: [], tuitions: [], lessonChanges: [] },
    });

    expect(await screen.findByText("오늘 챙길 일이 없습니다.")).toBeInTheDocument();
  });
});

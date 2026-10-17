import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

const api = vi.hoisted(() => ({
  fetchWorkspace: vi.fn(),
  markPrivateAttendance: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("@/lib/api/lesson-monthly-notes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-monthly-notes")>()),
  fetchLessonMonthlyNote: vi.fn(async () => null),
}));
vi.mock("@/lib/api/private-lessons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/private-lessons")>()),
  markPrivateLessonAttendance: api.markPrivateAttendance,
}));
vi.mock("@/lib/api/lesson-workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-workspace")>()),
  createLessonWorkspaceQueryOptions: (_client: unknown, input: { academyId: string; month: string }) => ({
    queryKey: ["test", "lesson-workspace", input.academyId, input.month],
    queryFn: api.fetchWorkspace,
  }),
}));

type User = ReturnType<typeof userEvent.setup>;

async function openConnectedPrivateDay(user: User) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind="private"
        initialDate="2026-08-21"
      />
    </QueryClientProvider>,
  );
  const grid = await screen.findByRole("grid", { name: "2026년 8월 개인레슨 캘린더" });
  await user.click(within(grid).getByRole("gridcell", { name: /21/ }));

  return screen.findByRole("dialog", { name: "2026-08-21 개인레슨 출석 확인" });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchWorkspace.mockResolvedValue(demoLessonWorkspaceData);
  api.markPrivateAttendance.mockResolvedValue(undefined);
});

describe("개인레슨 결석 사유 서버 연결", () => {
  it("입력한 사유를 결석 저장 요청에 담아 보내고 결석인원 표에 반영한다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    const dialog = await openConnectedPrivateDay(user);

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dialog).getByRole("textbox", { name: "결석 사유 (선택)" }), " 감기로 결석 ");
    await user.click(within(dialog).getByRole("button", { name: "결석 저장" }));

    await waitFor(() => expect(api.markPrivateAttendance).toHaveBeenCalledTimes(1));
    expect(api.markPrivateAttendance.mock.calls[0][1]).toMatchObject({
      academyId: "academy-demo",
      lessonEventId: "private-lesson-1",
      status: "absent",
      reason: "감기로 결석",
    });
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith("결석 처리했습니다. 회차권은 차감되지 않습니다."),
    );

    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "결석인원" }));
    const absences = await screen.findByRole("dialog", { name: "2026년 8월 개인레슨 결석인원" });
    expect(absences).toHaveTextContent("한서아");
    expect(absences).toHaveTextContent("감기로 결석");
  });

  it("사유를 비우면 reason 없이 보낸다(서버가 기본 문구를 쓴다)", async () => {
    const user = userEvent.setup();
    const dialog = await openConnectedPrivateDay(user);

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.click(within(dialog).getByRole("button", { name: "결석 저장" }));

    await waitFor(() => expect(api.markPrivateAttendance).toHaveBeenCalledTimes(1));
    expect(api.markPrivateAttendance.mock.calls[0][1].reason).toBeUndefined();
  });

  it("이미 결석인 수업의 사유 수정은 같은 요청으로 사유만 다시 보내고 수정했다고 알린다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    const dialog = await openConnectedPrivateDay(user);

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.click(within(dialog).getByRole("button", { name: "결석 저장" }));
    await user.click(await within(dialog).findByRole("button", { name: "한서아 개인레슨 결석 사유 수정" }));
    await user.type(within(dialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "독감");
    await user.click(within(dialog).getByRole("button", { name: "사유 저장" }));

    await waitFor(() => expect(api.markPrivateAttendance).toHaveBeenCalledTimes(2));
    expect(api.markPrivateAttendance.mock.calls[1][1]).toMatchObject({
      lessonEventId: "private-lesson-1",
      status: "absent",
      reason: "독감",
    });
    await waitFor(() => expect(success).toHaveBeenLastCalledWith("결석 사유를 수정했습니다."));
  });

  it("저장에 실패하면 결석으로 바꾸지 않고 오류를 안내한다", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    api.markPrivateAttendance.mockRejectedValue(new Error("개인레슨 출결을 저장하지 못했습니다."));
    const dialog = await openConnectedPrivateDay(user);

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "감기로 결석");
    await user.click(within(dialog).getByRole("button", { name: "결석 저장" }));

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" })).toBeInTheDocument();
    // 입력한 사유는 지워지지 않아 다시 입력하지 않고 저장을 다시 시도할 수 있다.
    expect(within(dialog).getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("감기로 결석");
  });
});

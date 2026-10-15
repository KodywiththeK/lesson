import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteLessonCalendarMemo } from "@/lib/api/lesson-memos";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

// 날짜 메모 삭제가 실제 저장소(API) 경로에서 확인 뒤에만, 한 번만 요청되는지 확인한다.
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({}),
}));

vi.mock("@/lib/api/lesson-workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-workspace")>()),
  createLessonWorkspaceQueryOptions: (
    _client: unknown,
    input: { academyId: string; month: string },
  ) => ({
    queryKey: ["lesson-workspace-test", input.academyId, input.month],
    queryFn: async () =>
      (await import("@/lib/demo/lesson-demo-data")).demoLessonWorkspaceData,
  }),
}));

vi.mock("@/lib/api/lesson-memos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-memos")>()),
  deleteLessonCalendarMemo: vi.fn(),
}));

const MEMO_CONTENT = "[2026-08-21] 5시 피아노반 박지호 연락 대기";
const deleteMemoRequest = vi.mocked(deleteLessonCalendarMemo);

async function openMemoDeleteConfirmation() {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        initialDate="2026-08-21"
      />
    </QueryClientProvider>,
  );

  const calendar = await screen.findByRole("grid", {
    name: "2026년 8월 학원레슨 캘린더",
  });
  await user.click(within(calendar).getByRole("gridcell", { name: /21/ }));

  const dayDialog = await screen.findByRole("dialog", {
    name: "2026-08-21 출석 확인",
  });
  await user.click(within(dayDialog).getByRole("tab", { name: "메모 1" }));
  await user.click(
    within(dayDialog).getByRole("button", { name: `${MEMO_CONTENT} 메모 삭제` }),
  );

  return {
    user,
    dayDialog,
    confirmDialog: await screen.findByRole("alertdialog", {
      name: "이 메모를 삭제할까요?",
    }),
  };
}

describe("날짜 메모 삭제 확인", () => {
  beforeEach(() => {
    deleteMemoRequest.mockReset();
  });

  it("확인하기 전에는 삭제를 요청하지 않고 취소하면 메모가 남는다", async () => {
    const { user, dayDialog, confirmDialog } = await openMemoDeleteConfirmation();

    expect(deleteMemoRequest).not.toHaveBeenCalled();

    await user.click(within(confirmDialog).getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(deleteMemoRequest).not.toHaveBeenCalled();
    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
    expect(dayDialog).toHaveTextContent(MEMO_CONTENT);
  });

  it("삭제를 확인하면 한 번만 요청하고 처리 중에는 버튼을 막는다", async () => {
    let finishDelete: () => void = () => undefined;
    deleteMemoRequest.mockReturnValue(
      new Promise<void>((resolve) => {
        finishDelete = resolve;
      }),
    );
    const { user, dayDialog, confirmDialog } = await openMemoDeleteConfirmation();
    const confirmButton = within(confirmDialog).getByRole("button", { name: "삭제" });

    await user.dblClick(confirmButton);

    await waitFor(() => expect(confirmButton).toBeDisabled());
    expect(within(confirmDialog).getByRole("button", { name: "취소" })).toBeDisabled();
    expect(deleteMemoRequest).toHaveBeenCalledTimes(1);
    expect(deleteMemoRequest).toHaveBeenCalledWith(expect.anything(), {
      academyId: "academy-demo",
      memoId: "academy-memo-2026-08-21-1",
    });

    finishDelete();

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(within(dayDialog).getByRole("tab", { name: "메모 0" })).toBeInTheDocument();
    expect(dayDialog).toHaveTextContent("선택한 날짜에 작성된 메모가 없습니다.");
  });

  it("삭제에 실패하면 메모를 지우지 않고 다시 시도할 수 있게 둔다", async () => {
    deleteMemoRequest.mockRejectedValueOnce(new Error("메모를 삭제하지 못했습니다."));
    const { user, dayDialog, confirmDialog } = await openMemoDeleteConfirmation();
    const confirmButton = within(confirmDialog).getByRole("button", { name: "삭제" });

    await user.click(confirmButton);

    await waitFor(() => expect(deleteMemoRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(confirmButton).toBeEnabled());
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await user.click(within(confirmDialog).getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
  });
});

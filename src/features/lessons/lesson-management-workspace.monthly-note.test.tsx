import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchLessonMonthlyNote,
  markLessonMonthlyNoteRead,
  saveLessonMonthlyNote,
} from "@/lib/api/lesson-monthly-notes";
import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

// 실서비스 경로는 월별 메모지 API 호출 인자와 화면 반영만 확인한다. 화면 흐름은 데모 경로로 확인한다.
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
    queryFn: async () => demoLessonWorkspaceData,
  }),
}));

vi.mock("@/lib/api/lesson-monthly-notes", () => ({
  fetchLessonMonthlyNote: vi.fn(),
  saveLessonMonthlyNote: vi.fn(),
  markLessonMonthlyNoteRead: vi.fn(),
}));

const fetchNote = vi.mocked(fetchLessonMonthlyNote);
const saveNote = vi.mocked(saveLessonMonthlyNote);
const markNoteRead = vi.mocked(markLessonMonthlyNoteRead);

function renderWorkspace({
  lessonKind = "academy",
  canManage,
  injectDemoData = true,
}: {
  lessonKind?: "academy" | "private";
  canManage?: boolean;
  injectDemoData?: boolean;
} = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind={lessonKind}
        initialDate="2026-08-21"
        canManage={canManage}
        demoData={injectDemoData ? demoLessonWorkspaceData : undefined}
      />
    </QueryClientProvider>,
  );
}

describe("월별 메모지 (데모 경로)", () => {
  it("학원레슨표에서 메모를 저장하면 미확인으로 표시하고, 확인 버튼을 눌러야 해제한다", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByRole("region", { name: "8월 학원레슨 메모지" })).toBeInTheDocument();
    expect(screen.getByText("이 달의 메모가 없습니다.")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), "김하늘 학부모님 전화 옴");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("미확인")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue(
      "김하늘 학부모님 전화 옴",
    );

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.queryByText("미확인")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
  });

  it("달을 옮겨도 달마다 따로 적은 메모가 사라지지 않는다", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), "8월 특이사항");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await user.click(screen.getByRole("button", { name: "학원 레슨 캘린더 다음 달" }));
    expect(screen.getByRole("region", { name: "9월 학원레슨 메모지" })).toBeInTheDocument();
    expect(screen.getByText("이 달의 메모가 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "9월 메모 내용" })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "학원 레슨 캘린더 이전 달" }));
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue("8월 특이사항");
  });

  it("개인레슨표에도 같은 메모지가 있다", () => {
    renderWorkspace({ lessonKind: "private" });

    expect(screen.getByRole("region", { name: "8월 개인레슨 메모지" })).toBeInTheDocument();
  });

  it("선생님처럼 관리 권한이 없으면 메모지를 보여 주지 않는다", () => {
    renderWorkspace({ canManage: false });

    expect(screen.queryByRole("region", { name: "8월 학원레슨 메모지" })).not.toBeInTheDocument();
  });
});

describe("월별 메모지 (실서비스 경로)", () => {
  beforeEach(() => {
    fetchNote.mockReset();
    saveNote.mockReset();
    markNoteRead.mockReset();
  });

  it("학원·레슨 종류·월 기준으로 불러와 미확인 메모를 보여 주고 확인하면 서버에 반영한다", async () => {
    const user = userEvent.setup();
    fetchNote.mockResolvedValue({
      content: "이서윤 보강 일정 조율",
      unread: true,
      updatedAt: "2026-08-20T09:00:00+09:00",
    });
    markNoteRead.mockResolvedValue({
      content: "이서윤 보강 일정 조율",
      unread: false,
      updatedAt: "2026-08-20T09:00:00+09:00",
    });
    renderWorkspace({ lessonKind: "private", injectDemoData: false });

    expect(await screen.findByDisplayValue("이서윤 보강 일정 조율")).toBeInTheDocument();
    expect(fetchNote).toHaveBeenCalledWith(expect.anything(), {
      academyId: "academy-demo",
      lessonKind: "private",
      month: "2026-08",
    });
    expect(screen.getByText("미확인")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(markNoteRead).toHaveBeenCalledWith(expect.anything(), {
        academyId: "academy-demo",
        lessonKind: "private",
        month: "2026-08",
      }),
    );
    await waitFor(() => expect(screen.queryByText("미확인")).not.toBeInTheDocument());
  });

  it("저장하면 학원·레슨 종류·월과 내용을 서버에 넘기고 미확인으로 보여 준다", async () => {
    const user = userEvent.setup();
    fetchNote.mockResolvedValue(null);
    saveNote.mockResolvedValue({
      content: "새 메모",
      unread: true,
      updatedAt: "2026-08-21T09:00:00+09:00",
    });
    renderWorkspace({ injectDemoData: false });

    await user.type(await screen.findByRole("textbox", { name: "8월 메모 내용" }), "새 메모");
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(saveNote).toHaveBeenCalledWith(expect.anything(), {
        academyId: "academy-demo",
        lessonKind: "academy",
        month: "2026-08",
        content: "새 메모",
      }),
    );
    expect(await screen.findByText("미확인")).toBeInTheDocument();
  });

  it("불러오지 못하면 사용자 문구로 알리고 레슨표는 계속 쓸 수 있다", async () => {
    fetchNote.mockRejectedValue(new Error("월별 메모를 불러오지 못했습니다: boom"));
    renderWorkspace({ injectDemoData: false });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" })).toBeInTheDocument();
  });
});

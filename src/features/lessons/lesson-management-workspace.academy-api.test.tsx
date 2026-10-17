import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

const api = vi.hoisted(() => ({
  fetchWorkspace: vi.fn(),
  resolveAbsence: vi.fn(),
  deleteEvent: vi.fn(),
  moveEvent: vi.fn(),
  resetAttendance: vi.fn(),
  attendeeCounts: vi.fn(),
  markAttendance: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("@/lib/api/lesson-monthly-notes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-monthly-notes")>()),
  fetchLessonMonthlyNote: vi.fn(async () => null),
}));
vi.mock("@/lib/api/academy-lessons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/academy-lessons")>()),
  markDailyAcademyLessonAttendance: api.markAttendance,
}));
vi.mock("@/lib/api/lesson-workspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/lesson-workspace")>()),
  createLessonWorkspaceQueryOptions: (_client: unknown, input: { academyId: string; month: string }) => ({
    queryKey: ["test", "lesson-workspace", input.academyId, input.month],
    queryFn: api.fetchWorkspace,
  }),
  resolveAcademyLessonAbsence: api.resolveAbsence,
  deleteAcademyLessonEvent: api.deleteEvent,
  moveAcademyLessonEvent: api.moveEvent,
  resetAcademyLessonAttendance: api.resetAttendance,
  fetchAcademyAttendeeCounts: api.attendeeCounts,
}));

type User = ReturnType<typeof userEvent.setup>;

async function renderConnectedWorkspace() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind="academy"
        initialDate="2026-08-21"
      />
    </QueryClientProvider>,
  );

  await screen.findByRole("grid", { name: "2026년 8월 학원레슨 캘린더" });
}

async function openResolutionSheet(user: User) {
  await user.click(screen.getByRole("button", { name: "결석인원" }));
  const absenceDialog = await screen.findByRole("dialog", { name: "2026년 8월 결석인원" });
  await user.click(within(absenceDialog).getByRole("button", { name: "박지호 결석확인" }));

  return screen.findByRole("dialog", { name: "결석 사유서" });
}

async function chooseMakeupAndConfirm(user: User, sheet: HTMLElement) {
  await user.click(within(sheet).getByRole("radio", { name: "보강" }));
  await user.click(within(sheet).getByRole("button", { name: "확인" }));

  return screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchWorkspace.mockResolvedValue(demoLessonWorkspaceData);
  api.attendeeCounts.mockResolvedValue({});
});

describe("학원 레슨표 서버 연결", () => {
  it("보강 확정은 사유서 내용을 서버에 보내고 서버가 만든 보강 일정을 달력에 보여 준다", async () => {
    const user = userEvent.setup();
    api.resolveAbsence.mockResolvedValue({
      resolution: "makeup",
      makeupLessonEventId: "server-makeup-1",
      memoLine: "박지호, 8/24 [월요일] 보강 - 8/21 [금요일]",
      month: "2026-08",
    });
    await renderConnectedWorkspace();

    const sheet = await openResolutionSheet(user);
    await user.type(within(sheet).getByLabelText("사유 메모"), "감기");
    const confirm = await chooseMakeupAndConfirm(user, sheet);
    await user.click(within(confirm).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
    expect(api.resolveAbsence).toHaveBeenCalledTimes(1);
    expect(api.resolveAbsence.mock.calls[0][1]).toEqual({
      academyId: "academy-demo",
      sourceLessonEventId: "academy-lesson-3",
      studentId: "student-3",
      resolution: "makeup",
      targetDate: "2026-08-24",
      startTime: undefined,
      endTime: undefined,
      reason: "감기",
    });
  });

  it("보강 시간을 입력하면 시작·종료 시간을 함께 보낸다", async () => {
    const user = userEvent.setup();
    api.resolveAbsence.mockResolvedValue({
      resolution: "makeup",
      makeupLessonEventId: "server-makeup-1",
      memoLine: "",
      month: "2026-08",
    });
    await renderConnectedWorkspace();

    const sheet = await openResolutionSheet(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.type(within(sheet).getByLabelText("보강 시간"), "18:30");
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" })).getByRole("button", {
        name: "확인",
      }),
    );

    await waitFor(() => expect(api.resolveAbsence).toHaveBeenCalled());
    expect(api.resolveAbsence.mock.calls[0][1]).toMatchObject({
      startTime: "18:30",
      endTime: "19:20",
    });
  });

  it("서버가 거부하면 사용자 문구로 알리고 사유서와 결석인원 목록을 그대로 둔다", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    api.resolveAbsence.mockRejectedValue(
      new Error("결석 사유서를 저장하지 못했습니다: 이미 보강 또는 패스로 처리된 결석입니다."),
    );
    await renderConnectedWorkspace();

    const sheet = await openResolutionSheet(user);
    const confirm = await chooseMakeupAndConfirm(user, sheet);
    await user.click(within(confirm).getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("결석 사유서 저장에 실패했습니다.", {
        description: "이미 보강 또는 패스로 처리된 결석입니다.",
      }),
    );
    expect(screen.getByRole("dialog", { name: "결석 사유서" })).toBeInTheDocument();
    // 사유서가 위에 떠 있어 결석인원 목록은 숨김 상태로 찾는다.
    const absenceDialog = screen
      .getAllByRole("dialog", { hidden: true })
      .find((dialog) => dialog.textContent?.includes("결석인원"));
    expect(absenceDialog).toHaveTextContent("박지호");
  });

  it("저장하는 동안 최종확인 버튼을 다시 눌러도 한 번만 보낸다", async () => {
    const user = userEvent.setup();
    let finish: (value: unknown) => void = () => undefined;
    api.resolveAbsence.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await renderConnectedWorkspace();

    const sheet = await openResolutionSheet(user);
    const confirm = await chooseMakeupAndConfirm(user, sheet);
    await user.click(within(confirm).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(within(confirm).getByRole("button", { name: "확인" })).toBeDisabled());
    await user.click(within(confirm).getByRole("button", { name: "확인" }));

    expect(api.resolveAbsence).toHaveBeenCalledTimes(1);

    finish({ resolution: "makeup", makeupLessonEventId: "m1", memoLine: "", month: "2026-08" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
  });

  it("서버에서 이미 처리된 결석은 새로 불러와도 다시 처리할 수 없다", async () => {
    const user = userEvent.setup();
    const [firstSheet, ...otherSheets] = demoLessonWorkspaceData.academySheets;
    api.fetchWorkspace.mockResolvedValue({
      ...demoLessonWorkspaceData,
      academySheets: [
        {
          ...firstSheet,
          rows: firstSheet.rows.map((row) =>
            row.lessonEventId === "academy-lesson-3" ? { ...row, absenceResolution: "makeup" } : row,
          ),
        },
        ...otherSheets,
      ],
    });
    await renderConnectedWorkspace();

    await user.click(screen.getByRole("button", { name: "결석인원" }));
    const absenceDialog = await screen.findByRole("dialog", { name: "2026년 8월 결석인원" });

    const row = within(absenceDialog).getByRole("row", { name: /박지호/ });
    expect(within(row).getByText("보강 완료")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "박지호 결석확인" })).not.toBeInTheDocument();
  });

  it("보강 후보가 다음 달로 넘어가면 다음 달 등원 인원을 조회해 추천에 반영한다", async () => {
    const user = userEvent.setup();
    api.attendeeCounts.mockResolvedValue({ "2026-08-31": 5, "2026-09-01": 0 });
    await renderConnectedWorkspace();

    const sheet = await openResolutionSheet(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));

    await waitFor(() =>
      expect(
        within(sheet)
          .getAllByRole("radio", { name: /\(.\) · \d+명/ })
          .map((option) => option.getAttribute("aria-label")),
      ).toEqual([
        "8/24 (월) · 0명",
        "8/25 (화) · 0명",
        "8/26 (수) · 0명",
        "8/27 (목) · 0명",
        "9/1 (화) · 0명",
      ]),
    );
    expect(api.attendeeCounts).toHaveBeenCalledWith(expect.anything(), {
      academyId: "academy-demo",
      month: "2026-09",
    });
  });

  it("출석확인은 고른 원생만 한 번에 저장한다", async () => {
    const user = userEvent.setup();
    api.markAttendance.mockResolvedValue(undefined);
    await renderConnectedWorkspace();

    await user.click(within(screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" })).getByRole("gridcell", { name: /^21/ }));
    const dialog = await screen.findByRole("dialog", { name: "2026-08-21 출석 확인" });
    await user.click(within(dialog).getByRole("radio", { name: "이서윤 결석" }));
    await user.click(within(dialog).getByRole("radio", { name: "박지호 등원" }));
    await user.click(within(dialog).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(api.markAttendance).toHaveBeenCalledTimes(1));
    const input = api.markAttendance.mock.calls[0][1];
    expect(input.academyId).toBe("academy-demo");
    expect(input.records.map((record: { lessonEventId: string; status: string }) => [record.lessonEventId, record.status])).toEqual([
      ["academy-lesson-2", "absent"],
      ["academy-lesson-3", "present"],
    ]);
  });

  it("삭제는 사유와 함께 서버에 보내고 실패하면 일정을 그대로 둔다", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    api.deleteEvent.mockRejectedValueOnce(new Error("학원 일정을 삭제하지 못했습니다: 삭제할 학원 일정을 찾지 못했습니다."));
    api.deleteEvent.mockResolvedValueOnce(undefined);
    await renderConnectedWorkspace();

    await user.click(within(screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" })).getByRole("gridcell", { name: /^21/ }));
    const dialog = await screen.findByRole("dialog", { name: "2026-08-21 출석 확인" });
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 삭제" }));
    const confirm = await screen.findByRole("alertdialog", { name: "이 일정을 삭제할까요?" });
    await user.type(within(confirm).getByLabelText("삭제 사유"), "휴원");
    await user.click(within(confirm).getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(error).toHaveBeenCalledWith("학원 일정 삭제에 실패했습니다.", {
        description: "삭제할 학원 일정을 찾지 못했습니다.",
      }),
    );
    expect(within(dialog).getByRole("row", { name: /이서윤/, hidden: true })).toBeInTheDocument();

    await user.click(within(confirm).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.deleteEvent).toHaveBeenLastCalledWith(expect.anything(), {
      academyId: "academy-demo",
      lessonEventId: "academy-lesson-2",
      reason: "휴원",
    });
    expect(within(dialog).queryByRole("row", { name: /이서윤/ })).not.toBeInTheDocument();
  });
});

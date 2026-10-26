import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

function renderPrivateWorkspace(
  props: Partial<ComponentProps<typeof LessonManagementWorkspace>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind="private"
        initialDate="2026-08-21"
        demoData={demoLessonWorkspaceData}
        {...props}
      />
    </QueryClientProvider>,
  );
}

async function openDay(user: ReturnType<typeof userEvent.setup>, day: RegExp) {
  await user.click(
    within(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).getByRole("gridcell", { name: day }),
  );

  return screen.findByRole("dialog", { name: "2026-08-21 개인레슨 출석 확인" });
}

afterEach(() => vi.restoreAllMocks());

describe("개인레슨 달력 일정 표시 (명세 3.3)", () => {
  it("날짜 칸에 시간과 `원생명 (악기) - 선생님명`을 보라색 점과 함께 보여 준다", () => {
    renderPrivateWorkspace();

    const grid = screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" });

    expect(grid).toHaveTextContent("오후 6시");
    expect(grid).toHaveTextContent("한서아 (바이올린) - 오유진 선생님");
    expect(grid).toHaveTextContent("오전 10:30");
    expect(grid).toHaveTextContent("최도윤 (첼로) - 문서준 선생님");
    expect(grid.querySelector('[data-slot="calendar-event-dot"]')).not.toBeNull();
  });
});

describe("개인레슨 출석 확인과 취소 (명세 3.4)", () => {
  it("등원 확인을 누르면 출석 상태와 현재/총 회차가 보이고, 취소하면 예정으로 돌아가 회차권 복구를 알린다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderPrivateWorkspace();

    const dialog = await openDay(user, /21/);

    expect(within(dialog).getByText("1/4")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /등원 확인 취소/ })).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }));

    expect(success).toHaveBeenCalledWith("출석 처리하고 회차권 1회를 차감했습니다.");
    expect(within(dialog).getByText("출석")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인 취소" }));

    expect(success).toHaveBeenCalledWith("등원 확인을 취소하고 회차권 1회를 복구했습니다.");
    expect(within(dialog).getByText("예정")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /등원 확인 취소/ })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "한서아 개인레슨 결석" })).toBeEnabled();
  });

  it("등원 확인 취소를 상위 처리기에 알린다", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onMark = vi.fn();
    renderPrivateWorkspace({
      onMarkPrivateLessonAttendance: onMark,
      onCancelPrivateLessonAttendance: onCancel,
    });

    const dialog = await openDay(user, /21/);
    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }));
    await user.click(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인 취소" }));

    expect(onMark).toHaveBeenCalledWith("private-lesson-1", "present", undefined);
    expect(onCancel).toHaveBeenCalledWith("private-lesson-1");
  });
});

describe("날짜에서 개인레슨 등록 (명세 3.2)", () => {
  it("출석 확인 창의 버튼으로 그 날짜가 채워진 레슨 일정 등록창을 연다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace();

    const dialog = await openDay(user, /21/);
    await user.click(within(dialog).getByRole("button", { name: "이 날짜에 개인레슨 등록" }));

    const registration = await screen.findByRole("dialog", { name: "레슨 일정 등록" });
    expect(within(registration).getByLabelText("날짜")).toHaveValue("2026-08-21");
    expect(screen.queryByRole("dialog", { name: "2026-08-21 개인레슨 출석 확인" })).toBeNull();
  });

  it("선생님 역할(canManage=false)은 등록 버튼을 보지 못하지만 출석 확인은 계속 할 수 있다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ canManage: false });

    expect(screen.queryByRole("button", { name: "개인레슨 등록" })).toBeNull();

    const dialog = await openDay(user, /21/);

    expect(within(dialog).queryByRole("button", { name: "이 날짜에 개인레슨 등록" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" })).toBeEnabled();
  });

  it("선생님 역할에게는 날짜 메모 탭을 보여 주지 않는다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ canManage: false });

    const dialog = await openDay(user, /21/);

    expect(within(dialog).queryByRole("tab", { name: /메모/ })).toBeNull();
  });

  it("선생님은 담당 악기의 잔여 회수와 만료일만 확인하고 결제 정보는 보지 않는다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({
      canManage: false,
      assignedTicketBalancesQueryFactory: (academyId) => ({
        queryKey: ["assigned-tickets", academyId],
        queryFn: async () => [{ studentId: "student-4", instrumentId: "violin", remainingCount: 2, validUntil: "2026-09-20" }],
      }),
    });

    const dialog = await openDay(user, /21/);
    expect(await within(dialog).findByText("잔여 2회 · 만료일 2026-09-20")).toBeInTheDocument();
    expect(within(dialog).queryByText(/결제 금액/)).not.toBeInTheDocument();
  });

  it("등록창은 달에 이미 있는 같은 선생님 일정과 겹치면 바로 경고한다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace();

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const registration = await screen.findByRole("dialog", { name: "레슨 일정 등록" });
    await within(registration).findByRole("option", { name: "바이올린" });
    await user.selectOptions(within(registration).getByLabelText("악기"), "violin");
    await user.selectOptions(within(registration).getByLabelText("원생"), "student-4");
    await user.selectOptions(within(registration).getByLabelText("선생님"), "teacher-2");
    expect(within(registration).getByLabelText("날짜")).toHaveValue("2026-08-21");
    await user.type(within(registration).getByLabelText("시작 시간"), "18:20");

    expect(within(registration).getByRole("alert")).toHaveTextContent(
      "이미 같은 시간대에 한서아 원생 레슨이 있습니다.",
    );
    expect(within(registration).getByRole("button", { name: "완료" })).toBeDisabled();
  });
});

describe("레슨원생 검색 및 선택 (명세 3.5)", () => {
  async function openSearch(user: ReturnType<typeof userEvent.setup>) {
    renderPrivateWorkspace();
    await user.click(screen.getByRole("button", { name: "레슨원생 검색" }));

    return screen.findByRole("dialog", { name: "레슨원생 검색 및 선택" });
  }

  it("검색 결과가 없으면 안내하고, 선택 전에는 선택된 원생이 없다고 보여 준다", async () => {
    const user = userEvent.setup();
    const dialog = await openSearch(user);

    expect(within(dialog).getByText("선택 원생 레슨 현황")).toBeInTheDocument();
    expect(within(dialog).getByText("선택된 원생이 없습니다.")).toBeInTheDocument();

    await user.type(within(dialog).getByPlaceholderText("원생 이름 검색..."), "없는이름");

    expect(within(dialog).getByText("검색된 원생이 없습니다.")).toBeInTheDocument();
  });

  it("원생을 선택하면 잔여 회차와 최근 레슨, 날짜·요일·회차 목록을 보여 준다", async () => {
    const user = userEvent.setup();
    const dialog = await openSearch(user);

    await user.click(within(dialog).getByRole("button", { name: /한서아/ }));

    expect(within(dialog).getByText("잔여 회차: 바이올린 2회")).toBeInTheDocument();
    expect(within(dialog).getByText("최근 레슨: 2026-08-21 바이올린 예정")).toBeInTheDocument();
    expect(within(dialog).getByText("8/21 (금) - 1/4")).toBeInTheDocument();
    expect(within(dialog).queryByText("선택된 원생이 없습니다.")).toBeNull();
  });

  it("복사는 `8/21 (금) - 1/4` 형태의 텍스트를 클립보드에 넣고, 초기화는 검색어와 선택을 비운다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    const dialog = await openSearch(user);

    expect(within(dialog).getByRole("button", { name: "복사" })).toBeDisabled();

    await user.type(within(dialog).getByRole("searchbox", { name: "레슨원생 검색어" }), "한서아");
    await user.click(within(dialog).getByRole("button", { name: /한서아/ }));
    await user.click(within(dialog).getByRole("button", { name: "복사" }));

    await waitFor(() => expect(success).toHaveBeenCalledWith("레슨 일정을 복사했습니다."));
    expect(await navigator.clipboard.readText()).toBe("8/21 (금) - 1/4");
    expect(within(dialog).getByRole("button", { name: "복사" })).toHaveAttribute("data-variant", "success");

    await user.click(within(dialog).getByRole("button", { name: "초기화" }));

    expect(within(dialog).getByRole("searchbox", { name: "레슨원생 검색어" })).toHaveValue("");
    expect(within(dialog).getByText("선택된 원생이 없습니다.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /최도윤/ })).toBeInTheDocument();
  });

  it("복사에 실패하면 성공이라고 하지 않는다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    const error = vi.spyOn(toast, "error");
    const dialog = await openSearch(user);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(within(dialog).getByRole("button", { name: /한서아/ }));
    await user.click(within(dialog).getByRole("button", { name: "복사" }));

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(success).not.toHaveBeenCalled();
  });

  it("닫기는 창 우측 하단의 X 버튼 하나로 한다", async () => {
    const user = userEvent.setup();
    const dialog = await openSearch(user);

    expect(within(dialog).getAllByRole("button", { name: /닫기|Close/ })).toHaveLength(1);

    await user.click(within(dialog).getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "레슨원생 검색 및 선택" })).toBeNull();
  });
});

describe("선생님별 레슨시간표 (명세 3.6)", () => {
  async function openSchedule(user: ReturnType<typeof userEvent.setup>) {
    renderPrivateWorkspace();
    await user.click(screen.getByRole("button", { name: "레슨시간표 보내기" }));

    return screen.findByRole("dialog", { name: "선생님별 레슨시간표" });
  }

  it("선생님을 고르기 전에는 안내 문구를 보여 주고, 고르면 그 달의 일정을 보여 준다", async () => {
    const user = userEvent.setup();
    const dialog = await openSchedule(user);

    expect(within(dialog).getByLabelText("선생님 선택")).toHaveValue("");
    expect(within(dialog).getByRole("option", { name: "선생님을 선택하세요" })).toBeInTheDocument();
    expect(
      within(dialog).getByText("선생님을 선택하면 해당 월의 레슨 일정이 표시됩니다."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "복사" })).toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText("선생님 선택"), "teacher-3");

    expect(within(dialog).getByLabelText("시간표 내용")).toHaveValue("8/22 최도윤 10:30 첼로");
    expect(
      within(dialog).queryByText("선생님을 선택하면 해당 월의 레슨 일정이 표시됩니다."),
    ).toBeNull();
  });

  it("복사는 녹색, 초기화는 회색 버튼이고 초기화하면 선택 전으로 돌아간다", async () => {
    const user = userEvent.setup();
    const dialog = await openSchedule(user);

    await user.selectOptions(within(dialog).getByLabelText("선생님 선택"), "teacher-3");

    expect(within(dialog).getByRole("button", { name: "복사" })).toHaveAttribute("data-variant", "success");
    expect(within(dialog).getByRole("button", { name: "초기화" })).toHaveAttribute("data-variant", "secondary");

    await user.click(within(dialog).getByRole("button", { name: "초기화" }));

    expect(within(dialog).getByLabelText("선생님 선택")).toHaveValue("");
    expect(
      within(dialog).getByText("선생님을 선택하면 해당 월의 레슨 일정이 표시됩니다."),
    ).toBeInTheDocument();
  });

  it("닫기는 우측 상단 X 아이콘만 있고 푸터에 닫기 버튼이 없다", async () => {
    const user = userEvent.setup();
    const dialog = await openSchedule(user);

    expect(within(dialog).queryByRole("button", { name: "닫기" })).toBeNull();

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "선생님별 레슨시간표" })).toBeNull();
  });
});

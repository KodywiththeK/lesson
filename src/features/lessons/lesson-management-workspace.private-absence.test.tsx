import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PrivateLesson } from "@/domain/private-lesson";
import {
  demoLessonWorkspaceData,
  type LessonWorkspaceDemoData,
} from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

const [firstLesson, secondLesson] = demoLessonWorkspaceData.privateLessons;

function buildLesson(
  overrides: Partial<PrivateLesson> & Pick<PrivateLesson, "id">,
): PrivateLesson {
  return { ...firstLesson, ...overrides };
}

const demoWithAbsences: LessonWorkspaceDemoData = {
  ...demoLessonWorkspaceData,
  privateLessons: [
    buildLesson({ id: "scheduled", studentName: "예정원생", status: "scheduled" }),
    buildLesson({
      id: "absent-late",
      studentName: "한서아",
      startAt: "2026-08-21T18:00:00+09:00",
      endAt: "2026-08-21T18:40:00+09:00",
      status: "absent",
    }),
    buildLesson({
      id: "absent-early",
      studentName: "최도윤",
      instrumentName: "첼로",
      teacherName: "문서준",
      startAt: "2026-08-05T10:30:00+09:00",
      endAt: "2026-08-05T11:30:00+09:00",
      status: "absent",
    }),
    buildLesson({ id: "present", studentName: "출석원생", status: "present" }),
    buildLesson({
      id: "absent-next-month",
      studentName: "구월원생",
      startAt: "2026-09-02T10:00:00+09:00",
      endAt: "2026-09-02T10:40:00+09:00",
      status: "absent",
    }),
  ],
};

function renderPrivateWorkspace(
  props: Partial<ComponentProps<typeof LessonManagementWorkspace>> = {},
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind="private"
        initialDate="2026-08-21"
        demoData={demoWithAbsences}
        {...props}
      />
    </QueryClientProvider>,
  );
}

async function openAbsenceDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "결석인원" }));

  return screen.findByRole("dialog", { name: "2026년 8월 개인레슨 결석인원" });
}

afterEach(() => vi.restoreAllMocks());

describe("개인레슨표 결석인원", () => {
  it("조회 중인 달에 결석한 개인레슨을 날짜순으로 한 번에 보여 준다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace();

    const dialog = await openAbsenceDialog(user);
    const rows = within(dialog).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2026-08-05");
    expect(rows[0]).toHaveTextContent("10:30-11:30");
    expect(rows[0]).toHaveTextContent("최도윤");
    expect(rows[0]).toHaveTextContent("첼로");
    expect(rows[0]).toHaveTextContent("문서준");
    expect(rows[1]).toHaveTextContent("2026-08-21");
    expect(rows[1]).toHaveTextContent("한서아");
    expect(dialog).toHaveTextContent("총 2건");
    expect(within(dialog).queryByText("예정원생")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("출석원생")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("구월원생")).not.toBeInTheDocument();
  });

  it("월을 옮기면 그 달의 결석으로 바뀌고 결석이 없으면 빈 상태를 안내한다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace();

    const dialog = await openAbsenceDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "결석인원 다음 달" }));

    const septemberDialog = await screen.findByRole("dialog", {
      name: "2026년 9월 개인레슨 결석인원",
    });
    expect(septemberDialog).toHaveTextContent("구월원생");
    expect(septemberDialog).not.toHaveTextContent("한서아");

    await user.click(within(septemberDialog).getByRole("button", { name: "결석인원 다음 달" }));

    expect(
      await screen.findByRole("dialog", { name: "2026년 10월 개인레슨 결석인원" }),
    ).toHaveTextContent("이 달에는 결석 인원이 없습니다.");
  });

  it("출석 확인에서 결석으로 바꾼 개인레슨이 결석인원에 바로 나타난다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData });

    await user.click(
      within(screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" })).getByRole(
        "gridcell",
        { name: /21/ },
      ),
    );
    const dayDialog = await screen.findByRole("dialog", { name: "2026-08-21 개인레슨 출석 확인" });
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));
    await user.click(within(dayDialog).getByRole("button", { name: "Close" }));

    const dialog = await openAbsenceDialog(user);

    expect(dialog).toHaveTextContent("한서아");
    expect(dialog).not.toHaveTextContent(secondLesson.studentName);
  });

  it("선생님도 결석 목록을 조회하고 담당 수업의 결석 취소를 시도할 수 있다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ canManage: false });

    const dialog = await openAbsenceDialog(user);

    expect(dialog).toHaveTextContent("한서아");
    expect(within(dialog).getByRole("button", { name: "한서아 결석 취소" })).toBeInTheDocument();
  });
});

async function openPrivateDay(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    within(screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" })).getByRole("gridcell", {
      name: /21/,
    }),
  );

  return screen.findByRole("dialog", { name: "2026-08-21 개인레슨 출석 확인" });
}

async function absenceRowOf(user: ReturnType<typeof userEvent.setup>, studentName: string) {
  const dialog = await openAbsenceDialog(user);

  return within(dialog)
    .getAllByRole("row")
    .find((row) => row.textContent?.includes(studentName));
}

describe("개인레슨표 결석 사유", () => {
  it("결석인원 표에 사유 열이 있고 사유가 없거나 기본 문구면 -로 보여 준다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({
      demoData: {
        ...demoWithAbsences,
        privateLessons: demoWithAbsences.privateLessons.map((lesson) =>
          lesson.id === "absent-early"
            ? { ...lesson, absenceReason: "감기로 결석" }
            : lesson.id === "absent-late"
              ? { ...lesson, absenceReason: "결석 확인" }
              : lesson,
        ),
      },
    });

    const dialog = await openAbsenceDialog(user);
    const [early, late] = within(dialog).getAllByRole("row").slice(1);

    expect(within(dialog).getByRole("columnheader", { name: "사유" })).toBeInTheDocument();
    expect(within(early).getByText("감기로 결석")).toBeInTheDocument();
    expect(within(late).queryByText("결석 확인")).not.toBeInTheDocument();
    expect(within(late).getByRole("cell", { name: "-" })).toBeInTheDocument();
  });

  it("출석 확인에서 사유를 입력해 결석 처리하면 결석인원 표 사유 열에 바로 보인다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "감기로 결석");
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));

    expect(success).toHaveBeenCalledWith("결석 처리했습니다. 회차권은 차감되지 않습니다.");
    await user.click(within(dayDialog).getByRole("button", { name: "Close" }));
    expect(await absenceRowOf(user, "한서아")).toHaveTextContent("감기로 결석");
  });

  it("사유를 비우고 결석 처리하면 사유 열에는 -를 보여 준다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));
    await user.click(within(dayDialog).getByRole("button", { name: "Close" }));

    expect(within((await absenceRowOf(user, "한서아"))!).getByRole("cell", { name: "-" })).toBeInTheDocument();
  });

  it("이미 결석인 수업은 사유 수정으로 사유만 바꾸고 수정했다고 알린다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "감기");
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석 사유 수정" }));
    const input = within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" });
    expect(input).toHaveValue("감기");
    await user.clear(input);
    await user.type(input, "독감");
    await user.click(within(dayDialog).getByRole("button", { name: "사유 저장" }));

    expect(success).toHaveBeenLastCalledWith("결석 사유를 수정했습니다.");
    await user.click(within(dayDialog).getByRole("button", { name: "Close" }));
    expect(await absenceRowOf(user, "한서아")).toHaveTextContent("독감");
  });

  it("출석으로 바꾸면 결석 사유는 사라지고 결석인원에서도 빠진다", async () => {
    const user = userEvent.setup();
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "감기");
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 등원 확인" }));
    await user.click(within(dayDialog).getByRole("button", { name: "Close" }));

    expect(await absenceRowOf(user, "한서아")).toBeUndefined();
  });

  it("선생님 역할도 같은 화면에서 사유를 입력해 결석 처리할 수 있다", async () => {
    const user = userEvent.setup();
    const onMark = vi.fn();
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData, canManage: false, onMarkPrivateLessonAttendance: onMark });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.type(within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" }), "감기");
    await user.click(within(dayDialog).getByRole("button", { name: "결석 저장" }));

    expect(onMark).toHaveBeenCalledWith("private-lesson-1", "absent", "감기");
  });

  it("사유가 100자를 넘으면 저장하지 않는다", async () => {
    const user = userEvent.setup();
    const onMark = vi.fn();
    renderPrivateWorkspace({ demoData: demoLessonWorkspaceData, onMarkPrivateLessonAttendance: onMark });

    const dayDialog = await openPrivateDay(user);
    await user.click(within(dayDialog).getByRole("button", { name: "한서아 개인레슨 결석" }));
    await user.click(within(dayDialog).getByRole("textbox", { name: "결석 사유 (선택)" }));
    await user.paste("가".repeat(101));

    expect(within(dayDialog).getByRole("alert")).toHaveTextContent("사유는 100자 이하로 입력해 주세요.");
    expect(within(dayDialog).getByRole("button", { name: "결석 저장" })).toBeDisabled();
    expect(onMark).not.toHaveBeenCalled();
  });
});

describe("개인레슨표 레슨원생 검색 위치", () => {
  it("레슨원생 검색은 보기 전환 탭과 같은 줄의 오른쪽 끝에 두고 도구 모음에는 두지 않는다", () => {
    renderPrivateWorkspace();

    const viewTabs = screen.getByRole("tablist");
    const searchButton = screen.getByRole("button", { name: "레슨원생 검색" });
    const row = viewTabs.closest(".justify-between");

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole("button", { name: "레슨원생 검색" })).toBe(
      searchButton,
    );
    expect(searchButton.closest(".ml-auto")).not.toBeNull();
    expect(
      within(screen.getByRole("toolbar", { name: "개인레슨 도구" })).queryByRole("button", {
        name: "레슨원생 검색",
      }),
    ).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        initialDate="2026-08-21"
        demoData={demoLessonWorkspaceData}
      />
    </QueryClientProvider>,
  );
}

describe("LessonManagementWorkspace", () => {
  it("HTML 와이어프레임의 레슨 관리 탭과 학원 캘린더를 예시 데이터로 보여준다", async () => {
    renderWorkspace();

    expect(
      screen.getByRole("tab", { name: "학원 레슨표" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "개인레슨표" })).toBeInTheDocument();

    const calendar = screen.getByRole("grid", {
      name: "2026년 8월 학원 레슨 캘린더",
    });

    expect(within(calendar).getByText("김민지")).toBeInTheDocument();
    expect(within(calendar).getByText("이서윤")).toBeInTheDocument();
    await userEvent.setup().click(
      within(calendar).getByRole("gridcell", { name: /21/ }),
    );

    const attendanceDialog = screen.getByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    expect(attendanceDialog).toHaveTextContent("15:00-15:50");
  });

  it("미등원 인원을 보강 처리하면 메모지에 사유와 보강일을 남긴다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "미등원인원" }));

    const absentDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 미등원 인원",
    });

    expect(within(absentDialog).getByText("박지호")).toBeInTheDocument();

    await user.click(within(absentDialog).getByRole("button", { name: "박지호 보강 입력" }));

    const makeupDialog = await screen.findByRole("dialog", {
      name: "보강 입력",
    });

    await user.clear(within(makeupDialog).getByLabelText("보강일"));
    await user.type(within(makeupDialog).getByLabelText("보강일"), "2026-08-24");
    await user.type(within(makeupDialog).getByLabelText("보강 사유"), "감기 결석");
    await user.click(within(makeupDialog).getByRole("button", { name: "보강 저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "보강 입력" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "메모지" }));

    const memoDialog = await screen.findByRole("dialog", {
      name: "학원레슨 메모 작성",
    });

    expect(within(memoDialog).getByLabelText("학원레슨 특이사항 메모")).toHaveValue(
      "[2026-08-21] 5시 피아노반 박지호 연락 대기\n[2026-08-21] 박지호 보강 사유: 감기 결석 (보강 예정일: 2026-08-24)",
    );
  });

  it("메모지는 다이얼로그에서 작성하고 저장할 때 반영한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    expect(screen.queryByLabelText("학원레슨 특이사항 메모")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "메모지" }));

    const memoDialog = await screen.findByRole("dialog", {
      name: "학원레슨 메모 작성",
    });
    const memoInput = within(memoDialog).getByLabelText("학원레슨 특이사항 메모");

    await user.clear(memoInput);
    await user.type(memoInput, "리허설 일정 재공지");
    await user.click(within(memoDialog).getByRole("button", { name: "메모 저장" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "학원레슨 메모 작성" }),
      ).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "메모지" }));

    expect(screen.getByLabelText("학원레슨 특이사항 메모")).toHaveValue(
      "리허설 일정 재공지",
    );
  });

  it("개인레슨표에서 선생님별 월간 시간표를 만들고 새 개인레슨을 추가한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "개인레슨표" }));

    const privateToolbar = screen.getByRole("toolbar", {
      name: "개인레슨 도구",
    });

    expect(
      within(privateToolbar).getByRole("button", { name: "개인레슨 등록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).toHaveTextContent("최도윤");

    await user.click(screen.getByRole("button", { name: "레슨시간표 보내기" }));

    const scheduleDialog = await screen.findByRole("dialog", {
      name: "레슨시간표 보내기",
    });

    await user.selectOptions(
      within(scheduleDialog).getByLabelText("선생님 선택"),
      "teacher-3",
    );

    expect(within(scheduleDialog).getByLabelText("시간표 내용")).toHaveValue(
      "8/22 최도윤 10:30 첼로",
    );

    await user.click(within(scheduleDialog).getByRole("button", { name: "닫기" }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const registrationDialog = await screen.findByRole("dialog", {
      name: "개인레슨 등록",
    });

    await user.selectOptions(within(registrationDialog).getByLabelText("원생"), "student-4");
    await user.selectOptions(within(registrationDialog).getByLabelText("악기"), "violin");
    await user.selectOptions(within(registrationDialog).getByLabelText("선생님"), "teacher-2");
    await user.type(
      within(registrationDialog).getByLabelText("시작 시간"),
      "2026-08-23T17:00",
    );
    await user.type(
      within(registrationDialog).getByLabelText("종료 시간"),
      "2026-08-23T17:40",
    );
    await user.click(within(registrationDialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "개인레슨 등록" })).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).toHaveTextContent("한서아");
  });

  it("개인레슨표에서 레슨원생 검색 다이얼로그로 잔여 회차와 최근 레슨을 확인한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "개인레슨표" }));
    await user.click(screen.getByRole("button", { name: "레슨원생 검색" }));

    const searchDialog = await screen.findByRole("dialog", {
      name: "레슨원생 검색",
    });

    expect(within(searchDialog).getByText("한서아")).toBeInTheDocument();
    expect(within(searchDialog).getByText("바이올린 2회")).toBeInTheDocument();
    expect(within(searchDialog).getByText("최근 레슨: 2026-08-21 바이올린 예정")).toBeInTheDocument();

    await user.type(within(searchDialog).getByRole("searchbox", { name: "레슨원생 검색어" }), "최도윤");

    expect(within(searchDialog).queryByText("한서아")).not.toBeInTheDocument();
    expect(within(searchDialog).getByText("최도윤")).toBeInTheDocument();
    expect(within(searchDialog).getByText("첼로 1회")).toBeInTheDocument();
  });
});

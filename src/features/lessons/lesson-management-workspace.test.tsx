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
  it("HTML 와이어프레임의 레슨 관리 탭과 학원 캘린더를 예시 데이터로 보여준다", () => {
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
    expect(
      screen.getByRole("region", { name: "2026-08-21 선택 일정" }),
    ).toHaveTextContent("15:00-15:50");
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

    expect(screen.getByLabelText("학원레슨 특이사항 메모")).toHaveValue(
      "[2026-08-21] 5시 피아노반 박지호 연락 대기\n[2026-08-21] 박지호 보강 사유: 감기 결석 (보강 예정일: 2026-08-24)",
    );
  });

  it("개인레슨표에서 선생님별 월간 시간표를 만들고 새 개인레슨을 추가한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole("tab", { name: "개인레슨표" }));

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
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_ABSENCE_REASON } from "@/domain/academy-lesson-attendance";
import { PRIVATE_ABSENCE_REASON_MAX_LENGTH } from "@/domain/private-lesson";
import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { PrivateDayAttendanceDialog } from "./private-day-attendance-dialog";

const lesson = demoLessonWorkspaceData.privateLessons[0];

function renderDialog(props: Partial<ComponentProps<typeof PrivateDayAttendanceDialog>> = {}) {
  const onMark = vi.fn();

  const { unmount } = render(
    <PrivateDayAttendanceDialog
      open
      academyId="academy-demo"
      date="2026-08-21"
      lessons={[lesson]}
      sessionLabels={new Map()}
      memos={[]}
      memoTargets={{ students: [], teachers: [] }}
      canManage={false}
      pendingLessonIds={new Set()}
      onOpenChange={vi.fn()}
      onCreateMemo={vi.fn()}
      onUpdateMemo={vi.fn()}
      onDeleteMemo={vi.fn()}
      onMark={onMark}
      onCancelAttendance={vi.fn()}
      {...props}
    />,
  );

  return { onMark, unmount, user: userEvent.setup() };
}

describe("PrivateDayAttendanceDialog", () => {
  it("같은 수업의 출결 요청 중에는 등원, 결석, 사유 수정을 다시 누를 수 없다", () => {
    renderDialog({ pendingLessonIds: new Set([lesson.id]) });

    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 등원 확인` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` })).toBeDisabled();
  });

  it("이미 결석인 수업의 사유 수정도 요청 중에는 누를 수 없다", () => {
    renderDialog({
      lessons: [{ ...lesson, status: "absent" }],
      pendingLessonIds: new Set([lesson.id]),
    });

    expect(
      screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석 사유 수정` }),
    ).toBeDisabled();
  });
});

describe("개인레슨 결석 사유 입력", () => {
  it("결석을 누르면 바로 저장하지 않고 사유 입력과 안내를 보여 준다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("");
    expect(screen.getByText(/개인정보는 적지 마세요/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`비우면 .${DEFAULT_ABSENCE_REASON}.으로 저장`))).toBeInTheDocument();
  });

  it("사유를 입력하고 저장하면 결석과 사유를 함께 전달한다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.type(screen.getByRole("textbox", { name: "결석 사유 (선택)" }), " 감기로 결석 ");
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    expect(onMark).toHaveBeenCalledWith(lesson, "absent", "감기로 결석");
    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("사유를 비워 두고 저장하면 사유 없이 결석으로 전달한다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    expect(onMark).toHaveBeenCalledWith(lesson, "absent", undefined);
  });

  it("100자를 넘기면 즉시 안내하고 저장하지 못하게 막는다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    const input = screen.getByRole("textbox", { name: "결석 사유 (선택)" });
    await user.click(input);
    await user.paste("가".repeat(PRIVATE_ABSENCE_REASON_MAX_LENGTH + 1));

    expect(screen.getByRole("alert")).toHaveTextContent("사유는 100자 이하로 입력해 주세요.");
    expect(input).toBeInvalid();
    expect(screen.getByRole("button", { name: "결석 저장" })).toBeDisabled();
    expect(onMark).not.toHaveBeenCalled();
  });

  it("정확히 100자는 저장할 수 있다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.click(screen.getByRole("textbox", { name: "결석 사유 (선택)" }));
    await user.paste("가".repeat(PRIVATE_ABSENCE_REASON_MAX_LENGTH));
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    expect(onMark).toHaveBeenCalledWith(lesson, "absent", "가".repeat(PRIVATE_ABSENCE_REASON_MAX_LENGTH));
  });

  it("취소하면 저장하지 않고 입력창을 닫는다", async () => {
    const { onMark, user } = renderDialog();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.click(screen.getByRole("button", { name: "사유 입력 취소" }));

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("이미 결석인 수업은 사유 수정을 제공하고 현재 사유를 채워 사유만 다시 저장한다", async () => {
    const absentLesson = { ...lesson, status: "absent" as const, absenceReason: "감기" };
    const { onMark, user } = renderDialog({ lessons: [absentLesson] });

    expect(
      screen.queryByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석 사유 수정` }));

    const input = screen.getByRole("textbox", { name: "결석 사유 (선택)" });
    expect(input).toHaveValue("감기");
    expect(screen.getByText(/회차권에는 영향이 없습니다/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "독감");
    await user.click(screen.getByRole("button", { name: "사유 저장" }));

    expect(onMark).toHaveBeenCalledWith(absentLesson, "absent", "독감");
  });

  it("기본 문구로 저장된 결석은 사유 수정 입력창을 비워 보여 준다", async () => {
    const { user } = renderDialog({
      lessons: [{ ...lesson, status: "absent", absenceReason: DEFAULT_ABSENCE_REASON }],
    });

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석 사유 수정` }));

    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("");
  });

  it("사유 입력창은 선택한 수업 하나에만 열린다", async () => {
    const other = { ...lesson, id: "other", studentName: "다른원생" };
    const { user } = renderDialog({ lessons: [lesson, other] });

    await user.click(screen.getByRole("button", { name: "다른원생 개인레슨 결석" }));

    expect(screen.getAllByRole("textbox", { name: "결석 사유 (선택)" })).toHaveLength(1);
  });

  it("저장이 실패하면(false) 입력한 사유를 그대로 둔 채 폼을 닫지 않는다", async () => {
    const onMark = vi.fn().mockResolvedValue(false);
    const { user } = renderDialog({ onMark });

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.type(screen.getByRole("textbox", { name: "결석 사유 (선택)" }), "감기로 결석");
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    await waitFor(() => expect(onMark).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("감기로 결석");
  });

  it("저장이 끝나면(true) 사유 폼이 닫힌다", async () => {
    const onMark = vi.fn().mockResolvedValue(true);
    const { user } = renderDialog({ onMark });

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument(),
    );
  });

  it("사유 폼을 연 채 날짜를 바꾸거나 창을 닫았다 열면 폼이 남지 않는다", async () => {
    const user = userEvent.setup();
    const baseProps: ComponentProps<typeof PrivateDayAttendanceDialog> = {
      open: true,
      academyId: "academy-demo",
      date: "2026-08-21",
      lessons: [lesson],
      sessionLabels: new Map(),
      memos: [],
      memoTargets: { students: [], teachers: [] },
      canManage: false,
      pendingLessonIds: new Set(),
      onOpenChange: vi.fn(),
      onCreateMemo: vi.fn(),
      onUpdateMemo: vi.fn(),
      onDeleteMemo: vi.fn(),
      onMark: vi.fn(),
      onCancelAttendance: vi.fn(),
    };
    const { rerender } = render(<PrivateDayAttendanceDialog {...baseProps} />);

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toBeInTheDocument();

    rerender(<PrivateDayAttendanceDialog {...baseProps} date="2026-08-22" />);
    rerender(<PrivateDayAttendanceDialog {...baseProps} date="2026-08-21" />);

    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("관리 권한이 있고 이력이 주어지면 변경 이력 탭에서 이력을 볼 수 있다", async () => {
    const { user } = renderDialog({ canManage: true, history: <p>출석 확인 취소 기록</p> });

    expect(screen.queryByText("출석 확인 취소 기록")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "변경 이력" }));

    expect(screen.getByText("출석 확인 취소 기록")).toBeInTheDocument();
  });

  it("이력이 없거나 관리 권한이 없으면 변경 이력 탭을 보여 주지 않는다", () => {
    const { unmount } = renderDialog({ canManage: true });

    expect(screen.queryByRole("tab", { name: "변경 이력" })).not.toBeInTheDocument();
    unmount();

    renderDialog({ canManage: false, history: <p>출석 확인 취소 기록</p> });

    expect(screen.queryByRole("tab", { name: "변경 이력" })).not.toBeInTheDocument();
  });
});

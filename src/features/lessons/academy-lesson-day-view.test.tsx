import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";

import { AcademyLessonDayView } from "./academy-lesson-day-view";

function buildRow(overrides: Partial<DailyAcademyAttendanceRow> = {}): DailyAcademyAttendanceRow {
  return {
    academyId: "academy-demo",
    lessonEventId: "lesson-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    teacherName: "김하늘",
    date: "2026-08-21",
    startTime: "15:00",
    endTime: "15:50",
    status: "pending",
    origin: "regular",
    originLabel: "정기",
    ...overrides,
  };
}

const ROWS = [
  buildRow(),
  buildRow({ lessonEventId: "lesson-2", studentId: "student-2", studentName: "이서윤", startTime: "16:00", endTime: "16:50" }),
];

function renderView(props: Partial<React.ComponentProps<typeof AcademyLessonDayView>> = {}) {
  const handlers = {
    onChangeDate: vi.fn(),
    onToday: vi.fn(),
    onConfirmAttendance: vi.fn().mockResolvedValue(true),
    onReset: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onCreateMemo: vi.fn(),
    onUpdateMemo: vi.fn(),
    onDeleteMemo: vi.fn(),
  };
  const view = (overrides: Partial<React.ComponentProps<typeof AcademyLessonDayView>> = {}) => (
    <AcademyLessonDayView
      academyId="academy-demo"
      date="2026-08-21"
      rows={ROWS}
      memos={[]}
      memoTargets={{ students: [], teachers: [] }}
      canManage
      isBusy={false}
      {...handlers}
      {...props}
      {...overrides}
    />
  );
  const { rerender } = render(view());

  return {
    ...handlers,
    user: userEvent.setup(),
    changeDate: (date: string) => rerender(view({ date, rows: ROWS.map((row) => ({ ...row, date })) })),
  };
}

describe("AcademyLessonDayView", () => {
  it("선택한 날짜의 수업 목록을 모달 없이 바로 보여 준다", () => {
    renderView();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "2026-08-21 출석 확인 목록" });
    expect(within(table).getByText("김민지")).toBeInTheDocument();
    expect(within(table).getByText("이서윤")).toBeInTheDocument();
  });

  it("날짜 컨트롤과 일별 메모지 버튼을 보여 주고 날짜를 옮긴다", async () => {
    const { onChangeDate, onToday, user } = renderView();

    await user.click(screen.getByRole("button", { name: "학원 레슨 테이블 다음 날짜" }));
    await user.click(screen.getByRole("button", { name: "오늘로 이동" }));

    expect(onChangeDate).toHaveBeenCalledWith("2026-08-22");
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^8월 21일 메모지/ })).toBeInTheDocument();
  });

  it("O/X는 임시로 고르고 확인을 눌러야 한꺼번에 저장한다", async () => {
    const { onConfirmAttendance, user } = renderView();

    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();

    await user.click(screen.getByRole("radio", { name: "김민지 등원" }));
    await user.click(screen.getByRole("radio", { name: "이서윤 결석" }));
    expect(onConfirmAttendance).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(onConfirmAttendance).toHaveBeenCalledWith([
        expect.objectContaining({ status: "present", row: expect.objectContaining({ studentName: "김민지" }) }),
        expect.objectContaining({ status: "absent", row: expect.objectContaining({ studentName: "이서윤" }) }),
      ]),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "확인" })).toBeDisabled());
  });

  it("취소를 누르면 고른 내용을 버린다", async () => {
    const { onConfirmAttendance, user } = renderView();

    await user.click(screen.getByRole("button", { name: "전체 등원" }));
    expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "김민지 등원" })).not.toBeChecked();
    expect(onConfirmAttendance).not.toHaveBeenCalled();
  });

  it("저장에 실패하면 고른 내용을 남겨 다시 시도할 수 있다", async () => {
    const onConfirmAttendance = vi.fn().mockResolvedValue(false);
    const { user } = renderView({ onConfirmAttendance });

    await user.click(screen.getByRole("radio", { name: "김민지 등원" }));
    await user.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(onConfirmAttendance).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("radio", { name: "김민지 등원" })).toBeChecked();
    expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();
  });

  it("날짜가 바뀌면 고르던 내용을 버린다", async () => {
    const { user, changeDate } = renderView();
    await user.click(screen.getByRole("radio", { name: "김민지 등원" }));
    expect(screen.getByRole("button", { name: "확인" })).toBeEnabled();

    changeDate("2026-08-22");

    expect(screen.getByRole("button", { name: "확인" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "김민지 등원" })).not.toBeChecked();
  });

  it("이동·삭제·초기화는 행에서 바로 할 수 있다", async () => {
    const { onMove, onDelete, user } = renderView({ rows: [ROWS[0], { ...ROWS[1], status: "present" }] });

    await user.click(screen.getByRole("button", { name: "김민지 일정 이동" }));
    await user.click(screen.getByRole("button", { name: "김민지 일정 삭제" }));

    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ studentName: "김민지" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ studentName: "김민지" }));
    expect(screen.getByRole("button", { name: "이서윤 출결 초기화" })).toBeEnabled();
  });

  it("조회만 가능한 역할에는 출결 선택·확인·취소·메모지를 보여 주지 않는다", () => {
    renderView({ canManage: false });

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "취소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /메모지/ })).not.toBeInTheDocument();
    expect(screen.getByText("김민지")).toBeInTheDocument();
  });

  it("변경 이력은 접이식 섹션으로, 이력이 주어졌고 관리 권한일 때만 보여 준다", async () => {
    const { user } = renderView({ history: <p>일정 이동 기록</p> });

    expect(screen.queryByText("일정 이동 기록")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /변경 이력/ }));
    expect(screen.getByText("일정 이동 기록")).toBeInTheDocument();
  });

  it("이력이 없으면 변경 이력 섹션을 두지 않는다", () => {
    renderView();

    expect(screen.queryByRole("button", { name: /변경 이력/ })).not.toBeInTheDocument();
  });
});

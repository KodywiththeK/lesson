import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { AcademyDayAttendanceDialog } from "./academy-day-attendance-dialog";

const ATTENDANCE_ROW = {
  academyId: "academy-demo",
  lessonEventId: "lesson-1",
  studentId: "student-1",
  studentName: "김민지",
  teacherId: "teacher-1",
  teacherName: "이서윤",
  instrumentId: "instrument-1",
  instrumentName: "피아노",
  date: "2026-08-21",
  startTime: "14:00",
  endTime: "15:00",
  status: "pending" as const,
};

function renderDialog(props: Partial<ComponentProps<typeof AcademyDayAttendanceDialog>> = {}) {
  render(
    <AcademyDayAttendanceDialog
      open
      academyId="academy-demo"
      date="2026-08-21"
      rows={[]}
      memos={[]}
      memoTargets={{ students: [], teachers: [] }}
      canManage
      isBusy={false}
      onOpenChange={vi.fn()}
      onCreateMemo={vi.fn()}
      onUpdateMemo={vi.fn()}
      onDeleteMemo={vi.fn()}
      onConfirmAttendance={vi.fn()}
      onReset={vi.fn()}
      onMove={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  );

  return userEvent.setup();
}

describe("AcademyDayAttendanceDialog 변경 이력", () => {
  it("관리 권한이 있고 이력이 주어지면 변경 이력 탭에서 이력을 볼 수 있다", async () => {
    const user = renderDialog({ history: <p>일정 이동 기록</p> });

    expect(screen.queryByText("일정 이동 기록")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "변경 이력" }));

    expect(screen.getByText("일정 이동 기록")).toBeInTheDocument();
  });

  it("이력이 없으면 변경 이력 탭을 보여 주지 않는다", () => {
    renderDialog();

    expect(screen.queryByRole("tab", { name: "변경 이력" })).not.toBeInTheDocument();
  });

  it("관리 권한이 없으면 이력이 주어져도 탭을 보여 주지 않는다", () => {
    renderDialog({ canManage: false, history: <p>일정 이동 기록</p> });

    expect(screen.queryByRole("tab", { name: "변경 이력" })).not.toBeInTheDocument();
  });
});

describe("AcademyDayAttendanceDialog 출석 초안", () => {
  it("닫기는 고른 출석을 저장하지 않고 모달만 닫는다", async () => {
    const onConfirmAttendance = vi.fn();
    const onOpenChange = vi.fn();
    const user = renderDialog({
      rows: [ATTENDANCE_ROW],
      onConfirmAttendance,
      onOpenChange,
    });

    await user.click(screen.getByRole("radio", { name: "김민지 등원" }));
    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(onConfirmAttendance).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("출석 저장은 고른 출석을 저장한 뒤 모달을 닫는다", async () => {
    const onConfirmAttendance = vi.fn().mockResolvedValue(true);
    const onOpenChange = vi.fn();
    const user = renderDialog({
      rows: [ATTENDANCE_ROW],
      onConfirmAttendance,
      onOpenChange,
    });

    await user.click(screen.getByRole("radio", { name: "김민지 등원" }));
    await user.click(screen.getByRole("button", { name: "출석 저장" }));

    expect(onConfirmAttendance).toHaveBeenCalledWith([
      expect.objectContaining({ row: ATTENDANCE_ROW, status: "present" }),
    ]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { AcademyDayAttendanceDialog } from "./academy-day-attendance-dialog";

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

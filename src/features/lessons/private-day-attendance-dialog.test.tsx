import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";

import { PrivateDayAttendanceDialog } from "./private-day-attendance-dialog";

describe("PrivateDayAttendanceDialog", () => {
  it("같은 수업의 출결 요청 중에는 등원과 결석을 다시 누를 수 없다", () => {
    const lesson = demoLessonWorkspaceData.privateLessons[0];
    render(
      <PrivateDayAttendanceDialog
        open
        academyId="academy-demo"
        date="2026-08-21"
        lessons={[lesson]}
        sessionLabels={new Map()}
        memos={[]}
        memoTargets={{ students: [], teachers: [] }}
        canManage={false}
        pendingLessonIds={new Set([lesson.id])}
        onOpenChange={vi.fn()}
        onCreateMemo={vi.fn()}
        onUpdateMemo={vi.fn()}
        onDeleteMemo={vi.fn()}
        onMark={vi.fn()}
        onCancelAttendance={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 등원 확인` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` })).toBeDisabled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MoveAcademyLessonDialog } from "./academy-move-dialog";

describe("학원 레슨 휴원일 이동", () => {
  it("휴원일 이름을 확인하기 전에는 이동을 저장하지 않는다", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const draft = {
      row: { academyId: "a1", lessonEventId: "e1", studentId: "s1", studentName: "김민지",
        teacherId: "t1", teacherName: "박선생", instrumentId: "piano", instrumentName: "피아노",
        date: "2026-10-20", startTime: "14:00", endTime: "14:40", status: "pending" as const,
        origin: "manual" as const },
      targetDate: "2026-10-21", startTime: "14:00", endTime: "14:40", reason: "",
    };
    render(<MoveAcademyLessonDialog draft={draft} onChange={vi.fn()} onClose={vi.fn()} onConfirm={onConfirm}
      closures={[{ id: "c1", title: "정기 휴원", startsOn: "2026-10-21", endsOn: "2026-10-21", weekday: null, active: true }]} />);
    expect(screen.getByText(/정기 휴원/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이동 저장" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /휴원일.*확인/ }));
    await user.click(screen.getByRole("button", { name: "이동 저장" }));
    expect(onConfirm).toHaveBeenCalledWith(draft);
  });
});

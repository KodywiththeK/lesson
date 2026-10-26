import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrivateAbsenceDialog } from "./private-absence-dialog";

describe("개인레슨 결석인원", () => {
  it("결석 취소를 누르면 해당 레슨의 출결 취소를 요청한다", async () => {
    const user = userEvent.setup();
    const lesson = { id: "event-1", academyId: "academy-1", studentId: "student-1",
      studentName: "김민지", instrumentId: "piano", instrumentName: "피아노",
      teacherId: "teacher-1", teacherName: "박선생", startAt: "2026-10-20T14:00:00+09:00",
      endAt: "2026-10-20T14:40:00+09:00", status: "absent" as const };
    const onCancelAbsence = vi.fn();
    render(<PrivateAbsenceDialog open month="2026-10" absences={[lesson]} onOpenChange={vi.fn()}
      onChangeMonth={vi.fn()} onCancelAbsence={onCancelAbsence} />);
    await user.click(screen.getByRole("button", { name: "김민지 결석 취소" }));
    expect(onCancelAbsence).toHaveBeenCalledWith(lesson);
  });
});

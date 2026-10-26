import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PrivateLessonEditDialog } from "./private-lesson-edit-dialog";

describe("개인레슨 일정 수정", () => {
  it("휴원일로 이동할 때 이름을 알리고 추가 확인을 요구한다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog
      lesson={{ id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지", instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생", startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", status: "scheduled" }}
      teachers={[{ teacherId: "t1", teacherName: "박선생", part: "피아노" }]}
      initialDate="2026-10-21"
      closures={[{ id: "c1", title: "학원 휴원", startsOn: "2026-10-21", endsOn: "2026-10-21", weekday: null, active: true }]}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
    />);
    expect(screen.getByText(/학원 휴원/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: /휴원일.*확인/ }));
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledOnce();
  });
  it("날짜·시간·선생님과 선택 사유를 수정하고 삭제 확인에는 사유를 묻지 않는다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PrivateLessonEditDialog
      lesson={{ id: "e1", academyId: "a1", studentId: "s1", studentName: "김민지",
        instrumentId: "piano", instrumentName: "피아노", teacherId: "t1", teacherName: "박선생",
        startAt: "2026-10-20T14:00:00+09:00", endAt: "2026-10-20T14:40:00+09:00", status: "scheduled" }}
      teachers={[{ teacherId: "t1", teacherName: "박선생", part: "피아노" }]}
      isSaving={false} onClose={vi.fn()} onSave={onSave} onDelete={vi.fn()}
    />);
    expect(screen.getByRole("dialog", { name: "개인레슨 일정 수정" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "수정 저장" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ reason: "", teacherId: "t1" }));
    await user.click(screen.getByRole("button", { name: "일정 삭제" }));
    expect(screen.getByRole("alertdialog", { name: "개인레슨 일정을 삭제할까요?" })).toBeInTheDocument();
    expect(screen.queryByLabelText("삭제 사유")).not.toBeInTheDocument();
  });
});

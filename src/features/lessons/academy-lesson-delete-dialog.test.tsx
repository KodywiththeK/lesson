import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AcademyLessonDeleteDialog } from "./academy-lesson-delete-dialog";

const DELETE_DRAFT = {
  row: {
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
  },
  reason: "수업 취소",
};

describe("AcademyLessonDeleteDialog", () => {
  it("취소는 삭제 요청 없이 확인창만 닫는다", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AcademyLessonDeleteDialog
        draft={DELETE_DRAFT}
        isDeleting={false}
        onChange={vi.fn()}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("삭제를 눌렀을 때만 삭제 요청을 보낸다", async () => {
    const onConfirm = vi.fn();
    render(
      <AcademyLessonDeleteDialog
        draft={DELETE_DRAFT}
        isDeleting={false}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith(DELETE_DRAFT);
  });
});

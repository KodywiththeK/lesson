import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LessonCalendarMemo } from "@/lib/api/lesson-memos";

import { LessonDayMemoDialog } from "./lesson-day-memo-dialog";

const MEMO: LessonCalendarMemo = {
  id: "memo-1",
  academyId: "academy-demo",
  lessonKind: "academy",
  date: "2026-08-21",
  content: "김하늘 학부모님 전화 옴",
  unread: false,
  studentId: null,
  studentName: null,
  teacherId: null,
  teacherName: null,
};

function renderMemo(props: Partial<React.ComponentProps<typeof LessonDayMemoDialog>> = {}) {
  const onCreateMemo = vi.fn();
  render(
    <LessonDayMemoDialog
      academyId="academy-demo"
      lessonKind="academy"
      date="2026-08-21"
      memos={[]}
      targets={{ students: [], teachers: [] }}
      onCreateMemo={onCreateMemo}
      onUpdateMemo={vi.fn()}
      onDeleteMemo={vi.fn()}
      {...props}
    />,
  );

  return { onCreateMemo, user: userEvent.setup() };
}

describe("LessonDayMemoDialog", () => {
  it("버튼에 날짜를 보여 주고 평소에는 메모를 펼쳐 두지 않는다", () => {
    renderMemo({ memos: [MEMO] });

    expect(screen.getByRole("button", { name: /^8월 21일 메모지/ })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("누르면 그날의 레슨 종류가 들어간 메모지 다이얼로그에 날짜별 메모를 보여 준다", async () => {
    const { user } = renderMemo({ memos: [MEMO] });

    await user.click(screen.getByRole("button", { name: /^8월 21일 메모지/ }));
    const dialog = await screen.findByRole("dialog");

    expect(dialog).toHaveAccessibleName("8월 21일 학원레슨 메모지");
    expect(within(dialog).getByText("김하늘 학부모님 전화 옴")).toBeInTheDocument();
  });

  it("개인레슨은 개인레슨 제목을 쓴다", async () => {
    const { user } = renderMemo({ lessonKind: "private", date: "2026-08-05" });

    await user.click(screen.getByRole("button", { name: /^8월 5일 메모지/ }));

    expect(await screen.findByRole("dialog")).toHaveAccessibleName("8월 5일 개인레슨 메모지");
  });

  it("다이얼로그 안에서 메모를 등록하면 학원·레슨 종류·날짜와 내용을 넘긴다", async () => {
    const { onCreateMemo, user } = renderMemo();

    await user.click(screen.getByRole("button", { name: /^8월 21일 메모지/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox", { name: "메모 내용" }), "보강 일정 조율");
    await user.click(within(dialog).getByRole("button", { name: "메모 등록" }));

    expect(onCreateMemo).toHaveBeenCalledWith(
      expect.objectContaining({
        academyId: "academy-demo",
        lessonKind: "academy",
        date: "2026-08-21",
        content: "보강 일정 조율",
      }),
    );
  });

  it("메모가 있으면 버튼에 개수를 알려 준다", () => {
    renderMemo({ memos: [MEMO] });

    expect(screen.getByRole("button", { name: /^8월 21일 메모지/ })).toHaveTextContent("1");
  });
});

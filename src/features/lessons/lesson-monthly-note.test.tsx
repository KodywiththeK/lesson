import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LessonMonthlyNote } from "@/lib/api/lesson-monthly-notes";

import { LessonMonthlyNoteDialog } from "./lesson-monthly-note";

const UNREAD_NOTE: LessonMonthlyNote = {
  content: "김하늘 학부모님 전화 옴",
  unread: true,
  updatedAt: "2026-08-20T09:00:00+09:00",
};

type UserEvent = ReturnType<typeof userEvent.setup>;

function renderNote(
  props: Partial<React.ComponentProps<typeof LessonMonthlyNoteDialog>> = {},
) {
  const onSave = vi.fn();
  const onMarkRead = vi.fn();
  const view = render(
    <LessonMonthlyNoteDialog
      lessonKind="academy"
      month="2026-08"
      note={null}
      onSave={onSave}
      onMarkRead={onMarkRead}
      {...props}
    />,
  );

  return { ...view, onSave, onMarkRead };
}

async function openNote(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: /^\d+월 메모지/ }));

  return screen.findByRole("dialog");
}

describe("LessonMonthlyNoteDialog", () => {
  it("평소에는 메모지 버튼만 보이고, 누르면 선택한 달과 레슨 종류를 제목으로 한 다이얼로그가 열린다", async () => {
    const user = userEvent.setup();
    renderNote();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await openNote(user);

    expect(dialog).toHaveAccessibleName("8월 학원레슨 메모지");
    expect(within(dialog).getByText("이 달의 메모가 없습니다.")).toBeInTheDocument();
  });

  it("개인레슨 메모지는 개인레슨 제목을 쓴다", async () => {
    const user = userEvent.setup();
    renderNote({ lessonKind: "private", month: "2026-07" });

    expect(await openNote(user)).toHaveAccessibleName("7월 개인레슨 메모지");
  });

  it("내용을 적고 저장하면 적은 내용을 넘긴다", async () => {
    const user = userEvent.setup();
    const { onSave } = renderNote();
    await openNote(user);

    const saveButton = screen.getByRole("button", { name: "저장" });
    expect(saveButton).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "8월 메모 내용" }),
      "이서윤 학부모님 상담 요청",
    );
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith("이서윤 학부모님 상담 요청");
  });

  it("저장된 내용이 그대로면 저장 버튼을 막는다", async () => {
    const user = userEvent.setup();
    renderNote({ note: { ...UNREAD_NOTE, unread: false } });
    await openNote(user);

    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue(
      "김하늘 학부모님 전화 옴",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("미확인 메모는 다이얼로그를 열기 전에도 버튼에 표시하고, 확인 버튼을 눌러야 확인 처리한다", async () => {
    const user = userEvent.setup();
    const { onMarkRead } = renderNote({ note: UNREAD_NOTE });

    expect(screen.getByRole("button", { name: /^\d+월 메모지/ })).toHaveTextContent("미확인");

    await openNote(user);
    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("이미 확인한 메모에는 미확인 표시와 확인 버튼이 없다", async () => {
    const user = userEvent.setup();
    renderNote({ note: { ...UNREAD_NOTE, unread: false } });

    expect(screen.queryByText("미확인")).not.toBeInTheDocument();

    await openNote(user);

    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
  });

  it("적던 내용은 다이얼로그를 닫았다 다시 열어도 남아 있다", async () => {
    const user = userEvent.setup();
    renderNote({ note: { ...UNREAD_NOTE, unread: false } });
    await openNote(user);

    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), " 추가");
    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await openNote(user);

    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue(
      "김하늘 학부모님 전화 옴 추가",
    );
  });

  it("달을 바꾸면 그 달의 내용으로 바뀌고, 쓰던 내용은 다른 달에 섞이지 않는다", async () => {
    const user = userEvent.setup();
    const { rerender, onSave, onMarkRead } = renderNote({
      note: { ...UNREAD_NOTE, unread: false },
    });
    await openNote(user);

    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), " 추가");

    rerender(
      <LessonMonthlyNoteDialog
        lessonKind="academy"
        month="2026-07"
        note={{ content: "7월 휴강 안내", unread: false, updatedAt: "2026-07-01T09:00:00+09:00" }}
        onSave={onSave}
        onMarkRead={onMarkRead}
      />,
    );

    expect(screen.getByRole("textbox", { name: "7월 메모 내용" })).toHaveValue(
      "7월 휴강 안내",
    );

    rerender(
      <LessonMonthlyNoteDialog
        lessonKind="academy"
        month="2026-08"
        note={{ ...UNREAD_NOTE, unread: false }}
        onSave={onSave}
        onMarkRead={onMarkRead}
      />,
    );
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue("김하늘 학부모님 전화 옴 추가");
  });

  it("불러오는 중에는 입력을 막고 안내한다", async () => {
    const user = userEvent.setup();
    renderNote({ isLoading: true });
    await openNote(user);

    expect(screen.getByText("메모를 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("불러오지 못하면 사용자 문구로 알려 준다", async () => {
    const user = userEvent.setup();
    renderNote({ loadErrorMessage: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
    await openNote(user);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인이 만료되었습니다. 다시 로그인해 주세요.",
    );
  });

  it("외부 저장본이 바뀌어도 작성 초안을 유지하고 명시적으로 선택하게 한다", async () => {
    const user = userEvent.setup();
    const { rerender, onSave, onMarkRead } = renderNote({ note: UNREAD_NOTE });
    await openNote(user);
    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), " 내 초안");

    rerender(
      <LessonMonthlyNoteDialog
        lessonKind="academy"
        month="2026-08"
        note={{ content: "다른 직원의 메모", unread: false, updatedAt: "2026-08-20T10:00:00+09:00" }}
        onSave={onSave}
        onMarkRead={onMarkRead}
      />,
    );

    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue("김하늘 학부모님 전화 옴 내 초안");
    expect(screen.getByRole("alert")).toHaveTextContent("다른 직원의 메모");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "서버 내용 사용" }));
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue("다른 직원의 메모");
  });
});

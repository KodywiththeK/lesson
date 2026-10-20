import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { LessonMonthlyNote } from "@/lib/api/lesson-monthly-notes";

import { LessonMonthlyNotePostit } from "./lesson-monthly-note";

const UNREAD_NOTE: LessonMonthlyNote = {
  content: "김하늘 학부모님 전화 옴",
  unread: true,
  updatedAt: "2026-08-20T09:00:00+09:00",
};

function renderPostit(
  props: Partial<React.ComponentProps<typeof LessonMonthlyNotePostit>> = {},
) {
  const onSave = vi.fn();
  const onMarkRead = vi.fn();
  const view = render(
    <LessonMonthlyNotePostit
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

describe("LessonMonthlyNotePostit", () => {
  it("선택한 달과 레슨 종류를 제목으로 보여 주고, 메모가 없으면 빈 상태를 알려 준다", () => {
    renderPostit();

    expect(
      screen.getByRole("region", { name: "8월 학원레슨 메모지" }),
    ).toBeInTheDocument();
    expect(screen.getByText("이 달의 메모가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("미확인")).not.toBeInTheDocument();
  });

  it("개인레슨 메모지는 개인레슨 제목을 쓴다", () => {
    renderPostit({ lessonKind: "private", month: "2026-07" });

    expect(
      screen.getByRole("region", { name: "7월 개인레슨 메모지" }),
    ).toBeInTheDocument();
  });

  it("내용을 적고 저장하면 적은 내용을 넘긴다", async () => {
    const user = userEvent.setup();
    const { onSave } = renderPostit();

    const saveButton = screen.getByRole("button", { name: "저장" });
    expect(saveButton).toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: "8월 메모 내용" }),
      "이서윤 학부모님 상담 요청",
    );
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith("이서윤 학부모님 상담 요청");
  });

  it("저장된 내용이 그대로면 저장 버튼을 막는다", () => {
    renderPostit({ note: { ...UNREAD_NOTE, unread: false } });

    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue(
      "김하늘 학부모님 전화 옴",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });

  it("미확인 메모는 표시와 확인 버튼을 보여 주고, 버튼을 눌러야 확인 처리한다", async () => {
    const user = userEvent.setup();
    const { onMarkRead } = renderPostit({ note: UNREAD_NOTE });

    expect(screen.getByText("미확인")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "확인" }));

    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  it("이미 확인한 메모에는 미확인 표시와 확인 버튼이 없다", () => {
    renderPostit({ note: { ...UNREAD_NOTE, unread: false } });

    expect(screen.queryByText("미확인")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
  });

  it("달을 바꾸면 그 달의 내용으로 바뀌고, 쓰던 내용은 다른 달에 섞이지 않는다", async () => {
    const user = userEvent.setup();
    const { rerender, onSave, onMarkRead } = renderPostit({
      note: { ...UNREAD_NOTE, unread: false },
    });

    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), " 추가");

    rerender(
      <LessonMonthlyNotePostit
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
      <LessonMonthlyNotePostit
        lessonKind="academy"
        month="2026-08"
        note={{ ...UNREAD_NOTE, unread: false }}
        onSave={onSave}
        onMarkRead={onMarkRead}
      />,
    );
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toHaveValue("김하늘 학부모님 전화 옴 추가");
  });

  it("불러오는 중에는 입력을 막고 안내한다", () => {
    renderPostit({ isLoading: true });

    expect(screen.getByText("메모를 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("불러오지 못하면 사용자 문구로 알려 준다", () => {
    renderPostit({ loadErrorMessage: "로그인이 만료되었습니다. 다시 로그인해 주세요." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "로그인이 만료되었습니다. 다시 로그인해 주세요.",
    );
  });

  it("접기를 누르면 내용을 숨기고 펼치면 다시 보여 준다", async () => {
    const user = userEvent.setup();
    renderPostit({ note: UNREAD_NOTE });

    await user.click(screen.getByRole("button", { name: "메모지 접기" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("미확인")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "메모지 펼치기" }));
    expect(screen.getByRole("textbox", { name: "8월 메모 내용" })).toBeInTheDocument();
  });

  it("패널은 이동·크기 조절 손잡이 없이 제자리에 표시된다", () => {
    renderPostit();
    const postit = screen.getByRole("region", { name: "8월 학원레슨 메모지" });

    expect(postit).not.toHaveStyle({ position: "absolute" });
    expect(screen.queryByTitle("메모지 크기 조절")).not.toBeInTheDocument();
  });

  it("외부 저장본이 바뀌어도 작성 초안을 유지하고 명시적으로 선택하게 한다", async () => {
    const user = userEvent.setup();
    const { rerender, onSave, onMarkRead } = renderPostit({ note: UNREAD_NOTE });
    await user.type(screen.getByRole("textbox", { name: "8월 메모 내용" }), " 내 초안");

    rerender(
      <LessonMonthlyNotePostit
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

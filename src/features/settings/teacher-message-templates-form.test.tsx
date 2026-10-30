import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeacherMessageTemplatesForm } from "./teacher-message-templates-form";

describe("선생님 문자 템플릿 설정", () => {
  it("기본 문구를 편집해 저장하고 지원하지 않는 변수는 막는다", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TeacherMessageTemplatesForm templates={[]} isSaving={false} onSave={onSave} onArchive={vi.fn()} />);
    expect((screen.getByLabelText("템플릿 내용") as HTMLTextAreaElement).value).toContain("{선생님}");
    fireEvent.change(screen.getByLabelText("템플릿 내용"), { target: { value: "잘못된 {이름}" } });
    expect(screen.getByRole("button", { name: "템플릿 저장" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("템플릿 내용"), { target: { value: "안녕하세요 {선생님}" } });
    await user.click(screen.getByRole("button", { name: "템플릿 저장" }));
    expect(onSave).toHaveBeenCalledWith({ title: "기본 정산 안내", content: "안녕하세요 {선생님}", id: undefined });
  });

  it("템플릿 삭제에 실패하면 선택과 입력 내용을 유지한다", async () => {
    const user = userEvent.setup();
    const templates = [{ id: "one", title: "정산 안내", content: "안녕하세요 {선생님}", active: true }];
    render(<TeacherMessageTemplatesForm templates={templates} isSaving={false} onSave={vi.fn()} onArchive={vi.fn().mockResolvedValue(false)} />);
    await user.selectOptions(screen.getByLabelText("템플릿 선택"), "one");
    await user.click(screen.getByRole("button", { name: "템플릿 삭제" }));
    await user.click(screen.getByRole("button", { name: /^삭제$/ }));
    expect(screen.getByLabelText("템플릿 선택")).toHaveValue("one");
    expect(screen.getByLabelText("템플릿 내용")).toHaveValue("안녕하세요 {선생님}");
  });

  it("템플릿 삭제 중에는 확인과 취소를 잠근다", async () => {
    const user = userEvent.setup();
    const templates = [{ id: "one", title: "정산 안내", content: "안녕하세요 {선생님}", active: true }];
    const props = { templates, onSave: vi.fn(), onArchive: vi.fn().mockResolvedValue(false) };
    const { rerender } = render(<TeacherMessageTemplatesForm {...props} isSaving={false} />);
    await user.selectOptions(screen.getByLabelText("템플릿 선택"), "one");
    await user.click(screen.getByRole("button", { name: "템플릿 삭제" }));
    rerender(<TeacherMessageTemplatesForm {...props} isSaving />);
    expect(screen.getByRole("button", { name: /^삭제$/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "취소" })).toBeDisabled();
  });
  it("화면이 갱신되기 전 삭제 확인을 연속으로 눌러도 한 번만 요청한다", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<TeacherMessageTemplatesForm templates={[{ id: "one", title: "안내", content: "내용", active: true }]}
      isSaving={false} onSave={vi.fn()} onArchive={onArchive} />);
    await user.selectOptions(screen.getByLabelText("템플릿 선택"), "one");
    await user.click(screen.getByRole("button", { name: "템플릿 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: /^삭제$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^삭제$/ }));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });
});

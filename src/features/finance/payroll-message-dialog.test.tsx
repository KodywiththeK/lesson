import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PayrollMessageDialog } from "./payroll-message-dialog";

describe("선생님 정산 문자", () => {
  it("템플릿으로 만든 문구를 수정한 뒤 복사한다", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    render(<PayrollMessageDialog open templates={[]} onOpenChange={vi.fn()}
      values={{ 선생님: "김선생", 월: "10", 실수령액: "248,036" }} detailWarning="학생별 내역을 확인해 주세요." />);
    const text = screen.getByLabelText("정산 문자 내용") as HTMLTextAreaElement;
    expect(text.value).toContain("김선생");
    expect(screen.getByText("학생별 내역을 확인해 주세요.")).toBeInTheDocument();
    await user.clear(text);
    await user.type(text, "확인할 문자");
    await user.click(screen.getByRole("button", { name: "복사" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("확인할 문자"));
  });

  it("클립보드 접근이 실패하면 직접 복사하도록 안내한다", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("접근 거부"));
    render(<PayrollMessageDialog open templates={[]} onOpenChange={vi.fn()} values={{ 선생님: "김선생" }} />);
    await user.click(screen.getByRole("button", { name: "복사" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("직접 선택해 복사");
  });
});

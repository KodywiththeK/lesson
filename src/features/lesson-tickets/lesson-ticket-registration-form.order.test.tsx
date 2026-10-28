import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonTicketRegistrationForm } from "./lesson-ticket-registration-form";

describe("회차권 등록 선택 순서", () => {
  it("악기를 먼저 선택하고 그 악기를 수강하는 원생만 표시한다", async () => {
    const user = userEvent.setup();
    render(<LessonTicketRegistrationForm
      academyId="academy-1" today="2026-10-20" isLoading={false} error={null}
      isSaving={false} canRecordPayment onSubmit={vi.fn()}
      options={[
        { studentId: "s1", studentName: "김민지", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] },
        { studentId: "s2", studentName: "이서윤", instruments: [{ instrumentId: "violin", instrumentName: "바이올린" }] },
      ]}
    />);
    await user.selectOptions(screen.getByLabelText("악기"), "piano");
    expect(screen.getByRole("option", { name: "김민지" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "이서윤" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("원생"), "s1");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "결제 금액" }), "100000");
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("서비스 지급을 명시하면 결제 금액 없이 등록하고 0원 일반 등록은 막는다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<LessonTicketRegistrationForm academyId="a1" today="2026-10-20"
      isLoading={false} error={null} isSaving={false} canRecordPayment onSubmit={onSubmit}
      options={[{ studentId: "s1", studentName: "김민지", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] }]} />);
    await user.selectOptions(screen.getByLabelText("악기"), "piano");
    await user.selectOptions(screen.getByLabelText("원생"), "s1");
    await user.type(screen.getByRole("textbox", { name: "결제 금액" }), "0");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "서비스로 지급하기" }));
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ isService: true, paidAmount: 0 }));
  });
});

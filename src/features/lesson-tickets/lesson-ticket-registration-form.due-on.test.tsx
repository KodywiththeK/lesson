import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonTicketRegistrationForm } from "./lesson-ticket-registration-form";

function renderForm() {
  const onSubmit = vi.fn();
  render(<LessonTicketRegistrationForm academyId="a1" today="2026-11-14"
    isLoading={false} error={null} isSaving={false} canRecordPayment onSubmit={onSubmit}
    options={[{ studentId: "s1", studentName: "김민지", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] }]} />);

  return { onSubmit, user: userEvent.setup() };
}

async function fillPaid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("악기"), "piano");
  await user.selectOptions(screen.getByLabelText("원생"), "s1");
  await user.type(screen.getByRole("textbox", { name: "결제 금액" }), "200000");
}

describe("회차권 등록 납입일", () => {
  it("'등록일과 동일'이 기본으로 켜져 있고 납입일은 등록일로 보낸다", async () => {
    const { onSubmit, user } = renderForm();
    await fillPaid(user);

    expect(screen.getByRole("radio", { name: "등록일과 동일" })).toBeChecked();
    expect(screen.queryByLabelText("납입일")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ registeredAt: "2026-11-14", dueOn: "2026-11-14" }));
  });

  it("'직접 입력'을 고르면 납입일을 직접 고르고 그 날짜로 보낸다", async () => {
    const { onSubmit, user } = renderForm();
    await fillPaid(user);

    await user.click(screen.getByRole("radio", { name: "직접 입력" }));
    const dueOn = screen.getByLabelText("납입일");
    expect(dueOn).toHaveValue("2026-11-14");
    await user.clear(dueOn);
    await user.type(dueOn, "2026-11-25");
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueOn: "2026-11-25" }));
  });

  it("'나중에 입력'을 고르면 납입일 없이 보내고 회차권 목록에서 입력한다고 안내한다", async () => {
    const { onSubmit, user } = renderForm();
    await fillPaid(user);

    await user.click(screen.getByRole("radio", { name: "나중에 입력" }));
    expect(screen.queryByLabelText("납입일")).not.toBeInTheDocument();
    expect(screen.getByText("납입일은 회차권 목록에서 나중에 입력할 수 있습니다.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dueOn: null }));
  });

  it("유료 회차권은 '등록' 상태로 시작해 입금대기로 바꿔야 쓸 수 있다고 안내한다", async () => {
    const { user } = renderForm();
    await fillPaid(user);

    expect(screen.getByText("유료 회차권은 '등록' 상태로 저장되고, 입금대기로 바꾼 뒤부터 레슨에 쓸 수 있습니다. 수입 내역은 입금 처리할 때 기록됩니다.")).toBeInTheDocument();
  });
});

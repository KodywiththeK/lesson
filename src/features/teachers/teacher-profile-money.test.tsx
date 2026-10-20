import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TeacherProfileForm } from "./teacher-profile-form";

describe("선생님 급여 입력", () => {
  it("월급 쉼표 금액을 그대로 입력하고 정수로 전달한다", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TeacherProfileForm submitLabel="저장" isSubmitting={false} isOwner onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("선생님명"), "김선생");
    await user.type(screen.getByLabelText("연락처"), "010-1234-5678");
    await user.type(screen.getByLabelText("계약 시작일"), "2026-10-01");
    await user.type(screen.getByLabelText("계약 종료일"), "2027-09-30");
    await user.type(screen.getByLabelText("월급"), "2,500,000");

    expect(screen.getByLabelText("월급")).toHaveValue("2,500,000");
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ monthlySalary: 2500000 }));
  });

  it("월급을 비우는 동안 입력을 유지하고 저장을 막는다", async () => {
    const user = userEvent.setup();
    render(<TeacherProfileForm submitLabel="저장" isSubmitting={false} isOwner onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("월급"), "140000");
    await user.clear(screen.getByLabelText("월급"));

    expect(screen.getByLabelText("월급")).toHaveValue("");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});

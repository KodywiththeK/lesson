import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonTicketRegistrationForm } from "./lesson-ticket-registration-form";

describe("회차권 등록 선택 순서", () => {
  it("악기를 먼저 선택하고 그 악기를 수강하는 원생만 표시한다", async () => {
    const user = userEvent.setup();
    render(<LessonTicketRegistrationForm
      academyId="academy-1" today="2026-10-20" isLoading={false} error={null}
      isSaving={false} canRecordPayment={false} onSubmit={vi.fn()}
      options={[
        { studentId: "s1", studentName: "김민지", instruments: [{ instrumentId: "piano", instrumentName: "피아노" }] },
        { studentId: "s2", studentName: "이서윤", instruments: [{ instrumentId: "violin", instrumentName: "바이올린" }] },
      ]}
    />);
    await user.selectOptions(screen.getByLabelText("악기"), "piano");
    expect(screen.getByRole("option", { name: "김민지" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "이서윤" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("원생"), "s1");
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });
});

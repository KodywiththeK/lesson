import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LessonHistorySection } from "./lesson-history-section";

describe("LessonHistorySection", () => {
  it("평소에는 접혀 있어 이력을 불러오지 않고, 펼치면 보여 준다", async () => {
    const user = userEvent.setup();
    render(
      <LessonHistorySection>
        <p>일정 이동 기록</p>
      </LessonHistorySection>,
    );

    const toggle = screen.getByRole("button", { name: /변경 이력/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("일정 이동 기록")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("일정 이동 기록")).toBeInTheDocument();
  });
});

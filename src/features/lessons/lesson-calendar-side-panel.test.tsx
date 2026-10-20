import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonCalendarSidePanel } from "./lesson-calendar-side-panel";

describe("캘린더 옆 날짜 패널", () => {
  it("선택 날짜의 수업을 시간순으로 보여 주고 메모지를 함께 둔다", async () => {
    const user = userEvent.setup();
    const onOpenDay = vi.fn();
    render(
      <LessonCalendarSidePanel
        date="2026-10-16"
        events={[
          { id: "late", date: "2026-10-16", startTime: "17:00", endTime: "18:00", title: "김민지", subtitle: "피아노", status: "scheduled" },
          { id: "early", date: "2026-10-16", startTime: "14:00", endTime: "15:00", title: "이서윤", subtitle: "첼로", status: "absent" },
        ]}
        onOpenDay={onOpenDay}
        memo={<div>월별 메모지</div>}
        history={<div>읽기 전용 변경 이력</div>}
      />,
    );

    const panel = screen.getByRole("complementary", { name: "선택 날짜, 월별 메모와 변경 이력" });
    expect(panel.textContent?.indexOf("이서윤")).toBeLessThan(panel.textContent?.indexOf("김민지") ?? 0);
    expect(panel).toHaveTextContent("월별 메모지");
    expect(panel).toHaveTextContent("읽기 전용 변경 이력");
    await user.click(screen.getByRole("button", { name: "10월 16일 출석·메모 열기" }));
    expect(onOpenDay).toHaveBeenCalledOnce();
  });
});

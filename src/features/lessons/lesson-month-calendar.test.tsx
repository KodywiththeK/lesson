import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonMonthCalendar } from "./lesson-month-calendar";
import type { CalendarEvent } from "./workspace-types";

const events: CalendarEvent[] = [
  { id: "a", date: "2026-10-16", startTime: "16:00", endTime: "17:00", title: "결석 원생", subtitle: "피아노", status: "absent" },
  { id: "b", date: "2026-10-16", startTime: "17:00", endTime: "18:00", title: "정상 수업", subtitle: "첼로", status: "scheduled" },
  { id: "c", date: "2026-10-16", startTime: "18:00", endTime: "19:00", title: "패스 원생", subtitle: "피아노", status: "passed" },
  { id: "d", date: "2026-10-16", startTime: "19:00", endTime: "20:00", title: "취소 원생", subtitle: "첼로", status: "cancelled" },
];

describe("월간 레슨 캘린더", () => {
  it("시간 미정 수업은 임시 자정 시각 대신 상태를 표시한다", () => {
    render(<LessonMonthCalendar
      ariaLabel="2026년 10월 학원레슨 캘린더"
      selectedDate="2026-10-16"
      events={[{ ...events[1], timeUnspecified: true, startTime: "00:00", endTime: "00:01" }]}
      memoCounts={new Map()}
      variant="academy"
      onChangeMonth={vi.fn()}
      onSelectDate={vi.fn()}
    />);
    const date = screen.getByRole("gridcell", { selected: true });
    expect(within(date).getByText(/시간 미정/)).toBeInTheDocument();
    expect(within(date).queryByText(/00:00/)).not.toBeInTheDocument();
  });

  it("결석 일정은 기본 숨기고 전체 기록 보기로 확인한다", async () => {
    const user = userEvent.setup();
    render(
      <LessonMonthCalendar
        ariaLabel="2026년 10월 학원레슨 캘린더"
        selectedDate="2026-10-16"
        events={events}
        memoCounts={new Map()}
        variant="academy"
        onChangeMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />,
    );

    const grid = screen.getByRole("grid", { name: "2026년 10월 학원레슨 캘린더" });
    expect(within(grid).queryByText("결석 원생")).not.toBeInTheDocument();
    expect(within(grid).getByText("정상 수업")).toBeInTheDocument();
    expect(within(grid).queryByText("패스 원생")).not.toBeInTheDocument();
    expect(within(grid).queryByText("취소 원생")).not.toBeInTheDocument();
    expect(screen.getByText("숨긴 일정 3건")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "전체 기록 보기" }));
    expect(within(grid).getByText("결석 원생")).toBeInTheDocument();
    expect(within(grid).getByText("패스 원생")).toBeInTheDocument();
    expect(within(grid).getByText("+1")).toBeInTheDocument();
  });

  it("취소된 개인레슨은 기본 숨김 후 기록 표시에서 확인한다", async () => {
    const user = userEvent.setup();
    render(<LessonMonthCalendar
      ariaLabel="2026년 10월 개인레슨 캘린더"
      selectedDate="2026-10-16"
      events={[events[3]]}
      memoCounts={new Map()}
      variant="private"
      onChangeMonth={vi.fn()}
      onSelectDate={vi.fn()}
    />);
    const grid = screen.getByRole("grid", { name: "2026년 10월 개인레슨 캘린더" });
    expect(within(grid).queryByText("취소 원생")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "전체 기록 보기" }));
    expect(within(grid).getByText("취소 원생")).toBeInTheDocument();
    expect(within(grid).getByText("취소")).toBeInTheDocument();
  });

  it("오늘로 이동은 선택 날짜를 오늘로 돌린다", async () => {
    const user = userEvent.setup();
    const onToday = vi.fn();
    render(
      <LessonMonthCalendar
        ariaLabel="2026년 10월 학원레슨 캘린더"
        selectedDate="2026-10-16"
        events={events}
        memoCounts={new Map()}
        variant="academy"
        onChangeMonth={vi.fn()}
        onSelectDate={vi.fn()}
        onToday={onToday}
      />,
    );

    await user.click(screen.getByRole("button", { name: "오늘로 이동" }));
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("좁은 날짜 칸에는 예정·등원 건수를 나눠 표시한다", () => {
    render(
      <LessonMonthCalendar
        ariaLabel="2026년 10월 학원레슨 캘린더"
        selectedDate="2026-10-16"
        events={[...events, {
          id: "c", date: "2026-10-16", startTime: "18:00", endTime: "19:00",
          title: "등원 원생", subtitle: "피아노", status: "present",
        }]}
        memoCounts={new Map()}
        variant="academy"
        onChangeMonth={vi.fn()}
        onSelectDate={vi.fn()}
      />,
    );

    const date = screen.getByRole("gridcell", { selected: true });
    expect(within(date).getByText("예정 1")).toBeInTheDocument();
    expect(within(date).getByText("등원 1")).toBeInTheDocument();
    expect(within(date).queryByText("결석 1")).not.toBeInTheDocument();
  });
});

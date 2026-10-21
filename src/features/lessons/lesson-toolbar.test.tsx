import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonDayControl, LessonMonthControl, LessonViewTabs } from "./lesson-toolbar";

describe("LessonViewTabs", () => {
  it("월별 캘린더뷰와 일별 테이블뷰 탭을 레슨 종류 접두어와 함께 보여 준다", () => {
    render(<LessonViewTabs labelPrefix="개인레슨" value="calendar" onValueChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: "개인레슨 월별 캘린더뷰" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "개인레슨 일별 테이블뷰" })).toHaveAttribute("aria-selected", "false");
  });

  it("탭을 누르면 보기 전환을 알리고, actions는 같은 줄에 둔다", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <LessonViewTabs
        labelPrefix="학원레슨"
        value="calendar"
        onValueChange={onValueChange}
        actions={<button type="button">레슨원생 검색</button>}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "학원레슨 일별 테이블뷰" }));

    expect(onValueChange).toHaveBeenCalledWith("table");
    expect(screen.getByRole("button", { name: "레슨원생 검색" })).toBeInTheDocument();
  });
});

describe("LessonMonthControl", () => {
  it("오늘로 이동 바로 뒤에 끼운 버튼을 보여 준다", () => {
    render(
      <LessonMonthControl
        variantLabel="학원 레슨 캘린더"
        selectedMonth="2026-08"
        onChangeMonth={vi.fn()}
        onToday={vi.fn()}
        trailing={<button type="button">8월 메모지</button>}
      />,
    );

    const today = screen.getByRole("button", { name: "오늘로 이동" });
    const memo = screen.getByRole("button", { name: "8월 메모지" });

    expect(today.compareDocumentPosition(memo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(today.nextElementSibling).toBe(memo);
  });
});

describe("LessonDayControl", () => {
  function renderControl(overrides: Partial<React.ComponentProps<typeof LessonDayControl>> = {}) {
    const onChangeDate = vi.fn();
    const onToday = vi.fn();
    render(
      <LessonDayControl
        variantLabel="학원 레슨 테이블"
        selectedDate="2026-08-31"
        onChangeDate={onChangeDate}
        onToday={onToday}
        trailing={<button type="button">8월 31일 메모지</button>}
        {...overrides}
      />,
    );

    return { onChangeDate, onToday, user: userEvent.setup() };
  }

  it("선택한 날짜를 날짜 선택 칸에 보여 준다", () => {
    renderControl();

    expect(screen.getByLabelText("학원 레슨 테이블 날짜 선택")).toHaveValue("2026-08-31");
  });

  it("이전·다음 버튼은 하루씩 옮기고 월 경계도 넘는다", async () => {
    const { onChangeDate, user } = renderControl();

    await user.click(screen.getByRole("button", { name: "학원 레슨 테이블 다음 날짜" }));
    expect(onChangeDate).toHaveBeenLastCalledWith("2026-09-01");

    await user.click(screen.getByRole("button", { name: "학원 레슨 테이블 이전 날짜" }));
    expect(onChangeDate).toHaveBeenLastCalledWith("2026-08-30");
  });

  it("오늘로 이동 버튼과 뒤에 끼운 메모지 버튼을 보여 준다", async () => {
    const { onToday, user } = renderControl();

    await user.click(screen.getByRole("button", { name: "오늘로 이동" }));

    expect(onToday).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "오늘로 이동" }).nextElementSibling).toBe(
      screen.getByRole("button", { name: "8월 31일 메모지" }),
    );
  });
});

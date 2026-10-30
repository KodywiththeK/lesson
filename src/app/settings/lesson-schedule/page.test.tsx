import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";

import { AppProviders } from "../../providers";
import LessonScheduleSettingsPage from "./page";

describe("레슨시간표 설정 페이지", () => {
  it("데모의 공휴일·휴원일 설정은 기본으로 켜져 있고 각각 바꿀 수 있다", async () => {
    const user = userEvent.setup();
    window.history.pushState(null, "", "/settings/lesson-schedule");
    render(<AppProviders><LessonScheduleSettingsPage /></AppProviders>);
    const publicHoliday = await screen.findByRole("checkbox", { name: "공휴일은 정기 수업에서 제외" });
    const closure = screen.getByRole("checkbox", { name: "학원 휴원일은 정기 수업에서 제외" });
    expect(publicHoliday).toBeChecked();
    expect(closure).toBeChecked();
    await user.click(publicHoliday);
    await waitFor(() => expect(publicHoliday).not.toBeChecked());
    expect(closure).toBeChecked();
  });
  it("설정 하위 메뉴에서 악기 색상과 휴원일 설정을 바로 보여 준다", async () => {
    window.history.pushState(null, "", "/settings/lesson-schedule");
    render(<AppProviders><LessonScheduleSettingsPage /></AppProviders>);

    expect(screen.getByRole("heading", { level: 1, name: "설정" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "레슨시간표" })).toHaveAttribute("href", "/settings/lesson-schedule");
    expect(await screen.findByRole("region", { name: "레슨시간표 설정" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "바이올린 색상" }));
    expect(screen.getAllByRole("button", { name: /바이올린 기본 색/ })).toHaveLength(8);
    expect(screen.getByLabelText("휴원 종류")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "레슨 시간표 설정" })).not.toBeInTheDocument();
  });
});

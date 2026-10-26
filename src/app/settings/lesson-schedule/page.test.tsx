import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../providers";
import LessonScheduleSettingsPage from "./page";

describe("레슨시간표 설정 페이지", () => {
  it("설정 하위 메뉴에서 악기 색상과 휴원일 설정을 바로 보여 준다", async () => {
    window.history.pushState(null, "", "/settings/lesson-schedule");
    render(<AppProviders><LessonScheduleSettingsPage /></AppProviders>);

    expect(screen.getByRole("heading", { level: 1, name: "설정" })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });
    expect(within(navigation).getByRole("link", { name: "레슨시간표" })).toHaveAttribute("href", "/settings/lesson-schedule");
    expect(await screen.findByRole("region", { name: "레슨시간표 설정" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /기본 색/ })).toHaveLength(8);
    expect(screen.getByLabelText("휴원 종류")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "레슨 시간표 설정" })).not.toBeInTheDocument();
  });
});

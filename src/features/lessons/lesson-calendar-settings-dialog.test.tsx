import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonCalendarSettingsDialog } from "./lesson-calendar-settings-dialog";

describe("레슨 시간표 설정", () => {
  it("기존 휴원일 수정 후 새 휴원일 입력으로 전환할 수 있다", async () => {
    const user = userEvent.setup();
    render(<LessonCalendarSettingsDialog open instruments={[]} colors={[]}
      closures={[{ id: "c1", title: "추석 휴원", startsOn: "2026-09-24", endsOn: "2026-09-26", weekday: null, active: true }]}
      isSaving={false} onOpenChange={vi.fn()} onSaveColor={vi.fn()}
      onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByRole("button", { name: "휴원일 수정" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "새 휴원일" }));
    expect(screen.getByLabelText("휴원 이름")).toHaveValue("");
    expect(screen.getByRole("button", { name: "휴원일 지정" })).toBeDisabled();
  });
  it("악기별 기본 색 또는 직접 고른 색을 학원 공통 설정으로 저장한다", async () => {
    const user = userEvent.setup();
    const onSaveColor = vi.fn();
    render(<LessonCalendarSettingsDialog open instruments={[{ id: "piano", name: "피아노" }]}
      colors={[]} closures={[]} isSaving={false} onOpenChange={vi.fn()}
      onSaveColor={onSaveColor} onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("색상 설정 악기"), "piano");
    await user.click(screen.getByRole("button", { name: "기본 색 2" }));
    await user.click(screen.getByRole("button", { name: "악기 색상 저장" }));
    expect(onSaveColor).toHaveBeenCalledWith("piano", expect.stringMatching(/^#[0-9a-f]{6}$/i));
  });

  it("하루·기간·매주 반복 휴원을 입력한다", async () => {
    const user = userEvent.setup();
    render(<LessonCalendarSettingsDialog open instruments={[]} colors={[]} closures={[]}
      isSaving={false} onOpenChange={vi.fn()} onSaveColor={vi.fn()}
      onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    expect(screen.getByLabelText("휴원 종류")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("휴원 종류"), "weekly");
    expect(screen.getByLabelText("반복 요일")).toBeInTheDocument();
    await user.type(screen.getByLabelText("휴원 이름"), "월요일 휴원");
    await user.type(screen.getByLabelText("휴원 시작일"), "2026-10-01");
    expect(screen.getByRole("button", { name: "휴원일 지정" })).toBeDisabled();
  });
});

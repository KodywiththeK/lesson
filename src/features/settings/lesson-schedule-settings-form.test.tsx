import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LessonScheduleSettingsForm } from "./lesson-schedule-settings-form";

describe("레슨 시간표 설정", () => {
  it("기존 휴원일 수정 후 새 휴원일 입력으로 전환할 수 있다", async () => {
    const user = userEvent.setup();
    render(<LessonScheduleSettingsForm instruments={[]} colors={[]}
      closures={[{ id: "c1", title: "추석 휴원", startsOn: "2026-09-24", endsOn: "2026-09-26", weekday: null, active: true }]}
      isSaving={false} onSaveColor={vi.fn()}
      onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByRole("button", { name: "휴원일 수정" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "새 휴원일" }));
    expect(screen.getByLabelText("휴원 이름")).toHaveValue("");
    expect(screen.getByRole("button", { name: "휴원일 지정" })).toBeDisabled();
  });
  it("악기별 기본 색만 선택하고 연한 실제 시간표 색을 미리 본 뒤 저장한다", async () => {
    const user = userEvent.setup();
    const onSaveColor = vi.fn();
    render(<LessonScheduleSettingsForm instruments={[{ id: "piano", name: "피아노" }]}
      colors={[]} closures={[]} isSaving={false}
      onSaveColor={onSaveColor} onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("색상 설정 악기"), "piano");
    expect(screen.queryByLabelText("직접 색상 선택")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기본 색 2" })).toHaveStyle({ backgroundColor: "#cfdeee" });
    await user.click(screen.getByRole("button", { name: "기본 색 2" }));
    await user.click(screen.getByRole("button", { name: "악기 색상 저장" }));
    expect(onSaveColor).toHaveBeenCalledWith("piano", expect.stringMatching(/^#[0-9a-f]{6}$/i));
  });

  it("마이그레이션 전 직접 선택 색도 가장 가까운 기본 색을 선택한 상태로 보여 준다", async () => {
    const user = userEvent.setup();
    render(<LessonScheduleSettingsForm instruments={[{ id: "piano", name: "피아노" }]}
      colors={[{ instrumentId: "piano", colorHex: "#236bb3" }]} closures={[]} isSaving={false}
      onSaveColor={vi.fn()} onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText("색상 설정 악기"), "piano");
    expect(screen.getByRole("button", { name: "기본 색 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("하루·기간·매주 반복 휴원을 입력한다", async () => {
    const user = userEvent.setup();
    render(<LessonScheduleSettingsForm instruments={[]} colors={[]} closures={[]}
      isSaving={false} onSaveColor={vi.fn()}
      onSaveClosure={vi.fn()} onArchiveClosure={vi.fn()} />);
    expect(screen.getByLabelText("휴원 종류")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("휴원 종류"), "weekly");
    expect(screen.getByLabelText("반복 요일")).toBeInTheDocument();
    await user.type(screen.getByLabelText("휴원 이름"), "월요일 휴원");
    await user.type(screen.getByLabelText("휴원 시작일"), "2026-10-01");
    expect(screen.getByRole("button", { name: "휴원일 지정" })).toBeDisabled();
  });
});

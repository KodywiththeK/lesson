import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { demoLessonWorkspaceData } from "@/lib/demo/lesson-demo-data";
import { getInstrumentColorTone } from "@/domain/instrument-color";

import { PrivateLessonDayView } from "./private-lesson-day-view";

const lesson = demoLessonWorkspaceData.privateLessons[0];

function renderView(props: Partial<ComponentProps<typeof PrivateLessonDayView>> = {}) {
  const handlers = {
    onChangeDate: vi.fn(),
    onToday: vi.fn(),
    onMark: vi.fn(),
    onCancelAttendance: vi.fn(),
    onCreateMemo: vi.fn(),
    onUpdateMemo: vi.fn(),
    onDeleteMemo: vi.fn(),
  };
  const view = (overrides: Partial<ComponentProps<typeof PrivateLessonDayView>> = {}) => (
    <PrivateLessonDayView
      academyId="academy-demo"
      date="2026-08-21"
      lessons={[lesson]}
      sessionLabels={new Map([[lesson.id, "1/8"]])}
      memos={[]}
      memoTargets={{ students: [], teachers: [] }}
      canManage
      pendingLessonIds={new Set()}
      {...handlers}
      {...props}
      {...overrides}
    />
  );
  const { rerender } = render(view());

  return {
    ...handlers,
    user: userEvent.setup(),
    changeDate: (date: string) => rerender(view({ date })),
  };
}

describe("PrivateLessonDayView", () => {
  it("행 전체와 원생 이름은 채우지 않고 악기 이름에만 색상 태그를 표시한다", () => {
    const tone = getInstrumentColorTone("#246bb2", "scheduled");
    renderView({ canManage: false,
      instrumentColors: new Map([[lesson.instrumentId, "#246bb2"]]),
      assignedTicketBalances: [{ studentId: lesson.studentId, instrumentId: lesson.instrumentId, remainingCount: 3, validUntil: "2026-12-31" }],
    });
    const row = screen.getByRole("row", { name: new RegExp(lesson.studentName) });
    expect(row).not.toHaveStyle({ backgroundColor: tone.background });
    expect(screen.getByText(lesson.studentName)).not.toHaveAttribute("style");
    expect(screen.getByText(lesson.instrumentName)).toHaveStyle({ backgroundColor: tone.background, color: tone.foreground });
    expect(screen.getByText(/잔여 3회/)).not.toHaveAttribute("style");
    expect(screen.getByText("예정")).not.toHaveAttribute("style");
  });

  it("등원한 악기 이름 태그도 예정과 같은 색을 쓴다", () => {
    const present = { ...lesson, status: "present" as const };
    const tone = getInstrumentColorTone("#246bb2", "present");
    renderView({ lessons: [present], instrumentColors: new Map([[lesson.instrumentId, "#246bb2"]]) });
    expect(screen.getByText(lesson.instrumentName)).toHaveStyle({ backgroundColor: tone.background, color: tone.foreground });
  });

  it("선택한 날짜의 개인레슨을 모달 없이 표로 보여 준다", () => {
    renderView();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "2026-08-21 개인레슨 테이블" });
    expect(within(table).getByText(lesson.studentName)).toBeInTheDocument();
    expect(within(table).getByText("1/8")).toBeInTheDocument();
    expect(within(table).queryByRole("columnheader", { name: "날짜" })).not.toBeInTheDocument();
  });

  it("그날 레슨이 없으면 안내한다", () => {
    renderView({ lessons: [] });

    expect(screen.getByText("선택한 날짜에 개인레슨이 없습니다.")).toBeInTheDocument();
  });

  it("날짜 컨트롤과 일별 메모지 버튼으로 날짜를 옮긴다", async () => {
    const { onChangeDate, onToday, user } = renderView();

    await user.click(screen.getByRole("button", { name: "개인레슨 테이블 이전 날짜" }));
    await user.click(screen.getByRole("button", { name: "오늘로 이동" }));

    expect(onChangeDate).toHaveBeenCalledWith("2026-08-20");
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /^8월 21일 메모지/ })).toBeInTheDocument();
  });

  it("등원 확인을 행에서 바로 한다", async () => {
    const { onMark, user } = renderView();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 등원 확인` }));

    expect(onMark).toHaveBeenCalledWith(lesson, "present");
  });

  it("출석한 레슨에는 등원 확인 취소를 보여 주고 누르면 취소를 알린다", async () => {
    const present = { ...lesson, status: "present" as const };
    const { onCancelAttendance, user } = renderView({ lessons: [present] });

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 등원 확인 취소` }));

    expect(onCancelAttendance).toHaveBeenCalledWith(present);
  });

  it("결석을 누르면 그 행 아래에 사유 입력을 펼치고, 저장하면 결석과 사유를 전달한다", async () => {
    const { onMark, user } = renderView();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));

    const row = screen.getByRole("row", { name: new RegExp(lesson.studentName) });
    const form = screen.getByRole("textbox", { name: "결석 사유 (선택)" });
    expect(onMark).not.toHaveBeenCalled();
    expect(row.nextElementSibling).toContainElement(form);

    await user.type(form, " 감기로 결석 ");
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    expect(onMark).toHaveBeenCalledWith(lesson, "absent", "감기로 결석");
    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("저장이 실패하면 입력한 사유를 잃지 않도록 폼을 열어 둔다", async () => {
    const onMark = vi.fn().mockResolvedValue(false);
    const { user } = renderView({ onMark });

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.type(screen.getByRole("textbox", { name: "결석 사유 (선택)" }), "감기");
    await user.click(screen.getByRole("button", { name: "결석 저장" }));

    await waitFor(() => expect(onMark).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("감기");
  });

  it("사유 입력을 취소하면 저장하지 않고 폼을 닫는다", async () => {
    const { onMark, user } = renderView();

    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    await user.click(screen.getByRole("button", { name: "사유 입력 취소" }));

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("이미 결석인 레슨은 사유 수정을 제공하고 현재 사유를 채운다", async () => {
    const absent = { ...lesson, status: "absent" as const, absenceReason: "감기" };
    const { user } = renderView({ lessons: [absent] });

    expect(
      screen.queryByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석 사유 수정` }));

    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toHaveValue("감기");
  });

  it("날짜가 바뀌면 열어 둔 사유 입력을 닫는다", async () => {
    const { user, changeDate } = renderView();
    await user.click(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` }));
    expect(screen.getByRole("textbox", { name: "결석 사유 (선택)" })).toBeInTheDocument();

    changeDate("2026-08-22");

    expect(screen.queryByRole("textbox", { name: "결석 사유 (선택)" })).not.toBeInTheDocument();
  });

  it("같은 수업의 요청 중에는 등원·결석·사유 수정을 누를 수 없다", () => {
    renderView({ pendingLessonIds: new Set([lesson.id]) });

    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 등원 확인` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `${lesson.studentName} 개인레슨 결석` })).toBeDisabled();
  });

  it("이 날짜에 개인레슨 등록 버튼은 등록 동작이 주어졌을 때만 보여 준다", async () => {
    const onRegisterOnDate = vi.fn();
    const { user } = renderView({ onRegisterOnDate });

    await user.click(screen.getByRole("button", { name: "이 날짜에 개인레슨 등록" }));

    expect(onRegisterOnDate).toHaveBeenCalledTimes(1);
  });

  it("등록 동작이 없으면 등록 버튼을 보여 주지 않는다", () => {
    renderView();

    expect(screen.queryByRole("button", { name: "이 날짜에 개인레슨 등록" })).not.toBeInTheDocument();
  });

  it("선생님(조회·본인 출결)에게는 메모지를 숨기고 배정 회차권 잔여를 보여 준다", () => {
    renderView({
      canManage: false,
      assignedTicketBalances: [
        { studentId: lesson.studentId, instrumentId: lesson.instrumentId, remainingCount: 3, validUntil: "2026-12-31" },
      ],
    });

    expect(screen.queryByRole("button", { name: /메모지/ })).not.toBeInTheDocument();
    expect(screen.getByText(/잔여 3회 · 만료일 2026-12-31/)).toBeInTheDocument();
  });

  it("변경 이력은 접이식 섹션으로, 이력이 주어졌고 관리 권한일 때만 보여 준다", async () => {
    const { user } = renderView({ history: <p>출석 확인 취소 기록</p> });

    expect(screen.queryByText("출석 확인 취소 기록")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /변경 이력/ }));
    expect(screen.getByText("출석 확인 취소 기록")).toBeInTheDocument();
  });

  it("이력이 없으면 변경 이력 섹션을 두지 않는다", () => {
    renderView();

    expect(screen.queryByRole("button", { name: /변경 이력/ })).not.toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import {
  demoLessonWorkspaceData,
  type LessonWorkspaceDemoData,
} from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

type User = ReturnType<typeof userEvent.setup>;

function renderAcademy({
  demoData = demoLessonWorkspaceData,
  canManage = true,
}: { demoData?: LessonWorkspaceDemoData; canManage?: boolean } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind="academy"
        initialDate="2026-08-21"
        canManage={canManage}
        demoData={demoData}
      />
    </QueryClientProvider>,
  );
}

// 결석인원 목록처럼 모달이 열린 채로도 달력 결과를 확인하려고 숨김 상태까지 포함해 찾는다.
function getCalendar() {
  return screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더", hidden: true });
}

function getDayCell(day: number) {
  return within(getCalendar()).getByRole("gridcell", {
    name: `2026-08-${String(day).padStart(2, "0")}`,
    hidden: true,
  });
}

async function openDay(user: User, day: number) {
  await user.click(getDayCell(day));

  return screen.findByRole("dialog", {
    name: `2026-08-${String(day).padStart(2, "0")} 출석 확인`,
  });
}

async function openAbsenceDialog(user: User) {
  await user.click(screen.getByRole("button", { name: "결석인원" }));

  return screen.findByRole("dialog", { name: "2026년 8월 결석인원" });
}

async function openResolutionDialog(user: User, studentName = "박지호") {
  const absenceDialog = await openAbsenceDialog(user);
  await user.click(within(absenceDialog).getByRole("button", { name: `${studentName} 결석확인` }));

  return screen.findByRole("dialog", { name: "결석 사유서" });
}

function createDataTransfer() {
  const store = new Map<string, string>();

  return {
    effectAllowed: "all",
    dropEffect: "move",
    setData: (type: string, value: string) => store.set(type, value),
    getData: (type: string) => store.get(type) ?? "",
  };
}

function dragChip(studentName: string, fromCell: HTMLElement, toCell: HTMLElement) {
  const chip = within(fromCell).getByText(studentName).closest("[draggable]") as HTMLElement;
  const dataTransfer = createDataTransfer();

  fireEvent.dragStart(chip, { dataTransfer });
  fireEvent.dragOver(toCell, { dataTransfer });
  fireEvent.drop(toCell, { dataTransfer });
  fireEvent.dragEnd(chip, { dataTransfer });
}

function withRows(
  rows: Array<Partial<DailyAcademyAttendanceRow> & Pick<DailyAcademyAttendanceRow, "lessonEventId">>,
): LessonWorkspaceDemoData {
  const rowsByDate = new Map<string, DailyAcademyAttendanceRow[]>();

  for (const partial of rows) {
    const row: DailyAcademyAttendanceRow = {
      academyId: "academy-demo",
      studentId: `student-${partial.lessonEventId}`,
      studentName: partial.lessonEventId,
      instrumentId: "piano",
      instrumentName: "피아노",
      date: "2026-08-21",
      startTime: "15:00",
      endTime: "15:50",
      status: "pending",
      origin: "regular",
      originLabel: "정기",
      ...partial,
    };
    rowsByDate.set(row.date, [...(rowsByDate.get(row.date) ?? []), row]);
  }

  return {
    ...demoLessonWorkspaceData,
    calendarMemos: [],
    academySheets: [...rowsByDate.entries()].map(([date, sheetRows]) => ({
      academyId: "academy-demo",
      date,
      rows: sheetRows,
      absenceQueue: [],
      summary: { total: sheetRows.length, present: 0, absent: 0, pending: sheetRows.length },
    })),
  };
}

describe("학원 레슨표 출석확인", () => {
  afterEach(() => vi.restoreAllMocks());

  it("원생별 등원/결석은 임시로 고르고 닫으면 저장하지 않고 버린다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    let dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("radio", { name: "이서윤 등원" }));
    expect(within(dialog).getByRole("radio", { name: "이서윤 등원" })).toBeChecked();
    expect(within(within(dialog).getByRole("row", { name: /이서윤/ })).getByText("대기")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" })).not.toBeInTheDocument());

    dialog = await openDay(user, 21);
    expect(within(dialog).getByRole("radio", { name: "이서윤 등원" })).not.toBeChecked();
    expect(within(within(dialog).getByRole("row", { name: /이서윤/ })).getByText("대기")).toBeInTheDocument();
  });

  it("출석 저장을 누르면 고른 출결을 한꺼번에 저장하고 날짜 출석을 마감한다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderAcademy();

    let dialog = await openDay(user, 21);
    expect(within(dialog).getByRole("button", { name: "출석 저장" })).toBeDisabled();

    await user.click(within(dialog).getByRole("radio", { name: "이서윤 결석" }));
    await user.click(within(dialog).getByRole("radio", { name: "김민지 결석" }));
    await user.click(within(dialog).getByRole("button", { name: "출석 저장" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" })).not.toBeInTheDocument());
    expect(success).toHaveBeenCalledWith("출석을 저장했습니다. 결석 2명은 결석인원에서 처리해 주세요.");

    dialog = await openDay(user, 21);
    expect(within(within(dialog).getByRole("row", { name: /이서윤/ })).getByText("결석")).toBeInTheDocument();
    expect(within(within(dialog).getByRole("row", { name: /김민지/ })).getByText("결석")).toBeInTheDocument();
  });

  it("전체 등원과 전체 결석은 명단 전체를 한 번에 고른다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "전체 등원" }));

    for (const name of ["김민지", "이서윤", "박지호"]) {
      expect(within(dialog).getByRole("radio", { name: `${name} 등원` })).toBeChecked();
    }

    await user.click(within(dialog).getByRole("button", { name: "전체 결석" }));

    for (const name of ["김민지", "이서윤", "박지호"]) {
      expect(within(dialog).getByRole("radio", { name: `${name} 결석` })).toBeChecked();
    }

    await user.click(within(dialog).getByRole("button", { name: "출석 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "결석인원" }));
    const absenceDialog = await screen.findByRole("dialog", { name: "2026년 8월 결석인원" });
    expect(absenceDialog).toHaveTextContent("김민지");
    expect(absenceDialog).toHaveTextContent("이서윤");
    expect(absenceDialog).toHaveTextContent("박지호");
  });

  it("검색으로 좁힌 명단에서는 전체 등원이 보이는 원생에게만 적용된다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.type(within(dialog).getByRole("searchbox", { name: "원생 검색" }), "이서윤");

    expect(dialog).toHaveTextContent("검색 결과 1명에게만 적용됩니다");
    await user.click(within(dialog).getByRole("button", { name: "전체 등원" }));
    await user.clear(within(dialog).getByRole("searchbox", { name: "원생 검색" }));

    expect(within(dialog).getByRole("radio", { name: "이서윤 등원" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "박지호 등원" })).not.toBeChecked();
  });

  it("이미 보강·패스로 확정한 결석은 출결을 다시 고를 수 없고 결과를 표시한다", async () => {
    const user = userEvent.setup();
    renderAcademy({
      demoData: withRows([
        { lessonEventId: "a", studentName: "김민지", status: "absent", absenceResolution: "makeup" },
        { lessonEventId: "b", studentName: "이서윤", status: "absent", absenceResolution: "pass" },
      ]),
    });

    const dialog = await openDay(user, 21);

    expect(within(dialog).getByText("보강 완료")).toBeInTheDocument();
    expect(within(dialog).getByText("패스 완료")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "김민지 등원" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "김민지 출결 초기화" })).toBeDisabled();
  });

  it("선택한 날짜에 일정이 없으면 빈 상태를 안내한다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 25);

    expect(dialog).toHaveTextContent("선택한 날짜에 예정된 학원 레슨이 없습니다.");
    expect(within(dialog).getByRole("button", { name: "출석 저장" })).toBeDisabled();
  });
});

describe("학원 레슨표 결석인원과 결석 사유서", () => {
  afterEach(() => vi.restoreAllMocks());

  it("결석인원은 조회 중인 달의 결석을 날짜순으로 한 번에 보여 준다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openAbsenceDialog(user);
    const rows = within(dialog).getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("2026-08-21");
    expect(rows[0]).toHaveTextContent("17:00-17:50");
    expect(rows[0]).toHaveTextContent("박지호");
    expect(rows[0]).toHaveTextContent("피아노");
    expect(rows[0]).toHaveTextContent("김하늘");
    expect(rows[0]).toHaveTextContent("연락 대기");
    expect(rows[0]).toHaveTextContent("미처리");
    expect(rows[1]).toHaveTextContent("2026-08-22");
    expect(rows[1]).toHaveTextContent("강도현");
    expect(rows[1]).toHaveTextContent("보호자 통화 예정");
    expect(within(dialog).queryByText("김민지")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("정하린")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent("총 2건 · 미처리 2건 · 보강 0건 · 패스 0건");
  });

  it("월을 옮기면 그 달의 결석으로 바뀌고 결석이 없는 달은 빈 상태를 보여 준다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openAbsenceDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "결석인원 다음 달" }));

    const septemberDialog = await screen.findByRole("dialog", { name: "2026년 9월 결석인원" });
    expect(septemberDialog).toHaveTextContent("이 달에는 결석 인원이 없습니다.");
    expect(within(septemberDialog).queryByText("박지호")).not.toBeInTheDocument();

    await user.click(within(septemberDialog).getByRole("button", { name: "결석인원 이전 달" }));

    expect(await screen.findByRole("dialog", { name: "2026년 8월 결석인원" })).toHaveTextContent("박지호");
  });

  it("다른 날짜의 미처리 결석도 같은 목록에서 바로 결석확인할 수 있다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openAbsenceDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "강도현 결석확인" }));

    expect(await screen.findByRole("dialog", { name: "결석 사유서" })).toHaveTextContent("강도현 · 8/22");
  });

  it("이미 보강·패스로 처리된 결석은 처리 결과만 보여 주고 다시 처리할 수 없어 이중 보강을 막는다", async () => {
    const user = userEvent.setup();
    renderAcademy({
      demoData: withRows([
        { lessonEventId: "a", studentName: "박지호", status: "absent", absenceResolution: "makeup" },
        { lessonEventId: "b", studentName: "이서윤", status: "absent", absenceResolution: "pass" },
        { lessonEventId: "c", studentName: "강도현", status: "absent" },
      ]),
    });

    const dialog = await openAbsenceDialog(user);

    expect(within(within(dialog).getByRole("row", { name: /박지호/ })).getByText("보강 완료")).toBeInTheDocument();
    expect(within(within(dialog).getByRole("row", { name: /이서윤/ })).getByText("패스 완료")).toBeInTheDocument();
    expect(within(within(dialog).getByRole("row", { name: /강도현/ })).getByText("미처리")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "박지호 결석확인" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "이서윤 결석 취소" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "강도현 결석확인" })).toBeInTheDocument();
    expect(dialog).toHaveTextContent("총 3건 · 미처리 1건 · 보강 1건 · 패스 1건");
  });

  it("결석 취소는 결석 표시를 거두고 출결을 대기 상태로 되돌린다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openAbsenceDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "박지호 결석 취소" }));

    expect(within(dialog).queryByText("박지호")).not.toBeInTheDocument();
    expect(within(dialog).getByText("강도현")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    const dayDialog = await openDay(user, 21);
    expect(within(within(dayDialog).getByRole("row", { name: /박지호/ })).getByText("대기")).toBeInTheDocument();
  });

  it("사유서는 사유 선택 → 날짜·시간 → 사유 메모 순서이고 사유를 고르기 전에는 날짜·시간이 잠겨 있다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    const labels = within(sheet)
      .getAllByText(/^[①②③]/)
      .map((element) => element.textContent);

    expect(labels).toEqual(["① 사유 선택", "② 보강 날짜·시간", "③ 사유 메모 (선택)"]);
    expect(within(sheet).getByLabelText("보강일")).toBeDisabled();
    expect(within(sheet).getByLabelText("보강 시간")).toBeDisabled();
    expect(within(sheet).getByRole("button", { name: "확인" })).toBeDisabled();
  });

  it("패스를 고르면 날짜·시간은 잠긴 채 사유 메모 없이도 확인할 수 있다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "패스" }));

    expect(within(sheet).getByLabelText("보강일")).toBeDisabled();
    expect(within(sheet).getByLabelText("보강 시간")).toBeDisabled();
    expect(within(sheet).queryByRole("radiogroup", { name: "추천 보강일" })).not.toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "확인" })).toBeEnabled();
  });

  it("최종확인에서 취소하면 처리하지 않고 사유서로 돌아온다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "패스" }));
    await user.click(within(sheet).getByRole("button", { name: "확인" }));

    const confirm = await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" });
    await user.click(within(confirm).getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "결석 사유서" })).toBeInTheDocument();
  });

  it("패스로 최종 확인하면 결석인원 목록에서 패스 완료로 바뀌고 보강 일정은 생기지 않는다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderAcademy();

    const absenceDialog = await openAbsenceDialog(user);
    await user.click(within(absenceDialog).getByRole("button", { name: "박지호 결석확인" }));
    const sheet = await screen.findByRole("dialog", { name: "결석 사유서" });
    await user.click(within(sheet).getByRole("radio", { name: "패스" }));
    await user.type(within(sheet).getByLabelText("사유 메모"), "보호자 요청");
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    const confirm = await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" });
    expect(confirm).toHaveTextContent("결석인원 목록에 패스 완료로 표시되고 월별 메모에 기록됩니다.");
    await user.click(within(confirm).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
    expect(success).toHaveBeenCalledWith("패스로 처리했습니다.");
    const passedRow = within(screen.getByRole("dialog", { name: "2026년 8월 결석인원" })).getByRole("row", {
      name: /박지호/,
    });
    expect(within(passedRow).getByText("패스 완료")).toBeInTheDocument();
    expect(within(passedRow).queryByRole("button", { name: "박지호 결석확인" })).not.toBeInTheDocument();
    expect(within(getCalendar()).queryByText("박지호")).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: "2026년 8월 결석인원" })).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("switch", { name: "전체 기록 보기" }));
    expect(within(getCalendar()).getByText("박지호")).toBeInTheDocument();
  });

  it("보강을 고르면 추천 보강일 5개를 인원과 함께 보여 주고 1순위를 기본 선택한다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));

    const recommendations = within(sheet).getByRole("radiogroup", { name: "추천 보강일" });
    const options = within(recommendations).getAllByRole("radio");

    // 8/21(금) 결석, 박지호의 정규 요일은 금요일. 주말과 금요일을 빼고 인원이 같으니 결석일에 가까운 순서다.
    expect(options.map((option) => option.getAttribute("aria-label"))).toEqual([
      "8/24 (월) · 0명",
      "8/25 (화) · 0명",
      "8/26 (수) · 0명",
      "8/27 (목) · 0명",
      "8/31 (월) · 0명",
    ]);
    expect(options[0]).toBeChecked();
    expect(within(recommendations).getAllByText("추천")).toHaveLength(5);
    expect(within(sheet).getByLabelText("보강일")).toHaveValue("2026-08-24");
    expect(within(sheet).getByLabelText("보강일")).toBeEnabled();
  });

  it("추천 기준 안내 아이콘을 누르면 세 가지 기준을 알려 준다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.click(within(sheet).getByRole("button", { name: "추천 기준 보기" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("정규 등원 요일은 제외");
    expect(tooltip).toHaveTextContent("등원 인원이 적은 날 우선");
    expect(tooltip).toHaveTextContent("결석일 이후 가까운 날 우선");
  });

  it("키보드로 안내 아이콘에 초점을 두어도 추천 기준이 열린다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    within(sheet).getByRole("button", { name: "추천 기준 보기" }).focus();

    expect(await screen.findByRole("tooltip")).toHaveTextContent("정규 등원 요일은 제외");
  });

  it("추천 목록 대신 달력에서 보강일을 직접 고를 수 있다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    const dateField = within(sheet).getByLabelText("보강일");
    await user.clear(dateField);
    await user.type(dateField, "2026-08-28");

    for (const option of within(sheet).getAllByRole("radio", { name: /\(.\) · \d+명/ })) {
      expect(option).not.toBeChecked();
    }
    expect(within(sheet).getByRole("button", { name: "확인" })).toBeEnabled();
  });

  it("보강일을 지우면 확인할 수 없다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.clear(within(sheet).getByLabelText("보강일"));

    expect(within(sheet).getByRole("button", { name: "확인" })).toBeDisabled();
  });

  it("보강으로 최종 확인하면 보강일 달력에 보강 수업이 생기고 시간을 입력하지 않으면 시간을 표시하지 않는다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.click(within(sheet).getByRole("radio", { name: "8/25 (화) · 0명" }));
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    const confirm = await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" });
    expect(confirm).toHaveTextContent("박지호");
    expect(confirm).toHaveTextContent("보강 8/25 (화)");
    await user.click(within(confirm).getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
    expect(success).toHaveBeenCalledWith("보강 일정을 저장했습니다.");

    const makeupCell = getDayCell(25);
    expect(makeupCell).toHaveTextContent("박지호");
    expect(makeupCell).toHaveTextContent("[보강 수업]");
    expect(makeupCell).not.toHaveTextContent("17:00");
    const makeupRow = within(screen.getByRole("dialog", { name: "2026년 8월 결석인원" })).getByRole("row", {
      name: /박지호/,
    });
    expect(within(makeupRow).getByText("보강 완료")).toBeInTheDocument();
    expect(within(makeupRow).queryByRole("button", { name: "박지호 결석확인" })).not.toBeInTheDocument();
  });

  it("보강 시간을 입력하면 보강 수업에 그 시간이 표시된다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.type(within(sheet).getByLabelText("보강 시간"), "18:30");
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" })).getByRole("button", {
        name: "확인",
      }),
    );

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
    expect(getDayCell(24)).toHaveTextContent("[보강 수업] 18:30 피아노");
  });

  it("보강 확정 뒤 원본 결석 일정은 결석 기록으로 남고 보강 완료로 표시된다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const sheet = await openResolutionDialog(user);
    await user.click(within(sheet).getByRole("radio", { name: "보강" }));
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" })).getByRole("button", {
        name: "확인",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
    await user.click(within(screen.getByRole("dialog", { name: "2026년 8월 결석인원" })).getByRole("button", { name: "Close" }));

    const dayDialog = await openDay(user, 21);
    const row = within(dayDialog).getByRole("row", { name: /박지호/ });
    expect(within(row).getByText("결석")).toBeInTheDocument();
    expect(within(row).getByText("보강 완료")).toBeInTheDocument();
  });
});

describe("결석 사유서와 월별 메모지 자동 기록", () => {
  afterEach(() => vi.restoreAllMocks());

  async function resolveAbsence(
    user: User,
    studentName: string,
    resolution: "보강" | "패스",
    memo?: string,
  ) {
    const absenceDialog = await screen.findByRole("dialog", { name: "2026년 8월 결석인원" });
    await user.click(within(absenceDialog).getByRole("button", { name: `${studentName} 결석확인` }));
    const sheet = await screen.findByRole("dialog", { name: "결석 사유서" });
    await user.click(within(sheet).getByRole("radio", { name: resolution }));
    if (memo) {
      await user.type(within(sheet).getByLabelText("사유 메모"), memo);
    }
    await user.click(within(sheet).getByRole("button", { name: "확인" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "최종확인하시겠습니까?" })).getByRole("button", {
        name: "확인",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결석 사유서" })).not.toBeInTheDocument());
  }

  it("사유서를 확정할 때마다 월별 메모지에 한 줄씩 자동으로 기록된다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dayDialog = await openDay(user, 21);
    await user.click(within(dayDialog).getByRole("radio", { name: "이서윤 결석" }));
    await user.click(within(dayDialog).getByRole("button", { name: "출석 저장" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "결석인원" }));
    await resolveAbsence(user, "박지호", "패스", "보호자 요청");
    await resolveAbsence(user, "이서윤", "보강");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026년 8월 결석인원" })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /^\d+월 메모지/ }));
    const note = await screen.findByRole("textbox", { name: "8월 메모 내용" });
    expect(note).toHaveValue(
      "박지호, 8/21 [금요일] 보호자 요청\n이서윤, 8/24 [월요일] 보강 - 8/21 [금요일]",
    );
  });
});

describe("학원 레슨표 일정 이동과 삭제", () => {
  afterEach(() => vi.restoreAllMocks());

  it("이동 다이얼로그는 사유를 비워도 같은 달 안에서 옮길 수 있다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 이동" }));
    const moveDialog = await screen.findByRole("dialog", { name: "이서윤 일정 이동" });
    const dateField = within(moveDialog).getByLabelText("이동 날짜");
    await user.clear(dateField);
    await user.type(dateField, "2026-08-27");

    expect(within(moveDialog).getByRole("button", { name: "이동 저장" })).toBeEnabled();
  });

  it("이동 다이얼로그는 다른 달로 옮기려 하면 사용자 문구로 막는다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 이동" }));
    const moveDialog = await screen.findByRole("dialog", { name: "이서윤 일정 이동" });
    const dateField = within(moveDialog).getByLabelText("이동 날짜");
    await user.clear(dateField);
    await user.type(dateField, "2026-09-02");

    expect(within(moveDialog).getByRole("alert")).toHaveTextContent("일정은 같은 달 안에서만 이동할 수 있습니다.");
    expect(within(moveDialog).getByRole("button", { name: "이동 저장" })).toBeDisabled();
  });

  it("출결이 처리된 일정은 이동·삭제하지 않고 초기화 후 다시 하라고 안내한다", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "김민지 일정 삭제" }));

    expect(error).toHaveBeenCalledWith(
      "이미 출결이 처리된 일정은 삭제할 수 없습니다. 먼저 출결을 초기화해 주세요.",
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "김민지 일정 이동" }));
    expect(error).toHaveBeenCalledWith(
      "이미 출결이 처리된 일정은 이동할 수 없습니다. 먼저 출결을 초기화해 주세요.",
    );
    expect(screen.queryByRole("dialog", { name: "김민지 일정 이동" })).not.toBeInTheDocument();
  });

  it("삭제는 사유를 입력해야 하고 확인하면 일정만 사라진다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 삭제" }));

    const confirm = await screen.findByRole("alertdialog", { name: "이 일정을 삭제할까요?" });
    expect(confirm).toHaveTextContent("원생 기본 정보와 정규 시간표는 바뀌지 않습니다.");
    expect(within(confirm).getByRole("button", { name: "삭제" })).toBeDisabled();

    await user.type(within(confirm).getByLabelText("삭제 사유"), "   ");
    expect(within(confirm).getByRole("button", { name: "삭제" })).toBeDisabled();

    await user.type(within(confirm).getByLabelText("삭제 사유"), "휴원");
    await user.click(within(confirm).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(success).toHaveBeenCalledWith("학원 일정을 삭제했습니다.");
    expect(within(dialog).queryByRole("row", { name: /이서윤/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("row", { name: /김민지/ })).toBeInTheDocument();
    expect(within(getCalendar()).queryByText("이서윤")).not.toBeInTheDocument();
  });

  it("삭제를 취소하면 일정이 그대로 남는다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 삭제" }));
    const confirm = await screen.findByRole("alertdialog", { name: "이 일정을 삭제할까요?" });
    await user.type(within(confirm).getByLabelText("삭제 사유"), "휴원");
    await user.click(within(confirm).getByRole("button", { name: "취소" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(within(dialog).getByRole("row", { name: /이서윤/ })).toBeInTheDocument();
  });
});

describe("일정 이동·삭제는 원생 기본 정보를 바꾸지 않는다", () => {
  afterEach(() => vi.restoreAllMocks());

  async function expectStudentStillRegistrable(user: User) {
    await user.click(screen.getByRole("button", { name: "일정 추가" }));
    const dialog = await screen.findByRole("dialog", { name: "학원 일정 추가" });
    const students = within(dialog).getByLabelText("원생");

    expect(within(students).getByRole("option", { name: /이서윤/ })).toBeInTheDocument();
  }

  it("일정을 삭제해도 그 원생은 일정 추가 대상에 그대로 남는다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const dialog = await openDay(user, 21);
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 삭제" }));
    const confirm = await screen.findByRole("alertdialog", { name: "이 일정을 삭제할까요?" });
    await user.type(within(confirm).getByLabelText("삭제 사유"), "휴원");
    await user.click(within(confirm).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await user.click(within(dialog).getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" })).not.toBeInTheDocument());

    await expectStudentStillRegistrable(user);
  });

  it("달력에서 일정을 옮겨도 원생 정보는 그대로이고 같은 날 다른 원생 일정도 그대로다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    dragChip("이서윤", getDayCell(21), getDayCell(24));
    await user.click(within(await screen.findByRole("dialog", { name: "이서윤 일정 이동" })).getByRole("button", { name: "이동 저장" }));
    await waitFor(() => expect(within(getDayCell(24)).getByText("이서윤")).toBeInTheDocument());

    expect(within(getDayCell(21)).getByText("김민지")).toBeInTheDocument();
    expect(within(getDayCell(21)).queryByText("박지호")).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "전체 기록 보기" }));
    expect(within(getDayCell(21)).getByText("박지호")).toBeInTheDocument();
    await expectStudentStillRegistrable(user);
  });
});

describe("학원 레슨표 달력 드래그 이동", () => {
  afterEach(() => vi.restoreAllMocks());

  it("일정을 같은 달의 다른 날짜로 끌어 놓으면 그 날짜로 옮겨진다", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success");
    renderAcademy();

    dragChip("이서윤", getDayCell(21), getDayCell(24));
    await user.click(within(await screen.findByRole("dialog", { name: "이서윤 일정 이동" })).getByRole("button", { name: "이동 저장" }));

    await waitFor(() => expect(within(getDayCell(24)).getByText("이서윤")).toBeInTheDocument());
    expect(within(getDayCell(21)).queryByText("이서윤")).not.toBeInTheDocument();
    expect(getDayCell(24)).toHaveTextContent("[이동]");
    // 시간은 그대로 옮긴다.
    expect(getDayCell(24)).toHaveTextContent("16:00");
    expect(success).toHaveBeenCalledWith("학원 일정을 이동했습니다.");
  });

  it("다른 달 날짜로 끌어 놓으면 이동 창을 열지 않는다", () => {
    renderAcademy();
    const nextMonthCell = within(getCalendar()).getAllByRole("gridcell", { hidden: true }).at(-1) as HTMLElement;

    dragChip("이서윤", getDayCell(21), nextMonthCell);

    expect(screen.queryByRole("dialog", { name: "이서윤 일정 이동" })).not.toBeInTheDocument();
    expect(within(getDayCell(21)).getByText("이서윤")).toBeInTheDocument();
  });

  it("같은 날짜에 놓거나 출결이 처리된 일정은 옮겨지지 않는다", () => {
    const error = vi.spyOn(toast, "error");
    renderAcademy();

    dragChip("이서윤", getDayCell(21), getDayCell(21));
    expect(within(getDayCell(21)).getByText("이서윤")).toBeInTheDocument();

    const processedChip = within(getDayCell(21)).getByText("김민지").closest("[draggable]");
    expect(processedChip).toHaveAttribute("draggable", "false");
    expect(error).not.toHaveBeenCalled();
  });

  it("조회만 가능한 선생님은 일정을 끌어 옮길 수 없다", () => {
    renderAcademy({ canManage: false });

    expect(within(getDayCell(21)).getByText("이서윤").closest("[draggable=true]")).toBeNull();
  });
});

describe("학원 레슨표 요일별 인원확인", () => {
  it("접이식 카드를 열면 선택한 달 정규 일정 기준으로 요일별 인원 이름과 전체 인원을 보여 준다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    const trigger = screen.getByRole("button", { name: /요일별 인원확인/ });
    expect(trigger).toHaveTextContent("전체 3명");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    const friday = screen.getByRole("group", { name: "금요일 3명" });
    expect(friday).toHaveTextContent("김민지");
    expect(friday).toHaveTextContent("박지호");
    expect(friday).toHaveTextContent("이서윤");
    expect(screen.getByRole("group", { name: "월요일 0명" })).toBeInTheDocument();
    // 토요일 정규 일정(강도현)은 월~금 인원확인에 들어가지 않는다.
    expect(screen.getAllByRole("group")).toHaveLength(5);
    for (const group of screen.getAllByRole("group")) {
      expect(group).not.toHaveTextContent("강도현");
    }
  });

  it("달을 옮기면 그 달의 정규 일정으로 다시 센다", async () => {
    const user = userEvent.setup();
    renderAcademy();

    await user.click(screen.getByRole("button", { name: "학원 레슨 캘린더 다음 달" }));

    expect(screen.getByRole("button", { name: /요일별 인원확인/ })).toHaveTextContent("전체 0명");
  });

  it("조회만 가능한 선생님도 요일별 인원확인은 볼 수 있다", () => {
    renderAcademy({ canManage: false });

    expect(screen.getByRole("button", { name: /요일별 인원확인/ })).toBeInTheDocument();
  });
});

describe("선생님은 학원 레슨표를 조회만 한다", () => {
  it("쓰기 버튼을 숨기고 조회 전용 안내를 보여 준다", async () => {
    const user = userEvent.setup();
    renderAcademy({ canManage: false });

    expect(screen.queryByRole("button", { name: "일정 추가" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "결석인원" })).not.toBeInTheDocument();
    expect(screen.getByText(/학원 레슨표는 조회만 할 수 있습니다/)).toBeInTheDocument();

    const dialog = await openDay(user, 21);

    expect(within(dialog).getByRole("row", { name: /이서윤/ })).toBeInTheDocument();
    for (const name of [/등원$/, /결석$/]) {
      expect(within(dialog).queryByRole("radio", { name })).not.toBeInTheDocument();
    }
    for (const label of ["확인", "전체 등원", "전체 결석", "이서윤 일정 이동", "이서윤 일정 삭제", "이서윤 출결 초기화"]) {
      expect(within(dialog).queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    expect(within(dialog).getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });

  it("날짜 메모는 원장·데스크 전용이라 선생님에게는 메모 탭을 보여 주지 않는다", async () => {
    const user = userEvent.setup();
    renderAcademy({ canManage: false });

    const dialog = await openDay(user, 21);

    expect(within(dialog).queryByRole("tab", { name: /메모/ })).not.toBeInTheDocument();
  });

  it("관리 권한이 있으면 쓰기 버튼이 보이고 조회 전용 안내는 없다", () => {
    renderAcademy();

    expect(screen.getByRole("button", { name: "일정 추가" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "결석인원" })).toBeInTheDocument();
    expect(screen.queryByText(/학원 레슨표는 조회만 할 수 있습니다/)).not.toBeInTheDocument();
  });
});

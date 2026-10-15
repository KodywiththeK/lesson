import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrivateLesson } from "@/domain/private-lesson";
import {
  demoLessonWorkspaceData,
  type LessonWorkspaceDemoData,
} from "@/lib/demo/lesson-demo-data";

import { LessonManagementWorkspace } from "./lesson-management-workspace";

type RenderWorkspaceOptions = {
  lessonKind?: "academy" | "private";
  demoData?: LessonWorkspaceDemoData;
};

// 시간 순서와 가나다 순서가 반대가 되도록 둔 이름. 8월 1일 레슨이 가장 뒤 이름이다.
const TIME_ORDERED_STUDENT_NAMES = [
  "타라",
  "카이",
  "차미",
  "자람",
  "아름",
  "사랑",
  "바다",
  "마루",
  "라온",
  "다온",
  "나은",
  "가온",
];

function buildPrivateLesson(
  id: string,
  studentName: string,
  startAt: string,
): PrivateLesson {
  return {
    id,
    academyId: "academy-demo",
    studentId: `student-${id}`,
    studentName,
    instrumentId: "violin",
    instrumentName: "바이올린",
    teacherId: "teacher-2",
    teacherName: "오유진",
    startAt,
    endAt: startAt.replace("10:00:00", "10:40:00"),
    status: "scheduled",
    origin: "private",
    originLabel: "개인레슨",
  };
}

function buildPagedPrivateLessonData(): LessonWorkspaceDemoData {
  const augustLessons = TIME_ORDERED_STUDENT_NAMES.map((name, index) =>
    buildPrivateLesson(
      `aug-${index + 1}`,
      name,
      `2026-08-${String(index + 1).padStart(2, "0")}T10:00:00+09:00`,
    ),
  );
  const septemberLessons = ["하늘", "구름", "나래"].map((name, index) =>
    buildPrivateLesson(
      `sep-${index + 1}`,
      name,
      `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00+09:00`,
    ),
  );

  return {
    ...demoLessonWorkspaceData,
    privateLessons: [...septemberLessons, ...augustLessons],
  };
}

function renderWorkspace({
  lessonKind = "academy",
  demoData = demoLessonWorkspaceData,
}: RenderWorkspaceOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LessonManagementWorkspace
        academyId="academy-demo"
        academyName="더 클래식"
        lessonKind={lessonKind}
        initialDate="2026-08-21"
        demoData={demoData}
      />
    </QueryClientProvider>,
  );
}

describe("LessonManagementWorkspace", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/lessons/academy");
  });
  afterEach(() => vi.useRealTimers());

  it("학원레슨표 캘린더를 예시 데이터로 보여준다", async () => {
    renderWorkspace();

    const calendar = screen.getByRole("grid", {
      name: "2026년 8월 학원레슨 캘린더",
    });

    expect(within(calendar).getByText("김민지")).toBeInTheDocument();
    expect(within(calendar).getByText("이서윤")).toBeInTheDocument();
    await userEvent.setup().click(
      within(calendar).getByRole("gridcell", { name: /21/ }),
    );

    const attendanceDialog = screen.getByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    expect(attendanceDialog).toHaveTextContent("15:00-15:50");
  });

  it("오늘 날짜는 캘린더에서 하이라이트하고 접근성 상태를 표시한다", () => {
    vi.setSystemTime(new Date("2026-08-05T12:00:00+09:00"));
    renderWorkspace({ lessonKind: "private" });

    expect(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).toBeInTheDocument();

    const todayCell = screen.getByRole("gridcell", { name: /5 오늘/ });

    expect(todayCell).toHaveAttribute("aria-current", "date");
    expect(todayCell.className).toContain("border-primary");
  });

  it("레슨 캘린더에서 이전/다음 달과 임의 연월로 이동한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      screen.getByRole("button", { name: "학원 레슨 캘린더 다음 달" }),
    );

    expect(
      screen.getByRole("grid", { name: "2026년 9월 학원레슨 캘린더" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("학원 레슨 캘린더 월 선택"), {
      target: { value: "2027-03" },
    });

    expect(
      screen.getByRole("grid", { name: "2027년 3월 학원레슨 캘린더" }),
    ).toBeInTheDocument();
  });

  it("학원 레슨표는 월간 캘린더와 선택 일자 테이블뷰를 함께 제공한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    expect(
      screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "학원레슨 테이블뷰" }));

    const table = screen.getByRole("table", {
      name: "2026-08-21 학원 레슨 테이블",
    });
    expect(within(table).getByRole("cell", { name: "김민지" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "정하린" })).not.toBeInTheDocument();

    await user.click(
      within(table).getByRole("button", { name: "김민지 출석 확인 열기" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "2026-08-21 출석 확인" }),
    ).toBeInTheDocument();
  });

  it("학원 레슨 출석 다이얼로그에서 검색, 일괄 처리, 선택 초기화를 수행한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    await user.type(within(dialog).getByRole("searchbox", { name: "원생 검색" }), "이서윤");
    expect(within(dialog).getByText("이서윤")).toBeInTheDocument();
    expect(within(dialog).queryByText("김민지")).not.toBeInTheDocument();

    await user.clear(within(dialog).getByRole("searchbox", { name: "원생 검색" }));
    await user.click(within(dialog).getByRole("button", { name: "현재 목록 3건 출석" }));

    expect(within(dialog).getAllByText("출석").length).toBeGreaterThanOrEqual(3);

    await user.click(within(dialog).getByRole("checkbox", { name: "이서윤 선택" }));
    await user.click(within(dialog).getByRole("button", { name: "선택 초기화" }));

    const seoyunRow = within(dialog).getByRole("row", { name: /이서윤/ });
    expect(within(seoyunRow).getByText("대기")).toBeInTheDocument();
  });

  it("검색으로 좁힌 목록의 일괄 처리는 보이는 원생에게만 적용되고 대상 건수가 버튼에 드러난다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    expect(within(dialog).getByRole("button", { name: "현재 목록 3건 결석" })).toBeEnabled();

    await user.type(within(dialog).getByRole("searchbox", { name: "원생 검색" }), "이서윤");
    expect(within(dialog).queryByRole("button", { name: "현재 목록 3건 결석" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "현재 목록 1건 결석" }));

    await user.clear(within(dialog).getByRole("searchbox", { name: "원생 검색" }));

    const statusFilter = within(dialog).getByRole("combobox", { name: "출결 상태 필터" });
    await user.selectOptions(statusFilter, "absent");
    expect(within(dialog).getByRole("row", { name: /이서윤/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("row", { name: /김민지/ })).not.toBeInTheDocument();

    await user.selectOptions(statusFilter, "present");
    expect(within(dialog).getByRole("row", { name: /김민지/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("row", { name: /이서윤/ })).not.toBeInTheDocument();
  });

  it("학원 레슨 출석 다이얼로그에서 이번 일정만 다른 날짜로 이동한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    await user.click(within(dialog).getByRole("button", { name: "이서윤 일정 이동" }));

    const moveDialog = await screen.findByRole("dialog", {
      name: "이서윤 일정 이동",
    });
    await user.clear(within(moveDialog).getByLabelText("이동 날짜"));
    await user.type(within(moveDialog).getByLabelText("이동 날짜"), "2026-08-24");
    await user.clear(within(moveDialog).getByLabelText("시작 시간"));
    await user.type(within(moveDialog).getByLabelText("시작 시간"), "18:00");
    await user.clear(within(moveDialog).getByLabelText("종료 시간"));
    await user.type(within(moveDialog).getByLabelText("종료 시간"), "18:50");
    await user.type(within(moveDialog).getByLabelText("이동 사유"), "콩쿠르 보충");
    await user.click(within(moveDialog).getByRole("button", { name: "이동 저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "이서윤 일정 이동" })).not.toBeInTheDocument();
    });

    const movedDayDialog = await screen.findByRole("dialog", {
      name: "2026-08-24 출석 확인",
    });
    expect(movedDayDialog).toHaveTextContent("이서윤");
    expect(movedDayDialog).toHaveTextContent("이동");
  });

  it("개인레슨표는 캘린더뷰와 테이블뷰를 함께 제공한다", async () => {
    const user = userEvent.setup();

    renderWorkspace({ lessonKind: "private" });

    await user.click(screen.getByRole("tab", { name: "개인레슨 테이블뷰" }));

    const table = screen.getByRole("table", { name: "2026년 8월 개인레슨 테이블" });
    expect(within(table).getByRole("cell", { name: "최도윤" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "오유진" })).toBeInTheDocument();

    await user.click(
      within(table).getByRole("button", { name: "최도윤 개인레슨 출석 확인 열기" }),
    );

    expect(
      await screen.findByRole("dialog", { name: "2026-08-22 개인레슨 출석 확인" }),
    ).toBeInTheDocument();
  });

  it("미등원 인원을 보강 처리하면 보강일 캘린더에 보강 일정이 표시된다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "미등원인원" }));

    const absentDialog = await screen.findByRole("dialog", {
      name: "2026년 8월 미등원 인원",
    });

    expect(within(absentDialog).getByText("박지호")).toBeInTheDocument();
    expect(absentDialog).toHaveTextContent("2026-08-21");
    expect(within(absentDialog).getByText("강도현")).toBeInTheDocument();
    expect(absentDialog).toHaveTextContent("2026-08-22");

    await user.click(within(absentDialog).getByRole("button", { name: "박지호 보강 입력" }));

    const makeupDialog = await screen.findByRole("dialog", {
      name: "보강 입력",
    });

    await user.clear(within(makeupDialog).getByLabelText("보강일"));
    await user.type(within(makeupDialog).getByLabelText("보강일"), "2026-08-24");
    await user.type(within(makeupDialog).getByLabelText("보강 사유"), "감기 결석");
    await user.click(within(makeupDialog).getByRole("button", { name: "보강 저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "보강 입력" })).not.toBeInTheDocument();
    });

    expect(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getAllByText("박지호"),
    ).toHaveLength(2);

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /24/ }),
    );

    expect(
      await screen.findByRole("dialog", { name: "2026-08-24 출석 확인" }),
    ).toHaveTextContent("보강");
  });

  it("학원 레슨표에서 비정기 일정을 직접 추가하고 출처를 구분한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    const toolbar = screen.getByRole("toolbar", { name: "학원레슨 도구" });
    await user.click(within(toolbar).getByRole("button", { name: "일정 추가" }));

    const dialog = await screen.findByRole("dialog", { name: "학원 일정 추가" });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.selectOptions(within(dialog).getByLabelText("악기"), "piano");
    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-1");
    await user.selectOptions(within(dialog).getByLabelText("일정 유형"), "manual");
    await user.clear(within(dialog).getByLabelText("시작 시간"));
    await user.type(within(dialog).getByLabelText("시작 시간"), "2026-08-24T19:00");
    await user.clear(within(dialog).getByLabelText("종료 시간"));
    await user.type(within(dialog).getByLabelText("종료 시간"), "2026-08-24T19:40");
    await user.type(within(dialog).getByLabelText("추가 사유"), "콩쿠르 전 보충");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "학원 일정 추가" })).not.toBeInTheDocument();
    });

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /24/ }),
    );

    const dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-24 출석 확인",
    });
    expect(dayDialog).toHaveTextContent("김민지");
    expect(dayDialog).toHaveTextContent("비정기");
  });

  it("날짜 모달은 출석관리와 메모 개수 탭을 분리해 보여준다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    expect(screen.queryByLabelText("학원레슨 특이사항 메모")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "메모지" })).not.toBeInTheDocument();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    const dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    expect(within(dayDialog).getByRole("tab", { name: "출석관리" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
    expect(
      within(dayDialog).queryByRole("button", { name: "김민지 원생 메모" }),
    ).not.toBeInTheDocument();
    expect(
      within(dayDialog).queryByRole("button", { name: "김하늘 선생님 메모" }),
    ).not.toBeInTheDocument();

    await user.click(within(dayDialog).getByRole("tab", { name: "메모 1" }));

    expect(dayDialog).toHaveTextContent(
      "[2026-08-21] 5시 피아노반 박지호 연락 대기",
    );
    expect(dayDialog).toHaveTextContent("김민지");
    expect(dayDialog).toHaveTextContent("김하늘");
  });

  it("메모 탭에서 일반/대상 메모를 등록하고 캘린더에 개수를 표시한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    let dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    await user.click(within(dayDialog).getByRole("tab", { name: "메모 1" }));

    expect(within(dayDialog).queryByLabelText("메모 대상 유형")).not.toBeInTheDocument();
    await user.selectOptions(within(dayDialog).getByLabelText("관련 원생"), "student-2");
    await user.selectOptions(within(dayDialog).getByLabelText("관련 선생님"), "teacher-1");
    await user.type(
      within(dayDialog).getByLabelText("메모 내용"),
      "이서윤 보강 가능 시간 확인",
    );
    await user.click(within(dayDialog).getByRole("button", { name: "메모 등록" }));

    expect(within(dayDialog).getByRole("tab", { name: "메모 2" })).toBeInTheDocument();
    expect(dayDialog).toHaveTextContent("이서윤 보강 가능 시간 확인");
    expect(dayDialog).toHaveTextContent("이서윤");
    expect(dayDialog).toHaveTextContent("김하늘");

    await user.click(within(dayDialog).getByRole("button", { name: "닫기" }));
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "2026-08-21 출석 확인" }),
      ).not.toBeInTheDocument();
    });
    const academyCalendarAfterSave = await screen.findByRole("grid", {
      name: "2026년 8월 학원레슨 캘린더",
    });
    const savedMemoCell = within(academyCalendarAfterSave).getByRole("gridcell", {
      name: /21/,
    });

    expect(savedMemoCell).toHaveTextContent("메모 2");

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    expect(within(dayDialog).getByRole("tab", { name: "메모 2" })).toBeInTheDocument();
  });

  it("메모 탭에서 날짜 메모를 수정하고 삭제한다", async () => {
    const user = userEvent.setup();

    renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    const dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    await user.click(within(dayDialog).getByRole("tab", { name: "메모 1" }));

    await user.click(
      within(dayDialog).getByRole("button", {
        name: "[2026-08-21] 5시 피아노반 박지호 연락 대기 메모 수정",
      }),
    );
    await user.clear(within(dayDialog).getByLabelText("메모 내용"));
    await user.type(within(dayDialog).getByLabelText("메모 내용"), "수정된 날짜 메모");
    await user.click(
      within(dayDialog).getByRole("button", { name: "메모 수정 저장" }),
    );

    expect(dayDialog).toHaveTextContent("수정된 날짜 메모");

    await user.click(
      within(dayDialog).getByRole("button", {
        name: "수정된 날짜 메모 메모 삭제",
      }),
    );

    // 확인 없이 지우지 않는다. 취소하면 메모가 그대로 남는다.
    const cancelConfirm = await screen.findByRole("alertdialog", {
      name: "이 메모를 삭제할까요?",
    });
    expect(cancelConfirm).toHaveTextContent("수정된 날짜 메모");
    await user.click(within(cancelConfirm).getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
    expect(dayDialog).toHaveTextContent("수정된 날짜 메모");

    await user.click(
      within(dayDialog).getByRole("button", {
        name: "수정된 날짜 메모 메모 삭제",
      }),
    );
    const confirmDelete = await screen.findByRole("alertdialog", {
      name: "이 메모를 삭제할까요?",
    });
    await user.click(within(confirmDelete).getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(within(dayDialog).getByRole("tab", { name: "메모 0" })).toBeInTheDocument();
    expect(dayDialog).toHaveTextContent("선택한 날짜에 작성된 메모가 없습니다.");
  });

  it("학원 레슨표와 개인레슨표는 같은 날짜에도 메모 개수를 따로 센다", async () => {
    const user = userEvent.setup();

    const academyView = renderWorkspace();

    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 학원레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    let dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });
    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
    await user.click(within(dayDialog).getByRole("button", { name: "닫기" }));

    academyView.unmount();
    renderWorkspace({ lessonKind: "private" });
    await user.click(
      within(
        screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
      ).getByRole("gridcell", { name: /21/ }),
    );
    dayDialog = await screen.findByRole("dialog", {
      name: "2026-08-21 개인레슨 출석 확인",
    });

    expect(within(dayDialog).getByRole("tab", { name: "메모 1" })).toBeInTheDocument();
    await user.click(within(dayDialog).getByRole("tab", { name: "메모 1" }));
    expect(dayDialog).toHaveTextContent(
      "[2026-08-21] 오유진 선생님 18시 바이올린 개인레슨",
    );
  });

  describe("레슨시간표 복사", () => {
    async function openScheduleDialog(user: ReturnType<typeof userEvent.setup>) {
      renderWorkspace({ lessonKind: "private" });
      await user.click(screen.getByRole("button", { name: "레슨시간표 보내기" }));
      const dialog = await screen.findByRole("dialog", { name: "레슨시간표 보내기" });
      await user.selectOptions(within(dialog).getByLabelText("선생님 선택"), "teacher-3");
      return dialog;
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("복사에 성공하면 시간표 내용을 클립보드에 넣고 복사했다고 알려 준다", async () => {
      const user = userEvent.setup();
      const success = vi.spyOn(toast, "success");
      const dialog = await openScheduleDialog(user);

      await user.click(within(dialog).getByRole("button", { name: "복사" }));

      await waitFor(() => expect(success).toHaveBeenCalledWith("시간표를 복사했습니다. 메시지에 붙여넣어 보내세요."));
      expect(await navigator.clipboard.readText()).toBe("8/22 최도윤 10:30 첼로");
    });

    it("복사에 실패하면 성공이라고 하지 않고 직접 복사하도록 안내한다", async () => {
      const user = userEvent.setup();
      const success = vi.spyOn(toast, "success");
      const error = vi.spyOn(toast, "error");
      const dialog = await openScheduleDialog(user);
      vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

      await user.click(within(dialog).getByRole("button", { name: "복사" }));

      await waitFor(() =>
        expect(error).toHaveBeenCalledWith("시간표를 복사하지 못했습니다.", {
          description: "시간표 내용을 직접 선택해 복사해 주세요.",
        }),
      );
      expect(success).not.toHaveBeenCalled();
    });
  });

  it("개인레슨표에서 선생님별 월간 시간표를 만들고 새 개인레슨을 추가한다", async () => {
    const user = userEvent.setup();

    renderWorkspace({ lessonKind: "private" });

    const privateToolbar = screen.getByRole("toolbar", {
      name: "개인레슨 도구",
    });

    expect(
      within(privateToolbar).getByRole("button", { name: "개인레슨 등록" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).toHaveTextContent("최도윤");

    await user.click(screen.getByRole("button", { name: "레슨시간표 보내기" }));

    const scheduleDialog = await screen.findByRole("dialog", {
      name: "레슨시간표 보내기",
    });

    await user.selectOptions(
      within(scheduleDialog).getByLabelText("선생님 선택"),
      "teacher-3",
    );

    expect(within(scheduleDialog).getByLabelText("시간표 내용")).toHaveValue(
      "8/22 최도윤 10:30 첼로",
    );

    await user.click(within(scheduleDialog).getByRole("button", { name: "닫기" }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const registrationDialog = await screen.findByRole("dialog", {
      name: "개인레슨 등록",
    });

    await user.selectOptions(within(registrationDialog).getByLabelText("원생"), "student-4");
    await user.selectOptions(within(registrationDialog).getByLabelText("악기"), "violin");
    await user.selectOptions(within(registrationDialog).getByLabelText("선생님"), "teacher-2");
    await user.type(
      within(registrationDialog).getByLabelText("시작 시간"),
      "2026-08-23T17:00",
    );
    await user.type(
      within(registrationDialog).getByLabelText("종료 시간"),
      "2026-08-23T17:40",
    );
    await user.click(within(registrationDialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "개인레슨 등록" })).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("grid", { name: "2026년 8월 개인레슨 캘린더" }),
    ).toHaveTextContent("한서아");
  });

  it("개인레슨표에서 레슨원생 검색 다이얼로그로 잔여 회차와 최근 레슨을 확인한다", async () => {
    const user = userEvent.setup();

    renderWorkspace({ lessonKind: "private" });

    await user.click(screen.getByRole("button", { name: "레슨원생 검색" }));

    const searchDialog = await screen.findByRole("dialog", {
      name: "레슨원생 검색",
    });

    expect(within(searchDialog).getByText("한서아")).toBeInTheDocument();
    expect(within(searchDialog).getByText("바이올린 2회")).toBeInTheDocument();
    expect(within(searchDialog).getByText("최근 레슨: 2026-08-21 바이올린 예정")).toBeInTheDocument();

    await user.type(within(searchDialog).getByRole("searchbox", { name: "레슨원생 검색어" }), "최도윤");

    expect(within(searchDialog).queryByText("한서아")).not.toBeInTheDocument();
    expect(within(searchDialog).getByText("최도윤")).toBeInTheDocument();
    expect(within(searchDialog).getByText("첼로 1회")).toBeInTheDocument();
  });
  describe("월별 개인레슨 표 페이지 이동", () => {
    async function openPrivateLessonTable() {
      const user = userEvent.setup();

      renderWorkspace({
        lessonKind: "private",
        demoData: buildPagedPrivateLessonData(),
      });
      await user.click(screen.getByRole("tab", { name: "개인레슨 테이블뷰" }));

      return {
        user,
        getTable: () =>
          screen.getByRole("table", { name: "2026년 8월 개인레슨 테이블" }),
      };
    }

    it("총 건수와 10건씩 보여 주고 다음 페이지에서 나머지를 시간순으로 보여 준다", async () => {
      const { user, getTable } = await openPrivateLessonTable();

      expect(screen.getByText("총 12건")).toBeInTheDocument();
      // 헤더 행 1개 + 데이터 행 10개
      expect(within(getTable()).getAllByRole("row")).toHaveLength(11);
      expect(within(getTable()).getAllByRole("row")[1]).toHaveTextContent("타라");
      expect(within(getTable()).queryByText("나은")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "이전 페이지" })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "다음 페이지" }));

      const rows = within(getTable()).getAllByRole("row");
      expect(rows).toHaveLength(3);
      expect(rows[1]).toHaveTextContent("나은");
      expect(rows[2]).toHaveTextContent("가온");
      expect(screen.getByRole("button", { name: "2페이지" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("페이지당 개수를 20으로 바꾸면 한 페이지에 모두 보여 주고 1페이지로 돌아간다", async () => {
      const { user, getTable } = await openPrivateLessonTable();

      await user.click(screen.getByRole("button", { name: "다음 페이지" }));
      await user.selectOptions(
        screen.getByRole("combobox", { name: "페이지당 개인레슨 수" }),
        "20",
      );

      expect(within(getTable()).getAllByRole("row")).toHaveLength(13);
      expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
    });

    it("달을 옮기면 그 달의 건수만 세고 돌아오면 1페이지부터 보여 준다", async () => {
      const { user, getTable } = await openPrivateLessonTable();

      await user.click(screen.getByRole("button", { name: "다음 페이지" }));
      await user.click(
        screen.getByRole("button", { name: "개인레슨 테이블 다음 달" }),
      );

      expect(screen.getByText("총 3건")).toBeInTheDocument();
      expect(
        screen.getByRole("table", { name: "2026년 9월 개인레슨 테이블" }),
      ).toHaveTextContent("구름");

      await user.click(
        screen.getByRole("button", { name: "개인레슨 테이블 이전 달" }),
      );

      expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(within(getTable()).getAllByRole("row")[1]).toHaveTextContent("타라");
    });

    it("등록된 개인레슨이 없는 달도 총 0건과 페이지 컨트롤을 보여 준다", async () => {
      const user = userEvent.setup();

      renderWorkspace({ lessonKind: "private" });
      await user.click(screen.getByRole("tab", { name: "개인레슨 테이블뷰" }));
      await user.click(
        screen.getByRole("button", { name: "개인레슨 테이블 다음 달" }),
      );

      expect(
        screen.getByText("해당 월에 등록된 개인레슨이 없습니다."),
      ).toBeInTheDocument();
      expect(screen.getByText("총 0건")).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", { name: "페이지당 개인레슨 수" }),
      ).toBeInTheDocument();
    });

    it("같은 시각의 레슨은 원생 이름 가나다 순으로 보여 준다", async () => {
      const user = userEvent.setup();
      const sameTime = "2026-08-10T10:00:00+09:00";

      renderWorkspace({
        lessonKind: "private",
        demoData: {
          ...demoLessonWorkspaceData,
          privateLessons: [
            buildPrivateLesson("b", "나은", sameTime),
            buildPrivateLesson("a", "가온", sameTime),
          ],
        },
      });
      await user.click(screen.getByRole("tab", { name: "개인레슨 테이블뷰" }));

      const rows = within(
        screen.getByRole("table", { name: "2026년 8월 개인레슨 테이블" }),
      ).getAllByRole("row");
      expect(rows[1]).toHaveTextContent("가온");
      expect(rows[2]).toHaveTextContent("나은");
    });
  });
});

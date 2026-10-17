import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentEnrollmentSaveResult } from "@/domain/student-enrollment-edit";
import { buildStudentList, type StudentListRow } from "@/domain/student-list";

import { StudentListScreen } from "./student-list-screen";

const { toastMock } = vi.hoisted(() => ({
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    throw new Error("테스트에서는 Supabase client를 쓰지 않는다.");
  },
}));

const teachers = [
  { teacherId: "teacher-1", name: "박선생", part: "피아노" },
  { teacherId: "teacher-2", name: "최선생", part: "바이올린" },
  { teacherId: "teacher-5", name: "강선생", part: "첼로" },
].map((teacher) => ({
  academyId: "academy-1",
  contact: "010-0000-0000",
  registeredAt: "2026-08-01",
  payType: "monthly" as const,
  ...teacher,
}));

const pianoInstrument = {
  studentInstrumentId: "si-piano",
  teacherId: "teacher-1",
  teacherName: "박선생",
  instrumentId: "piano",
  instrumentName: "피아노",
  lessonType: "academy",
  weekdayLabels: ["월", "수"],
  startTime: "15:00",
  endTime: "15:50",
  progress: "체르니 100",
  lessonFee: 150000,
  discountTotal: 0,
  finalMonthlyFee: 150000,
  active: true,
  weeklySchedules: [
    { weekday: "monday", weekdayLabel: "월", startTime: "15:00", endTime: "15:50" },
    { weekday: "wednesday", weekdayLabel: "수", startTime: "15:00", endTime: "15:50" },
  ],
};

const violinInstrument = {
  ...pianoInstrument,
  studentInstrumentId: "si-violin",
  teacherId: "teacher-2",
  teacherName: "최선생",
  instrumentId: "violin",
  instrumentName: "바이올린",
  lessonType: "private",
  weekdayLabels: ["화"],
  startTime: "17:00",
  endTime: "17:40",
  progress: "자유곡",
  lessonFee: 200000,
  finalMonthlyFee: 200000,
  weeklySchedules: [
    { weekday: "tuesday", weekdayLabel: "화", startTime: "17:00", endTime: "17:40" },
  ],
};

const multiInstrumentStudent: StudentListRow = {
  academyId: "academy-1",
  studentId: "student-9",
  name: "한소희",
  registeredOn: "2026-08-01",
  status: "enrolled",
  teacherNames: ["박선생", "최선생"],
  instrumentNames: ["피아노", "바이올린"],
  weekdayLabels: ["월", "화", "수"],
  instruments: [pianoInstrument, violinInstrument],
};

const singleInstrumentStudent: StudentListRow = {
  ...multiInstrumentStudent,
  studentId: "student-1",
  name: "김민지",
  teacherNames: ["박선생"],
  instrumentNames: ["피아노"],
  weekdayLabels: ["월", "수"],
  instruments: [pianoInstrument],
};

const privatePianoInstrument = {
  ...pianoInstrument,
  studentInstrumentId: "si-piano-private",
  lessonType: "private",
};

// 이전 데이터: 피아노가 아닌 악기가 학원레슨으로 저장되어 있다.
const legacyViolinInstrument = { ...violinInstrument, lessonType: "academy" };

const legacyStudent: StudentListRow = {
  ...multiInstrumentStudent,
  studentId: "student-7",
  name: "정이전",
  instruments: [pianoInstrument, privatePianoInstrument, legacyViolinInstrument],
};

type UpdateStudentMock = ReturnType<typeof vi.fn>;

async function openEditForm(studentName: string, updateStudent: UpdateStudentMock = vi.fn()) {
  const user = userEvent.setup();
  const rows = [multiInstrumentStudent, singleInstrumentStudent, legacyStudent];

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentListScreen
        academyId="academy-1"
        academyName="더 클래식"
        teachers={teachers}
        updateStudent={updateStudent}
        queryOptionsFactory={(queryOptions) => ({
          queryKey: ["students", queryOptions.academyId, "enrollment"],
          queryFn: async () => buildStudentList(rows, queryOptions),
        })}
      />
    </QueryClientProvider>,
  );

  await user.click(await screen.findByRole("button", { name: `${studentName} 자세히보기` }));
  const dialog = await screen.findByRole("dialog", { name: `${studentName} 원생 상세` });
  await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

  return { user, updateStudent, dialog };
}

async function confirmEnd(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, label: string) {
  await user.click(within(dialog).getByRole("button", { name: `${label} 수강 종료` }));

  return screen.findByRole("alertdialog");
}

async function addInstrument(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  instrumentName: string,
) {
  await user.selectOptions(within(dialog).getByLabelText("추가할 악기"), instrumentName);
  await user.click(within(dialog).getByRole("button", { name: "악기 추가" }));
}

function optionLabels(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

beforeEach(() => {
  Object.values(toastMock).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("원생 수정 폼 수강 종료", () => {
  it("기존 악기 칸은 읽기 전용이고 다른 악기로 바꾸는 방법을 안내한다", async () => {
    const { dialog } = await openEditForm("한소희");

    expect(within(dialog).getByLabelText("피아노 악기")).toHaveAttribute("readonly");
    expect(
      within(dialog).getAllByText("다른 악기로 바꾸려면 이 악기를 종료하고 새 악기를 추가해 주세요."),
    ).toHaveLength(2);
  });

  it("수강 종료는 확인 창에서 정기 일정 취소와 남는 일정, 수강료 기록을 안내하고 취소하면 그대로 둔다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    const confirmation = await confirmEnd(user, dialog, "바이올린");

    expect(within(confirmation).getByText(/정기 일정이 취소/)).toBeVisible();
    expect(within(confirmation).getByText(/이동·보강·개인레슨 예정 일정은 남/)).toBeVisible();
    expect(within(confirmation).getByText(/이미 만들어진 월 수강료 기록은 바뀌지 않/)).toBeVisible();
    expect(within(confirmation).getByText(/레슨표·수입 관리에서 확인/)).toBeVisible();

    await user.click(within(confirmation).getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("바이올린 레슨비")).toBeVisible();
    expect(within(dialog).queryByText("종료 예정")).not.toBeInTheDocument();
  });

  it("확인하면 그 섹션을 종료 예정으로 흐리게 보이고 저장 때 다른 변경과 함께 한 번에 end로 보낸다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await user.click(within(dialog).getByLabelText("피아노 금요일"));
    await user.type(within(dialog).getByLabelText("피아노 금 시작 시간"), "16:00");
    await user.type(within(dialog).getByLabelText("피아노 금 종료 시간"), "16:50");
    const confirmation = await confirmEnd(user, dialog, "바이올린");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));

    expect(updateStudent).not.toHaveBeenCalled();
    expect(within(dialog).getByText("바이올린 수강 종료 예정")).toBeVisible();
    expect(within(dialog).queryByLabelText("바이올린 레슨비")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent.mock.calls[0][0].changes).toEqual([
      expect.objectContaining({ action: "update", studentInstrumentId: "si-piano" }),
      { action: "end", studentInstrumentId: "si-violin" },
    ]);
  });

  it("되돌리면 입력했던 내용 그대로 섹션이 돌아오고 저장해도 종료하지 않는다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await user.clear(within(dialog).getByLabelText("바이올린 레슨비"));
    await user.type(within(dialog).getByLabelText("바이올린 레슨비"), "210000");
    const confirmation = await confirmEnd(user, dialog, "바이올린");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));
    await user.click(within(dialog).getByRole("button", { name: "바이올린 되돌리기" }));

    expect(within(dialog).queryByText("바이올린 수강 종료 예정")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("바이올린 레슨비")).toHaveValue(210000);

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent.mock.calls[0][0].changes).toEqual([
      expect.objectContaining({ action: "update", studentInstrumentId: "si-violin", lessonFee: 210000 }),
    ]);
  });

  it("남는 활성 악기가 하나뿐이면 수강 종료를 막고 휴원·퇴원 처리를 안내한다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    const confirmation = await confirmEnd(user, dialog, "바이올린");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));

    expect(within(dialog).getByRole("button", { name: "피아노 수강 종료" })).toBeDisabled();
    expect(
      within(dialog).getByText(
        "수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.",
      ),
    ).toBeVisible();
  });

  it("악기가 하나뿐인 원생은 수강 종료를 누를 수 없다", async () => {
    const { dialog } = await openEditForm("김민지");

    expect(within(dialog).getByRole("button", { name: "수강 종료" })).toBeDisabled();
    expect(within(dialog).getByText(/휴원·퇴원 처리를 해 주세요/)).toBeVisible();
  });

  it("종료 예정인 악기는 수정완료를 막는 입력 검사에서 빠진다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    await user.click(within(dialog).getByLabelText("피아노 목요일"));
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();

    const confirmation = await confirmEnd(user, dialog, "피아노");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));

    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();
  });
});

describe("원생 수정 폼 악기 추가", () => {
  it("이미 수강 중인 악기·수업 형태는 선택지에서 빼고 피아노는 남은 수업 형태만 고르게 한다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    expect(optionLabels(within(dialog).getByLabelText("추가할 악기"))).toEqual([
      "악기를 선택해 주세요",
      "피아노",
      "첼로",
      "플루트",
    ]);

    await addInstrument(user, dialog, "피아노");

    expect(within(dialog).getByLabelText("새 피아노 레슨 형태")).toHaveValue("private");
    expect(within(dialog).getByLabelText("새 피아노 레슨 형태")).toBeDisabled();
  });

  it("수강 시작일은 오늘이 기본이고 저장하면 add 변경에 요일별 시간과 레슨비가 담긴다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T03:00:00Z"));
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await addInstrument(user, dialog, "첼로");

    expect(within(dialog).getByLabelText("새 첼로 수강 시작일")).toHaveValue("2026-10-17");
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();
    expect(within(dialog).getByText(/저장하려면 새 첼로 수업 정보를 확인해 주세요/)).toBeVisible();

    await user.click(within(dialog).getByLabelText("새 첼로 금요일"));
    await user.type(within(dialog).getByLabelText("새 첼로 금 시작 시간"), "16:00");
    await user.type(within(dialog).getByLabelText("새 첼로 금 종료 시간"), "16:40");

    expect(within(dialog).getByLabelText("새 첼로 레슨비")).not.toHaveValue(0);
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent.mock.calls[0][0]).toMatchObject({
      studentId: "student-9",
      changes: [
        {
          action: "add",
          startedOn: "2026-10-17",
          instrumentId: "cello",
          instrumentName: "첼로",
          teacherId: "teacher-5",
          teacherName: "강선생",
          lessonType: "private",
          weeklySchedules: [{ weekdayLabel: "금", startTime: "16:00", endTime: "16:40" }],
        },
      ],
    });
    expect(updateStudent.mock.calls[0][0].changes).toHaveLength(1);
  });

  it("저장 전에는 추가한 섹션을 지울 수 있고 지우면 수정완료 검사에서도 빠진다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("김민지", vi.fn());

    await addInstrument(user, dialog, "바이올린");
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "새 바이올린 추가 취소" }));

    expect(within(dialog).queryByLabelText("새 바이올린 담당 선생님")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    expect(updateStudent).not.toHaveBeenCalled();
  });

  it("악기를 하나 추가해도 기존 악기 입력은 그대로 남고 새 악기와 구분되는 이름으로 바뀐다", async () => {
    const { user, dialog } = await openEditForm("김민지");

    await user.click(within(dialog).getByLabelText("목요일"));
    await user.type(within(dialog).getByLabelText("목 시작 시간"), "16:00");
    await addInstrument(user, dialog, "바이올린");

    expect(within(dialog).getByLabelText("피아노 목 시작 시간")).toHaveValue("16:00");
    expect(within(dialog).getByLabelText("새 바이올린 담당 선생님")).toHaveValue("teacher-2");
  });

  it("기존 악기를 종료하고 새 악기를 추가하면 add가 end보다 먼저 한 번에 저장된다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("김민지");

    await addInstrument(user, dialog, "첼로");
    await user.click(within(dialog).getByLabelText("새 첼로 월요일"));
    await user.type(within(dialog).getByLabelText("새 첼로 월 시작 시간"), "16:00");
    await user.type(within(dialog).getByLabelText("새 첼로 월 종료 시간"), "16:40");
    const confirmation = await confirmEnd(user, dialog, "피아노");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(
      updateStudent.mock.calls[0][0].changes.map((change: { action: string }) => change.action),
    ).toEqual(["add", "end"]);
  });
});

describe("원생 수정 폼 수업 형태 정책", () => {
  it("피아노가 아닌 악기는 개인레슨만 고르게 하고 피아노는 학원레슨과 개인레슨을 모두 고르게 한다", async () => {
    const { dialog } = await openEditForm("한소희");

    expect(optionLabels(within(dialog).getByLabelText("바이올린 수업 형태"))).toEqual(["개인레슨"]);
    expect(optionLabels(within(dialog).getByLabelText("피아노 수업 형태"))).toEqual([
      "학원레슨",
      "개인레슨",
    ]);
  });

  it("이전 데이터로 학원레슨이 저장된 피아노 외 악기는 현재 값을 계속 고를 수 있다", async () => {
    const { dialog } = await openEditForm("정이전");
    const select = within(dialog).getByLabelText("바이올린 수업 형태");

    expect(select).toHaveValue("academy");
    expect(optionLabels(select)).toEqual(["학원레슨", "개인레슨"]);
    expect(within(select).getByRole("option", { name: "학원레슨" })).toBeEnabled();
  });

  it("같은 피아노를 학원레슨과 개인레슨으로 수강 중이면 서로의 형태를 막고 이유를 알려 준다", async () => {
    const { dialog } = await openEditForm("정이전");
    const academy = within(dialog).getByLabelText("피아노(학원레슨) 수업 형태");
    const personal = within(dialog).getByLabelText("피아노(개인레슨) 수업 형태");

    expect(within(academy).getByRole("option", { name: "개인레슨" })).toBeDisabled();
    expect(within(academy).getByRole("option", { name: "학원레슨" })).toBeEnabled();
    expect(academy).toHaveAccessibleDescription(
      "이미 같은 악기를 개인레슨으로 수강 중이라 선택할 수 없습니다.",
    );
    expect(within(personal).getByRole("option", { name: "학원레슨" })).toBeDisabled();
    expect(personal).toHaveAccessibleDescription(
      "이미 같은 악기를 학원레슨으로 수강 중이라 선택할 수 없습니다.",
    );
  });

  it("막힌 형태가 없으면 안내 문구를 보여 주지 않는다", async () => {
    const { dialog } = await openEditForm("한소희");

    expect(within(dialog).getByLabelText("피아노 수업 형태")).not.toHaveAccessibleDescription();
    expect(within(dialog).queryByText(/수강 중이라 선택할 수 없습니다/)).not.toBeInTheDocument();
  });

  it("기존 수강이 형태를 바꾸면 같은 조합이 추가 선택지에서 빠지고, 추가한 섹션이 쓰는 조합은 기존 섹션이 못 고른다", async () => {
    const { user, dialog } = await openEditForm("김민지");

    await user.selectOptions(within(dialog).getByLabelText("수업 형태"), "private");
    await user.selectOptions(within(dialog).getByLabelText("추가할 악기"), "피아노");
    await user.click(within(dialog).getByRole("button", { name: "악기 추가" }));

    expect(within(dialog).getByLabelText("새 피아노 레슨 형태")).toHaveValue("academy");
    expect(
      within(within(dialog).getByLabelText("피아노 수업 형태")).getByRole("option", {
        name: "학원레슨",
      }),
    ).toBeDisabled();
  });

  it("종료 예정으로 표시한 수강의 조합은 저장 전까지 다른 섹션이 고를 수 없다", async () => {
    const { user, dialog } = await openEditForm("정이전");

    await user.click(within(dialog).getByRole("button", { name: "피아노(개인레슨) 수강 종료" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "종료 예정으로 표시" }),
    );

    expect(
      within(within(dialog).getByLabelText("피아노(학원레슨) 수업 형태")).getByRole("option", {
        name: "개인레슨",
      }),
    ).toBeDisabled();
  });

  it("충돌이 없으면 형태를 바꾸지 않은 수정의 저장 변경은 그대로다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("정이전");

    await user.clear(within(dialog).getByLabelText("바이올린 레슨비"));
    await user.type(within(dialog).getByLabelText("바이올린 레슨비"), "210000");
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent.mock.calls[0][0].changes).toEqual([
      expect.objectContaining({
        action: "update",
        studentInstrumentId: "si-violin",
        lessonType: "academy",
        lessonFee: 210000,
      }),
    ]);
  });
});

describe("원생 수정 저장 결과", () => {
  it("종료한 악기는 상세와 목록에서 사라지고 남은 예정 일정이 있으면 안내한다", async () => {
    const result: StudentEnrollmentSaveResult = {
      addedStudentInstrumentIds: [],
      ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 2 }],
    };
    const updateStudent = vi.fn().mockResolvedValue(result);
    const { user, dialog } = await openEditForm("한소희", updateStudent);

    const confirmation = await confirmEnd(user, dialog, "바이올린");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalled());
    expect(toastMock.success).toHaveBeenCalledWith(
      "원생 정보를 수정했습니다.",
      expect.objectContaining({ description: expect.stringContaining("정기 외 예정 일정 2건") }),
    );

    const row = (await screen.findAllByRole("row")).find((candidate) =>
      within(candidate).queryByRole("cell", { name: "한소희" }),
    ) as HTMLElement;
    expect(within(row).getByRole("cell", { name: "피아노" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "박선생" })).toBeInTheDocument();

    await userEvent.click(within(row).getByRole("button", { name: "한소희 자세히보기" }));
    const detail = await screen.findByRole("dialog", { name: "한소희 원생 상세" });
    expect(within(detail).queryByText("바이올린")).not.toBeInTheDocument();
  });

  it("남은 예정 일정이 없으면 기본 성공 안내만 보여 준다", async () => {
    const updateStudent = vi.fn().mockResolvedValue({
      addedStudentInstrumentIds: [],
      ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 0 }],
    });
    const { user, dialog } = await openEditForm("한소희", updateStudent);

    const confirmation = await confirmEnd(user, dialog, "바이올린");
    await user.click(within(confirmation).getByRole("button", { name: "종료 예정으로 표시" }));
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    expect(toastMock.success).toHaveBeenCalledWith("원생 정보를 수정했습니다.", {
      description: undefined,
    });
  });

  it("추가한 악기는 서버가 알려 준 수강 id로 목록에 나타난다", async () => {
    const updateStudent = vi.fn().mockResolvedValue({
      addedStudentInstrumentIds: ["si-cello"],
      ended: [],
    });
    const { user, dialog } = await openEditForm("한소희", updateStudent);

    await addInstrument(user, dialog, "첼로");
    await user.click(within(dialog).getByLabelText("새 첼로 월요일"));
    await user.type(within(dialog).getByLabelText("새 첼로 월 시작 시간"), "16:00");
    await user.type(within(dialog).getByLabelText("새 첼로 월 종료 시간"), "16:40");
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    const row = (await screen.findAllByRole("row")).find((candidate) =>
      within(candidate).queryByRole("cell", { name: "한소희" }),
    ) as HTMLElement;
    expect(await within(row).findByRole("cell", { name: "피아노, 바이올린, 첼로" })).toBeInTheDocument();
  });
});

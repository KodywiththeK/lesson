import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
  { teacherId: "teacher-4", name: "윤선생", part: "바이올린" },
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
  discountTotal: 0,
  finalMonthlyFee: 200000,
  active: true,
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

async function openEditForm(
  studentName: string,
  options: { updateStudent?: ReturnType<typeof vi.fn> } = {},
) {
  const user = userEvent.setup();
  const updateStudent = options.updateStudent ?? vi.fn();
  const rows = [multiInstrumentStudent, singleInstrumentStudent];

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StudentListScreen
        academyId="academy-1"
        academyName="더 클래식"
        teachers={teachers}
        updateStudent={updateStudent}
        queryOptionsFactory={(queryOptions) => ({
          queryKey: ["students", queryOptions.academyId, "multi"],
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

function optionLabels(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

async function editViolin(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.selectOptions(within(dialog).getByLabelText("바이올린 담당 선생님"), "teacher-4");
  await user.click(within(dialog).getByLabelText("바이올린 목요일"));
  await user.type(within(dialog).getByLabelText("바이올린 목 시작 시간"), "18:00");
  await user.type(within(dialog).getByLabelText("바이올린 목 종료 시간"), "18:40");
  await user.clear(within(dialog).getByLabelText("바이올린 레슨비"));
  await user.type(within(dialog).getByLabelText("바이올린 레슨비"), "210000");
}

async function editPiano(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
  await user.click(within(dialog).getByLabelText("피아노 금요일"));
  await user.type(within(dialog).getByLabelText("피아노 금 시작 시간"), "16:00");
  await user.type(within(dialog).getByLabelText("피아노 금 종료 시간"), "16:50");
}

describe("원생 수정 폼 복수 악기", () => {
  it("활성 악기마다 담당 선생님·수업 형태·요일·진도·레슨비 섹션을 보여 준다", async () => {
    const { dialog } = await openEditForm("한소희");

    expect(within(dialog).getByLabelText("피아노 담당 선생님")).toHaveValue("teacher-1");
    expect(within(dialog).getByLabelText("바이올린 담당 선생님")).toHaveValue("teacher-2");
    expect(optionLabels(within(dialog).getByLabelText("바이올린 담당 선생님"))).toEqual([
      "미배정",
      "윤선생",
      "최선생",
    ]);
    expect(within(dialog).getByLabelText("피아노 수업 형태")).toHaveValue("academy");
    expect(within(dialog).getByLabelText("바이올린 수업 형태")).toHaveValue("private");
    expect(within(dialog).getByLabelText("피아노 월 시작 시간")).toHaveValue("15:00");
    expect(within(dialog).getByLabelText("바이올린 화 시작 시간")).toHaveValue("17:00");
    expect(within(dialog).getByLabelText("피아노 레슨비")).toHaveValue("150000");
    expect(within(dialog).getByLabelText("바이올린 레슨비")).toHaveValue("200000");
    expect(within(dialog).getByLabelText("피아노 악기")).toHaveAttribute("readonly");
    expect(within(dialog).getByLabelText("바이올린 악기")).toHaveAttribute("readonly");
    // 기본 정보는 악기와 상관없이 한 번만 보여 준다.
    expect(within(dialog).getAllByLabelText("원생명")).toHaveLength(1);
    expect(within(dialog).getAllByLabelText("등록일")).toHaveLength(1);
  });

  it("바이올린만 고치면 바이올린 변경 하나만 한 번에 보내고 바뀌지 않은 기본 정보와 피아노는 보내지 않는다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await editViolin(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent).toHaveBeenCalledWith({
      academyId: "academy-1",
      studentId: "student-9",
      name: "한소희",
      changes: [
        expect.objectContaining({
          action: "update",
          studentInstrumentId: "si-violin",
          teacherId: "teacher-4",
          teacherName: "윤선생",
          instrumentId: "violin",
          instrumentName: "바이올린",
          lessonType: "private",
          lessonFee: 210000,
          finalMonthlyFee: 210000,
          weeklySchedules: [
            { weekdayLabel: "화", startTime: "17:00", endTime: "17:40" },
            { weekdayLabel: "목", startTime: "18:00", endTime: "18:40" },
          ],
        }),
      ],
    });
  });

  it("두 악기를 모두 고치면 한 번의 저장에 악기 순서대로 담는다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await editViolin(user, dialog);
    await editPiano(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    const [input] = updateStudent.mock.calls[0];

    expect(input.changes).toHaveLength(2);
    expect(input.changes[0]).toMatchObject({
      action: "update",
      studentInstrumentId: "si-piano",
      weeklySchedules: [
        { weekdayLabel: "월", startTime: "15:00", endTime: "15:50" },
        { weekdayLabel: "수", startTime: "15:00", endTime: "15:50" },
        { weekdayLabel: "금", startTime: "16:00", endTime: "16:50" },
      ],
    });
    expect(input.changes[1]).toMatchObject({
      action: "update",
      studentInstrumentId: "si-violin",
      teacherId: "teacher-4",
    });
    expect(input.basicInfo).toBeUndefined();
  });

  it("고쳤다가 원래대로 되돌린 악기는 저장하지 않고 바뀐 기본 정보만 보낸다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await user.click(within(dialog).getByLabelText("피아노 금요일"));
    await user.click(within(dialog).getByLabelText("피아노 금요일"));
    await user.clear(within(dialog).getByLabelText("학교"));
    await user.type(within(dialog).getByLabelText("학교"), "한빛중");
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    const [input] = updateStudent.mock.calls[0];

    expect(input.changes).toEqual([]);
    expect(input).toMatchObject({
      name: "한소희",
      basicInfo: expect.objectContaining({ registeredOn: "2026-08-01", school: "한빛중" }),
    });
  });

  it("아무것도 바꾸지 않고 수정완료를 누르면 저장하지 않고 수정 폼만 닫는다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("한소희");

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    expect(updateStudent).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "수정하기" })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "수정완료" })).not.toBeInTheDocument();
  });

  it("저장 후 목록에는 두 악기의 선생님이 모두 남는다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    await editViolin(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    const row = (await screen.findAllByRole("row")).find((candidate) =>
      within(candidate).queryByRole("cell", { name: "한소희" }),
    );
    expect(row).toBeDefined();
    expect(within(row as HTMLElement).getByRole("cell", { name: "박선생, 윤선생" })).toBeInTheDocument();
    expect(within(row as HTMLElement).getByRole("cell", { name: "피아노, 바이올린" })).toBeInTheDocument();
  });

  it("저장이 실패하면 아무것도 저장되지 않았다고 알리고 입력값을 유지한 채 폼을 열어 두며 다시 저장하면 같은 내용을 한 번 더 보낸다", async () => {
    toastMock.error.mockReset();
    const updateStudent = vi
      .fn()
      .mockRejectedValueOnce(new Error("원생 정보를 수정하지 못했습니다: 네트워크 연결이 불안정합니다."))
      .mockResolvedValue(undefined);
    const { user, dialog } = await openEditForm("한소희", { updateStudent });

    await editViolin(user, dialog);
    await editPiano(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("저장되지 않았습니다.");
    expect(alert).toHaveTextContent("네트워크 연결이 불안정합니다.");
    expect(alert).not.toHaveTextContent("일부만");
    expect(toastMock.error).toHaveBeenCalledWith(
      "원생 정보 수정에 실패했습니다.",
      expect.objectContaining({ description: expect.stringContaining("저장되지 않았습니다.") }),
    );
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();
    expect(within(dialog).getByLabelText("바이올린 레슨비")).toHaveValue("210,000");
    expect(within(dialog).getByLabelText("피아노 금 시작 시간")).toHaveValue("16:00");

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(2));
    expect(updateStudent.mock.calls[1][0]).toEqual(updateStudent.mock.calls[0][0]);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "한소희 원생 상세" })).not.toBeInTheDocument(),
    );
  });

  it("한 악기의 학원 수업 시간은 둘 다 비우거나 함께 입력해야 한다", async () => {
    const { user, dialog } = await openEditForm("한소희");

    await user.click(within(dialog).getByLabelText("피아노 목요일"));

    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();
    await user.type(within(dialog).getByLabelText("피아노 목 시작 시간"), "16:00");
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();
    expect(
      within(dialog).getByText(
        "피아노: 시작 시간과 종료 시간을 함께 입력해 주세요.",
      ),
    ).toBeVisible();

    await user.type(within(dialog).getByLabelText("피아노 목 종료 시간"), "16:50");

    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();
  });

  it("악기가 하나뿐인 원생은 악기 이름 없는 label과 오류 문구 그대로 수정한다", async () => {
    const { user, updateStudent, dialog } = await openEditForm("김민지");

    expect(within(dialog).queryByLabelText("피아노 담당 선생님")).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("목요일"));
    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();
    await user.type(within(dialog).getByLabelText("목 시작 시간"), "16:00");
    expect(
      within(dialog).getByText("시작 시간과 종료 시간을 함께 입력해 주세요."),
    ).toBeVisible();
    await user.type(within(dialog).getByLabelText("목 종료 시간"), "16:50");
    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
    expect(updateStudent.mock.calls[0][0]).toMatchObject({
      studentId: "student-1",
      changes: [{ action: "update", studentInstrumentId: "si-piano" }],
    });
    expect(updateStudent.mock.calls[0][0].basicInfo).toBeUndefined();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildStudentList } from "@/domain/student-list";
import type { StudentSupabaseRow } from "@/lib/api/students";

import {
  StudentListScreen,
  type StudentListQueryOptionsFactory,
} from "./student-list-screen";

const supabaseBrowserClient = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => supabaseBrowserClient.create(),
}));

const studentRows = [
  {
    academyId: "academy-1",
    studentId: "student-1",
    name: "김민지",
    registeredOn: "2026-08-01",
    status: "enrolled",
    teacherNames: ["박선생"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월", "수"],
    instruments: [
      {
        studentInstrumentId: "student-instrument-1",
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
        discountTotal: 10000,
        finalMonthlyFee: 140000,
        active: true,
      },
    ],
  },
  {
    academyId: "academy-1",
    studentId: "student-2",
    name: "이서윤",
    teacherNames: ["최선생"],
    instrumentNames: ["바이올린"],
    weekdayLabels: ["화"],
  },
];

const teacherRows = [
  {
    academyId: "academy-1",
    teacherId: "teacher-1",
    name: "박선생",
    part: "피아노",
    contact: "010-1111-1111",
    registeredAt: "2026-08-01",
    payType: "monthly" as const,
  },
  {
    academyId: "academy-1",
    teacherId: "teacher-2",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "hourly" as const,
  },
];

function renderStudentListScreen(
  queryOptionsFactory: StudentListQueryOptionsFactory | undefined,
  options: Partial<React.ComponentProps<typeof StudentListScreen>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudentListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={queryOptionsFactory}
        teachers={teacherRows}
        {...options}
      />
    </QueryClientProvider>,
  );
}

function createManyStudents(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    academyId: "academy-1",
    studentId: `student-${index + 1}`,
    name: `원생${String(index + 1).padStart(2, "0")}`,
    teacherNames: ["박선생"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월"],
  }));
}

function optionLabels(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);
}

function createStudentSupabaseRow(
  id: string,
  name: string,
  teacherName: string,
  instrumentName: string,
  weekdays: string[],
): StudentSupabaseRow {
  return {
    id,
    academy_id: "academy-1",
    name,
    status: "enrolled",
    student_instruments: [
      {
        id: `${id}-instrument`,
        instrument_name: instrumentName,
        weekdays,
        teachers: { name: teacherName },
      },
    ],
  };
}

function createStudentsClient(rows: StudentSupabaseRow[]) {
  const builder = {
    eq: () => builder,
    is: () => builder,
    then: (resolve: (result: { data: StudentSupabaseRow[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };

  return { from: () => ({ select: () => builder }) };
}

describe("StudentListScreen", () => {
  it("원생 목록을 표로 보여주고 선생님/악기/정기 요일을 함께 표시한다", async () => {
    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId, options.search ?? ""],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    const table = await screen.findByRole("table", { name: "원생 목록" });
    expect(
      within(table).getByRole("cell", { name: "김민지" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "박선생" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "피아노" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "월, 수" }),
    ).toBeInTheDocument();
  });

  it("검색어와 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<StudentListQueryOptionsFactory>[0][] = [];

    renderStudentListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "students",
          options.academyId,
          options.search ?? "",
          options.filters?.teacherName ?? "",
          options.filters?.instrumentName ?? "",
          options.filters?.weekdayLabel ?? "",
        ],
        queryFn: async () => buildStudentList(studentRows, options),
      };
    });

    await screen.findByRole("cell", { name: "김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "원생 검색" }),
      "바이올린",
    );
    await user.selectOptions(screen.getByLabelText("선생님 필터"), "최선생");
    await user.selectOptions(screen.getByLabelText("악기 필터"), "바이올린");
    await user.selectOptions(screen.getByLabelText("요일 필터"), "화");

    expect(
      await screen.findByRole("cell", { name: "이서윤" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "김민지" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "바이올린",
      filters: {
        teacherName: "최선생",
        instrumentName: "바이올린",
        weekdayLabel: "화",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "원생 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });

  it("신규 원생 등록 모달에서 복수 악기와 요일별 시간을 등록 payload로 만든다", async () => {
    const user = userEvent.setup();
    const registerStudent = vi.fn();

    renderStudentListScreen(
      (options) => ({
        queryKey: ["students", options.academyId, options.search ?? ""],
        queryFn: async () => buildStudentList(studentRows, options),
      }),
      { registerStudent },
    );

    await screen.findByRole("cell", { name: "김민지" });
    await user.click(screen.getByRole("button", { name: "원생 등록" }));

    const dialog = await screen.findByRole("dialog", { name: "원생 등록" });
    await user.type(within(dialog).getByLabelText("원생명"), "윤라온");
    await user.type(within(dialog).getByLabelText("연락처"), "010-7777-8888");
    await user.click(within(dialog).getByLabelText("피아노 월요일"));
    await user.type(
      within(dialog).getByLabelText("피아노 월 시작 시간"),
      "14:00",
    );
    await user.type(
      within(dialog).getByLabelText("피아노 월 종료 시간"),
      "14:50",
    );
    await user.click(within(dialog).getByLabelText("바이올린 선택"));
    await user.click(within(dialog).getByLabelText("바이올린 금요일"));

    await user.click(within(dialog).getByRole("button", { name: "등록" }));

    await waitFor(() => {
      expect(registerStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "윤라온",
          contact: {
            relationship: "모",
            phone: "010-7777-8888",
          },
          instruments: expect.arrayContaining([
            expect.objectContaining({
              instrumentName: "피아노",
              teacherId: "teacher-1",
              lessonType: "academy",
              weeklySchedules: [
                { weekday: "monday", startTime: "14:00", endTime: "14:50" },
              ],
            }),
            expect.objectContaining({
              instrumentName: "바이올린",
              teacherId: "teacher-2",
              lessonType: "private",
              weeklySchedules: [{ weekday: "friday" }],
            }),
          ]),
        }),
      );
    });
  });

  it("학원레슨은 선택한 모든 요일의 수업 시간을 채워야 등록할 수 있다", async () => {
    const user = userEvent.setup();
    renderStudentListScreen(
      (options) => ({
        queryKey: ["students", options.academyId, "registration-validation"],
        queryFn: async () => buildStudentList(studentRows, options),
      }),
    );

    await screen.findByRole("cell", { name: "김민지" });
    await user.click(screen.getByRole("button", { name: "원생 등록" }));
    const dialog = screen.getByRole("dialog", { name: "원생 등록" });
    await user.type(within(dialog).getByLabelText("원생명"), "윤라온");
    await user.type(within(dialog).getByLabelText("연락처"), "010-7777-8888");
    await user.click(within(dialog).getByLabelText("피아노 월요일"));
    expect(within(dialog).getByRole("button", { name: "등록" })).toBeDisabled();

    await user.type(within(dialog).getByLabelText("피아노 월 시작 시간"), "14:00");
    await user.type(within(dialog).getByLabelText("피아노 월 종료 시간"), "14:50");
    expect(within(dialog).getByRole("button", { name: "등록" })).toBeEnabled();
  });

  it("원생이 10명 이하여도 총 인원, 페이지 번호, 페이지당 인원 선택을 항상 보여준다", async () => {
    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId, options.page ?? 1, options.pageSize ?? 10],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    await screen.findByRole("cell", { name: "김민지" });

    expect(screen.getByText("총 2명")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "이전 페이지" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
    expect(
      within(screen.getByLabelText("페이지당 원생 수"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["10명", "20명", "30명"]);
  });

  it("원생이 10명을 넘으면 번호와 이전·다음 버튼으로 이동하고 페이지당 인원을 바꾼다", async () => {
    const user = userEvent.setup();
    const manyStudents = createManyStudents(12);

    renderStudentListScreen((options) => ({
      queryKey: [
        "students",
        options.academyId,
        options.page ?? 1,
        options.pageSize ?? 10,
      ],
      queryFn: async () => buildStudentList(manyStudents, options),
    }));

    expect(await screen.findByText("총 12명")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "원생01" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2페이지" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "1페이지" }));
    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("페이지당 원생 수"), "20");

    expect(await screen.findByRole("cell", { name: "원생12" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "2페이지" })).not.toBeInTheDocument();
  });

  it("검색어나 필터를 바꾸면 1페이지부터 다시 보여준다", async () => {
    const user = userEvent.setup();
    const manyStudents = createManyStudents(12);
    const seenOptions: Parameters<StudentListQueryOptionsFactory>[0][] = [];

    renderStudentListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "students",
          options.academyId,
          options.search ?? "",
          options.filters?.teacherName ?? "",
          options.filters?.weekdayLabel ?? "",
          options.page ?? 1,
          options.pageSize ?? 10,
        ],
        queryFn: async () => buildStudentList(manyStudents, options),
      };
    });

    await screen.findByRole("cell", { name: "원생01" });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.type(screen.getByRole("searchbox", { name: "원생 검색" }), "원생");
    expect(seenOptions.at(-1)).toMatchObject({ search: "원생", page: 1 });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.selectOptions(screen.getByLabelText("선생님 필터"), "박선생");
    expect(seenOptions.at(-1)).toMatchObject({
      filters: { teacherName: "박선생" },
      page: 1,
    });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.selectOptions(screen.getByLabelText("요일 필터"), "월");
    expect(seenOptions.at(-1)).toMatchObject({
      filters: { weekdayLabel: "월" },
      page: 1,
    });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.click(screen.getByRole("button", { name: "초기화" }));
    expect(seenOptions.at(-1)).toMatchObject({ search: "", page: 1 });
  });

  it("필터를 하나 걸어도 다른 값으로 바꿀 수 있게 전체 선택지를 유지한다", async () => {
    const user = userEvent.setup();

    renderStudentListScreen((options) => ({
      queryKey: [
        "students",
        options.academyId,
        options.filters?.teacherName ?? "",
        options.filters?.instrumentName ?? "",
        options.filters?.weekdayLabel ?? "",
      ],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    await screen.findByRole("cell", { name: "김민지" });
    await user.selectOptions(screen.getByLabelText("선생님 필터"), "최선생");
    await screen.findByRole("cell", { name: "이서윤" });

    expect(optionLabels(screen.getByLabelText("선생님 필터"))).toEqual([
      "전체",
      "박선생",
      "최선생",
    ]);
    expect(optionLabels(screen.getByLabelText("악기 필터"))).toEqual(
      expect.arrayContaining(["전체", "피아노", "바이올린"]),
    );
    expect(optionLabels(screen.getByLabelText("요일 필터"))).toEqual([
      "전체",
      "월",
      "화",
      "수",
      "목",
      "금",
      "토",
      "일",
    ]);

    await user.selectOptions(screen.getByLabelText("선생님 필터"), "박선생");

    expect(await screen.findByRole("cell", { name: "김민지" })).toBeInTheDocument();
  });

  it("Supabase 조회에서는 전체 원생의 선생님·악기를 필터 선택지로 쓴다", async () => {
    const user = userEvent.setup();
    supabaseBrowserClient.create.mockReturnValue(
      createStudentsClient([
        createStudentSupabaseRow("student-1", "김민지", "박선생", "피아노", ["monday"]),
        createStudentSupabaseRow("student-2", "이서윤", "정선생", "드럼", ["tuesday"]),
      ]),
    );

    renderStudentListScreen(undefined);

    await screen.findByRole("cell", { name: "김민지" });
    await user.selectOptions(screen.getByLabelText("선생님 필터"), "정선생");
    await screen.findByRole("cell", { name: "이서윤" });

    expect(screen.queryByRole("cell", { name: "김민지" })).not.toBeInTheDocument();
    expect(optionLabels(screen.getByLabelText("선생님 필터"))).toEqual(
      expect.arrayContaining(["박선생", "정선생"]),
    );
    expect(optionLabels(screen.getByLabelText("악기 필터"))).toEqual(
      expect.arrayContaining(["드럼", "피아노"]),
    );
  });

  it("자세히보기 다이얼로그에서 원생 정보를 확인하고 바로 수정완료한다", async () => {
    const user = userEvent.setup();
    const updateStudent = vi.fn();

    renderStudentListScreen(
      (options) => ({
        queryKey: ["students", options.academyId, options.search ?? ""],
        queryFn: async () => buildStudentList(studentRows, options),
      }),
      { updateStudent },
    );

    const table = await screen.findByRole("table", { name: "원생 목록" });
    await user.click(
      within(table).getByRole("button", { name: "김민지 자세히보기" }),
    );

    const detailDialog = await screen.findByRole("dialog", {
      name: "김민지 원생 상세",
    });
    expect(within(detailDialog).getByText("체르니 100")).toBeInTheDocument();
    expect(within(detailDialog).getByText("150,000원")).toBeInTheDocument();

    await user.click(within(detailDialog).getByRole("button", { name: "수정하기" }));
    expect(within(detailDialog).queryByLabelText("악기 ID")).not.toBeInTheDocument();
    expect(within(detailDialog).queryByLabelText("악기명")).not.toBeInTheDocument();
    expect(within(detailDialog).getByLabelText("악기")).toHaveValue("피아노");
    expect(within(detailDialog).getByLabelText("악기")).toHaveAttribute("readonly");
    await user.clear(within(detailDialog).getByLabelText("원생명"));
    await user.type(within(detailDialog).getByLabelText("원생명"), "김민주");
    await user.selectOptions(within(detailDialog).getByLabelText("담당 선생님"), "teacher-2");
    await user.click(within(detailDialog).getByLabelText("목요일"));

    await user.click(within(detailDialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => {
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "student-1",
          name: "김민주",
          teacherId: "teacher-2",
          teacherName: "최선생",
          instrumentId: "piano",
          instrumentName: "피아노",
          weekdayLabels: expect.arrayContaining(["월", "목"]),
        }),
      );
    });
    const updatedRow = (await screen.findByRole("cell", { name: "김민주" })).closest("tr");
    expect(updatedRow).not.toBeNull();
    expect(within(updatedRow as HTMLElement).getByRole("cell", { name: "최선생" })).toBeInTheDocument();
  });

  it("원생 상세 다이얼로그에서 휴원 확인창을 최상위 레이어로 띄운다", async () => {
    const user = userEvent.setup();

    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId, options.search ?? ""],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    const table = await screen.findByRole("table", { name: "원생 목록" });
    await user.click(
      within(table).getByRole("button", { name: "김민지 자세히보기" }),
    );

    const detailDialog = await screen.findByRole("dialog", {
      name: "김민지 원생 상세",
    });
    await user.click(within(detailDialog).getByRole("button", { name: "휴원" }));

    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "상태 변경 확인",
    });

    expect(confirmDialog).toBeVisible();
    expect(confirmDialog).toHaveStyle({ zIndex: "1000" });
  });

  it("재원 원생에게는 삭제 버튼을 보여주지 않는다", async () => {
    const user = userEvent.setup();

    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId, "delete-hidden"],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    await user.click(await screen.findByRole("button", { name: "김민지 자세히보기" }));
    const detailDialog = await screen.findByRole("dialog", { name: "김민지 원생 상세" });

    expect(within(detailDialog).queryByRole("button", { name: "삭제" })).not.toBeInTheDocument();
  });

  it("퇴원 원생은 삭제할 수 없고 보관 상태로 유지된다는 안내만 보여준다", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    const updateStudentStatus = vi.fn();

    renderStudentListScreen(
      (options) => ({
        queryKey: ["students", options.academyId, "delete-disabled"],
        queryFn: async () => buildStudentList(studentRows, options),
      }),
      { updateStudentStatus },
    );

    await user.click(await screen.findByRole("button", { name: "김민지 자세히보기" }));
    const detailDialog = await screen.findByRole("dialog", { name: "김민지 원생 상세" });
    await user.click(within(detailDialog).getByRole("button", { name: "퇴원" }));
    const confirmDialog = await screen.findByRole("alertdialog", { name: "상태 변경 확인" });
    await user.click(within(confirmDialog).getByRole("button", { name: "처리" }));

    await waitFor(() => {
      expect(updateStudentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: "student-1", status: "withdrawn" }),
      );
    });

    const deleteButton = await within(detailDialog).findByRole("button", { name: "삭제" });
    expect(deleteButton).toBeDisabled();
    expect(
      within(detailDialog).getByText(
        "결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.",
      ),
    ).toBeVisible();
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("좁은 화면에서도 각 원생 정보와 관리 작업의 항목명을 제공한다", async () => {
    renderStudentListScreen((options) => ({
      queryKey: ["students", options.academyId],
      queryFn: async () => buildStudentList(studentRows, options),
    }));

    const table = await screen.findByRole("table", { name: "원생 목록" });
    const row = within(table).getByRole("row", { name: /김민지/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "원생", "선생님", "악기", "정기 요일", "관리",
    ]);
  });

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
    // 요일 1개는 가격표 구간이 없어 레슨비를 직접 입력해야 한다.
    await user.type(within(dialog).getByLabelText("피아노 레슨비"), "135000");
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
              lessonFee: 140000,
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
    await user.type(within(dialog).getByLabelText("피아노 레슨비"), "135000");
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
      {
        updateStudent,
        teachers: [
          ...teacherRows,
          {
            academyId: "academy-1",
            teacherId: "teacher-3",
            name: "정선생",
            part: "피아노",
            contact: "010-3333-3333",
            registeredAt: "2026-08-03",
            payType: "monthly" as const,
          },
        ],
      },
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
    await user.selectOptions(within(detailDialog).getByLabelText("담당 선생님"), "teacher-3");
    await user.click(within(detailDialog).getByLabelText("목요일"));
    await user.type(within(detailDialog).getByLabelText("목 시작 시간"), "16:00");
    await user.type(within(detailDialog).getByLabelText("목 종료 시간"), "16:50");

    await user.click(within(detailDialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => {
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "student-1",
          name: "김민주",
          teacherId: "teacher-3",
          teacherName: "정선생",
          instrumentId: "piano",
          instrumentName: "피아노",
          weekdayLabels: expect.arrayContaining(["월", "목"]),
          weeklySchedules: [
            { weekdayLabel: "월", startTime: "15:00", endTime: "15:50" },
            { weekdayLabel: "수", startTime: "15:00", endTime: "15:50" },
            { weekdayLabel: "목", startTime: "16:00", endTime: "16:50" },
          ],
        }),
      );
    });
    const updatedRow = (await screen.findByRole("cell", { name: "김민주" })).closest("tr");
    expect(updatedRow).not.toBeNull();
    expect(within(updatedRow as HTMLElement).getByRole("cell", { name: "정선생" })).toBeInTheDocument();
  });

  async function openEditForm(
    student: string,
    rows: Parameters<typeof buildStudentList>[0] = studentRows,
    options: Partial<React.ComponentProps<typeof StudentListScreen>> = {},
  ) {
    const user = userEvent.setup();
    const updateStudent = vi.fn();

    renderStudentListScreen(
      (queryOptions) => ({
        queryKey: ["students", queryOptions.academyId, queryOptions.search ?? ""],
        queryFn: async () => buildStudentList(rows, queryOptions),
      }),
      { updateStudent, ...options },
    );

    const table = await screen.findByRole("table", { name: "원생 목록" });
    await user.click(within(table).getByRole("button", { name: `${student} 자세히보기` }));
    const detailDialog = await screen.findByRole("dialog", { name: `${student} 원생 상세` });
    await user.click(within(detailDialog).getByRole("button", { name: "수정하기" }));

    return { user, updateStudent, dialog: detailDialog };
  }

  it("수정 폼은 요일마다 저장된 시작·종료 시간을 보여 준다", async () => {
    const { dialog } = await openEditForm("김민지");

    expect(within(dialog).getByLabelText("월 시작 시간")).toHaveValue("15:00");
    expect(within(dialog).getByLabelText("월 종료 시간")).toHaveValue("15:50");
  });

  it("학원 수업에서 시간이 빠진 요일이 있으면 수정완료를 막고 이유를 알려 준다", async () => {
    const { user, dialog } = await openEditForm("김민지");

    await user.click(within(dialog).getByLabelText("목요일"));

    expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();
    expect(
      within(dialog).getByText("학원레슨의 모든 요일에 시작 시간과 종료 시간을 입력해야 합니다."),
    ).toBeInTheDocument();
  });

  it("담당 선생님 후보는 악기 파트 선생님이고 담당이 없으면 미배정으로 두며 첫 선생님으로 바꾸지 않는다", async () => {
    const rows = [
      {
        ...studentRows[0],
        instruments: [
          {
            ...studentRows[0].instruments![0],
            lessonType: "private",
            teacherId: null,
            teacherName: "",
          },
        ],
      },
    ];
    const { user, updateStudent, dialog } = await openEditForm("김민지", rows);
    const teacherSelect = within(dialog).getByLabelText("담당 선생님");

    expect(teacherSelect).toHaveValue("");
    expect(optionLabels(teacherSelect)).toEqual(["미배정", "박선생"]);

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => {
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({ teacherId: undefined }),
      );
    });
  });

  it("담당 선생님이 목록에 없는 휴직·퇴사 선생님이어도 기존 담당을 유지한다", async () => {
    const rows = [
      {
        ...studentRows[0],
        instruments: [
          {
            ...studentRows[0].instruments![0],
            lessonType: "private",
            teacherId: "teacher-9",
            teacherName: "한선생",
          },
        ],
      },
    ];
    const { user, updateStudent, dialog } = await openEditForm("김민지", rows);

    expect(within(dialog).getByLabelText("담당 선생님")).toHaveValue("teacher-9");
    expect(optionLabels(within(dialog).getByLabelText("담당 선생님"))).toContain("한선생");

    await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

    await waitFor(() => {
      expect(updateStudent).toHaveBeenCalledWith(
        expect.objectContaining({ teacherId: "teacher-9", teacherName: "한선생" }),
      );
    });
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

  describe("정렬", () => {
    const sortableRows = [
      { ...studentRows[0], studentId: "s-1", name: "가은", teacherNames: ["최선생"] },
      { ...studentRows[0], studentId: "s-2", name: "나은", teacherNames: ["박선생"] },
    ];

    it("기본은 이름순이고 정렬 기준과 방향을 바꾸면 목록 조회 입력에 반영하고 1페이지로 돌아간다", async () => {
      const user = userEvent.setup();
      const seenOptions: Parameters<StudentListQueryOptionsFactory>[0][] = [];

      renderStudentListScreen((options) => {
        seenOptions.push(options);

        return {
          queryKey: ["students", options.sort?.key, options.sort?.direction],
          queryFn: async () => buildStudentList(sortableRows, options),
        };
      });

      await screen.findByRole("cell", { name: "가은" });
      expect(screen.getByLabelText("정렬 기준")).toHaveValue("name");
      expect(optionLabels(screen.getByLabelText("정렬 기준"))).toEqual([
        "이름",
        "담당 선생님",
        "악기",
        "정기 요일",
      ]);

      await user.selectOptions(screen.getByLabelText("정렬 기준"), "teacher");
      const rows = await screen.findAllByRole("row");
      expect(within(rows[1]).getByRole("cell", { name: "나은" })).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("정렬 방향"), "desc");
      expect(seenOptions.at(-1)).toMatchObject({ sort: { key: "teacher", direction: "desc" }, page: 1 });
    });

    it("초기화를 누르면 이름 오름차순으로 돌아간다", async () => {
      const user = userEvent.setup();

      renderStudentListScreen((options) => ({
        queryKey: ["students", options.sort?.key, options.sort?.direction],
        queryFn: async () => buildStudentList(sortableRows, options),
      }));

      await screen.findByRole("cell", { name: "가은" });
      await user.selectOptions(screen.getByLabelText("정렬 기준"), "instrument");
      await user.selectOptions(screen.getByLabelText("정렬 방향"), "desc");
      await user.click(screen.getByRole("button", { name: "초기화" }));

      expect(screen.getByLabelText("정렬 기준")).toHaveValue("name");
      expect(screen.getByLabelText("정렬 방향")).toHaveValue("asc");
    });
  });

  describe("나이 자동 증가", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("원생 상세는 입력한 해가 지난 만큼 늘어난 나이를 보여 준다", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2027-01-01T00:00:00+09:00"));
      const user = userEvent.setup();

      renderStudentListScreen((options) => ({
        queryKey: ["students", options.academyId, "age-detail"],
        queryFn: async () =>
          buildStudentList([{ ...studentRows[0], age: 9, ageAsOfYear: 2026 }], options),
      }));
      await user.click(await screen.findByRole("button", { name: "김민지 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "김민지 원생 상세" });

      expect(within(dialog).getByText("10세")).toBeVisible();
    });

    it("상세와 수정 폼은 입력한 해가 지난 만큼 늘어난 나이를 보여 주고 저장하면 그 나이를 올해 나이로 보낸다", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-16T03:00:00Z"));
      const rows = [{ ...studentRows[0], age: 9, ageAsOfYear: 2025 }];
      const { user, updateStudent, dialog } = await openEditForm("김민지", rows);

      expect(within(dialog).getByLabelText("나이")).toHaveValue(10);
      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({ basicInfo: expect.objectContaining({ age: 10 }) }),
        );
      });
    });
  });

  describe("수정 폼 기본 정보", () => {
    const detailedRows = [
      {
        ...studentRows[0],
        age: 9,
        grade: "초등 3학년",
        school: "한빛초",
        occupation: "학생",
        contacts: [{ contactId: "c-1", relationship: "모", phone: "010-1111-2222" }],
      },
    ];

    it("등록 폼에 있는 등록일, 나이, 학년, 학교, 직업, 연락처를 저장된 값으로 채워 수정할 수 있다", async () => {
      const { user, updateStudent, dialog } = await openEditForm("김민지", detailedRows);

      expect(within(dialog).getByLabelText("등록일")).toHaveValue("2026-08-01");
      expect(within(dialog).getByLabelText("나이")).toHaveValue(9);
      expect(within(dialog).getByLabelText("학년")).toHaveValue("초등 3학년");
      expect(within(dialog).getByLabelText("학교")).toHaveValue("한빛초");
      expect(within(dialog).getByLabelText("직업")).toHaveValue("학생");
      expect(within(dialog).getByLabelText("연락처 구분")).toHaveValue("모");
      expect(within(dialog).getByLabelText("연락처")).toHaveValue("010-1111-2222");

      await user.clear(within(dialog).getByLabelText("학교"));
      await user.type(within(dialog).getByLabelText("학교"), "새빛초");
      await user.selectOptions(within(dialog).getByLabelText("연락처 구분"), "부");
      await user.clear(within(dialog).getByLabelText("연락처"));
      await user.type(within(dialog).getByLabelText("연락처"), "010-5555-6666");
      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            basicInfo: {
              registeredOn: "2026-08-01",
              age: 9,
              grade: "초등 3학년",
              school: "새빛초",
              occupation: "학생",
              contactRelationship: "부",
              contactPhone: "010-5555-6666",
            },
          }),
        );
      });
    });

    it("연락처가 이미 있는 원생은 연락처를 비우면 수정완료를 막고 이유를 알려 준다", async () => {
      const { user, dialog } = await openEditForm("김민지", detailedRows);

      await user.clear(within(dialog).getByLabelText("연락처"));

      expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();
      expect(within(dialog).getByText("연락처는 숫자 4자리 이상 입력해 주세요.")).toBeVisible();
    });

    it("저장된 관계가 선택지에 없어도 그대로 보여 주고 유지한다", async () => {
      const rows = [
        { ...detailedRows[0], contacts: [{ contactId: "c-1", relationship: "조모", phone: "010-1111-2222" }] },
      ];
      const { dialog } = await openEditForm("김민지", rows);

      expect(within(dialog).getByLabelText("연락처 구분")).toHaveValue("조모");
    });

    it("저장에 실패하면 수정 폼을 닫지 않아 다시 저장할 수 있다", async () => {
      const user = userEvent.setup();
      const updateStudent = vi
        .fn()
        .mockRejectedValueOnce(new Error("원생 정보를 일부만 저장했습니다: 기본 정보 저장 실패"))
        .mockResolvedValueOnce(undefined);

      renderStudentListScreen(
        (options) => ({
          queryKey: ["students", options.academyId, "retry"],
          queryFn: async () => buildStudentList(detailedRows, options),
        }),
        { updateStudent },
      );
      await user.click(await screen.findByRole("button", { name: "김민지 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "김민지 원생 상세" });
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));
      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
      expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeEnabled();

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
      await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(2));
    });
  });

  describe("수정 폼 레슨비·할인", () => {
    it("저장된 레슨비를 그대로 보여 주고 진도를 가격표 목록에서 바꾸면 다시 계산한다", async () => {
      const { user, updateStudent, dialog } = await openEditForm("김민지");

      expect(within(dialog).getByLabelText("레슨비")).toHaveValue(150000);
      expect(within(dialog).getByLabelText("진도")).toHaveValue("체르니 100");
      expect(
        within(dialog).getByText("가격표에 없는 진도라 레슨비를 직접 입력해 주세요."),
      ).toBeVisible();

      await user.selectOptions(within(dialog).getByLabelText("진도"), "체르니30");
      expect(within(dialog).getByLabelText("레슨비")).toHaveValue(160000);

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({ progress: "체르니30", lessonFee: 160000 }),
        );
      });
    });

    it("이전에 종류 없이 저장된 할인액은 기존 할인으로 남기고 최종 수강료에 그대로 반영한다", async () => {
      const { user, updateStudent, dialog } = await openEditForm("김민지");

      expect(within(dialog).getByLabelText("기존 할인액")).toHaveValue(10000);
      expect(within(dialog).getByLabelText("최종 수강료")).toHaveValue(140000);

      await user.click(within(dialog).getByRole("checkbox", { name: "두 자녀 할인" }));
      expect(within(dialog).getByLabelText("최종 수강료")).toHaveValue(130000);

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            discountKinds: ["sibling"],
            discountTotal: 20000,
            finalMonthlyFee: 130000,
          }),
        );
      });
    });

    it("지인 소개 할인 달은 등록 달이 기본이고 수정 폼에서 바꿀 수 있는 월 필드다", async () => {
      const { user, updateStudent, dialog } = await openEditForm("김민지");

      await user.click(within(dialog).getByRole("checkbox", { name: "지인 소개 할인" }));
      expect(within(dialog).getByLabelText("지인 소개 할인 월")).toHaveValue("2026-08");

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            discountKinds: ["referral"],
            referralDiscountMonth: "2026-08",
            referralDiscountAmount: 10000,
            finalMonthlyFee: 140000,
          }),
        );
      });
    });
  });

  describe("수강 요일", () => {
    it("일요일은 이전 데이터에 저장된 경우에만 선택지로 남긴다", async () => {
      const withoutSunday = await openEditForm("김민지");
      expect(within(withoutSunday.dialog).queryByLabelText("일요일")).not.toBeInTheDocument();
    });

    it("저장된 일요일은 보여 주고 수정해도 유지한다", async () => {
      const rows = [
        {
          ...studentRows[0],
          weekdayLabels: ["월", "일"],
          instruments: [
            {
              ...studentRows[0].instruments![0],
              lessonType: "private",
              weekdayLabels: ["월", "일"],
              weeklySchedules: [
                { weekday: "monday", weekdayLabel: "월", startTime: "", endTime: "" },
                { weekday: "sunday", weekdayLabel: "일", startTime: "", endTime: "" },
              ],
            },
          ],
        },
      ];
      const { user, updateStudent, dialog } = await openEditForm("김민지", rows);

      expect(within(dialog).getByLabelText("일요일")).toBeChecked();
      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      await waitFor(() => {
        expect(updateStudent).toHaveBeenCalledWith(
          expect.objectContaining({ weekdayLabels: ["월", "일"] }),
        );
      });
    });
  });
});

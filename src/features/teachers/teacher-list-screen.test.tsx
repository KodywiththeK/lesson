import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { buildTeacherList, type TeacherListRow } from "@/domain/teacher-list";

import {
  TeacherListScreen,
  type TeacherListQueryOptionsFactory,
} from "./teacher-list-screen";

const teacherRows = [
  {
    academyId: "academy-1",
    teacherId: "teacher-1",
    name: "박선생",
    part: "피아노",
    contact: "010-1111-1111",
    registeredAt: "2026-08-01",
    payType: "ratio" as const,
    status: "employed" as const,
    contractStartOn: "2026-08-01",
    contractEndOn: "2027-07-31",
    salarySummary: "비율제 60%",
    workScheduleSummary: "월 14:00-20:00",
  },
  {
    academyId: "academy-1",
    teacherId: "teacher-2",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "monthly" as const,
    status: "on_leave" as const,
    contractStartOn: "2026-08-01",
    contractEndOn: "2027-07-31",
    salarySummary: "월급제 2,500,000원",
    workScheduleSummary: "-",
  },
];

const manyTeacherRows: TeacherListRow[] = Array.from({ length: 25 }, (_, index) => ({
  academyId: "academy-1",
  teacherId: `teacher-${String(index + 1).padStart(2, "0")}`,
  name: `선생${String(index + 1).padStart(2, "0")}`,
  part: index % 2 === 0 ? "피아노" : "바이올린",
  contact: "010-0000-0000",
  registeredAt: "2026-08-01",
  payType: "monthly" as const,
  status: "employed" as const,
  contractStartOn: "2026-08-01",
  contractEndOn: "2027-07-31",
  salarySummary: "월급제 2,500,000원",
  workScheduleSummary: "-",
}));

function pagedTeacherQueryOptions(
  options: Parameters<TeacherListQueryOptionsFactory>[0],
  rows: TeacherListRow[] = manyTeacherRows,
) {
  return {
    queryKey: [
      "teachers",
      options.academyId,
      options.search ?? "",
      options.filters?.part ?? "",
      options.filters?.payType ?? "",
      options.page ?? 1,
      options.pageSize ?? 10,
    ],
    queryFn: async () => buildTeacherList(rows, options),
  };
}

function renderTeacherListScreen(
  queryOptionsFactory: TeacherListQueryOptionsFactory,
  props: Partial<ComponentProps<typeof TeacherListScreen>> = {},
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
      <TeacherListScreen
        academyId="academy-1"
        academyName="더 클래식"
        queryOptionsFactory={queryOptionsFactory}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("TeacherListScreen", () => {
  it("좁은 화면에서도 선생님 정보와 관리 작업의 항목명을 제공한다", async () => {
    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId],
      queryFn: async () => buildTeacherList(teacherRows, options),
    }));

    const table = await screen.findByRole("table", { name: "선생님 목록" });
    const row = within(table).getByRole("row", { name: /박선생/ });
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "선생님", "상태", "담당 파트", "연락처", "계약기간", "근무시간", "급여", "관리",
    ]);
  });

  it("선생님 목록을 표로 보여주고 상태, 계약기간, 근무시간, 급여 상세를 표시한다", async () => {
    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId, options.search ?? ""],
      queryFn: async () => buildTeacherList(teacherRows, options),
    }));

    const table = await screen.findByRole("table", { name: "선생님 목록" });
    expect(
      within(table).getByRole("cell", { name: "박선생" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "피아노" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "재직" }),
    ).toBeInTheDocument();
    expect(
      within(table).getAllByRole("cell", {
        name: "2026-08-01 - 2027-07-31",
      })[0],
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "월 14:00-20:00" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "비율제 60%" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("900101-1")).not.toBeInTheDocument();
  });

  it("검색어와 담당 파트, 급여 형태 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<TeacherListQueryOptionsFactory>[0][] = [];

    renderTeacherListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "teachers",
          options.academyId,
          options.search ?? "",
          options.filters?.part ?? "",
          options.filters?.payType ?? "",
        ],
        queryFn: async () => buildTeacherList(teacherRows, options),
      };
    });

    await screen.findByRole("cell", { name: "박선생" });

    await user.type(
      screen.getByRole("searchbox", { name: "선생님 검색" }),
      "월급제",
    );
    await user.selectOptions(screen.getByLabelText("담당 파트 필터"), "바이올린");
    await user.selectOptions(screen.getByLabelText("급여 형태 필터"), "monthly");

    expect(
      await screen.findByRole("cell", { name: "최선생" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "박선생" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "월급제",
      filters: {
        part: "바이올린",
        payType: "monthly",
      },
    });
  });

  it("목록에는 재직 선생님만 나오므로 항상 비어 있는 상태 필터는 보여주지 않는다", async () => {
    renderTeacherListScreen((options) => pagedTeacherQueryOptions(options, teacherRows));

    await screen.findByRole("cell", { name: "박선생" });

    expect(screen.queryByLabelText("상태 필터")).not.toBeInTheDocument();
  });

  it("담당 파트 선택지는 필터를 걸어도 전체 선생님 기준으로 유지된다", async () => {
    const user = userEvent.setup();

    renderTeacherListScreen(
      (options) => pagedTeacherQueryOptions(options, teacherRows),
      {
        teacherOptionsQueryOptions: {
          queryKey: ["teachers", "options"],
          queryFn: async () => teacherRows,
        },
      },
    );

    await screen.findByRole("cell", { name: "박선생" });
    const partFilter = screen.getByLabelText("담당 파트 필터");
    await user.selectOptions(partFilter, "바이올린");

    expect(
      await screen.findByRole("cell", { name: "최선생" }),
    ).toBeInTheDocument();
    expect(
      within(partFilter).getByRole("option", { name: "피아노" }),
    ).toBeInTheDocument();
    expect(
      within(partFilter).getByRole("option", { name: "바이올린" }),
    ).toBeInTheDocument();
  });

  it("선생님이 10명을 넘으면 총 인원과 페이지 번호로 다음 페이지를 볼 수 있다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<TeacherListQueryOptionsFactory>[0][] = [];

    renderTeacherListScreen((options) => {
      seenOptions.push(options);

      return pagedTeacherQueryOptions(options);
    });

    const table = await screen.findByRole("table", { name: "선생님 목록" });
    expect(screen.getByText("총 25명")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByRole("cell", { name: "선생01" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "선생11" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2페이지" }));

    expect(await within(table).findByRole("cell", { name: "선생11" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "선생01" })).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({ page: 2, pageSize: 10 });
  });

  it("페이지를 넘기는 동안에는 이전 목록과 페이지 이동 영역을 유지한다", async () => {
    const user = userEvent.setup();
    let releaseSecondPage!: () => void;
    const secondPage = new Promise<void>((resolve) => {
      releaseSecondPage = resolve;
    });

    renderTeacherListScreen((options) => {
      const queryOptions = pagedTeacherQueryOptions(options);

      return {
        ...queryOptions,
        queryFn: async () => {
          if (options.page === 2) {
            await secondPage;
          }

          return queryOptions.queryFn();
        },
      };
    });

    await screen.findByRole("cell", { name: "선생01" });
    await user.click(screen.getByRole("button", { name: "2페이지" }));

    expect(screen.getByRole("cell", { name: "선생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeInTheDocument();

    await act(async () => releaseSecondPage());

    expect(await screen.findByRole("cell", { name: "선생11" })).toBeInTheDocument();
  });

  it("페이지당 선생님 수를 바꾸면 1페이지부터 그 수만큼 보여준다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<TeacherListQueryOptionsFactory>[0][] = [];

    renderTeacherListScreen((options) => {
      seenOptions.push(options);

      return pagedTeacherQueryOptions(options);
    });

    await screen.findByRole("table", { name: "선생님 목록" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "선생21" });

    await user.selectOptions(screen.getByLabelText("페이지당 선생님 수"), "20");

    expect(await screen.findByRole("cell", { name: "선생20" })).toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({ page: 1, pageSize: 20 });
  });

  it("검색어, 필터, 초기화를 바꾸면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<TeacherListQueryOptionsFactory>[0][] = [];

    renderTeacherListScreen((options) => {
      seenOptions.push(options);

      return pagedTeacherQueryOptions(options);
    });

    await screen.findByRole("table", { name: "선생님 목록" });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "선생11" });
    await user.type(screen.getByRole("searchbox", { name: "선생님 검색" }), "선생");
    expect(seenOptions.at(-1)).toMatchObject({ search: "선생", page: 1 });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "선생11" });
    await user.selectOptions(screen.getByLabelText("담당 파트 필터"), "피아노");
    expect(seenOptions.at(-1)).toMatchObject({ filters: { part: "피아노" }, page: 1 });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByRole("cell", { name: "선생21" });
    await user.selectOptions(screen.getByLabelText("급여 형태 필터"), "monthly");
    expect(seenOptions.at(-1)).toMatchObject({ filters: { payType: "monthly" }, page: 1 });

    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await user.click(screen.getByRole("button", { name: "초기화" }));
    expect(seenOptions.at(-1)).toMatchObject({ search: "", page: 1 });
  });

  it("검색 결과가 없어도 총 0명과 페이지 이동 영역을 보여준다", async () => {
    const user = userEvent.setup();

    renderTeacherListScreen((options) => pagedTeacherQueryOptions(options));

    await screen.findByRole("table", { name: "선생님 목록" });
    await user.type(screen.getByRole("searchbox", { name: "선생님 검색" }), "없는이름");

    expect(await screen.findByText("조건에 맞는 선생님이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0명")).toBeInTheDocument();
    expect(screen.getByLabelText("페이지당 선생님 수")).toBeInTheDocument();
  });

  it("등록 모달에서 계약기간, 근무요일, 비율제 급여를 입력해 저장한다", async () => {
    const user = userEvent.setup();
    const registerTeacher = vi.fn();

    renderTeacherListScreen(
      (options) => ({
        queryKey: ["teachers", options.academyId, options.search ?? ""],
        queryFn: async () => buildTeacherList(teacherRows, options),
      }),
      { registerTeacher },
    );

    await user.click(screen.getByRole("button", { name: "선생님 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });

    await user.type(within(dialog).getByLabelText("선생님명"), "홍선생");
    await user.clear(within(dialog).getByLabelText("연락처"));
    await user.type(within(dialog).getByLabelText("연락처"), "010-9999-0000");
    await user.type(within(dialog).getByLabelText("계약 시작일"), "2026-09-01");
    await user.type(within(dialog).getByLabelText("계약 종료일"), "2027-08-31");
    await user.click(within(dialog).getByRole("checkbox", { name: "월" }));
    await user.type(within(dialog).getByLabelText("월 시작 시간"), "14:00");
    await user.type(within(dialog).getByLabelText("월 종료 시간"), "20:00");
    await user.selectOptions(within(dialog).getByLabelText("급여 형태"), "ratio");
    await user.clear(within(dialog).getByLabelText("학원 몫"));
    await user.type(within(dialog).getByLabelText("학원 몫"), "4");
    await user.clear(within(dialog).getByLabelText("선생님 몫"));
    await user.type(within(dialog).getByLabelText("선생님 몫"), "6");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(registerTeacher).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "홍선생",
        contractStartOn: "2026-09-01",
        contractEndOn: "2027-08-31",
        payType: "ratio",
        ratioAcademyShare: 4,
        ratioTeacherShare: 6,
        workSchedules: [
          {
            weekday: "monday",
            startTime: "14:00",
            endTime: "20:00",
          },
        ],
      }),
    );
  });

  it("자세히보기 다이얼로그에서 수정과 상태 버튼 정책을 제공한다", async () => {
    const user = userEvent.setup();

    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId, options.search ?? ""],
      queryFn: async () => buildTeacherList(teacherRows, options),
    }));

    await user.click(
      await screen.findByRole("button", { name: "박선생 자세히보기" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "박선생 상세",
    });

    expect(within(dialog).getByText("비율제 60%")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "수정하기" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "휴직" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "퇴사" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(
      within(dialog).getByText(
        "결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.",
      ),
    ).toBeInTheDocument();
  });

  it("퇴사 처리한 선생님도 삭제할 수 없고 보관 상태로 안내한다", async () => {
    const user = userEvent.setup();
    const updateTeacherStatus = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");

    renderTeacherListScreen(
      (options) => pagedTeacherQueryOptions(options, teacherRows),
      { updateTeacherStatus },
    );

    await user.click(
      await screen.findByRole("button", { name: "박선생 자세히보기" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });
    await user.click(within(dialog).getByRole("button", { name: "퇴사" }));
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "상태 변경 확인",
    });
    await user.click(within(confirmDialog).getByRole("button", { name: "처리" }));

    await waitFor(() =>
      expect(updateTeacherStatus).toHaveBeenCalledWith(
        expect.objectContaining({ teacherId: "teacher-1", status: "resigned" }),
      ),
    );
    await within(dialog).findByText("퇴사", { selector: "span" });
    expect(within(dialog).getByRole("button", { name: "삭제" })).toBeDisabled();
    expect(
      within(dialog).getByText(/삭제할 수 없습니다\. 보관 상태로 유지됩니다\./),
    ).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "선생님 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });
});

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
    ratioTeacherShare: 60,
    workScheduleSummary: "월 14:00-20:00",
    residentRegistrationMasked: "900101-1******",
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
        isOwner
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
      "선생님", "상태", "담당 파트", "연락처", "계약 기간", "주민등록번호", "근무시간", "급여", "관리",
    ]);
  });

  it("목록 표에 계약 기간과 마스킹된 주민등록번호를 보여 준다", async () => {
    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId],
      queryFn: async () => buildTeacherList(teacherRows, options),
    }));

    const table = await screen.findByRole("table", { name: "선생님 목록" });
    const row = within(table).getByRole("row", { name: /박선생/ });

    expect(within(row).getByRole("cell", { name: "2026-08-01~2027-07-31" })).toHaveAttribute("data-label", "계약 기간");
    expect(within(row).getByRole("cell", { name: "900101-1******" })).toHaveAttribute("data-label", "주민등록번호");
    expect(within(table).getByRole("columnheader", { name: "계약 기간" })).toBeInTheDocument();
    // 주민등록번호가 없는 선생님은 빈 값 표시
    const emptyRow = within(table).getByRole("row", { name: /최선생/ });
    const emptyResidentCell = within(emptyRow)
      .getAllByRole("cell")
      .find((cell) => cell.getAttribute("data-label") === "주민등록번호");
    expect(emptyResidentCell).toHaveTextContent("-");
  });

  it("선생님 목록을 표로 보여주고 상태, 근무시간, 급여 상세를 표시한다", async () => {
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

    expect(within(dialog).queryByLabelText("등록일")).not.toBeInTheDocument();

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

  it("계약기간을 비워도 선생님을 등록할 수 있다", async () => {
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
    await user.selectOptions(within(dialog).getByLabelText("급여 형태"), "ratio");
    await user.clear(within(dialog).getByLabelText("학원 몫"));
    await user.type(within(dialog).getByLabelText("학원 몫"), "4");
    await user.clear(within(dialog).getByLabelText("선생님 몫"));
    await user.type(within(dialog).getByLabelText("선생님 몫"), "6");

    expect(within(dialog).getByLabelText("계약 시작일")).toHaveValue("");
    expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    expect(registerTeacher).toHaveBeenCalledTimes(1);
    const submitted = registerTeacher.mock.calls[0][0];
    expect(submitted).toMatchObject({ name: "홍선생" });
    expect(submitted.contractStartOn).toBeUndefined();
    expect(submitted.contractEndOn).toBeUndefined();
  });

  it("비율 한쪽을 정수로 바꾸면 반대쪽을 자동으로 10에 맞춘다", async () => {
    const user = userEvent.setup();
    renderTeacherListScreen(
      (options) => ({
        queryKey: ["teachers", options.academyId],
        queryFn: async () => buildTeacherList(teacherRows, options),
      }),
      { registerTeacher: vi.fn() },
    );

    await user.click(screen.getByRole("button", { name: "선생님 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });
    await user.selectOptions(within(dialog).getByLabelText("급여 형태"), "ratio");
    const academyShare = within(dialog).getByLabelText("학원 몫");
    const teacherShare = within(dialog).getByLabelText("선생님 몫");

    expect(academyShare).toHaveAttribute("step", "1");
    expect(teacherShare).toHaveAttribute("step", "1");
    await user.clear(academyShare);
    await user.type(academyShare, "7");

    expect(teacherShare).toHaveValue(3);

    await user.clear(academyShare);
    await user.type(academyShare, "6.5");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "한쪽 몫을 0부터 10까지 정수로 입력해 주세요.",
    );
  });

  it("상세 화면은 계약기간이 없거나 한쪽만 있을 때 알아볼 수 있게 보여 준다", async () => {
    const user = userEvent.setup();
    const rows = [
      { ...teacherRows[0], contractStartOn: undefined, contractEndOn: undefined },
    ];

    const { unmount } = renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId, options.search ?? ""],
      queryFn: async () => buildTeacherList(rows, options),
    }));
    await user.click(await screen.findByRole("button", { name: `${rows[0].name} 자세히보기` }));

    const noPeriodDialog = await screen.findByRole("dialog", { name: `${rows[0].name} 상세` });
    expect(within(within(noPeriodDialog).getByText("계약기간").parentElement!).getByText("-"))
      .toBeInTheDocument();
    unmount();

    renderTeacherListScreen((options) => ({
      queryKey: ["teachers", options.academyId, options.search ?? "", "start-only"],
      queryFn: async () =>
        buildTeacherList([{ ...rows[0], contractStartOn: "2026-08-01" }], options),
    }));
    await user.click(await screen.findByRole("button", { name: `${rows[0].name} 자세히보기` }));

    expect(
      within(await screen.findByRole("dialog", { name: `${rows[0].name} 상세` })).getByText("2026-08-01~"),
    ).toBeInTheDocument();
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
    expect(within(dialog).getByText("2026-08-01~2027-07-31")).toBeInTheDocument();
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

  describe("원장이 아닌 사용자(데스크)", () => {
    const deskProps = { isOwner: false };

    it("급여 컬럼·급여 형태 필터·상세의 급여정보를 숨기고 금액이 어디에도 나오지 않는다", async () => {
      const user = userEvent.setup();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        deskProps,
      );

      const table = await screen.findByRole("table", { name: "선생님 목록" });
      const row = within(table).getByRole("row", { name: /박선생/ });

      expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
        "선생님", "상태", "담당 파트", "연락처", "계약 기간", "주민등록번호", "근무시간", "관리",
      ]);
      expect(within(table).queryByRole("columnheader", { name: "급여" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("급여 형태 필터")).not.toBeInTheDocument();
      expect(screen.queryByText("비율제 60%")).not.toBeInTheDocument();
      expect(screen.queryByText("월급제 2,500,000원")).not.toBeInTheDocument();
      expect(screen.getByRole("searchbox", { name: "선생님 검색" })).toHaveAttribute(
        "placeholder",
        "이름, 담당 파트, 연락처",
      );
      // 마스킹 값은 데스크도 본다.
      expect(within(row).getByRole("cell", { name: "900101-1******" })).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "박선생 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });

      expect(within(dialog).queryByText("급여정보")).not.toBeInTheDocument();
      expect(within(dialog).queryByText("비율제 60%")).not.toBeInTheDocument();
      expect(within(dialog).getByText("900101-1******")).toBeInTheDocument();
      expect(within(dialog).queryByRole("button", { name: "원문 보기" })).not.toBeInTheDocument();
    });

    it("등록 폼에는 급여·주민등록번호 입력이 없고 저장하면 급여 항목 없이 전달한다", async () => {
      const user = userEvent.setup();
      const registerTeacher = vi.fn();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        { ...deskProps, registerTeacher },
      );

      await user.click(screen.getByRole("button", { name: "선생님 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });

      expect(within(dialog).queryByLabelText("급여 형태")).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText("월급")).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText("주민등록번호")).not.toBeInTheDocument();

      await user.type(within(dialog).getByLabelText("선생님명"), "홍선생");
      await user.type(within(dialog).getByLabelText("연락처"), "010-9999-0000");
      await user.type(within(dialog).getByLabelText("계약 시작일"), "2026-09-01");
      await user.type(within(dialog).getByLabelText("계약 종료일"), "2027-08-31");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      expect(registerTeacher).toHaveBeenCalledTimes(1);
      const submitted = registerTeacher.mock.calls[0][0];
      expect(submitted).toMatchObject({ name: "홍선생", part: "피아노" });
      for (const key of ["payType", "monthlySalary", "hourlyRate", "ratioAcademyShare", "ratioTeacherShare", "residentRegistration"]) {
        expect(submitted, key).not.toHaveProperty(key);
      }
    });

    it("수정 폼도 급여 항목 없이 전달하고 급여 입력은 보이지 않는다", async () => {
      const user = userEvent.setup();
      const updateTeacher = vi.fn();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        { ...deskProps, updateTeacher },
      );

      await user.click(await screen.findByRole("button", { name: "박선생 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

      expect(within(dialog).queryByLabelText("급여 형태")).not.toBeInTheDocument();
      expect(within(dialog).queryByLabelText("주민등록번호")).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      expect(updateTeacher).toHaveBeenCalledTimes(1);
      expect(updateTeacher.mock.calls[0][0]).not.toHaveProperty("payType");
      expect(updateTeacher.mock.calls[0][0]).not.toHaveProperty("ratioTeacherShare");
    });
  });

  describe("담당 파트 선택", () => {
    it("자유 입력 대신 피아노·바이올린·첼로·플루트·원장 중에서 고르고 기본값은 피아노다", async () => {
      const user = userEvent.setup();
      const registerTeacher = vi.fn();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        { registerTeacher },
      );

      await user.click(screen.getByRole("button", { name: "선생님 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });
      const part = within(dialog).getByLabelText("담당 파트");

      expect(part.tagName).toBe("SELECT");
      expect(part).toHaveValue("피아노");
      expect(within(part).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "피아노", "바이올린", "첼로", "플루트", "원장",
      ]);

      await user.selectOptions(part, "원장");
      await user.type(within(dialog).getByLabelText("선생님명"), "홍선생");
      await user.type(within(dialog).getByLabelText("연락처"), "010-9999-0000");
      await user.type(within(dialog).getByLabelText("계약 시작일"), "2026-09-01");
      await user.type(within(dialog).getByLabelText("계약 종료일"), "2027-08-31");
      await user.type(within(dialog).getByLabelText("월급"), "2500000");
      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      expect(registerTeacher).toHaveBeenCalledWith(expect.objectContaining({ part: "원장" }));
    });

    it("수정할 때 기존 데이터의 목록 밖 파트는 선택지로 남아 선택된 채 유지된다", async () => {
      const user = userEvent.setup();
      const oboe = { ...teacherRows[0], part: "오보에" };

      renderTeacherListScreen((options) => ({
        queryKey: ["teachers", options.academyId],
        queryFn: async () => buildTeacherList([oboe], options),
      }));

      await user.click(await screen.findByRole("button", { name: "박선생 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

      const part = within(dialog).getByLabelText("담당 파트");
      expect(part).toHaveValue("오보에");
      expect(within(part).getAllByRole("option").map((option) => option.textContent)).toEqual([
        "피아노", "바이올린", "첼로", "플루트", "원장", "오보에",
      ]);
    });
  });

  describe("주민등록번호 입력", () => {
    async function openRegistration(props: Partial<ComponentProps<typeof TeacherListScreen>> = {}) {
      const user = userEvent.setup();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        props,
      );
      await user.click(screen.getByRole("button", { name: "선생님 등록" }));
      const dialog = await screen.findByRole("dialog", { name: "선생님 등록" });

      await user.type(within(dialog).getByLabelText("선생님명"), "홍선생");
      await user.type(within(dialog).getByLabelText("연락처"), "010-9999-0000");
      await user.type(within(dialog).getByLabelText("계약 시작일"), "2026-09-01");
      await user.type(within(dialog).getByLabelText("계약 종료일"), "2027-08-31");
      await user.type(within(dialog).getByLabelText("월급"), "2500000");

      return { user, dialog };
    }

    it("숫자만 입력해도 6자리 뒤에 하이픈이 자동으로 붙고 저장할 때 정규화된 번호를 전달한다", async () => {
      const registerTeacher = vi.fn();
      const { user, dialog } = await openRegistration({ registerTeacher });
      const field = within(dialog).getByLabelText("주민등록번호");

      await user.type(field, "9001011234567");

      expect(field).toHaveValue("900101-1234567");

      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      expect(registerTeacher).toHaveBeenCalledWith(
        expect.objectContaining({ residentRegistration: "900101-1234567" }),
      );
    });

    it("입력하지 않으면 선택 항목으로 보고 저장 때 번호를 전달하지 않는다", async () => {
      const registerTeacher = vi.fn();
      const { user, dialog } = await openRegistration({ registerTeacher });

      await user.click(within(dialog).getByRole("button", { name: "저장" }));

      expect(registerTeacher.mock.calls[0][0]).not.toHaveProperty("residentRegistration");
    });

    it("생년월일이나 성별 자리가 잘못되면 이유를 보여 주고 저장하지 못한다", async () => {
      const registerTeacher = vi.fn();
      const { user, dialog } = await openRegistration({ registerTeacher });
      const field = within(dialog).getByLabelText("주민등록번호");

      await user.type(field, "9013011234567");

      expect(field).toBeInvalid();
      expect(within(dialog).getByText("주민등록번호 앞 6자리가 올바른 생년월일이 아닙니다.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();

      await user.clear(field);
      await user.type(field, "9001019234567");

      expect(within(dialog).getByText("주민등록번호 성별 자리(뒤 첫 숫자)는 1~8이어야 합니다.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
      expect(registerTeacher).not.toHaveBeenCalled();
    });

    it("13자리를 채우기 전에는 오류를 띄우지 않고 칸을 벗어나면 형식 안내를 보여 준다", async () => {
      const { user, dialog } = await openRegistration();
      const field = within(dialog).getByLabelText("주민등록번호");

      await user.type(field, "90010");

      expect(within(dialog).queryByText(/숫자 13자리/)).not.toBeInTheDocument();

      await user.tab();

      expect(within(dialog).getByText("주민등록번호는 숫자 13자리(######-#######)로 입력해 주세요.")).toBeInTheDocument();
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeDisabled();
    });

    it("수정 폼은 번호를 비워 두고 현재는 마스킹 값만 안내하며, 비워 두면 번호를 바꾸지 않는다", async () => {
      const user = userEvent.setup();
      const updateTeacher = vi.fn();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        { updateTeacher },
      );

      await user.click(await screen.findByRole("button", { name: "박선생 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

      const field = within(dialog).getByLabelText("주민등록번호");
      expect(field).toHaveValue("");
      expect(within(dialog).getByText("현재 900101-1****** · 바꿀 때만 새로 입력해 주세요.")).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));

      expect(updateTeacher.mock.calls[0][0]).not.toHaveProperty("residentRegistration");
    });
  });

  describe("주민등록번호 원문 보기(원장 전용)", () => {
    async function openDetail(reveal: ReturnType<typeof vi.fn>) {
      const user = userEvent.setup();

      renderTeacherListScreen(
        (options) => ({
          queryKey: ["teachers", options.academyId],
          queryFn: async () => buildTeacherList(teacherRows, options),
        }),
        { revealResidentRegistration: reveal, updateTeacher: vi.fn() },
      );
      await user.click(await screen.findByRole("button", { name: "박선생 자세히보기" }));
      const dialog = await screen.findByRole("dialog", { name: "박선생 상세" });

      return { user, dialog };
    }

    it("확인을 거친 뒤에만 원문을 보여 주고, 숨기면 다시 마스킹 값으로 돌아간다", async () => {
      const reveal = vi.fn().mockResolvedValue("900101-1234567");
      const { user, dialog } = await openDetail(reveal);

      expect(within(dialog).getByText("900101-1******")).toBeInTheDocument();
      expect(within(dialog).queryByText("900101-1234567")).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "원문 보기" }));
      const confirm = await screen.findByRole("alertdialog", { name: "주민등록번호 원문 보기" });
      expect(reveal).not.toHaveBeenCalled();
      expect(within(confirm).getByText(/열람 기록이 남습니다/)).toBeInTheDocument();

      await user.click(within(confirm).getByRole("button", { name: "원문 보기" }));

      expect(await within(dialog).findByText("900101-1234567")).toBeInTheDocument();
      expect(reveal).toHaveBeenCalledWith({ academyId: "academy-1", teacherId: "teacher-1" });
      expect(within(dialog).queryByText("900101-1******")).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "숨기기" }));

      expect(within(dialog).queryByText("900101-1234567")).not.toBeInTheDocument();
      expect(within(dialog).getByText("900101-1******")).toBeInTheDocument();
    });

    it("확인에서 취소하면 원문을 요청하지 않는다", async () => {
      const reveal = vi.fn();
      const { user, dialog } = await openDetail(reveal);

      await user.click(within(dialog).getByRole("button", { name: "원문 보기" }));
      const confirm = await screen.findByRole("alertdialog", { name: "주민등록번호 원문 보기" });
      await user.click(within(confirm).getByRole("button", { name: "취소" }));

      expect(reveal).not.toHaveBeenCalled();
      expect(within(dialog).getByText("900101-1******")).toBeInTheDocument();
    });

    it("상세를 닫았다가 다시 열면 원문은 지워지고 마스킹 값만 보인다", async () => {
      const reveal = vi.fn().mockResolvedValue("900101-1234567");
      const { user, dialog } = await openDetail(reveal);

      await user.click(within(dialog).getByRole("button", { name: "원문 보기" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "원문 보기" }));
      await within(dialog).findByText("900101-1234567");

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "박선생 상세" })).not.toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "박선생 자세히보기" }));
      const reopened = await screen.findByRole("dialog", { name: "박선생 상세" });

      expect(within(reopened).queryByText("900101-1234567")).not.toBeInTheDocument();
      expect(within(reopened).getByText("900101-1******")).toBeInTheDocument();
    });

    it("수정 화면으로 넘어가면 원문을 지우고, 열람 실패는 사용자 문구로 안내한다", async () => {
      const reveal = vi
        .fn()
        .mockResolvedValueOnce("900101-1234567")
        .mockRejectedValueOnce(new Error("주민등록번호 원문을 불러오지 못했습니다: 주민등록번호 암호화 키가 설정되지 않았습니다. 관리자에게 Vault의 teacher_rrn_key 설정을 요청해 주세요."));
      const { user, dialog } = await openDetail(reveal);

      await user.click(within(dialog).getByRole("button", { name: "원문 보기" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "원문 보기" }));
      await within(dialog).findByText("900101-1234567");
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

      expect(within(dialog).queryByText("900101-1234567")).not.toBeInTheDocument();
      expect(screen.queryByText("900101-1234567")).not.toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
      await waitFor(() => expect(within(dialog).queryByRole("button", { name: "수정완료" })).not.toBeInTheDocument());
      await user.click(within(dialog).getByRole("button", { name: "원문 보기" }));
      await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "원문 보기" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("주민등록번호 암호화 키가 설정되지 않았습니다.");
      expect(within(dialog).getByText("900101-1******")).toBeInTheDocument();
    });
  });

  describe("수정 폼 급여 초기값", () => {
    async function openEdit(teacher: TeacherListRow) {
      const user = userEvent.setup();

      renderTeacherListScreen((options) => ({
        queryKey: ["teachers", options.academyId],
        queryFn: async () => buildTeacherList([teacher], options),
      }));
      await user.click(await screen.findByRole("button", { name: `${teacher.name} 자세히보기` }));
      const dialog = await screen.findByRole("dialog", { name: `${teacher.name} 상세` });
      await user.click(within(dialog).getByRole("button", { name: "수정하기" }));

      return { user, dialog };
    }

    it("선생님 몫 0%는 0:10으로 보여 주고 6으로 바꾸지 않는다", async () => {
      const { dialog } = await openEdit({ ...teacherRows[0], ratioTeacherShare: 0, salarySummary: "비율제 0%" });

      expect(within(dialog).getByLabelText("선생님 몫")).toHaveValue(0);
      expect(within(dialog).getByLabelText("학원 몫")).toHaveValue(10);
    });

    it("저장된 비율이 없으면 4:6을 채우지 않고 비워 두어 저장 버튼이 막힌다", async () => {
      const { dialog } = await openEdit({ ...teacherRows[0], ratioTeacherShare: undefined, salarySummary: "급여 미설정" });

      expect(within(dialog).getByLabelText("선생님 몫")).toHaveValue(null);
      expect(within(dialog).getByLabelText("학원 몫")).toHaveValue(null);
      expect(within(dialog).getByRole("button", { name: "수정완료" })).toBeDisabled();
    });

    it("저장된 60%는 4:6으로 그대로 보여 준다", async () => {
      const { dialog } = await openEdit({ ...teacherRows[0], ratioTeacherShare: 60 });

      expect(within(dialog).getByLabelText("선생님 몫")).toHaveValue(6);
      expect(within(dialog).getByLabelText("학원 몫")).toHaveValue(4);
    });
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

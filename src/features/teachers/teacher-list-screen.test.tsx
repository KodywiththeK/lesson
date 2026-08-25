import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { buildTeacherList } from "@/domain/teacher-list";

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

  it("검색어와 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
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
          options.filters?.status ?? "",
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
    await user.selectOptions(screen.getByLabelText("상태 필터"), "on_leave");

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
        status: "on_leave",
      },
    });
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
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});

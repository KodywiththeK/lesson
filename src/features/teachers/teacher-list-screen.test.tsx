import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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
  },
  {
    academyId: "academy-1",
    teacherId: "teacher-2",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "monthly" as const,
  },
];

function renderTeacherListScreen(
  queryOptionsFactory: TeacherListQueryOptionsFactory,
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
      />
    </QueryClientProvider>,
  );
}

describe("TeacherListScreen", () => {
  it("선생님 목록을 표로 보여주고 담당 파트와 급여 형태를 표시한다", async () => {
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
      within(table).getByRole("cell", { name: "비율제" }),
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

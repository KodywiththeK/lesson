import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildStudentList } from "@/domain/student-list";

import {
  StudentListScreen,
  type StudentListQueryOptionsFactory,
} from "./student-list-screen";

const studentRows = [
  {
    academyId: "academy-1",
    studentId: "student-1",
    name: "김민지",
    teacherNames: ["박선생"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월", "수"],
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

function renderStudentListScreen(
  queryOptionsFactory: StudentListQueryOptionsFactory,
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
      />
    </QueryClientProvider>,
  );
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
    await user.selectOptions(
      screen.getByLabelText("선생님 필터"),
      "최선생",
    );
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
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});

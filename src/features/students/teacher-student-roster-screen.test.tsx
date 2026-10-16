import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  buildTeacherStudentRoster,
  type BuildTeacherStudentRosterOptions,
  type TeacherStudentRosterRow,
} from "@/domain/teacher-student-roster";

import { TeacherStudentRosterScreen } from "./teacher-student-roster-screen";

const rows: TeacherStudentRosterRow[] = [
  { academyId: "academy-1", studentId: "s-1", name: "김민지", instrumentNames: ["피아노"], weekdayLabels: ["월", "수"] },
  { academyId: "academy-1", studentId: "s-2", name: "이서윤", instrumentNames: ["바이올린"], weekdayLabels: ["화"] },
];

function renderRoster(
  queryFn: (options: BuildTeacherStudentRosterOptions) => Promise<ReturnType<typeof buildTeacherStudentRoster>>,
) {
  const factory = vi.fn((options: BuildTeacherStudentRosterOptions) => ({
    queryKey: ["roster", options.search ?? "", options.page ?? 1],
    queryFn: () => queryFn(options),
  }));

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TeacherStudentRosterScreen academyId="academy-1" queryOptionsFactory={factory} />
    </QueryClientProvider>,
  );

  return factory;
}

describe("TeacherStudentRosterScreen", () => {
  it("담당 원생의 이름, 악기, 요일만 표로 보여 주고 연락처·수강료 열은 없다", async () => {
    renderRoster(async (options) => buildTeacherStudentRoster(rows, options));

    const table = await screen.findByRole("table", { name: "담당 원생 목록" });

    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "원생",
      "악기",
      "정기 요일",
    ]);
    const row = within(table).getByRole("row", { name: /김민지/ });
    expect(within(row).getByRole("cell", { name: "피아노" })).toBeInTheDocument();
    expect(within(row).getByRole("cell", { name: "월, 수" })).toBeInTheDocument();
    expect(within(row).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "원생",
      "악기",
      "정기 요일",
    ]);
  });

  it("선생님에게는 원생 등록·수정·휴원·퇴원 같은 관리 버튼을 보여 주지 않는다", async () => {
    renderRoster(async (options) => buildTeacherStudentRoster(rows, options));

    await screen.findByRole("table", { name: "담당 원생 목록" });

    expect(screen.queryByRole("button", { name: /등록|수정|휴원|퇴원|삭제/ })).not.toBeInTheDocument();
    expect(screen.getByText("총 2명")).toBeInTheDocument();
  });

  it("검색어를 조회 조건으로 보내고 1페이지부터 다시 보여 준다", async () => {
    const user = userEvent.setup();
    const factory = renderRoster(async (options) => buildTeacherStudentRoster(rows, options));

    await screen.findByRole("table", { name: "담당 원생 목록" });
    await user.type(screen.getByRole("searchbox", { name: "원생 검색" }), "바이올린");

    await waitFor(() => {
      expect(factory).toHaveBeenLastCalledWith(expect.objectContaining({ search: "바이올린", page: 1 }));
    });
    expect(await screen.findByText("이서윤")).toBeInTheDocument();
    expect(screen.queryByText("김민지")).not.toBeInTheDocument();
  });

  it("담당 원생이 없으면 안내 문구를 보여 준다", async () => {
    renderRoster(async (options) => buildTeacherStudentRoster([], options));

    expect(await screen.findByText("담당 원생이 없습니다.")).toBeInTheDocument();
  });

  it("조회에 실패하면 사용자에게 이유를 알려 준다", async () => {
    renderRoster(async () => {
      throw new Error("담당 원생 명단을 불러오지 못했습니다: 선생님 계정으로만 볼 수 있습니다.");
    });

    expect(await screen.findByText("담당 원생 명단을 불러오지 못했습니다.")).toBeInTheDocument();
  });
});

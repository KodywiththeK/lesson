import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  buildStatusManagementList,
  type ManagedStatus,
  type StatusManagementRow,
} from "@/domain/status-management";

import {
  StatusManagementScreen,
  type StatusManagementScreenProps,
} from "./status-management-screen";

type StudentQueryOptions = Parameters<
  NonNullable<StatusManagementScreenProps["studentQueryOptionsFactory"]>
>[0];
type TeacherQueryOptions = Parameters<
  NonNullable<StatusManagementScreenProps["teacherQueryOptionsFactory"]>
>[0];

function buildRows(
  entityType: "student" | "teacher",
  status: ManagedStatus,
  count: number,
  label: string,
): StatusManagementRow[] {
  return Array.from({ length: count }, (_, index) => {
    const serial = String(index + 1).padStart(2, "0");

    return {
      academyId: "academy-1",
      entityType,
      entityId: `${entityType}-${status}-${serial}`,
      name: `${label}${serial}`,
      status,
      changedAt: "2026-09-01T00:00:00+09:00",
      statusReason: "개인 사정",
    };
  });
}

const rows: StatusManagementRow[] = [
  ...buildRows("student", "suspended", 25, "휴원생"),
  ...buildRows("student", "withdrawn", 2, "퇴원생"),
  ...buildRows("teacher", "on_leave", 12, "휴직쌤"),
  ...buildRows("teacher", "resigned", 1, "퇴사쌤"),
];

type Gate = (
  kind: "student" | "teacher",
  options: StudentQueryOptions | TeacherQueryOptions,
) => Promise<void> | undefined;

function createDeferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { promise, release };
}

function renderStatusManagementScreen(gate?: Gate) {
  const seenStudentOptions: StudentQueryOptions[] = [];
  const seenTeacherOptions: TeacherQueryOptions[] = [];
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <StatusManagementScreen
        academyId="academy-1"
        academyName="더 클래식"
        studentQueryOptionsFactory={(options) => {
          seenStudentOptions.push(options);

          return {
            queryKey: [
              "status",
              "student",
              options.status,
              options.search ?? "",
              options.page ?? 1,
              options.pageSize ?? 10,
            ],
            queryFn: async () => {
              await gate?.("student", options);

              return buildStatusManagementList(rows, { ...options, entityType: "student" });
            },
          };
        }}
        teacherQueryOptionsFactory={(options) => {
          seenTeacherOptions.push(options);

          return {
            queryKey: [
              "status",
              "teacher",
              options.status,
              options.search ?? "",
              options.page ?? 1,
              options.pageSize ?? 10,
            ],
            queryFn: async () => {
              await gate?.("teacher", options);

              return buildStatusManagementList(rows, { ...options, entityType: "teacher" });
            },
          };
        }}
      />
    </QueryClientProvider>,
  );

  return { seenStudentOptions, seenTeacherOptions };
}

describe("StatusManagementScreen", () => {
  it("휴원 원생이 10명을 넘으면 총 인원과 페이지 번호로 다음 페이지를 볼 수 있다", async () => {
    const user = userEvent.setup();
    const { seenStudentOptions } = renderStatusManagementScreen();

    const table = await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });
    expect(screen.getByText("총 25명")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByText("휴원생01")).toBeInTheDocument();
    expect(within(table).queryByText("휴원생11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "2페이지" }));

    expect(await within(table).findByText("휴원생11")).toBeInTheDocument();
    expect(within(table).queryByText("휴원생01")).not.toBeInTheDocument();
    expect(seenStudentOptions.at(-1)).toMatchObject({
      status: "suspended",
      page: 2,
      pageSize: 10,
    });
  });

  it("이름 검색어를 조회 조건으로 보내고 1페이지부터 다시 보여준다", async () => {
    const user = userEvent.setup();
    const { seenStudentOptions } = renderStatusManagementScreen();

    await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });
    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByText("휴원생11");

    await user.type(screen.getByRole("searchbox", { name: "이름 검색" }), "휴원생2");

    expect(seenStudentOptions.at(-1)).toMatchObject({ search: "휴원생2", page: 1 });
    expect(await screen.findByText("휴원생20")).toBeInTheDocument();
    expect(screen.queryByText("휴원생01")).not.toBeInTheDocument();
    expect(screen.getByText("총 6명")).toBeInTheDocument();
  });

  it("검색 결과가 없어도 안내 문구와 함께 총 0명과 페이지 이동 영역을 보여준다", async () => {
    const user = userEvent.setup();
    renderStatusManagementScreen();

    await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });
    await user.type(screen.getByRole("searchbox", { name: "이름 검색" }), "없는이름");

    expect(
      await screen.findByText("조건에 맞는 원생이 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("총 0명")).toBeInTheDocument();
    expect(screen.getByLabelText("페이지당 원생 수")).toBeInTheDocument();
  });

  it("휴원과 퇴원 탭을 바꾸면 1페이지에서 다시 조회한다", async () => {
    const user = userEvent.setup();
    const { seenStudentOptions } = renderStatusManagementScreen();

    await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByText("휴원생21");

    await user.click(screen.getByRole("tab", { name: "퇴원" }));

    expect(await screen.findByText("퇴원생01")).toBeInTheDocument();
    expect(seenStudentOptions.at(-1)).toMatchObject({ status: "withdrawn", page: 1 });
    expect(screen.getByText("총 2명")).toBeInTheDocument();
  });

  it("선생님 탭에서는 선생님 기준 인원 수와 페이지당 개수를 고른다", async () => {
    const user = userEvent.setup();
    const { seenTeacherOptions } = renderStatusManagementScreen();

    await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });
    await user.click(screen.getByRole("button", { name: "2페이지" }));
    await screen.findByText("휴원생11");
    await user.click(screen.getByRole("tab", { name: "선생님" }));

    expect(await screen.findByText("휴직쌤01")).toBeInTheDocument();
    expect(seenTeacherOptions.at(-1)).toMatchObject({ status: "on_leave", page: 1 });
    expect(screen.getByText("총 12명")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("페이지당 선생님 수"), "20");

    expect(await screen.findByText("휴직쌤12")).toBeInTheDocument();
    expect(seenTeacherOptions.at(-1)).toMatchObject({ pageSize: 20, page: 1 });
  });

  it("페이지를 넘기는 동안에는 이전 목록과 페이지 이동 영역을 유지한다", async () => {
    const user = userEvent.setup();
    const secondPage = createDeferred();
    renderStatusManagementScreen((kind, options) =>
      kind === "student" && options.page === 2 ? secondPage.promise : undefined,
    );

    await screen.findByText("휴원생01");
    await user.click(screen.getByRole("button", { name: "2페이지" }));

    expect(screen.getByText("휴원생01")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeInTheDocument();

    await act(async () => secondPage.release());

    expect(await screen.findByText("휴원생11")).toBeInTheDocument();
  });

  it("다른 탭으로 바꾸면 이전 탭의 목록 대신 불러오는 중임을 알려준다", async () => {
    const user = userEvent.setup();
    const teacherList = createDeferred();
    renderStatusManagementScreen((kind) =>
      kind === "teacher" ? teacherList.promise : undefined,
    );

    await screen.findByText("휴원생01");
    await user.click(screen.getByRole("tab", { name: "선생님" }));

    expect(screen.getByText("관리 목록을 불러오는 중입니다.")).toBeInTheDocument();
    expect(screen.queryByText("휴원생01")).not.toBeInTheDocument();

    await act(async () => teacherList.release());

    expect(await screen.findByText("휴직쌤01")).toBeInTheDocument();
  });

  it("이미 자동으로 다시 불러오므로 별도 새로고침 버튼은 두지 않는다", async () => {
    renderStatusManagementScreen();

    await screen.findByRole("table", { name: "휴원/퇴원 관리 목록" });

    expect(screen.queryByRole("button", { name: "새로고침" })).not.toBeInTheDocument();
  });
});

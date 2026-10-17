import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStudentList, type StudentListRow } from "@/domain/student-list";
import { queryKeys } from "@/lib/api/query-keys";

import { StudentListScreen } from "./student-list-screen";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => {
    throw new Error("테스트에서는 Supabase client를 쓰지 않는다.");
  },
}));

const ACADEMY_ID = "academy-1";

function row(studentId: string, name: string, status = "enrolled"): StudentListRow {
  return {
    academyId: ACADEMY_ID,
    studentId,
    name,
    registeredOn: "2026-08-01",
    status,
    teacherNames: ["박선생"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월"],
    instruments: [
      {
        studentInstrumentId: `${studentId}-instrument`,
        teacherId: "teacher-1",
        teacherName: "박선생",
        instrumentId: "piano",
        instrumentName: "피아노",
        lessonType: "academy",
        weekdayLabels: ["월"],
        startTime: "15:00",
        endTime: "15:50",
        progress: "체르니 100",
        lessonFee: 150000,
        discountTotal: 10000,
        finalMonthlyFee: 140000,
        active: true,
      },
    ],
  };
}

// 서버 데이터를 테스트가 바꿀 수 있게 queryFn이 매번 이 변수를 읽는다.
let serverRows: StudentListRow[];
let queryClient: QueryClient;

function renderScreen(updateStudent: (input: unknown) => Promise<undefined> = async () => undefined) {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <StudentListScreen
        academyId={ACADEMY_ID}
        academyName="더 클래식"
        teachers={[
          {
            academyId: ACADEMY_ID,
            teacherId: "teacher-1",
            name: "박선생",
            part: "피아노",
            contact: "010-1111-1111",
            registeredAt: "2026-08-01",
            payType: "monthly",
          },
        ]}
        updateStudent={updateStudent}
        updateStudentStatus={async () => undefined}
        queryOptionsFactory={(options) => ({
          queryKey: queryKeys.students.list(ACADEMY_ID, { q: options.search }),
          queryFn: async () => buildStudentList(serverRows, options),
        })}
      />
    </QueryClientProvider>,
  );
}

async function openDetail(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `${name} 자세히보기` }));

  return screen.findByRole("dialog", { name: `${name} 원생 상세` });
}

async function renameInEditForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  name: string,
) {
  await user.click(within(dialog).getByRole("button", { name: "수정하기" }));
  await user.clear(within(dialog).getByLabelText("원생명"));
  await user.type(within(dialog).getByLabelText("원생명"), name);
  await user.click(within(dialog).getByRole("button", { name: "수정완료" }));
}

async function refetchStudents() {
  await act(() => queryClient.invalidateQueries({ queryKey: [...queryKeys.academy(ACADEMY_ID), "students"] }));
}

beforeEach(() => {
  serverRows = [row("student-1", "김민지"), row("student-2", "이서윤")];
});

describe("원생 목록의 저장 직후 반영과 서버 재조회", () => {
  it("수정에 성공하면 재조회 결과가 같아도 수정한 모습을 유지한다", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openDetail(user, "김민지");

    await renameInEditForm(user, dialog, "김민주");

    expect(await screen.findByRole("cell", { name: "김민주" })).toBeInTheDocument();
    await refetchStudents();
    expect(screen.getByRole("cell", { name: "김민주" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "김민지" })).not.toBeInTheDocument();
  });

  it("저장 직후 재조회가 다른 값을 주면 서버 값으로 바꾼다", async () => {
    const user = userEvent.setup();
    renderScreen(async () => {
      serverRows = [row("student-1", "김민주(서버 정리)"), serverRows[1]];

      return undefined;
    });
    const dialog = await openDetail(user, "김민지");

    await renameInEditForm(user, dialog, "김민주");

    expect(await screen.findByRole("cell", { name: "김민주(서버 정리)" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "김민주" })).not.toBeInTheDocument();
  });

  it("저장한 뒤 다른 사용자가 바꾼 값은 다음 재조회에서 서버 값이 우선한다", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openDetail(user, "김민지");

    await renameInEditForm(user, dialog, "김민주");
    expect(await screen.findByRole("cell", { name: "김민주" })).toBeInTheDocument();

    serverRows = [row("student-1", "김민주(다른 사용자)"), serverRows[1]];
    await refetchStudents();

    expect(await screen.findByRole("cell", { name: "김민주(다른 사용자)" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "김민주" })).not.toBeInTheDocument();
  });

  it("열려 있는 상세 창도 낡은 스냅샷 대신 현재 목록의 행을 보여 준다", async () => {
    const user = userEvent.setup();
    renderScreen();
    await openDetail(user, "김민지");

    serverRows = [row("student-1", "김민지(다른 사용자 수정)"), serverRows[1]];
    await refetchStudents();

    expect(
      await screen.findByRole("dialog", { name: "김민지(다른 사용자 수정) 원생 상세" }),
    ).toBeInTheDocument();
  });

  it("현재 목록에 없는 원생의 상세 창은 열 때의 스냅샷을 유지한다", async () => {
    const user = userEvent.setup();
    renderScreen();
    await openDetail(user, "김민지");

    serverRows = [serverRows[1]];
    await refetchStudents();

    await waitFor(() =>
      expect(screen.queryByRole("cell", { name: "김민지" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog", { name: "김민지 원생 상세" })).toBeInTheDocument();
  });

  it("상태를 바꾸면 바로 반영하고 다른 사용자가 다시 바꾸면 서버 상태를 따른다", async () => {
    const user = userEvent.setup();
    renderScreen();
    const dialog = await openDetail(user, "김민지");
    const statusValue = () => within(dialog).getByText("상태").nextElementSibling;

    await user.click(within(dialog).getByRole("button", { name: "휴원" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "상태 변경 확인" })).getByRole("button", {
        name: "처리",
      }),
    );

    await waitFor(() => expect(statusValue()).toHaveTextContent("휴원"));
    await refetchStudents();
    expect(statusValue()).toHaveTextContent("휴원");

    serverRows = [row("student-1", "김민지", "withdrawn"), serverRows[1]];
    await refetchStudents();

    await waitFor(() => expect(statusValue()).toHaveTextContent("퇴원"));
  });
});

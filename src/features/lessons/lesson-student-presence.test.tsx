import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentPresenceRecord } from "@/domain/student-presence";
import type { StudentPresenceSupabaseClient } from "@/lib/api/student-presence";

import { LessonStudentPresence } from "./lesson-student-presence";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const roster: StudentPresenceRecord[] = [
  {
    studentId: "student-1",
    studentName: "김민지",
    lessonKinds: ["academy"],
    firstStartAt: "2026-11-14T15:00:00+09:00",
    arrivedAt: null,
    leftAt: null,
  },
];

function renderContainer(props: Partial<React.ComponentProps<typeof LessonStudentPresence>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <LessonStudentPresence
          academyId="academy-1"
          date="2026-11-14"
          canManage
          client={null}
          localRoster={roster}
          {...props}
        />
      </QueryClientProvider>,
    ),
  };
}

describe("LessonStudentPresence", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-14T06:02:00Z"));
    vi.mocked(toast.error).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("저장소 없이 화면 안에서만 유지하는 데모 상태", () => {
    it("등원과 하원을 누르면 지금 시각이 기록되고 상태가 바뀐다", async () => {
      const { user } = renderContainer();

      await user.click(screen.getByRole("button", { name: "김민지 등원" }));
      expect(screen.getByText("학원에 있음")).toBeInTheDocument();
      expect(screen.getByText("등원 15:02")).toBeInTheDocument();

      vi.setSystemTime(new Date("2026-11-14T07:40:00Z"));
      await user.click(screen.getByRole("button", { name: "김민지 하원" }));
      expect(screen.getByText("등원 15:02 · 하원 16:40")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "김민지 하원 취소" }));
      expect(screen.getByText("학원에 있음")).toBeInTheDocument();
    });

    it("오늘이 아닌 날짜에는 기록 버튼이 없다", () => {
      renderContainer({ date: "2026-11-13" });

      expect(screen.queryByRole("button", { name: /등원|하원/ })).not.toBeInTheDocument();
    });
  });

  describe("서버(RPC) 연결", () => {
    function createClient(rows: unknown[]) {
      const rpc = vi.fn(async (name: string) =>
        name === "list_daily_student_presence" ? { data: rows, error: null } : { data: null, error: null },
      );

      return { client: { rpc } as unknown as StudentPresenceSupabaseClient, rpc };
    }

    const serverRow = {
      student_id: "student-1",
      student_name: "김민지",
      lesson_kinds: ["private"],
      first_starts_at: "2026-11-14T06:00:00+00:00",
      arrived_at: null,
      left_at: null,
    };

    it("그날 현황을 불러와 보여 주고 등원을 누르면 RPC로 기록한 뒤 다시 불러온다", async () => {
      const { client, rpc } = createClient([serverRow]);
      const { user } = renderContainer({ client, localRoster: undefined });

      expect(await screen.findByText("김민지")).toBeInTheDocument();
      expect(rpc).toHaveBeenCalledWith("list_daily_student_presence", { p_academy_id: "academy-1", p_date: "2026-11-14" });

      await user.click(screen.getByRole("button", { name: "김민지 등원" }));

      await waitFor(() =>
        expect(rpc).toHaveBeenCalledWith("record_student_presence", {
          p_academy_id: "academy-1",
          p_student_id: "student-1",
          p_date: "2026-11-14",
          p_action: "arrive",
        }),
      );
      await waitFor(() =>
        expect(rpc.mock.calls.filter(([name]) => name === "list_daily_student_presence")).toHaveLength(2),
      );
    });

    it("선생님(관리 권한 없음)은 서버에서 받은 담당 원생을 읽기 전용으로 본다", async () => {
      const { client } = createClient([serverRow]);
      renderContainer({ client, canManage: false, localRoster: undefined });

      expect(await screen.findByText("김민지")).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("기록에 실패하면 이유를 알린다", async () => {
      const rpc = vi.fn(async (name: string) =>
        name === "list_daily_student_presence"
          ? { data: [serverRow], error: null }
          : { data: null, error: new Error("등원을 먼저 기록해 주세요.") },
      );
      const { user } = renderContainer({ client: { rpc } as unknown as StudentPresenceSupabaseClient, localRoster: undefined });

      await user.click(await screen.findByRole("button", { name: "김민지 등원" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("등하원 기록에 실패했습니다.", {
          description: "등원을 먼저 기록해 주세요.",
        }),
      );
    });

    it("데모가 아닌데 저장소에 연결하지 못하면 화면 안 기록으로 넘어가지 않고 알린다", async () => {
      renderContainer({ client: null, localRoster: undefined });

      expect(await screen.findByRole("alert")).toHaveTextContent("등하원 저장소에 연결하지 못했습니다");
      expect(screen.queryByRole("button", { name: /등원/ })).not.toBeInTheDocument();
    });

    it("현황을 불러오지 못하면 알린다", async () => {
      const rpc = vi.fn(async () => ({ data: null, error: new Error("로그인이 필요합니다.") }));
      renderContainer({ client: { rpc } as unknown as StudentPresenceSupabaseClient, localRoster: undefined });

      expect(await screen.findByRole("alert")).toHaveTextContent("등하원 현황을 불러오지 못했습니다");
    });
  });
});

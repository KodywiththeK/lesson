import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../providers";
import StudentsPage from "./page";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ rpc }),
}));

vi.mock("@/features/auth/academy-session-gate", () => ({
  useAcademySessionControls: () => null,
  AcademySessionGate: ({
    children,
  }: {
    children: (context: unknown) => React.ReactNode;
  }) =>
    children({
      academyId: "academy-1",
      academyName: "더 클래식",
      permissionContext: { role: "teacher", teacherId: "teacher-1", assignedStudentIds: [] },
    }),
}));

describe("StudentsPage 선생님 계정", () => {
  it("선생님에게는 담당 원생의 이름·악기·요일만 읽기 전용으로 보여 주고 등록·수정 버튼을 숨긴다", async () => {
    rpc.mockResolvedValue({
      data: [
        { student_id: "s-1", student_name: "김민지", instrument_names: ["피아노"], weekdays: ["월", "수"] },
      ],
      error: null,
    });
    window.history.pushState(null, "", "/management/students");

    render(
      <AppProviders>
        <StudentsPage />
      </AppProviders>,
    );

    expect(await screen.findByRole("table", { name: "담당 원생 목록" })).toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("list_students_for_teacher", { p_academy_id: "academy-1" });
    expect(screen.getByText("김민지")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원생 등록" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /자세히보기/ })).not.toBeInTheDocument();
  });
});

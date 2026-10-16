import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import {
  AcademyLessonAttendanceScreen,
  type DailyAcademyLessonAttendanceQueryFactory,
} from "./academy-lesson-attendance-screen";

function renderAcademyLessonAttendanceScreen(
  attendanceQueryFactory: DailyAcademyLessonAttendanceQueryFactory,
  markAttendance?: ComponentProps<
    typeof AcademyLessonAttendanceScreen
  >["markAttendance"],
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
      <AcademyLessonAttendanceScreen
        academyId="academy-1"
        academyName="더 클래식"
        attendanceQueryFactory={attendanceQueryFactory}
        markAttendance={markAttendance}
      />
    </QueryClientProvider>,
  );
}

const dailySheet = {
  academyId: "academy-1",
  date: "2026-08-21",
  rows: [
    {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      date: "2026-08-21",
      startTime: "15:00",
      endTime: "15:50",
      status: "pending" as const,
    },
    {
      academyId: "academy-1",
      lessonEventId: "lesson-2",
      studentId: "student-2",
      studentName: "이서윤",
      instrumentId: "piano",
      instrumentName: "피아노",
      date: "2026-08-21",
      startTime: "16:00",
      endTime: "16:50",
      status: "pending" as const,
    },
  ],
  absenceQueue: [],
  summary: {
    total: 2,
    present: 0,
    absent: 0,
    pending: 2,
  },
};

describe("AcademyLessonAttendanceScreen", () => {
  it("날짜 선택 후 출석 확인 모달에서 예상 출석 원생을 보여준다", async () => {
    const user = userEvent.setup();

    renderAcademyLessonAttendanceScreen((options) => ({
      queryKey: ["daily-attendance", options.academyId, options.date],
      queryFn: async () => dailySheet,
    }));

    await user.clear(screen.getByLabelText("출석 날짜"));
    await user.type(screen.getByLabelText("출석 날짜"), "2026-08-21");
    await user.click(screen.getByRole("button", { name: "출석 확인" }));

    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    expect(within(dialog).getByText("김민지")).toBeInTheDocument();
    expect(within(dialog).getByText("이서윤")).toBeInTheDocument();
    expect(within(dialog).getByText("대기 2")).toBeInTheDocument();
    const attendanceRow = within(dialog).getByRole("row", { name: /김민지/ });
    expect(within(attendanceRow).getAllByRole("cell").map((cell) => cell.getAttribute("data-label"))).toEqual([
      "시간", "원생", "악기", "상태", "처리",
    ]);
    expect(
      within(dialog).getByRole("button", { name: "전체 출석" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "전체 결석" }),
    ).toBeInTheDocument();
  });

  it("전체 출석과 개별 결석 처리를 mutation으로 전달한다", async () => {
    const user = userEvent.setup();
    const submissions: Array<Record<string, unknown>> = [];

    renderAcademyLessonAttendanceScreen(
      (options) => ({
        queryKey: ["daily-attendance", options.academyId, options.date],
        queryFn: async () => dailySheet,
      }),
      async (input) => {
        submissions.push(input);
      },
    );

    await user.clear(screen.getByLabelText("출석 날짜"));
    await user.type(screen.getByLabelText("출석 날짜"), "2026-08-21");
    await user.click(screen.getByRole("button", { name: "출석 확인" }));

    const dialog = await screen.findByRole("dialog", {
      name: "2026-08-21 출석 확인",
    });

    await user.click(within(dialog).getByRole("button", { name: "전체 출석" }));

    await waitFor(() => {
      expect(submissions[0]).toMatchObject({
        academyId: "academy-1",
        records: [
          {
            lessonEventId: "lesson-1",
            studentId: "student-1",
            status: "present",
          },
          {
            lessonEventId: "lesson-2",
            studentId: "student-2",
            status: "present",
          },
        ],
      });
    });

    await user.click(
      within(dialog).getByRole("button", { name: "김민지 결석" }),
    );

    await waitFor(() => {
      expect(submissions[1]).toMatchObject({
        academyId: "academy-1",
        records: [
          {
            lessonEventId: "lesson-1",
            studentId: "student-1",
            status: "absent",
            reason: "결석 확인",
          },
        ],
      });
    });
  });
});

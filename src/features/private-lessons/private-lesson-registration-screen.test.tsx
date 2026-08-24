import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import {
  PrivateLessonRegistrationScreen,
  type PrivateLessonRegistrationOptionsQueryFactory,
} from "./private-lesson-registration-screen";

function renderPrivateLessonRegistrationScreen(
  registrationOptionsQueryFactory: PrivateLessonRegistrationOptionsQueryFactory,
  registerPrivateLesson?: ComponentProps<
    typeof PrivateLessonRegistrationScreen
  >["registerPrivateLesson"],
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
      <PrivateLessonRegistrationScreen
        academyId="academy-1"
        academyName="더 클래식"
        registrationOptionsQueryFactory={registrationOptionsQueryFactory}
        registerPrivateLesson={registerPrivateLesson}
      />
    </QueryClientProvider>,
  );
}

describe("PrivateLessonRegistrationScreen", () => {
  it("개인레슨 등록 다이얼로그를 원생, 악기, 선생님, 시간 순서로 보여준다", async () => {
    const user = userEvent.setup();

    renderPrivateLessonRegistrationScreen((academyId) => ({
      queryKey: ["private-lesson-registration-options", academyId],
      queryFn: async () => ({
        students: [
          {
            studentId: "student-1",
            studentName: "김민지",
            instruments: [
              {
                studentInstrumentId: "student-instrument-1",
                instrumentId: "piano",
                instrumentName: "피아노",
              },
            ],
          },
        ],
        teachers: [
          {
            teacherId: "teacher-1",
            teacherName: "박선생",
            part: "피아노",
          },
        ],
      }),
    }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));

    const dialog = await screen.findByRole("dialog", {
      name: "개인레슨 등록",
    });

    const steps = within(dialog).getByRole("list", {
      name: "개인레슨 등록 단계",
    });

    expect(within(steps).getByText("원생")).toBeInTheDocument();
    expect(within(steps).getByText("악기")).toBeInTheDocument();
    expect(within(steps).getByText("선생님")).toBeInTheDocument();
    expect(within(steps).getByText("시간")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");

    expect(within(dialog).getByLabelText("악기")).toBeEnabled();
    expect(within(dialog).getByLabelText("악기")).toHaveValue("piano");
    expect(within(dialog).getByLabelText("선생님")).toBeEnabled();
  });

  it("원생을 선택하면 해당 원생의 첫 악기를 자동 선택한다", async () => {
    const user = userEvent.setup();

    renderPrivateLessonRegistrationScreen((academyId) => ({
      queryKey: ["private-lesson-registration-options", academyId],
      queryFn: async () => ({
        students: [
          {
            studentId: "student-1",
            studentName: "김민지",
            instruments: [
              {
                studentInstrumentId: "student-instrument-1",
                instrumentId: "piano",
                instrumentName: "피아노",
              },
              {
                studentInstrumentId: "student-instrument-2",
                instrumentId: "violin",
                instrumentName: "바이올린",
              },
            ],
          },
          {
            studentId: "student-2",
            studentName: "이서윤",
            instruments: [
              {
                studentInstrumentId: "student-instrument-3",
                instrumentId: "cello",
                instrumentName: "첼로",
              },
            ],
          },
        ],
        teachers: [
          {
            teacherId: "teacher-1",
            teacherName: "박선생",
            part: "피아노",
          },
        ],
      }),
    }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const dialog = await screen.findByRole("dialog", {
      name: "개인레슨 등록",
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("piano");

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("cello");
  });

  it("개인레슨 등록 폼 입력을 mutation으로 전달한다", async () => {
    const user = userEvent.setup();
    const registrations: Array<Record<string, unknown>> = [];

    renderPrivateLessonRegistrationScreen(
      (academyId) => ({
        queryKey: ["private-lesson-registration-options", academyId],
        queryFn: async () => ({
          students: [
            {
              studentId: "student-1",
              studentName: "김민지",
              instruments: [
                {
                  studentInstrumentId: "student-instrument-1",
                  instrumentId: "piano",
                  instrumentName: "피아노",
                },
              ],
            },
          ],
          teachers: [
            {
              teacherId: "teacher-1",
              teacherName: "박선생",
              part: "피아노",
            },
          ],
        }),
      }),
      async (input) => {
        registrations.push(input);

        return {
          id: "lesson-new",
          academyId: input.academyId,
          studentId: input.studentId,
          studentName: input.studentName,
          instrumentId: input.instrumentId,
          instrumentName: input.instrumentName,
          teacherId: input.teacherId,
          teacherName: input.teacherName,
          startAt: input.startAt,
          endAt: input.endAt,
          status: "scheduled",
        };
      },
    );

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));

    const dialog = await screen.findByRole("dialog", {
      name: "개인레슨 등록",
    });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.selectOptions(within(dialog).getByLabelText("악기"), "piano");
    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-1");
    await user.type(within(dialog).getByLabelText("시작 시간"), "2026-08-21T15:00");
    await user.type(within(dialog).getByLabelText("종료 시간"), "2026-08-21T15:50");
    await user.click(within(dialog).getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(registrations).toEqual([
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          studentInstrumentId: "student-instrument-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          startAt: "2026-08-21T15:00:00+09:00",
          endAt: "2026-08-21T15:50:00+09:00",
        },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "개인레슨 등록" })).toBeNull();
  });
});

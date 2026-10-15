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
  ticketBalances?: ComponentProps<
    typeof PrivateLessonRegistrationScreen
  >["ticketBalances"],
  extraProps: Partial<ComponentProps<typeof PrivateLessonRegistrationScreen>> = {},
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
        ticketBalances={ticketBalances}
        {...extraProps}
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
      name: "레슨 일정 등록",
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

  it("원생의 악기가 하나일 때만 악기를 자동 선택하고 여러 개면 직접 고르게 한다", async () => {
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
      name: "레슨 일정 등록",
    });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("");

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("cello");
  });

  it("원생을 고르면 그 악기의 담당 선생님이 기본 선생님으로 선택된다", async () => {
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
                teacherId: "teacher-2",
              },
            ],
          },
          {
            studentId: "student-2",
            studentName: "이서윤",
            instruments: [
              {
                studentInstrumentId: "student-instrument-2",
                instrumentId: "violin",
                instrumentName: "바이올린",
              },
            ],
          },
        ],
        teachers: [
          { teacherId: "teacher-1", teacherName: "박선생", part: "피아노" },
          { teacherId: "teacher-2", teacherName: "최선생", part: "피아노" },
          { teacherId: "teacher-3", teacherName: "오유진", part: "바이올린" },
        ],
      }),
    }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "레슨 일정 등록" });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("선생님")).toHaveValue("teacher-2");

    // 담당 선생님 정보가 없으면 같은 파트 선생님이 한 명일 때만 기본 선택
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("선생님")).toHaveValue("teacher-3");
  });

  it("악기를 바꾸면 그 악기에 맞는 선생님으로 기본값이 다시 정해진다", async () => {
    const user = userEvent.setup();

    renderPrivateLessonRegistrationScreen((academyId) => ({
      queryKey: ["private-lesson-registration-options", academyId],
      queryFn: async () => ({
        students: [
          {
            studentId: "student-1",
            studentName: "김민지",
            instruments: [
              { studentInstrumentId: "si-1", instrumentId: "piano", instrumentName: "피아노" },
              { studentInstrumentId: "si-2", instrumentId: "violin", instrumentName: "바이올린" },
            ],
          },
        ],
        teachers: [
          { teacherId: "teacher-1", teacherName: "박선생", part: "피아노" },
          { teacherId: "teacher-3", teacherName: "오유진", part: "바이올린" },
        ],
      }),
    }));

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "레슨 일정 등록" });

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("선생님")).toHaveValue("");

    await user.selectOptions(within(dialog).getByLabelText("악기"), "violin");
    expect(within(dialog).getByLabelText("선생님")).toHaveValue("teacher-3");
  });

  it("개인레슨 회차권 원생은 등록 모달에서 잔여 회차권을 확인한다", async () => {
    const user = userEvent.setup();

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
            {
              studentId: "student-2",
              studentName: "이서윤",
              instruments: [
                {
                  studentInstrumentId: "student-instrument-2",
                  instrumentId: "violin",
                  instrumentName: "바이올린",
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
      undefined,
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 3,
        },
      ],
    );

    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));

    const dialog = await screen.findByRole("dialog", {
      name: "레슨 일정 등록",
    });
    expect(
      within(dialog).getByRole("option", { name: "김민지 · 피아노 3회" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("option", { name: "이서윤 · 회차권 없음" }),
    ).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");

    expect(within(dialog).getByText("선택 악기 잔여 회차권 3회")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "사용할 수 있는 회차권이 없습니다.",
    );
    expect(within(dialog).getByRole("status")).toHaveTextContent("회차권 메뉴에서 먼저 등록해 주세요");
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
      name: "레슨 일정 등록",
    });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await user.selectOptions(within(dialog).getByLabelText("악기"), "piano");
    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-1");
    await user.type(within(dialog).getByLabelText("날짜"), "2026-08-21");
    await user.type(within(dialog).getByLabelText("시작 시간"), "15:00");
    await user.click(within(dialog).getByRole("button", { name: "완료" }));

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
          // 원생의 레슨 길이 기본 30분
          endAt: "2026-08-21T15:30:00+09:00",
        },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "레슨 일정 등록" })).toBeNull();
  });
});

describe("레슨 일정 등록 폼 (명세 3.3)", () => {
  const lessonOptions = {
    students: [
      {
        studentId: "student-2",
        studentName: "이서윤",
        instruments: [
          {
            studentInstrumentId: "si-2",
            instrumentId: "violin",
            instrumentName: "바이올린",
            lessonMinutes: 40,
          },
        ],
      },
      {
        studentId: "student-1",
        studentName: "가은",
        instruments: [
          {
            studentInstrumentId: "si-1",
            instrumentId: "piano",
            instrumentName: "피아노",
          },
        ],
      },
    ],
    teachers: [
      { teacherId: "teacher-1", teacherName: "박선생", part: "피아노" },
      { teacherId: "teacher-2", teacherName: "오유진", part: "바이올린" },
      { teacherId: "teacher-3", teacherName: "김첼로", part: "첼로" },
    ],
  };
  const optionsFactory: PrivateLessonRegistrationOptionsQueryFactory = (academyId) => ({
    queryKey: ["private-lesson-registration-options", academyId],
    queryFn: async () => lessonOptions,
  });

  async function openDialog(
    user: ReturnType<typeof userEvent.setup>,
    extraProps: Partial<ComponentProps<typeof PrivateLessonRegistrationScreen>> = {},
    register?: ComponentProps<typeof PrivateLessonRegistrationScreen>["registerPrivateLesson"],
  ) {
    renderPrivateLessonRegistrationScreen(optionsFactory, register, undefined, extraProps);
    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    return screen.findByRole("dialog", { name: "레슨 일정 등록" });
  }

  it("취소와 완료 버튼을 보여 주고 원생은 가나다순으로 고른다", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    expect(within(dialog).getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "저장" })).toBeNull();
    await waitFor(() =>
      expect(
        within(within(dialog).getByLabelText("원생")).getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["원생 선택", "가은", "이서윤"]),
    );

    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog", { name: "레슨 일정 등록" })).toBeNull();
  });

  it("등록할 수 있는 원생이 하나도 없으면 등록된 원생 없음으로 알리고 선택하지 못하게 한다", async () => {
    const user = userEvent.setup();
    renderPrivateLessonRegistrationScreen((academyId) => ({
      queryKey: ["private-lesson-registration-options", academyId],
      queryFn: async () => ({ students: [], teachers: [] }),
    }));
    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "레슨 일정 등록" });

    await waitFor(() =>
      expect(within(dialog).getByRole("option", { name: "등록된 원생 없음" })).toBeInTheDocument(),
    );
    expect(within(dialog).getByLabelText("원생")).toBeDisabled();
  });

  it("담당 선생님은 선택한 악기의 파트 선생님만 보여 주고 미배정 선택지는 없다", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await user.selectOptions(await within(dialog).findByLabelText("원생"), "student-2");

    const teacherOptions = within(within(dialog).getByLabelText("선생님")).getAllByRole("option");
    expect(teacherOptions.map((option) => option.textContent)).toEqual(["선생님 선택", "오유진 / 바이올린"]);
    expect(within(dialog).queryByText(/미배정/)).toBeNull();
    expect(within(dialog).queryByText("이 악기를 담당하는 선생님이 없어 전체 선생님을 보여 줍니다.")).toBeNull();
  });

  it("해당 악기를 담당하는 선생님이 없으면 전체 선생님을 보여 주고 안내한다", async () => {
    const user = userEvent.setup();
    renderPrivateLessonRegistrationScreen((academyId) => ({
      queryKey: ["private-lesson-registration-options", academyId],
      queryFn: async () => ({
        students: [
          {
            studentId: "student-3",
            studentName: "최도윤",
            instruments: [{ studentInstrumentId: "si-3", instrumentId: "flute", instrumentName: "플루트" }],
          },
        ],
        teachers: lessonOptions.teachers,
      }),
    }));
    await user.click(screen.getByRole("button", { name: "개인레슨 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "레슨 일정 등록" });

    await user.selectOptions(await within(dialog).findByLabelText("원생"), "student-3");

    expect(
      within(dialog).getByText("이 악기를 담당하는 선생님이 없어 전체 선생님을 보여 줍니다."),
    ).toBeInTheDocument();
    expect(within(within(dialog).getByLabelText("선생님")).getAllByRole("option")).toHaveLength(4);
  });

  it("원생의 레슨 길이로 종료 시간을 계산해 읽기 전용으로 보여 주고 길이를 고칠 수 있다", async () => {
    const user = userEvent.setup();
    const registrations: Array<Record<string, unknown>> = [];
    const dialog = await openDialog(user, {}, async (input) => {
      registrations.push(input);
      return { ...input, id: "new", status: "scheduled" };
    });

    await user.selectOptions(await within(dialog).findByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("레슨 시간(분)")).toHaveValue(40);
    expect(within(dialog).getByLabelText("종료 시간")).toHaveAttribute("readonly");

    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-2");
    await user.type(within(dialog).getByLabelText("날짜"), "2026-08-21");
    await user.type(within(dialog).getByLabelText("시작 시간"), "15:00");
    expect(within(dialog).getByLabelText("종료 시간")).toHaveValue("15:40");

    await user.clear(within(dialog).getByLabelText("레슨 시간(분)"));
    await user.type(within(dialog).getByLabelText("레슨 시간(분)"), "50");
    expect(within(dialog).getByLabelText("종료 시간")).toHaveValue("15:50");

    await user.click(within(dialog).getByRole("button", { name: "완료" }));

    await waitFor(() =>
      expect(registrations).toEqual([
        expect.objectContaining({
          startAt: "2026-08-21T15:00:00+09:00",
          endAt: "2026-08-21T15:50:00+09:00",
        }),
      ]),
    );
  });

  it("레슨 길이가 올바르지 않으면 완료할 수 없다", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user);

    await user.selectOptions(await within(dialog).findByLabelText("원생"), "student-2");
    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-2");
    await user.type(within(dialog).getByLabelText("날짜"), "2026-08-21");
    await user.type(within(dialog).getByLabelText("시작 시간"), "15:00");
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeEnabled();

    await user.clear(within(dialog).getByLabelText("레슨 시간(분)"));

    expect(within(dialog).getByRole("button", { name: "완료" })).toBeDisabled();
  });

  it("같은 선생님의 시간대가 겹치면 바로 경고하고 완료를 막고, 겹치지 않으면 풀린다", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, {
      existingLessons: [
        {
          id: "lesson-existing",
          academyId: "academy-1",
          studentId: "student-9",
          studentName: "한서아",
          instrumentId: "violin",
          instrumentName: "바이올린",
          teacherId: "teacher-2",
          teacherName: "오유진",
          startAt: "2026-08-21T15:00:00+09:00",
          endAt: "2026-08-21T15:40:00+09:00",
          status: "scheduled",
        },
      ],
    });

    await user.selectOptions(await within(dialog).findByLabelText("원생"), "student-2");
    await user.selectOptions(within(dialog).getByLabelText("선생님"), "teacher-2");
    await user.type(within(dialog).getByLabelText("날짜"), "2026-08-21");
    await user.type(within(dialog).getByLabelText("시작 시간"), "15:20");

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "이미 같은 시간대에 한서아 원생 레슨이 있습니다.",
    );
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText("시작 시간"));
    await user.type(within(dialog).getByLabelText("시작 시간"), "15:40");

    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "완료" })).toBeEnabled();
  });

  it("초기 날짜를 받으면 날짜 칸을 미리 채워 연다", async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, { initialDate: "2026-08-24" });

    expect(within(dialog).getByLabelText("날짜")).toHaveValue("2026-08-24");
  });

  it("바깥에서 열림 상태를 제어하는 dialog 모드는 등록 버튼 없이 다이얼로그만 보여 준다", async () => {
    const user = userEvent.setup();
    const closed: boolean[] = [];

    renderPrivateLessonRegistrationScreen(optionsFactory, undefined, undefined, {
      displayMode: "dialog",
      open: true,
      onOpenChange: (next) => closed.push(next),
      initialDate: "2026-08-24",
    });

    const dialog = await screen.findByRole("dialog", { name: "레슨 일정 등록" });
    expect(screen.queryByRole("button", { name: "개인레슨 등록" })).toBeNull();
    expect(within(dialog).getByLabelText("날짜")).toHaveValue("2026-08-24");

    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(closed).toEqual([false]);
  });
});

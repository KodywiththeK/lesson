import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { expectWholeWonInput } from "@/test/expect-whole-won-input";

import {
  buildLessonTicketList,
  type LessonTicketListItem,
} from "@/domain/lesson-ticket";

import {
  LessonTicketListScreen,
  type LessonTicketListQueryOptionsFactory,
  type LessonTicketRegistrationOptionsQueryFactory,
} from "./lesson-ticket-list-screen";

const lessonTickets: LessonTicketListItem[] = [
  {
    academyId: "academy-1",
    ticketId: "ticket-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    totalGrantedCount: 12,
    remainingCount: 2,
    validFrom: "2026-08-01",
    validUntil: "2026-09-07",
    registeredAt: "2026-08-01",
  },
  {
    academyId: "academy-1",
    ticketId: "ticket-2",
    studentId: "student-2",
    studentName: "이서윤",
    instrumentId: "violin",
    instrumentName: "바이올린",
    totalGrantedCount: 8,
    remainingCount: 8,
    validFrom: "2026-08-01",
    validUntil: "2026-10-31",
    registeredAt: "2026-08-01",
  },
];

function renderLessonTicketListScreen(
  queryOptionsFactory: LessonTicketListQueryOptionsFactory,
  registrationOptionsQueryFactory?: LessonTicketRegistrationOptionsQueryFactory,
  registerLessonTicket?: ComponentProps<
    typeof LessonTicketListScreen
  >["registerLessonTicket"],
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
      <LessonTicketListScreen
        academyId="academy-1"
        academyName="더 클래식"
        today="2026-09-01"
        queryOptionsFactory={queryOptionsFactory}
        registrationOptionsQueryFactory={registrationOptionsQueryFactory}
        registerLessonTicket={registerLessonTicket}
      />
    </QueryClientProvider>,
  );
}

// 원생01~원생25. 앞 15명은 피아노, 나머지는 바이올린. 원생05부터는 잔여 2회로 잔여 부족 상태다.
const manyLessonTickets: LessonTicketListItem[] = Array.from({ length: 25 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  const isPiano = index < 15;

  return {
    academyId: "academy-1",
    ticketId: `ticket-${number}`,
    studentId: `student-${number}`,
    studentName: `원생${number}`,
    instrumentId: isPiano ? "piano" : "violin",
    instrumentName: isPiano ? "피아노" : "바이올린",
    totalGrantedCount: 12,
    remainingCount: index >= 4 ? 2 : 8,
    validFrom: "2026-08-01",
    validUntil: "2026-12-31",
    registeredAt: "2026-08-01",
  };
});

const pagedQueryOptionsFactory: LessonTicketListQueryOptionsFactory = (options) => ({
  queryKey: [
    "lesson-tickets",
    options.academyId,
    options.search ?? "",
    options.filters?.status ?? "",
    options.page ?? "",
    options.pageSize ?? "",
  ],
  queryFn: async () => buildLessonTicketList(manyLessonTickets, options),
});

describe("LessonTicketListScreen", () => {
  it("회차권 목록을 표로 보여주고 원생, 악기, 총/잔여 회수, 유효기간, 상태를 표시한다", async () => {
    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId, options.search ?? ""],
      queryFn: async () => buildLessonTicketList(lessonTickets, options),
    }));

    const table = await screen.findByRole("table", { name: "회차권 목록" });
    expect(within(table).getByRole("cell", { name: "김민지" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "피아노" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "12회" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "2회" })).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "2026-08-01 ~ 2026-09-07" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("cell", { name: "잔여 부족 만료 임박" }),
    ).toBeInTheDocument();
  });

  it("검색어와 상태 필터 변경을 TanStack Query 입력으로 반영한다", async () => {
    const user = userEvent.setup();
    const seenOptions: Parameters<LessonTicketListQueryOptionsFactory>[0][] =
      [];

    renderLessonTicketListScreen((options) => {
      seenOptions.push(options);

      return {
        queryKey: [
          "lesson-tickets",
          options.academyId,
          options.search ?? "",
          options.filters?.status ?? "",
        ],
        queryFn: async () => buildLessonTicketList(lessonTickets, options),
      };
    });

    await screen.findByRole("cell", { name: "김민지" });

    await user.type(
      screen.getByRole("searchbox", { name: "회차권 검색" }),
      "피아노",
    );
    await user.selectOptions(screen.getByLabelText("회차권 상태 필터"), "low-remaining");

    expect(await screen.findByRole("cell", { name: "김민지" })).toBeInTheDocument();
    expect(
      screen.queryByRole("cell", { name: "이서윤" }),
    ).not.toBeInTheDocument();
    expect(seenOptions.at(-1)).toMatchObject({
      academyId: "academy-1",
      search: "피아노",
      filters: {
        status: "low-remaining",
      },
    });
  });

  it("Supabase 오류가 나면 화면에서 확인 가능한 오류 상태를 보여준다", async () => {
    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId, "error"],
      queryFn: async () => {
        throw new Error("permission denied");
      },
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "회차권 목록을 불러오지 못했습니다.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 작업을 할 권한이 없습니다. 원장에게 문의해 주세요.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("permission denied");
  });

  it("회차권 결제 금액은 1원 단위 양의 정수를 제출 검증으로 허용한다", async () => {
    const user = userEvent.setup();

    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId],
      queryFn: async () => buildLessonTicketList(lessonTickets, options),
    }));

    await user.click(screen.getByRole("button", { name: "회차권 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });

    expectWholeWonInput(within(dialog).getByRole("spinbutton", { name: "결제 금액" }));
  });

  it("회차권 등록 폼은 등록일·유효 시작일을 오늘로 채우고 악기가 하나면 자동 선택한다", async () => {
    const user = userEvent.setup();

    renderLessonTicketListScreen(
      (options) => ({
        queryKey: ["lesson-tickets", options.academyId],
        queryFn: async () => buildLessonTicketList(lessonTickets, options),
      }),
      (academyId) => ({
        queryKey: ["lesson-ticket-registration-options", academyId],
        queryFn: async () => [
          {
            studentId: "student-1",
            studentName: "김민지",
            instruments: [{ instrumentId: "piano", instrumentName: "피아노" }],
          },
          {
            studentId: "student-2",
            studentName: "한서아",
            instruments: [
              { instrumentId: "violin", instrumentName: "바이올린" },
              { instrumentId: "cello", instrumentName: "첼로" },
            ],
          },
        ],
      }),
    );

    await user.click(screen.getByRole("button", { name: "회차권 등록" }));
    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });
    await within(dialog).findByRole("option", { name: "김민지" });

    expect(within(dialog).getByLabelText("등록일")).toHaveValue("2026-09-01");
    expect(within(dialog).getByLabelText("유효 시작일")).toHaveValue("2026-09-01");
    expect(within(dialog).getByLabelText("유효 만료일")).toHaveValue("");

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("piano");

    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-2");
    expect(within(dialog).getByLabelText("악기")).toHaveValue("");
  });

  it("회차권 등록 다이얼로그에서 원생과 악기를 선택해 등록 mutation을 실행한다", async () => {
    const user = userEvent.setup();
    const registrations: Array<Record<string, unknown>> = [];

    renderLessonTicketListScreen(
      (options) => ({
        queryKey: ["lesson-tickets", options.academyId],
        queryFn: async () => buildLessonTicketList(lessonTickets, options),
      }),
      (academyId) => ({
        queryKey: ["lesson-ticket-registration-options", academyId],
        queryFn: async () => [
          {
            studentId: "student-1",
            studentName: "김민지",
            instruments: [
              {
                instrumentId: "piano",
                instrumentName: "피아노",
              },
            ],
          },
        ],
      }),
      async (input) => {
        registrations.push(input);

        return {
          ticket: {
            academyId: input.academyId,
            ticketId: "ticket-3",
            studentId: input.studentId,
            studentName: input.studentName,
            instrumentId: input.instrumentId,
            instrumentName: input.instrumentName,
            totalGrantedCount: input.grantedCount,
            remainingCount: input.grantedCount,
            validFrom: input.validFrom,
            validUntil: input.validUntil,
            registeredAt: input.registeredAt,
          },
          event: {
            type: "created-new-ticket",
            addedCount: input.grantedCount,
            nextValidUntil: input.validUntil,
          },
        };
      },
    );

    await user.click(screen.getByRole("button", { name: "회차권 등록" }));

    const dialog = await screen.findByRole("dialog", { name: "회차권 등록" });
    await within(dialog).findByRole("option", { name: "김민지" });
    await user.selectOptions(within(dialog).getByLabelText("원생"), "student-1");
    await within(dialog).findByRole("option", { name: "피아노" });
    await user.selectOptions(within(dialog).getByLabelText("악기"), "piano");
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "부여 회수" }), {
      target: { value: "10" },
    });
    fireEvent.change(within(dialog).getByRole("spinbutton", { name: "결제 금액" }), {
      target: { value: "150000" },
    });
    fireEvent.change(within(dialog).getByLabelText("유효 시작일"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(within(dialog).getByLabelText("유효 만료일"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.change(within(dialog).getByLabelText("등록일"), {
      target: { value: "2026-09-01" },
    });
    await waitFor(() => {
      expect(within(dialog).getByRole("button", { name: "저장" })).toBeEnabled();
    });
    fireEvent.submit(
      within(dialog).getByRole("form", { name: "회차권 등록 입력" }),
    );

    await waitFor(() => {
      expect(registrations).toEqual([
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          grantedCount: 10,
          validFrom: "2026-09-01",
          validUntil: "2026-10-31",
          registeredAt: "2026-09-01",
          paidAmount: 150000,
        },
      ]);
    });
    expect(screen.queryByRole("dialog", { name: "회차권 등록" })).toBeNull();
  });
});

describe("LessonTicketListScreen 페이지 이동", () => {
  it("총 회차권 개수와 페이지당 개수 선택을 항상 보여주고 10개씩 표시한다", async () => {
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    const table = await screen.findByRole("table", { name: "회차권 목록" });

    expect(screen.getByText("총 25개")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(11);
    expect(within(table).getByRole("cell", { name: "원생10" })).toBeInTheDocument();
    expect(within(table).queryByRole("cell", { name: "원생11" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "페이지당 회차권 수" })).toHaveValue("10");
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("회차권이 10개 이하여도 총 개수와 페이지 이동을 보여준다", async () => {
    renderLessonTicketListScreen((options) => ({
      queryKey: ["lesson-tickets", options.academyId, options.page ?? ""],
      queryFn: async () => buildLessonTicketList(lessonTickets, options),
    }));

    await screen.findByRole("table", { name: "회차권 목록" });

    expect(screen.getByText("총 2개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("다음 페이지로 이동하면 11번째 회차권부터 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));

    expect(await screen.findByRole("cell", { name: "원생11" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생01" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("페이지당 20개를 고르면 1페이지로 돌아가 20개를 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByRole("combobox", { name: "페이지당 회차권 수" }), "20");

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "원생20" })).toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: "원생21" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("검색하면 1페이지로 돌아가 검색 결과의 첫 회차권부터 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.type(screen.getByRole("searchbox", { name: "회차권 검색" }), "피아노");

    expect(await screen.findByText("총 15개")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("상태 필터를 바꾸면 1페이지로 돌아간다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "3페이지" }));
    await screen.findByRole("cell", { name: "원생21" });
    await user.selectOptions(screen.getByLabelText("회차권 상태 필터"), "low-remaining");

    expect(await screen.findByText("총 21개")).toBeInTheDocument();
    expect(await screen.findByRole("cell", { name: "원생05" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("초기화하면 1페이지로 돌아가 전체 회차권을 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.click(screen.getByRole("button", { name: "다음 페이지" }));
    await screen.findByRole("cell", { name: "원생11" });
    await user.click(screen.getByRole("button", { name: "초기화" }));

    expect(await screen.findByRole("cell", { name: "원생01" })).toBeInTheDocument();
    expect(screen.getByText("총 25개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1페이지" })).toHaveAttribute("aria-current", "page");
  });

  it("조건에 맞는 회차권이 없어도 총 0개를 보여준다", async () => {
    const user = userEvent.setup();
    renderLessonTicketListScreen(pagedQueryOptionsFactory);

    await screen.findByRole("cell", { name: "원생01" });
    await user.type(screen.getByRole("searchbox", { name: "회차권 검색" }), "없는이름");

    expect(await screen.findByText("조건에 맞는 회차권이 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("총 0개")).toBeInTheDocument();
  });
});

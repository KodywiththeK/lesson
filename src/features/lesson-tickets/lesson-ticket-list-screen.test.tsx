import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  buildLessonTicketList,
  type LessonTicketListItem,
} from "@/domain/lesson-ticket";

import {
  LessonTicketListScreen,
  type LessonTicketListQueryOptionsFactory,
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
      />
    </QueryClientProvider>,
  );
}

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
    expect(screen.getByRole("alert")).toHaveTextContent("permission denied");
  });
});

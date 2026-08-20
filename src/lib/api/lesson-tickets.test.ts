import { describe, expect, it } from "vitest";

import {
  createLessonTicketListQueryOptions,
  fetchLessonTicketList,
  type LessonTicketGrantSupabaseRow,
  type LessonTicketListSupabaseClient,
} from "./lesson-tickets";

function createSupabaseStub(
  rows: LessonTicketGrantSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: LessonTicketListSupabaseClient = {
    from(table) {
      calls.push({ table });

      return {
        select(select) {
          calls[calls.length - 1].select = select;

          return {
            async eq(column, value) {
              calls[calls.length - 1].eq = [column, value];

              return {
                data: error ? null : rows,
                error,
              };
            },
          };
        },
      };
    },
  };

  return { client, calls };
}

describe("fetchLessonTicketList", () => {
  it("Supabase 회차권 row를 목록으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "ticket-1",
        academy_id: "academy-1",
        student_id: "student-1",
        instrument_id: "piano",
        instrument_name: "피아노",
        total_granted_count: 12,
        remaining_count: 2,
        valid_from: "2026-08-01",
        valid_until: "2026-09-07",
        registered_at: "2026-08-01",
        students: {
          name: "김민지",
        },
      },
    ]);

    const result = await fetchLessonTicketList(client, {
      academyId: "academy-1",
      today: "2026-09-01",
      lowRemainingThreshold: 2,
      expiringWithinDays: 7,
      search: "피아노",
    });

    expect(calls).toEqual([
      {
        table: "lesson_ticket_grants",
        select:
          "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, students(name)",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result[0]).toMatchObject({
      academyId: "academy-1",
      ticketId: "ticket-1",
      studentName: "김민지",
      instrumentName: "피아노",
      statuses: ["low-remaining", "expiring-soon"],
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchLessonTicketList(client, {
        academyId: "academy-1",
        today: "2026-09-01",
        lowRemainingThreshold: 2,
        expiringWithinDays: 7,
      }),
    ).rejects.toThrow("회차권 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("createLessonTicketListQueryOptions", () => {
  it("학원 범위와 검색/상태 필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createLessonTicketListQueryOptions(client, {
      academyId: "academy-1",
      today: "2026-09-01",
      lowRemainingThreshold: 2,
      expiringWithinDays: 7,
      search: "피아노",
      filters: {
        status: "low-remaining",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "lesson-tickets",
      "list",
      "피아노",
      "low-remaining",
    ]);
    await expect(options.queryFn()).resolves.toEqual([]);
  });
});

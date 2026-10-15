import { describe, expect, it } from "vitest";

import {
  createLessonTicketListQueryKey,
  createLessonTicketListQueryOptions,
  fetchAllLessonTickets,
  fetchLessonTicketRegistrationOptions,
  fetchLessonTicketList,
  registerLessonTicketGrant,
  type LessonTicketGrantRegistrationSupabaseClient,
  type LessonTicketGrantSupabaseRow,
  type LessonTicketListSupabaseClient,
} from "./lesson-tickets";

function createGrantRow(
  overrides: Partial<LessonTicketGrantSupabaseRow> = {},
): LessonTicketGrantSupabaseRow {
  return {
    id: "ticket-1",
    academy_id: "academy-1",
    student_id: "student-1",
    instrument_id: "piano",
    instrument_name: "피아노",
    total_granted_count: 12,
    remaining_count: 8,
    valid_from: "2026-08-01",
    valid_until: "2026-12-31",
    registered_at: "2026-08-01",
    students: { name: "김민지" },
    ...overrides,
  };
}

function createGrantRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");

    return createGrantRow({
      id: `ticket-${number}`,
      student_id: `student-${number}`,
      students: { name: `원생${number}` },
    });
  });
}

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
          "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, paid_amount, paid_at, students!lesson_ticket_grants_academy_student_fk(name)",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      ticketId: "ticket-1",
      studentName: "김민지",
      instrumentName: "피아노",
      statuses: ["low-remaining", "expiring-soon"],
    });
  });

  it("조회한 회차권을 페이지로 나눠 총 건수와 함께 돌려준다", async () => {
    const { client } = createSupabaseStub(createGrantRows(25));

    const result = await fetchLessonTicketList(client, {
      academyId: "academy-1",
      today: "2026-09-01",
      lowRemainingThreshold: 2,
      expiringWithinDays: 7,
      page: 3,
      pageSize: 10,
    });

    expect(result.items.map((row) => row.studentName)).toEqual([
      "원생21",
      "원생22",
      "원생23",
      "원생24",
      "원생25",
    ]);
    expect(result).toMatchObject({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3 });
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
      "",
      "",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({ items: [], totalItems: 0 });
  });

  it("페이지와 페이지당 개수가 바뀌면 다른 queryKey를 만든다", () => {
    const { client } = createSupabaseStub([]);
    const baseOptions = {
      academyId: "academy-1",
      today: "2026-09-01",
      lowRemainingThreshold: 2,
      expiringWithinDays: 7,
    };

    const secondPage = createLessonTicketListQueryOptions(client, { ...baseOptions, page: 2, pageSize: 20 });
    const firstPage = createLessonTicketListQueryOptions(client, { ...baseOptions, page: 1, pageSize: 20 });

    expect(secondPage.queryKey.slice(-2)).toEqual(["2", "20"]);
    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(createLessonTicketListQueryKey({ ...baseOptions, page: 2, pageSize: 20 })).toEqual(
      secondPage.queryKey,
    );
  });
});

describe("fetchAllLessonTickets", () => {
  it("재무 집계처럼 페이지로 자르면 안 되는 곳을 위해 학원의 회차권 전체를 돌려준다", async () => {
    const { client, calls } = createSupabaseStub(createGrantRows(25));

    const tickets = await fetchAllLessonTickets(client, "academy-1");

    expect(tickets).toHaveLength(25);
    expect(tickets[0]).toMatchObject({ ticketId: "ticket-01", studentName: "원생01" });
    expect(calls[0].eq).toEqual(["academy_id", "academy-1"]);
  });

  it("조회 오류는 회차권 목록을 불러오지 못했다는 오류로 바꾼다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(fetchAllLessonTickets(client, "academy-1")).rejects.toThrow(
      "회차권 목록을 불러오지 못했습니다: permission denied",
    );
  });
});

describe("fetchLessonTicketRegistrationOptions", () => {
  it("원생과 활성 개인레슨 악기를 회차권 등록 선택지로 만든다", async () => {
    const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
      [];
    const client = {
      from(table: "students") {
        calls.push({ table });

        return {
          select(select: string) {
            calls[calls.length - 1].select = select;

            return {
              async eq(column: "academy_id", value: string) {
                calls[calls.length - 1].eq = [column, value];

                return {
                  data: [
                    {
                      id: "student-1",
                      academy_id: "academy-1",
                      name: "김민지",
                      student_instruments: [
                        {
                          instrument_id: "piano",
                          instrument_name: "피아노",
                          lesson_type: "private",
                          active: true,
                        },
                        {
                          instrument_id: "cello",
                          instrument_name: "첼로",
                          lesson_type: "private",
                          active: false,
                        },
                        {
                          instrument_id: "academy-piano",
                          instrument_name: "학원 피아노",
                          lesson_type: "academy",
                          active: true,
                        },
                      ],
                    },
                  ],
                  error: null,
                };
              },
            };
          },
        };
      },
    };

    const result = await fetchLessonTicketRegistrationOptions(
      client,
      "academy-1",
    );

    expect(calls).toEqual([
      {
        table: "students",
        select:
          "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(instrument_id, instrument_name, lesson_type, active)",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result).toEqual([
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
    ]);
  });
});

describe("fetchLessonTicketRegistrationOptions 정렬", () => {
  it("등록할 원생 선택지를 이름 가나다순으로 준다", async () => {
    const client = {
      from() {
        return {
          select() {
            return {
              async eq() {
                return {
                  data: ["한서아", "원생10", "김민지", "원생2"].map((name, index) => ({
                    id: `student-${index}`,
                    academy_id: "academy-1",
                    name,
                    student_instruments: [],
                  })),
                  error: null,
                };
              },
            };
          },
        };
      },
    };

    const result = await fetchLessonTicketRegistrationOptions(client, "academy-1");

    expect(result.map((option) => option.studentName)).toEqual(["김민지", "원생2", "원생10", "한서아"]);
  });
});

describe("registerLessonTicketGrant", () => {
  it("기존 회차권이 있으면 회수와 유효기간을 병합해 update한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      from(table: "lesson_ticket_grants" | "ledger_entries") {
        calls.push({ table });

        if (table === "ledger_entries") {
          return {
            async insert(values: Record<string, unknown>) {
              calls[calls.length - 1].insert = values;

              return {
                data: null,
                error: null,
              };
            },
          };
        }

        return {
          select(select: string) {
            calls[calls.length - 1].select = select;

            return createExistingTicketLookup(calls, [
              {
                id: "ticket-1",
                academy_id: "academy-1",
                student_id: "student-1",
                instrument_id: "piano",
                instrument_name: "피아노",
                total_granted_count: 12,
                remaining_count: 3,
                valid_from: "2026-08-01",
                valid_until: "2026-09-30",
                registered_at: "2026-08-01",
                students: {
                  name: "김민지",
                },
              },
            ]);
          },
          update(values: Record<string, unknown>) {
            calls[calls.length - 1].update = values;

            return createPersistedTicketResult(calls, {
              id: "ticket-1",
              academy_id: "academy-1",
              student_id: "student-1",
              instrument_id: "piano",
              instrument_name: "피아노",
              total_granted_count: 22,
              remaining_count: 13,
              valid_from: "2026-10-01",
              valid_until: "2026-11-30",
              registered_at: "2026-09-20",
              students: {
                name: "김민지",
              },
            });
          },
          insert() {
            throw new Error("insert should not be called");
          },
        };
      },
    } as unknown as LessonTicketGrantRegistrationSupabaseClient;

    const result = await registerLessonTicketGrant(client, {
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      grantedCount: 10,
      validFrom: "2026-10-01",
      validUntil: "2026-11-30",
      registeredAt: "2026-09-20",
    });

    expect(calls).toMatchObject([
      {
        table: "lesson_ticket_grants",
        select:
          "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, paid_amount, paid_at, students!lesson_ticket_grants_academy_student_fk(name)",
        eq: [
          ["academy_id", "academy-1"],
          ["student_id", "student-1"],
          ["instrument_id", "piano"],
        ],
        order: ["valid_until", { ascending: false }],
        limit: 1,
      },
      {
        table: "lesson_ticket_grants",
        update: {
          total_granted_count: 22,
          remaining_count: 13,
          valid_from: "2026-10-01",
          valid_until: "2026-11-30",
          registered_at: "2026-09-20",
          instrument_name: "피아노",
          paid_amount: 0,
          paid_at: null,
        },
        eq: [["id", "ticket-1"]],
      },
    ]);
    expect(result.ticket).toMatchObject({
      ticketId: "ticket-1",
      totalGrantedCount: 22,
      remainingCount: 13,
      validUntil: "2026-11-30",
    });
    expect(result.event.type).toBe("merged-existing-ticket");
  });

  it("기존 회차권이 없으면 새 회차권을 insert한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      from(table: "lesson_ticket_grants" | "ledger_entries") {
        calls.push({ table });

        if (table === "ledger_entries") {
          return {
            async insert(values: Record<string, unknown>) {
              calls[calls.length - 1].insert = values;

              return {
                data: null,
                error: null,
              };
            },
          };
        }

        return {
          select(select: string) {
            calls[calls.length - 1].select = select;

            return createExistingTicketLookup(calls, []);
          },
          update() {
            throw new Error("update should not be called");
          },
          insert(values: Record<string, unknown>) {
            calls[calls.length - 1].insert = values;

            return createPersistedTicketResult(calls, {
              id: "ticket-2",
              academy_id: "academy-1",
              student_id: "student-2",
              instrument_id: "violin",
              instrument_name: "바이올린",
              total_granted_count: 8,
              remaining_count: 8,
              valid_from: "2026-09-01",
              valid_until: "2026-10-31",
              registered_at: "2026-09-01",
              paid_amount: 160000,
              paid_at: "2026-09-01",
              students: {
                name: "이서윤",
              },
            });
          },
        };
      },
    } as unknown as LessonTicketGrantRegistrationSupabaseClient;

    const result = await registerLessonTicketGrant(client, {
      academyId: "academy-1",
      studentId: "student-2",
      studentName: "이서윤",
      instrumentId: "violin",
      instrumentName: "바이올린",
      grantedCount: 8,
      validFrom: "2026-09-01",
      validUntil: "2026-10-31",
      registeredAt: "2026-09-01",
      paidAmount: 160000,
    });

    expect(calls[1]).toMatchObject({
      table: "lesson_ticket_grants",
      insert: {
        academy_id: "academy-1",
        student_id: "student-2",
        instrument_id: "violin",
        instrument_name: "바이올린",
        total_granted_count: 8,
        remaining_count: 8,
        valid_from: "2026-09-01",
        valid_until: "2026-10-31",
        registered_at: "2026-09-01",
        paid_amount: 160000,
        paid_at: "2026-09-01",
      },
    });
    expect(calls[2]).toMatchObject({
      table: "ledger_entries",
      insert: {
        academy_id: "academy-1",
        occurred_on: "2026-09-01",
        entry_type: "income",
        source: "lesson-ticket",
        amount: 160000,
        description: "이서윤 바이올린 회차권 8회 구매",
        ref_id: "ticket-2",
      },
    });
    expect(result.event.type).toBe("created-new-ticket");
  });
});

function createExistingTicketLookup(
  calls: Array<Record<string, unknown>>,
  rows: LessonTicketGrantSupabaseRow[],
) {
  return {
    eq(column: string, value: string) {
      const latestCall = calls[calls.length - 1];
      latestCall.eq = [...((latestCall.eq as unknown[]) ?? []), [column, value]];

      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      calls[calls.length - 1].order = [column, options];

      return this;
    },
    async limit(count: number) {
      calls[calls.length - 1].limit = count;

      return {
        data: rows,
        error: null,
      };
    },
  };
}

function createPersistedTicketResult(
  calls: Array<Record<string, unknown>>,
  row: LessonTicketGrantSupabaseRow,
) {
  return {
    eq(column: string, value: string) {
      const latestCall = calls[calls.length - 1];
      latestCall.eq = [...((latestCall.eq as unknown[]) ?? []), [column, value]];

      return this;
    },
    select(select: string) {
      calls[calls.length - 1].select = select;

      return this;
    },
    async single() {
      return {
        data: row,
        error: null,
      };
    },
  };
}

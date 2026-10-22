import { describe, expect, it } from "vitest";

import {
  createLessonTicketListQueryKey,
  createLessonTicketListQueryOptions,
  fetchAllLessonTickets,
  fetchLessonTicketRegistrationOptions,
  fetchLessonTicketList,
  fetchAssignedLessonTicketBalances,
  adjustLessonTicket,
  deleteLessonTicket,
  getLessonTicketRefundPreview,
  registerLessonTicket,
  type AdjustLessonTicketSupabaseClient,
  type DeleteLessonTicketSupabaseClient,
  type LessonTicketRefundPreviewSupabaseClient,
  type LessonTicketGrantSupabaseRow,
  type LessonTicketListSupabaseClient,
  type LessonTicketRegistrationOptionsSupabaseClient,
  type RegisterLessonTicketSupabaseClient,
} from "./lesson-tickets";
import { createFakeSupabase } from "./test-support/fake-supabase";

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
  const fake = createFakeSupabase(
    { lesson_ticket_grants: rows },
    error ? { errors: { lesson_ticket_grants: error } } : {},
  );

  return {
    client: fake.client as unknown as LessonTicketListSupabaseClient,
    calls: fake.queries,
  };
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
      search: "피아노",
    });

    expect(calls).toEqual([
      expect.objectContaining({
        table: "lesson_ticket_grants",
        select:
          "id, academy_id, student_id, instrument_id, instrument_name, total_granted_count, remaining_count, valid_from, valid_until, registered_at, students!lesson_ticket_grants_academy_student_fk(name)",
        eq: [["academy_id", "academy-1"]],
        order: [["id", undefined]],
        range: [[0, 999]],
      }),
    ]);
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      ticketId: "ticket-1",
      studentName: "김민지",
      instrumentName: "피아노",
      statuses: ["low-remaining"],
    });
  });

  it("조회한 회차권을 페이지로 나눠 총 건수와 함께 돌려준다", async () => {
    const { client } = createSupabaseStub(createGrantRows(25));

    const result = await fetchLessonTicketList(client, {
      academyId: "academy-1",
      today: "2026-09-01",
      lowRemainingThreshold: 2,
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
      "2026-09-01",
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
    };

    const secondPage = createLessonTicketListQueryOptions(client, { ...baseOptions, page: 2, pageSize: 20 });
    const firstPage = createLessonTicketListQueryOptions(client, { ...baseOptions, page: 1, pageSize: 20 });

    expect(secondPage.queryKey.slice(-2)).toEqual(["2", "20"]);
    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(createLessonTicketListQueryKey({ ...baseOptions, page: 2, pageSize: 20 })).toEqual(
      secondPage.queryKey,
    );
  });

  it("서울 날짜가 바뀌면 상태 목록을 새로 조회한다", () => {
    const base = { academyId: "academy-1", today: "2026-09-01", lowRemainingThreshold: 2 };
    expect(createLessonTicketListQueryKey(base)).not.toEqual(
      createLessonTicketListQueryKey({ ...base, today: "2026-09-02" }),
    );
  });
});

describe("fetchAllLessonTickets", () => {
  it("재무 집계처럼 페이지로 자르면 안 되는 곳을 위해 학원의 회차권 전체를 돌려준다", async () => {
    const { client, calls } = createSupabaseStub(createGrantRows(25));

    const tickets = await fetchAllLessonTickets(client, "academy-1");

    expect(tickets).toHaveLength(25);
    expect(tickets[0]).toMatchObject({ ticketId: "ticket-01", studentName: "원생01" });
    expect(calls[0].eq).toEqual([["academy_id", "academy-1"]]);
  });

  it("1000건을 넘는 회차권도 id순으로 range를 이어 끝까지 읽는다", async () => {
    const { client, calls } = createSupabaseStub(createGrantRows(1200));

    await expect(fetchAllLessonTickets(client, "academy-1")).resolves.toHaveLength(1200);
    expect(calls.map((call) => call.range[0])).toEqual([[0, 999], [1000, 1999]]);
    expect(calls.every((call) => call.order[0]?.[0] === "id")).toBe(true);
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
    const { client, queries } = createFakeSupabase({
      students: [
        {
          id: "student-1",
          academy_id: "academy-1",
          name: "김민지",
          student_instruments: [
            { instrument_id: "piano", instrument_name: "피아노", lesson_type: "private", active: true },
            { instrument_id: "cello", instrument_name: "첼로", lesson_type: "private", active: false },
            { instrument_id: "academy-piano", instrument_name: "학원 피아노", lesson_type: "academy", active: true },
          ],
        },
      ],
    });

    const result = await fetchLessonTicketRegistrationOptions(
      client as unknown as LessonTicketRegistrationOptionsSupabaseClient,
      "academy-1",
    );

    expect(queries).toEqual([
      expect.objectContaining({
        table: "students",
        select:
          "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(instrument_id, instrument_name, lesson_type, active)",
        eq: [["academy_id", "academy-1"]],
        order: [["id", undefined]],
        range: [[0, 999]],
      }),
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
    const { client } = createFakeSupabase({
      students: ["한서아", "원생10", "김민지", "원생2"].map((name, index) => ({
        id: `student-${index}`,
        academy_id: "academy-1",
        name,
        student_instruments: [{
          instrument_id: "piano", instrument_name: "피아노",
          lesson_type: "private", active: true,
        }],
      })),
    });

    const result = await fetchLessonTicketRegistrationOptions(
      client as unknown as LessonTicketRegistrationOptionsSupabaseClient,
      "academy-1",
    );

    expect(result.map((option) => option.studentName)).toEqual(["김민지", "원생2", "원생10", "한서아"]);
  });
});

describe("담당 선생님 회차권 조회", () => {
  it("담당 악기의 잔여 횟수와 만료일만 RPC 결과로 돌려준다", async () => {
    const calls: unknown[] = [];
    const client = {
      async rpc(name: string, payload: Record<string, string>) {
        calls.push({ name, payload });
        return { data: [{ student_id: "s1", instrument_id: "piano", remaining_count: 2, valid_until: "2026-11-01" }], error: null };
      },
    };
    await expect(fetchAssignedLessonTicketBalances(client, "academy-1")).resolves.toEqual([
      { studentId: "s1", instrumentId: "piano", remainingCount: 2, validUntil: "2026-11-01" },
    ]);
    expect(calls).toEqual([{ name: "get_assigned_lesson_ticket_balances", payload: { p_academy_id: "academy-1" } }]);
  });
});

type RpcCall = { functionName: string; payload: Record<string, unknown> };

function createRpcStub<TClient>(result: { data: unknown; error: Error | null }) {
  const calls: RpcCall[] = [];
  const client = {
    async rpc(functionName: string, payload: Record<string, unknown>) {
      calls.push({ functionName, payload });

      return result;
    },
  } as unknown as TClient;

  return { client, calls };
}

describe("registerLessonTicket", () => {
  const input = {
    academyId: "academy-1",
    studentId: "student-1",
    instrumentId: "piano",
    instrumentName: "피아노",
    grantedCount: 10,
    validDays: 30,
    registeredAt: "2026-09-20",
  };

  it("등록 RPC를 한 번 호출하고 결과를 camelCase로 돌려준다", async () => {
    const { client, calls } = createRpcStub<RegisterLessonTicketSupabaseClient>({
      data: {
        ticket_id: "ticket-1",
        merged: true,
        total_granted_count: 22,
        remaining_count: 13,
        valid_from: "2026-08-01",
        valid_until: "2026-10-20",
      },
      error: null,
    });

    const result = await registerLessonTicket(client, { ...input, paidAmount: 150000 });

    expect(calls).toEqual([
      {
        functionName: "register_lesson_ticket",
        payload: {
          p_academy_id: "academy-1",
          p_student_id: "student-1",
          p_instrument_id: "piano",
          p_instrument_name: "피아노",
          p_granted_count: 10,
          p_valid_days: 30,
          p_registered_at: "2026-09-20",
          p_paid_amount: 150000,
        },
      },
    ]);
    expect(result).toEqual({
      ticketId: "ticket-1",
      merged: true,
      totalGrantedCount: 22,
      remainingCount: 13,
      validFrom: "2026-08-01",
      validUntil: "2026-10-20",
    });
  });

  it("결제 금액을 입력하지 않으면 0원으로 보낸다", async () => {
    const { client, calls } = createRpcStub<RegisterLessonTicketSupabaseClient>({
      data: {
        ticket_id: "ticket-2",
        merged: false,
        total_granted_count: 10,
        remaining_count: 10,
        valid_from: "2026-09-20",
        valid_until: "2026-10-20",
      },
      error: null,
    });

    await registerLessonTicket(client, input);

    expect(calls[0].payload).toMatchObject({ p_paid_amount: 0 });
  });

  it("RPC 오류는 한국어 원인을 살려 등록 실패 오류로 감싼다", async () => {
    const { client } = createRpcStub<RegisterLessonTicketSupabaseClient>({
      data: null,
      error: new Error(
        "결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다. 결제 금액을 비우고 등록해 주세요.",
      ),
    });

    await expect(registerLessonTicket(client, { ...input, paidAmount: 1000 })).rejects.toThrow(
      "회차권을 등록하지 못했습니다: 결제 금액을 수입으로 기록하는 것은 원장만 할 수 있습니다.",
    );
  });

  it("RPC가 결과를 돌려주지 않으면 오류로 처리한다", async () => {
    const { client } = createRpcStub<RegisterLessonTicketSupabaseClient>({ data: null, error: null });

    await expect(registerLessonTicket(client, input)).rejects.toThrow(
      "회차권을 등록했지만 반환된 데이터가 없습니다.",
    );
  });
});

describe("adjustLessonTicket", () => {
  const input = {
    academyId: "academy-1",
    ticketId: "ticket-1",
    totalGrantedCount: 10,
    remainingCount: 6,
    validUntil: "2026-10-15",
    reason: "수기 장부와 맞추기",
  };

  it("수정 RPC를 호출하고 결과를 camelCase로 돌려준다", async () => {
    const { client, calls } = createRpcStub<AdjustLessonTicketSupabaseClient>({
      data: {
        ticket_id: "ticket-1",
        total_granted_count: 10,
        remaining_count: 6,
        valid_until: "2026-10-15",
      },
      error: null,
    });

    const result = await adjustLessonTicket(client, input);

    expect(calls).toEqual([
      {
        functionName: "adjust_lesson_ticket",
        payload: {
          p_academy_id: "academy-1",
          p_ticket_id: "ticket-1",
          p_total_granted_count: 10,
          p_remaining_count: 6,
          p_valid_until: "2026-10-15",
          p_reason: "수기 장부와 맞추기",
        },
      },
    ]);
    expect(result).toEqual({
      ticketId: "ticket-1",
      totalGrantedCount: 10,
      remainingCount: 6,
      validUntil: "2026-10-15",
    });
  });

  it("RPC 오류는 수정 실패 오류로 감싼다", async () => {
    const { client } = createRpcStub<AdjustLessonTicketSupabaseClient>({
      data: null,
      error: new Error("잔여 회수는 부여 회수보다 많을 수 없습니다."),
    });

    await expect(adjustLessonTicket(client, input)).rejects.toThrow(
      "회차권을 수정하지 못했습니다: 잔여 회수는 부여 회수보다 많을 수 없습니다.",
    );
  });

  it("RPC가 결과를 돌려주지 않으면 오류로 처리한다", async () => {
    const { client } = createRpcStub<AdjustLessonTicketSupabaseClient>({ data: null, error: null });

    await expect(adjustLessonTicket(client, input)).rejects.toThrow(
      "회차권을 수정했지만 반환된 데이터가 없습니다.",
    );
  });
});

describe("회차권 삭제·환불 미리보기", () => {
  it("환불 미리보기 RPC에 학원과 회차권을 넘기고 camelCase로 바꿔 돌려준다", async () => {
    const calls: Array<{ name: string; payload: unknown }> = [];
    const client = {
      rpc(name: string, payload: unknown) {
        calls.push({ name, payload });

        return Promise.resolve({
          data: {
            policy: "proportional_always",
            total_granted_count: 8,
            used_count: 6,
            eligible: true,
            refund_amount: 70000,
            can_delete_as_mistake: false,
          },
          error: null,
        });
      },
    } as unknown as LessonTicketRefundPreviewSupabaseClient;

    await expect(getLessonTicketRefundPreview(client, { academyId: "academy-1", ticketId: "ticket-1" })).resolves.toEqual({
      policy: "proportional_always",
      totalGrantedCount: 8,
      usedCount: 6,
      eligible: true,
      refundAmount: 70000,
      canDeleteAsMistake: false,
    });
    expect(calls).toEqual([
      { name: "get_lesson_ticket_refund_preview", payload: { p_academy_id: "academy-1", p_ticket_id: "ticket-1" } },
    ]);
  });

  it("환불 미리보기 실패는 사용자에게 보일 문구로 던진다", async () => {
    const client = {
      rpc: () => Promise.resolve({ data: null, error: new Error("권한이 없습니다.") }),
    } as unknown as LessonTicketRefundPreviewSupabaseClient;

    await expect(getLessonTicketRefundPreview(client, { academyId: "academy-1", ticketId: "ticket-1" })).rejects.toThrow(
      "환불 정보를 불러오지 못했습니다: 권한이 없습니다.",
    );
  });

  it("삭제 RPC에 방식(환불 처리·잘못 등록)을 넘기고 결과를 돌려준다", async () => {
    const calls: Array<{ name: string; payload: unknown }> = [];
    const client = {
      rpc(name: string, payload: unknown) {
        calls.push({ name, payload });

        return Promise.resolve({ data: { mode: "refund", refunded: true, refund_amount: 70000 }, error: null });
      },
    } as unknown as DeleteLessonTicketSupabaseClient;

    await expect(deleteLessonTicket(client, { academyId: "academy-1", ticketId: "ticket-1", mode: "refund" })).resolves.toEqual({
      mode: "refund",
      refunded: true,
      refundAmount: 70000,
    });
    expect(calls).toEqual([
      { name: "delete_lesson_ticket", payload: { p_academy_id: "academy-1", p_ticket_id: "ticket-1", p_mode: "refund" } },
    ]);
  });

  it("삭제 실패는 사용자에게 보일 문구로 던진다", async () => {
    const client = {
      rpc: () => Promise.resolve({ data: null, error: new Error("사용한 회차권은 잘못 등록으로 삭제할 수 없습니다.") }),
    } as unknown as DeleteLessonTicketSupabaseClient;

    await expect(
      deleteLessonTicket(client, { academyId: "academy-1", ticketId: "ticket-1", mode: "mistake" }),
    ).rejects.toThrow("회차권을 삭제하지 못했습니다: 사용한 회차권은 잘못 등록으로 삭제할 수 없습니다.");
  });
});

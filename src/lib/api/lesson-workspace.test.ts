import { describe, expect, it } from "vitest";

import {
  fetchLessonWorkspaceData,
  type LessonWorkspaceSupabaseClient,
} from "./lesson-workspace";

describe("fetchLessonWorkspaceData", () => {
  it("월간 레슨관리표 조회 전에 정기 학원 레슨 이벤트 생성을 요청한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
    });

    expect(calls[0]).toEqual({
      functionName: "ensure_monthly_academy_lesson_events",
      payload: {
        p_academy_id: "academy-1",
        p_month: "2026-08",
      },
    });
    expect(result.academySheets).toHaveLength(1);
    expect(result.academySheets[0]?.rows[0]).toMatchObject({
      studentName: "김민지",
      instrumentName: "피아노",
      status: "pending",
    });
  });

  it("정기 학원 레슨 이벤트 생성 실패를 레슨관리표 조회 오류로 전달한다", async () => {
    const client = createLessonWorkspaceClient([], {
      rpcError: new Error("permission denied"),
    });

    await expect(
      fetchLessonWorkspaceData(client, {
        academyId: "academy-1",
        month: "2026-08",
      }),
    ).rejects.toThrow("레슨관리표 정기 일정을 준비하지 못했습니다: permission denied");
  });
});

function createLessonWorkspaceClient(
  calls: Array<Record<string, unknown>>,
  options: {
    rpcError?: Error;
  } = {},
): LessonWorkspaceSupabaseClient {
  return {
    async rpc(functionName: string, payload: Record<string, unknown>) {
      calls.push({ functionName, payload });

      return {
        data: null,
        error: options.rpcError ?? null,
      };
    },
    from(table: string) {
      calls.push({ table });

      return {
        select(select: string) {
          calls[calls.length - 1].select = select;

          if (table === "monthly_memos") {
            return createMonthlyMemoBuilder(calls);
          }

          return createListBuilder(table, calls);
        },
      };
    },
  } as unknown as LessonWorkspaceSupabaseClient;
}

function createListBuilder(table: string, calls: Array<Record<string, unknown>>) {
  return {
    eq(column: string, value: string) {
      const latestCall = calls[calls.length - 1];
      latestCall.eq = [...((latestCall.eq as unknown[]) ?? []), [column, value]];

      if (table === "students" || table === "teachers") {
        return Promise.resolve({
          data:
            table === "students"
              ? [
                  {
                    id: "student-1",
                    academy_id: "academy-1",
                    name: "김민지",
                    student_instruments: [],
                  },
                ]
              : [
                  {
                    id: "teacher-1",
                    academy_id: "academy-1",
                    name: "박선생",
                    part: "피아노",
                  },
                ],
          error: null,
        });
      }

      return this;
    },
    gte(column: string, value: string) {
      calls[calls.length - 1].gte = [column, value];

      return this;
    },
    lt(column: string, value: string) {
      calls[calls.length - 1].lt = [column, value];

      return this;
    },
    gt(column: string, value: number) {
      calls[calls.length - 1].gt = [column, value];

      return this;
    },
    order(column: string, options: { ascending: boolean }) {
      calls[calls.length - 1].order = [column, options];

      if (table === "lesson_events") {
        return Promise.resolve({
          data: [
            {
              id: "lesson-1",
              academy_id: "academy-1",
              student_id: "student-1",
              students: { name: "김민지" },
              instrument_id: "piano",
              instrument_name: "피아노",
              teacher_id: "teacher-1",
              teachers: { name: "박선생" },
              lesson_kind: "academy",
              starts_at: "2026-08-21T15:00:00+09:00",
              ends_at: "2026-08-21T15:50:00+09:00",
              status: "scheduled",
              attendance_records: [],
            },
          ],
          error: null,
        });
      }

      return Promise.resolve({
        data: [],
        error: null,
      });
    },
    async limit() {
      return {
        data: [],
        error: null,
      };
    },
    then(resolve: (value: unknown) => void) {
      const latestCall = calls[calls.length - 1];

      if (table === "lesson_ticket_grants") {
        latestCall.result = "ticket-balances";
        resolve({
          data: [],
          error: null,
        });
        return;
      }

      resolve({
        data: [],
        error: null,
      });
    },
  };
}

function createMonthlyMemoBuilder(calls: Array<Record<string, unknown>>) {
  return {
    eq(column: string, value: string) {
      const latestCall = calls[calls.length - 1];
      latestCall.eq = [...((latestCall.eq as unknown[]) ?? []), [column, value]];

      return this;
    },
    async maybeSingle() {
      return {
        data: {
          content: "",
        },
        error: null,
      };
    },
  };
}

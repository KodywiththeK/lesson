import { describe, expect, it } from "vitest";

import {
  createLessonTicketRefundPolicyQueryOptions,
  fetchLessonTicketRefundPolicy,
  setLessonTicketRefundPolicy,
  type AcademySettingsSupabaseClient,
} from "./academy-settings";

type Result = { data: unknown; error: Error | null };

function createClient(read: Result, write: Result = { data: null, error: null }) {
  const calls: Array<{ kind: string; detail: unknown }> = [];
  const client: AcademySettingsSupabaseClient = {
    from(table) {
      calls.push({ kind: "from", detail: table });

      return {
        select(select: string) {
          calls.push({ kind: "select", detail: select });

          return {
            eq(column: string, value: string) {
              calls.push({ kind: "eq", detail: [column, value] });

              return { maybeSingle: async () => read as never };
            },
          };
        },
      };
    },
    rpc: async (name, payload) => {
      calls.push({ kind: "rpc", detail: { name, payload } });

      return write as never;
    },
  };

  return { client, calls };
}

describe("fetchLessonTicketRefundPolicy", () => {
  it("학원 설정에서 회차권 환불 규정을 읽는다", async () => {
    const { client, calls } = createClient({
      data: { lesson_ticket_refund_policy: "proportional_until_half" },
      error: null,
    });

    await expect(fetchLessonTicketRefundPolicy(client, "academy-1")).resolves.toBe("proportional_until_half");
    expect(calls).toEqual([
      { kind: "from", detail: "academy_settings" },
      { kind: "select", detail: "lesson_ticket_refund_policy" },
      { kind: "eq", detail: ["academy_id", "academy-1"] },
    ]);
  });

  it("설정 행이 아직 없으면 기본값인 환불 불가를 돌려준다", async () => {
    const { client } = createClient({ data: null, error: null });

    await expect(fetchLessonTicketRefundPolicy(client, "academy-1")).resolves.toBe("none");
  });

  it("알 수 없는 값은 조용히 넘기지 않고 오류로 알린다", async () => {
    const { client } = createClient({ data: { lesson_ticket_refund_policy: "anything" }, error: null });

    await expect(fetchLessonTicketRefundPolicy(client, "academy-1")).rejects.toThrow(
      "회차권 환불 규정을 알 수 없습니다: anything",
    );
  });

  it("조회 오류는 사용자에게 보일 문구로 감싼다", async () => {
    const { client } = createClient({ data: null, error: new Error("permission denied") });

    await expect(fetchLessonTicketRefundPolicy(client, "academy-1")).rejects.toThrow(
      "회차권 환불 규정을 불러오지 못했습니다: permission denied",
    );
  });
});

describe("setLessonTicketRefundPolicy", () => {
  it("저장 RPC에 학원과 규정을 넘기고 저장된 규정을 돌려준다", async () => {
    const { client, calls } = createClient(
      { data: null, error: null },
      { data: { lesson_ticket_refund_policy: "proportional_always" }, error: null },
    );

    await expect(
      setLessonTicketRefundPolicy(client, { academyId: "academy-1", policy: "proportional_always" }),
    ).resolves.toBe("proportional_always");
    expect(calls).toEqual([
      {
        kind: "rpc",
        detail: {
          name: "set_lesson_ticket_refund_policy",
          payload: { p_academy_id: "academy-1", p_policy: "proportional_always" },
        },
      },
    ]);
  });

  it("실패하면 저장 실패 문구로 던진다", async () => {
    const { client } = createClient({ data: null, error: null }, { data: null, error: new Error("원장만 바꿀 수 있습니다.") });

    await expect(
      setLessonTicketRefundPolicy(client, { academyId: "academy-1", policy: "none" }),
    ).rejects.toThrow("회차권 환불 규정을 저장하지 못했습니다: 원장만 바꿀 수 있습니다.");
  });
});

describe("createLessonTicketRefundPolicyQueryOptions", () => {
  it("학원 범위 쿼리 키로 묶는다", async () => {
    const { client } = createClient({ data: { lesson_ticket_refund_policy: "none" }, error: null });
    const options = createLessonTicketRefundPolicyQueryOptions(client, "academy-1");

    expect(options.queryKey).toEqual(["academy", "academy-1", "settings", "lesson-ticket-refund-policy"]);
    await expect(options.queryFn()).resolves.toBe("none");
  });
});

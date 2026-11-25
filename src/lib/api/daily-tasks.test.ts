import { describe, expect, it } from "vitest";

import {
  fetchDailyTaskSource,
  fetchDailyTaskStates,
  setDailyTaskState,
  type DailyTasksSupabaseClient,
} from "./daily-tasks";

function createClient(data: unknown, error: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });

      return { data: error ? null : data, error };
    },
  } as unknown as DailyTasksSupabaseClient;

  return { client, calls };
}

describe("오늘 할 일 API", () => {
  it("원천 데이터를 날짜로 읽고 빠진 목록은 빈 배열로 채운다", async () => {
    const { client, calls } = createClient({
      unresolvedAbsences: [{ attendanceId: "att-1" }],
      tuitions: [],
    });

    const source = await fetchDailyTaskSource(client, { academyId: "academy-1", date: "2026-11-19" });

    expect(calls).toEqual([
      { name: "get_daily_task_source", args: { p_academy_id: "academy-1", p_date: "2026-11-19" } },
    ]);
    expect(source.unresolvedAbsences).toHaveLength(1);
    expect(source.lessonChanges).toEqual([]);
    expect(source.pendingBookOrders).toEqual([]);
  });

  it("공유 상태를 화면 모양으로 바꾼다", async () => {
    const { client } = createClient([
      { task_key: "makeup:att-1", state: "waiting_reply", updated_by_name: "원장", updated_at: "2026-11-19T01:00:00Z" },
    ]);

    await expect(fetchDailyTaskStates(client, { academyId: "academy-1" })).resolves.toEqual([
      { taskKey: "makeup:att-1", state: "waiting_reply", updatedByName: "원장", updatedAt: "2026-11-19T01:00:00Z" },
    ]);
  });

  it("상태 변경은 null로 되돌리기를 지원하고 실패하면 한국어 오류를 던진다", async () => {
    const ok = createClient(null);
    await setDailyTaskState(ok.client, { academyId: "academy-1", taskKey: "makeup:att-1", state: null });
    expect(ok.calls[0]).toEqual({
      name: "set_daily_task_state",
      args: { p_academy_id: "academy-1", p_task_key: "makeup:att-1", p_state: null },
    });

    const failed = createClient(null, new Error("denied"));
    await expect(
      setDailyTaskState(failed.client, { academyId: "academy-1", taskKey: "makeup:att-1", state: "done" }),
    ).rejects.toThrow("할 일 상태를 바꾸지 못했습니다: denied");
  });
});

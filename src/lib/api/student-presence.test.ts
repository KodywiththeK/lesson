import { describe, expect, it } from "vitest";

import {
  fetchDailyStudentPresence,
  recordStudentPresence,
  type StudentPresenceSupabaseClient,
} from "./student-presence";

function createClient(data: unknown, error: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });

      return { data: error ? null : data, error };
    },
  } as unknown as StudentPresenceSupabaseClient;

  return { client, calls };
}

describe("등하원 현황 API", () => {
  it("그날의 오기로 한 학생과 등하원 기록을 RPC로 읽어 화면 모양으로 바꾼다", async () => {
    const { client, calls } = createClient([
      {
        student_id: "student-1",
        student_name: "김민지",
        lesson_kinds: ["academy", "private"],
        first_starts_at: "2026-11-14T06:00:00+00:00",
        arrived_at: "2026-11-14T05:50:00+00:00",
        left_at: null,
      },
      {
        student_id: "student-2",
        student_name: "이서윤",
        lesson_kinds: ["private"],
        first_starts_at: null,
        arrived_at: null,
        left_at: null,
      },
    ]);

    const records = await fetchDailyStudentPresence(client, { academyId: "academy-1", date: "2026-11-14" });

    expect(calls).toEqual([
      { name: "list_daily_student_presence", args: { p_academy_id: "academy-1", p_date: "2026-11-14" } },
    ]);
    expect(records).toEqual([
      {
        studentId: "student-1",
        studentName: "김민지",
        lessonKinds: ["academy", "private"],
        firstStartAt: "2026-11-14T06:00:00+00:00",
        arrivedAt: "2026-11-14T05:50:00+00:00",
        leftAt: null,
      },
      {
        studentId: "student-2",
        studentName: "이서윤",
        lessonKinds: ["private"],
        firstStartAt: null,
        arrivedAt: null,
        leftAt: null,
      },
    ]);
  });

  it("makeup 수업은 학원레슨으로 묶어 보여 준다", async () => {
    const { client } = createClient([
      {
        student_id: "student-1",
        student_name: "김민지",
        lesson_kinds: ["makeup", "academy"],
        first_starts_at: null,
        arrived_at: null,
        left_at: null,
      },
    ]);

    const [record] = await fetchDailyStudentPresence(client, { academyId: "academy-1", date: "2026-11-14" });

    expect(record.lessonKinds).toEqual(["academy"]);
  });

  it("조회에 실패하면 서버 문구와 함께 알린다", async () => {
    const { client } = createClient(null, new Error("로그인이 필요합니다."));

    await expect(
      fetchDailyStudentPresence(client, { academyId: "academy-1", date: "2026-11-14" }),
    ).rejects.toThrow("등하원 현황을 불러오지 못했습니다: 로그인이 필요합니다.");
  });

  it("등하원 기록은 학생·날짜·동작을 RPC로 보낸다", async () => {
    const { client, calls } = createClient({ student_id: "student-1" });

    await recordStudentPresence(client, {
      academyId: "academy-1",
      studentId: "student-1",
      date: "2026-11-14",
      action: "arrive",
    });

    expect(calls).toEqual([
      {
        name: "record_student_presence",
        args: { p_academy_id: "academy-1", p_student_id: "student-1", p_date: "2026-11-14", p_action: "arrive" },
      },
    ]);
  });

  it("기록에 실패하면 서버 문구와 함께 알린다", async () => {
    const { client } = createClient(null, new Error("등원을 먼저 기록해 주세요."));

    await expect(
      recordStudentPresence(client, {
        academyId: "academy-1",
        studentId: "student-1",
        date: "2026-11-14",
        action: "leave",
      }),
    ).rejects.toThrow("등하원을 기록하지 못했습니다: 등원을 먼저 기록해 주세요.");
  });
});

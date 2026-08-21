import { describe, expect, it } from "vitest";

import {
  createDailyAcademyLessonAttendanceQueryOptions,
  fetchDailyAcademyLessonAttendance,
  markDailyAcademyLessonAttendance,
  type AcademyLessonAttendanceSupabaseClient,
  type AcademyLessonAttendanceSupabaseRow,
} from "./academy-lessons";

describe("fetchDailyAcademyLessonAttendance", () => {
  it("학원과 선택 날짜 기준으로 학원 수업 출석표를 불러온다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createAttendanceClient(calls, [
      {
        id: "lesson-2",
        academy_id: "academy-1",
        student_id: "student-2",
        students: { name: "이서윤" },
        instrument_id: "piano",
        instrument_name: "피아노",
        starts_at: "2026-08-21T16:00:00+09:00",
        ends_at: "2026-08-21T16:50:00+09:00",
        status: "scheduled",
        attendance_records: [],
      },
      {
        id: "lesson-1",
        academy_id: "academy-1",
        student_id: "student-1",
        students: { name: "김민지" },
        instrument_id: "piano",
        instrument_name: "피아노",
        starts_at: "2026-08-21T15:00:00+09:00",
        ends_at: "2026-08-21T15:50:00+09:00",
        status: "scheduled",
        attendance_records: [
          {
            status: "present",
            absence_reason: null,
            marked_at: "2026-08-21T15:05:00+09:00",
          },
        ],
      },
    ]);

    const result = await fetchDailyAcademyLessonAttendance(client, {
      academyId: "academy-1",
      date: "2026-08-21",
    });

    expect(calls).toEqual([
      {
        functionName: "ensure_monthly_academy_lesson_events",
        payload: {
          p_academy_id: "academy-1",
          p_month: "2026-08",
        },
      },
      {
        table: "lesson_events",
        select:
          "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, starts_at, ends_at, status, attendance_records!attendance_records_academy_lesson_event_fk(status, absence_reason, marked_at)",
        eq: [
          ["academy_id", "academy-1"],
          ["lesson_kind", "academy"],
          ["status", "scheduled"],
        ],
        gte: ["starts_at", "2026-08-21T00:00:00+09:00"],
        lt: ["starts_at", "2026-08-22T00:00:00+09:00"],
        order: ["starts_at", { ascending: true }],
      },
    ]);
    expect(result.rows.map((row) => row.studentName)).toEqual(["김민지", "이서윤"]);
    expect(result.rows[0]).toMatchObject({
      lessonEventId: "lesson-1",
      status: "present",
      markedAt: "2026-08-21T15:05:00+09:00",
    });
    expect(result.summary).toEqual({
      total: 2,
      present: 1,
      absent: 0,
      pending: 1,
    });
  });

  it("출석표 조회 오류는 한국어 메시지로 전달한다", async () => {
    const client = createAttendanceClient([], [], {
      queryError: new Error("permission denied"),
    });

    await expect(
      fetchDailyAcademyLessonAttendance(client, {
        academyId: "academy-1",
        date: "2026-08-21",
      }),
    ).rejects.toThrow("학원 수업 출석표를 불러오지 못했습니다: permission denied");
  });

  it("정기 학원 레슨 이벤트 생성 실패를 출석표 조회 오류로 전달한다", async () => {
    const client = createAttendanceClient([], [], {
      rpcError: new Error("permission denied"),
    });

    await expect(
      fetchDailyAcademyLessonAttendance(client, {
        academyId: "academy-1",
        date: "2026-08-21",
      }),
    ).rejects.toThrow("학원 수업 정기 일정을 준비하지 못했습니다: permission denied");
  });

  it("Supabase가 UTC timestamptz를 반환해도 한국 시간 기준 날짜와 시간을 보여준다", async () => {
    const client = createAttendanceClient([], [
      {
        id: "lesson-1",
        academy_id: "academy-1",
        student_id: "student-1",
        students: { name: "김민지" },
        instrument_id: "piano",
        instrument_name: "피아노",
        starts_at: "2026-08-20T15:00:00Z",
        ends_at: "2026-08-20T15:50:00Z",
        status: "scheduled",
        attendance_records: [],
      },
    ]);

    const result = await fetchDailyAcademyLessonAttendance(client, {
      academyId: "academy-1",
      date: "2026-08-21",
    });

    expect(result.rows[0]).toMatchObject({
      date: "2026-08-21",
      startTime: "00:00",
      endTime: "00:50",
    });
  });
});

describe("markDailyAcademyLessonAttendance", () => {
  it("선택한 출결 상태를 attendance_records에 upsert한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createAttendanceClient(calls, []);

    await markDailyAcademyLessonAttendance(client, {
      academyId: "academy-1",
      records: [
        {
          lessonEventId: "lesson-1",
          studentId: "student-1",
          status: "present",
          markedAt: "2026-08-21T15:05:00+09:00",
        },
        {
          lessonEventId: "lesson-2",
          studentId: "student-2",
          status: "absent",
          reason: "감기",
          markedAt: "2026-08-21T16:05:00+09:00",
        },
      ],
    });

    expect(calls).toEqual([
      {
        table: "attendance_records",
        upsert: [
          {
            academy_id: "academy-1",
            lesson_event_id: "lesson-1",
            student_id: "student-1",
            status: "present",
            absence_reason: null,
            marked_at: "2026-08-21T15:05:00+09:00",
          },
          {
            academy_id: "academy-1",
            lesson_event_id: "lesson-2",
            student_id: "student-2",
            status: "absent",
            absence_reason: "감기",
            marked_at: "2026-08-21T16:05:00+09:00",
          },
        ],
        options: {
          onConflict: "academy_id,lesson_event_id,student_id",
        },
        select: "id",
      },
    ]);
  });
});

describe("createDailyAcademyLessonAttendanceQueryOptions", () => {
  it("출석표 query key를 학원과 날짜별로 분리한다", () => {
    const client = createAttendanceClient([], []);

    expect(
      createDailyAcademyLessonAttendanceQueryOptions(client, {
        academyId: "academy-1",
        date: "2026-08-21",
      }).queryKey,
    ).toEqual([
      "academy",
      "academy-1",
      "academy-lessons",
      "daily-attendance",
      "2026-08-21",
    ]);
  });
});

function createAttendanceClient(
  calls: Array<Record<string, unknown>>,
  lessonRows: AcademyLessonAttendanceSupabaseRow[],
  options: {
    rpcError?: Error;
    queryError?: Error;
    upsertError?: Error;
  } = {},
): AcademyLessonAttendanceSupabaseClient {
  return {
    async rpc(functionName: string, payload: Record<string, unknown>) {
      calls.push({ functionName, payload });

      return {
        data: 0,
        error: options.rpcError ?? null,
      };
    },
    from(table) {
      calls.push({ table });

      return {
        select(select: string) {
          calls[calls.length - 1].select = select;

          return {
            eq(column: string, value: string) {
              const latestCall = calls[calls.length - 1];
              latestCall.eq = [
                ...((latestCall.eq as unknown[]) ?? []),
                [column, value],
              ];

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
            async order(column: string, orderOptions: { ascending: boolean }) {
              calls[calls.length - 1].order = [column, orderOptions];

              return {
                data: lessonRows,
                error: options.queryError ?? null,
              };
            },
          };
        },
        upsert(values: Record<string, unknown>[], upsertOptions: unknown) {
          calls[calls.length - 1].upsert = values;
          calls[calls.length - 1].options = upsertOptions;

          return {
            async select(select: string) {
              calls[calls.length - 1].select = select;

              return {
                data: [],
                error: options.upsertError ?? null,
              };
            },
          };
        },
      };
    },
  };
}

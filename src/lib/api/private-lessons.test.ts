import { describe, expect, it } from "vitest";

import {
  fetchAcademyLessonRegistrationOptions,
  fetchPrivateLessonRegistrationOptions,
  cancelPrivateLessonAttendance,
  markPrivateLessonAttendance,
  registerPrivateLessonEvent,
  type PrivateLessonEventSupabaseRow,
  type PrivateLessonRegistrationOptionsSupabaseClient,
  type PrivateLessonRegistrationSupabaseClient,
} from "./private-lessons";

describe("fetchPrivateLessonRegistrationOptions", () => {
  it("개인레슨 수강 정보가 있는 원생과 악기만 선택지로 만든다", async () => {
    const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
      [];
    const client = createRegistrationOptionsClient(calls);

    const result = await fetchPrivateLessonRegistrationOptions(
      client,
      "academy-1",
    );

    expect(calls).toEqual([
      {
        table: "students",
        select:
          "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(id, instrument_id, instrument_name, lesson_type, active, teacher_id, start_time, end_time)",
        eq: ["academy_id", "academy-1"],
      },
      {
        table: "teachers",
        select: "id, academy_id, name, part, status",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(result).toEqual({
      students: [
        {
          studentId: "student-1",
          studentName: "김민지",
          instruments: [
            {
              studentInstrumentId: "student-instrument-1",
              instrumentId: "piano",
              instrumentName: "피아노",
              teacherId: "teacher-1",
              lessonMinutes: 40,
            },
            {
              studentInstrumentId: "student-instrument-4",
              instrumentId: "violin",
              instrumentName: "바이올린",
              teacherId: undefined,
              lessonMinutes: 30,
            },
          ],
        },
      ],
      // 재직 중인 선생님만, 가나다순
      teachers: [
        {
          teacherId: "teacher-2",
          teacherName: "가선생",
          part: "바이올린",
        },
        {
          teacherId: "teacher-1",
          teacherName: "박선생",
          part: "피아노",
        },
      ],
    });
  });
});

describe("fetchAcademyLessonRegistrationOptions", () => {
  it("학원레슨 수강 정보가 있는 원생과 악기만 선택지로 만든다", async () => {
    const client = createRegistrationOptionsClient();

    const result = await fetchAcademyLessonRegistrationOptions(
      client,
      "academy-1",
    );

    expect(result.students).toEqual([
      {
        studentId: "student-1",
        studentName: "김민지",
        instruments: [
          {
            studentInstrumentId: "student-instrument-2",
            instrumentId: "academy-piano",
            instrumentName: "학원 피아노",
          },
        ],
      },
      {
        studentId: "student-2",
        studentName: "이서윤",
        instruments: [
          {
            studentInstrumentId: "student-instrument-3",
            instrumentId: "academy-violin",
            instrumentName: "학원 바이올린",
          },
        ],
      },
    ]);
  });
});

function createRegistrationOptionsClient(
  calls: Array<{ table: string; select?: string; eq?: [string, string] }> = [],
): PrivateLessonRegistrationOptionsSupabaseClient {
  return {
    from(table: "students" | "teachers") {
      calls.push({ table });

      return {
        select(select: string) {
          calls[calls.length - 1].select = select;

          return {
            async eq(column: "academy_id", value: string) {
              calls[calls.length - 1].eq = [column, value];

              return table === "students"
                ? {
                    data: [
                      {
                        id: "student-1",
                        academy_id: "academy-1",
                        name: "김민지",
                        student_instruments: [
                          {
                            id: "student-instrument-1",
                            instrument_id: "piano",
                            instrument_name: "피아노",
                            lesson_type: "private",
                            active: true,
                            teacher_id: "teacher-1",
                            start_time: "14:00:00",
                            end_time: "14:40:00",
                          },
                          {
                            id: "student-instrument-4",
                            instrument_id: "violin",
                            instrument_name: "바이올린",
                            lesson_type: "private",
                            active: true,
                            start_time: null,
                            end_time: null,
                          },
                          {
                            id: "student-instrument-2",
                            instrument_id: "academy-piano",
                            instrument_name: "학원 피아노",
                            lesson_type: "academy",
                            active: true,
                          },
                        ],
                      },
                      {
                        id: "student-2",
                        academy_id: "academy-1",
                        name: "이서윤",
                        student_instruments: [
                          {
                            id: "student-instrument-3",
                            instrument_id: "academy-violin",
                            instrument_name: "학원 바이올린",
                            lesson_type: "academy",
                            active: true,
                          },
                        ],
                      },
                    ],
                    error: null,
                  }
                : {
                    data: [
                      {
                        id: "teacher-1",
                        academy_id: "academy-1",
                        name: "박선생",
                        part: "피아노",
                        status: "employed",
                      },
                      {
                        id: "teacher-3",
                        academy_id: "academy-1",
                        name: "나선생",
                        part: "첼로",
                        status: "resigned",
                      },
                      {
                        id: "teacher-2",
                        academy_id: "academy-1",
                        name: "가선생",
                        part: "바이올린",
                        status: "employed",
                      },
                    ],
                    error: null,
                  };
            },
          };
        },
      };
    },
  } as PrivateLessonRegistrationOptionsSupabaseClient;
}

describe("registerPrivateLessonEvent", () => {
  it("선생님 시간 충돌이 없으면 개인레슨 일정을 insert한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createRegistrationClient(calls, []);

    const result = await registerPrivateLessonEvent(client, {
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      studentInstrumentId: "student-instrument-1",
      instrumentId: "piano",
      instrumentName: "피아노",
      teacherId: "teacher-1",
      teacherName: "박선생",
      startAt: "2026-08-21T15:00:00+09:00",
      endAt: "2026-08-21T15:50:00+09:00",
    });

    expect(calls).toMatchObject([
      {
        table: "lesson_events",
        select:
          "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, teacher_id, teachers!lesson_events_academy_teacher_fk(name), starts_at, ends_at, status, origin",
        eq: [
          ["academy_id", "academy-1"],
          ["teacher_id", "teacher-1"],
          ["lesson_kind", "private"],
        ],
      },
      {
        table: "lesson_events",
        insert: {
          academy_id: "academy-1",
          student_id: "student-1",
          student_instrument_id: "student-instrument-1",
          teacher_id: "teacher-1",
          lesson_kind: "private",
          origin: "private",
          series_id: null,
          source_lesson_event_id: null,
          counts_for_ticket: true,
          instrument_id: "piano",
          instrument_name: "피아노",
          starts_at: "2026-08-21T15:00:00+09:00",
          ends_at: "2026-08-21T15:50:00+09:00",
          status: "scheduled",
          generated_from_enrollment: false,
        },
      },
    ]);
    expect(result).toMatchObject({
      id: "lesson-new",
      academyId: "academy-1",
      studentName: "김민지",
      teacherName: "박선생",
      status: "scheduled",
    });
  });

  it("선생님 시간 충돌이 있으면 저장 전에 거부한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createRegistrationClient(calls, [
      {
        id: "lesson-1",
        academy_id: "academy-1",
        student_id: "student-existing",
        students: { name: "이서윤" },
        instrument_id: "piano",
        instrument_name: "피아노",
        teacher_id: "teacher-1",
        teachers: { name: "박선생" },
        starts_at: "2026-08-21T15:20:00+09:00",
        ends_at: "2026-08-21T16:10:00+09:00",
        status: "scheduled",
      },
    ]);

    await expect(
      registerPrivateLessonEvent(client, {
        academyId: "academy-1",
        studentId: "student-1",
        studentName: "김민지",
        studentInstrumentId: "student-instrument-1",
        instrumentId: "piano",
        instrumentName: "피아노",
        teacherId: "teacher-1",
        teacherName: "박선생",
        startAt: "2026-08-21T15:00:00+09:00",
        endAt: "2026-08-21T15:50:00+09:00",
      }),
    ).rejects.toThrow("선택한 선생님의 해당 시간에 이미 개인레슨이 있습니다.");
    expect(calls).toHaveLength(1);
  });
});

describe("markPrivateLessonAttendance", () => {
  it("개인레슨 출석 처리를 회차권 차감 RPC로 위임한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      async rpc(functionName: string, payload: Record<string, unknown>) {
        calls.push({ functionName, payload });

        return {
          data: null,
          error: null,
        };
      },
    };

    await markPrivateLessonAttendance(client, {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      instrumentId: "violin",
      instrumentName: "바이올린",
      status: "present",
      markedAt: "2026-08-21T18:05:00+09:00",
    });

    expect(calls).toEqual([
      {
        functionName: "mark_private_lesson_attendance",
        payload: {
          p_academy_id: "academy-1",
          p_lesson_event_id: "lesson-1",
          p_student_id: "student-1",
          p_instrument_id: "violin",
          p_status: "present",
          p_marked_at: "2026-08-21T18:05:00+09:00",
        },
      },
    ]);
  });

  it("회차권 차감 RPC 오류를 사용자 메시지로 변환한다", async () => {
    const client = {
      async rpc() {
        return {
          data: null,
          error: new Error("회차권 잔여가 없습니다."),
        };
      },
    };

    await expect(
      markPrivateLessonAttendance(client, {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        studentId: "student-1",
        instrumentId: "violin",
        instrumentName: "바이올린",
        status: "present",
        markedAt: "2026-08-21T18:05:00+09:00",
      }),
    ).rejects.toThrow("개인레슨 출결을 저장하지 못했습니다: 회차권 잔여가 없습니다.");
  });
});

describe("cancelPrivateLessonAttendance", () => {
  it("등원 확인 취소를 회차권 복구 RPC로 위임한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      async rpc(functionName: string, payload: Record<string, unknown>) {
        calls.push({ functionName, payload });

        return { data: null, error: null };
      },
    };

    await cancelPrivateLessonAttendance(client, {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      instrumentId: "violin",
    });

    expect(calls).toEqual([
      {
        functionName: "cancel_private_lesson_attendance",
        payload: {
          p_academy_id: "academy-1",
          p_lesson_event_id: "lesson-1",
          p_student_id: "student-1",
          p_instrument_id: "violin",
        },
      },
    ]);
  });

  it("RPC 오류를 등원 확인 취소 실패 메시지로 감싼다", async () => {
    const client = {
      async rpc() {
        return { data: null, error: new Error("개인레슨 일정을 찾지 못했습니다.") };
      },
    };

    await expect(
      cancelPrivateLessonAttendance(client, {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        studentId: "student-1",
        instrumentId: "violin",
      }),
    ).rejects.toThrow("등원 확인을 취소하지 못했습니다: 개인레슨 일정을 찾지 못했습니다.");
  });
});

function createRegistrationClient(
  calls: Array<Record<string, unknown>>,
  existingRows: PrivateLessonEventSupabaseRow[],
): PrivateLessonRegistrationSupabaseClient {
  return {
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
            async order(column: string, options: { ascending: boolean }) {
              calls[calls.length - 1].order = [column, options];

              return {
                data: existingRows,
                error: null,
              };
            },
          };
        },
        insert(values: Record<string, unknown>) {
          calls[calls.length - 1].insert = values;

          return {
            select(select: string) {
              calls[calls.length - 1].select = select;

              return {
                async single() {
                  const row: PrivateLessonEventSupabaseRow = {
                    id: "lesson-new",
                    academy_id: String(values.academy_id),
                    student_id: String(values.student_id),
                    students: { name: "김민지" },
                    instrument_id: String(values.instrument_id),
                    instrument_name: String(values.instrument_name),
                    teacher_id: String(values.teacher_id),
                    teachers: { name: "박선생" },
                    starts_at: String(values.starts_at),
                    ends_at: String(values.ends_at),
                    status: "scheduled",
                    origin: "private",
                  };

                  return {
                    data: row,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

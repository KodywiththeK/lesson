import { describe, expect, it } from "vitest";

import {
  fetchPrivateLessonRegistrationOptions,
  registerPrivateLessonEvent,
  type PrivateLessonEventSupabaseRow,
  type PrivateLessonRegistrationOptionsSupabaseClient,
  type PrivateLessonRegistrationSupabaseClient,
} from "./private-lessons";

describe("fetchPrivateLessonRegistrationOptions", () => {
  it("현재 학원의 원생, 활성 개인레슨 악기, 선생님 선택지를 만든다", async () => {
    const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
      [];
    const client = {
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

    const result = await fetchPrivateLessonRegistrationOptions(
      client,
      "academy-1",
    );

    expect(calls).toEqual([
      {
        table: "students",
        select:
          "id, academy_id, name, student_instruments(id, instrument_id, instrument_name, lesson_type, active)",
        eq: ["academy_id", "academy-1"],
      },
      {
        table: "teachers",
        select: "id, academy_id, name, part",
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
            },
          ],
        },
      ],
      teachers: [
        {
          teacherId: "teacher-1",
          teacherName: "박선생",
          part: "피아노",
        },
      ],
    });
  });
});

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
          "id, academy_id, student_id, students(name), instrument_id, instrument_name, teacher_id, teachers(name), starts_at, ends_at, status",
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

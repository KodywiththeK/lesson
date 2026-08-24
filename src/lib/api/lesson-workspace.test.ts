import { describe, expect, it } from "vitest";

import {
  createAcademyLessonEvent,
  createMakeupLessonEvent,
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
      origin: "regular",
      originLabel: "정기",
    });
    expect(result.calendarMemos).toEqual([
      {
        academyId: "academy-1",
        lessonKind: "academy",
        date: "2026-08-21",
        content: "콩쿠르 보강 확인",
        unread: false,
      },
      {
        academyId: "academy-1",
        lessonKind: "private",
        date: "2026-08-22",
        content: "오유진 선생님 시간표 공유",
        unread: true,
      },
    ]);
  });

  it("취소/삭제 일정은 레슨관리표 기본 목록에서 제외한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls, {
      eventRows: [
        {
          id: "lesson-cancelled",
          academy_id: "academy-1",
          student_id: "student-1",
          students: { name: "김민지" },
          instrument_id: "piano",
          instrument_name: "피아노",
          teacher_id: "teacher-1",
          teachers: { name: "박선생" },
          lesson_kind: "academy",
          origin: "manual",
          starts_at: "2026-08-21T15:00:00+09:00",
          ends_at: "2026-08-21T15:50:00+09:00",
          status: "cancelled",
          attendance_records: [],
        },
      ],
    });

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
    });

    expect(result.academySheets).toEqual([]);
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

describe("createAcademyLessonEvent", () => {
  it("비정기 학원 레슨을 series 없이 직접 lesson_events에 생성한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    const result = await createAcademyLessonEvent(client, {
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      studentInstrumentId: "student-instrument-1",
      instrumentId: "piano",
      instrumentName: "피아노",
      teacherId: "teacher-1",
      teacherName: "박선생",
      startAt: "2026-08-24T15:00:00+09:00",
      endAt: "2026-08-24T15:50:00+09:00",
      origin: "manual",
      reason: "비정기 보충",
    });

    expect(calls.at(-1)).toMatchObject({
      table: "lesson_events",
      insert: {
        academy_id: "academy-1",
        student_id: "student-1",
        student_instrument_id: "student-instrument-1",
        series_id: null,
        teacher_id: "teacher-1",
        lesson_kind: "academy",
        origin: "manual",
        source_lesson_event_id: null,
        counts_for_ticket: false,
        instrument_id: "piano",
        instrument_name: "피아노",
        starts_at: "2026-08-24T15:00:00+09:00",
        ends_at: "2026-08-24T15:50:00+09:00",
        status: "scheduled",
        generated_from_enrollment: false,
        creation_reason: "비정기 보충",
      },
    });
    expect(result).toMatchObject({
      studentName: "김민지",
      origin: "manual",
      originLabel: "비정기",
    });
  });
});

describe("createMakeupLessonEvent", () => {
  it("결석 원본 수업과 연결된 보강 event 생성을 RPC로 위임한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    await createMakeupLessonEvent(client, {
      academyId: "academy-1",
      sourceLessonEventId: "lesson-absent",
      studentId: "student-1",
      targetDate: "2026-08-24",
      startTime: "15:00",
      endTime: "15:50",
      reason: "감기 결석",
    });

    expect(calls.at(-1)).toEqual({
      functionName: "create_makeup_lesson_event",
      payload: {
        p_academy_id: "academy-1",
        p_source_lesson_event_id: "lesson-absent",
        p_student_id: "student-1",
        p_target_date: "2026-08-24",
        p_start_time: "15:00",
        p_end_time: "15:50",
        p_reason: "감기 결석",
      },
    });
  });
});

function createLessonWorkspaceClient(
  calls: Array<Record<string, unknown>>,
  options: {
    rpcError?: Error;
    eventRows?: Array<Record<string, unknown>>;
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

          return createListBuilder(table, calls, options);
        },
        insert(values: Record<string, unknown>) {
          return createListBuilder(table, calls, options).insert(values);
        },
      };
    },
  } as unknown as LessonWorkspaceSupabaseClient;
}

function createListBuilder(
  table: string,
  calls: Array<Record<string, unknown>>,
  options: {
    eventRows?: Array<Record<string, unknown>>;
  } = {},
) {
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

      if (table === "lesson_calendar_memos") {
        return Promise.resolve({
          data: [
            {
              academy_id: "academy-1",
              lesson_kind: "academy",
              memo_date: "2026-08-21",
              content: "콩쿠르 보강 확인",
              unread: false,
            },
            {
              academy_id: "academy-1",
              lesson_kind: "private",
              memo_date: "2026-08-22",
              content: "오유진 선생님 시간표 공유",
              unread: true,
            },
          ],
          error: null,
        });
      }

      return this;
    },
    gt(column: string, value: number) {
      calls[calls.length - 1].gt = [column, value];

      return this;
    },
    order(column: string, orderOptions: { ascending: boolean }) {
      calls[calls.length - 1].order = [column, orderOptions];

      if (table === "lesson_events") {
        return Promise.resolve({
          data: options.eventRows ?? [
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
              origin: "regular",
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
    insert(values: Record<string, unknown>) {
      calls[calls.length - 1].insert = values;

      return {
        select(select: string) {
          calls[calls.length - 1].select = select;

          return {
            async single() {
              return {
                data: {
                  id: "lesson-new",
                  academy_id: values.academy_id,
                  student_id: values.student_id,
                  students: { name: "김민지" },
                  instrument_id: values.instrument_id,
                  instrument_name: values.instrument_name,
                  teacher_id: values.teacher_id,
                  teachers: { name: "박선생" },
                  lesson_kind: values.lesson_kind,
                  origin: values.origin,
                  starts_at: values.starts_at,
                  ends_at: values.ends_at,
                  status: values.status,
                  attendance_records: [],
                },
                error: null,
              };
            },
          };
        },
      };
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

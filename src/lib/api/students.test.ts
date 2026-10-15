import { describe, expect, it } from "vitest";

import {
  createStudentListQueryOptions,
  createStudentStatusManagementQueryOptions,
  deleteWithdrawnStudent,
  fetchStudentOptions,
  fetchStudentStatusManagementList,
  fetchStudentList,
  registerStudentEnrollment,
  updateStudentProfile,
  updateStudentStatus,
  type StudentSupabaseRow,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
  type StudentRegistrationSupabaseClient,
} from "./students";

function createSupabaseStub(
  rows:
    | StudentSupabaseRow[]
    | Record<string, StudentSupabaseRow[] | Array<Record<string, unknown>>>,
  error: Error | null = null,
) {
  const calls: Array<{
    table: string;
    select?: string;
    eq?: Array<[string, string]>;
    is?: Array<[string, null]>;
    order?: Array<[string, { ascending?: boolean } | undefined]>;
  }> = [];
  const rowsByTable: Record<string, Array<Record<string, unknown>>> = Array.isArray(rows)
    ? { students: rows as Array<Record<string, unknown>> }
    : rows;
  const client = {
    from(table) {
      calls.push({ table });

      return {
        select(select) {
          calls[calls.length - 1].select = select;

          const builder = {
            eq(column: string, value: string) {
              calls[calls.length - 1].eq = [
                ...(calls[calls.length - 1].eq ?? []),
                [column, value],
              ];

              return builder;
            },
            is(column: string, value: null) {
              calls[calls.length - 1].is = [
                ...(calls[calls.length - 1].is ?? []),
                [column, value],
              ];

              return builder;
            },
            order(column: string, options?: { ascending?: boolean }) {
              calls[calls.length - 1].order = [
                ...(calls[calls.length - 1].order ?? []),
                [column, options],
              ];

              return builder;
            },
            then<TResult1 = { data: Array<Record<string, unknown>> | null; error: Error | null }>(
              resolve?: (
                value: {
                  data: Array<Record<string, unknown>> | null;
                  error: Error | null;
                },
              ) => TResult1 | PromiseLike<TResult1>,
            ) {
              const value = {
                data: error
                  ? null
                  : (rowsByTable[table] ?? []),
                error,
              };

              return Promise.resolve(resolve ? resolve(value) : (value as TResult1));
            },
          };

          return builder;
        },
      };
    },
  } as StudentListSupabaseClient;

  return { client, calls };
}

describe("fetchStudentOptions", () => {
  it("드롭다운용 원생은 10명을 넘어도 전부 가나다순으로 가져온다", async () => {
    const names = ["하", "가", "나", "다", "라", "마", "바", "사", "아", "자", "차"];
    const { client } = createSupabaseStub(
      names.map((name, index) => ({
        id: `student-${index}`,
        academy_id: "academy-1",
        name: `${name}원생`,
        student_instruments: [],
      })),
    );

    const options = await fetchStudentOptions(client, "academy-1");

    expect(options.map((student) => student.name)).toEqual([
      "가원생", "나원생", "다원생", "라원생", "마원생", "바원생", "사원생", "아원생", "자원생", "차원생", "하원생",
    ]);
  });
});

describe("fetchStudentList", () => {
  it("Supabase 원생 row를 도메인 원생 목록으로 변환한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        student_instruments: [
          {
            instrument_name: "피아노",
            weekdays: ["월", "수"],
            teachers: {
              name: "박선생",
            },
          },
        ],
      },
      {
        id: "student-2",
        academy_id: "academy-1",
        name: "이서윤",
        student_instruments: [
          {
            instrument_name: "바이올린",
            weekdays: ["화"],
            teachers: {
              name: "최선생",
            },
          },
        ],
      },
    ]);

    const result = await fetchStudentList(client, {
      academyId: "academy-1",
      search: "피아노",
    });

    expect(calls).toEqual([
      {
        table: "students",
        select:
          "id, academy_id, name, age, grade, school, occupation, attendance_code, registered_on, status, suspended_at, withdrawn_at, retention_until, archived_at, student_contacts!student_contacts_academy_student_fk(id, relationship, phone, phone_last4), student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label, final_monthly_fee, active, student_instrument_weekly_schedules!student_iws_academy_instrument_fk(id, weekday, start_time, end_time), teachers!student_instruments_academy_teacher_fk(name))",
        eq: [
          ["academy_id", "academy-1"],
          ["status", "enrolled"],
        ],
        is: [["archived_at", null]],
      },
    ]);
    expect(result.items.map((student) => student.name)).toEqual(["김민지"]);
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      studentId: "student-1",
      teacherNames: ["박선생"],
      instrumentNames: ["피아노"],
      weekdayLabels: ["월", "수"],
      instruments: [
        {
          instrumentName: "피아노",
          teacherName: "박선생",
          weekdayLabels: ["월", "수"],
        },
      ],
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchStudentList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("원생 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("registerStudentEnrollment", () => {
  it("복수 악기와 요일별 스케줄을 원생 등록 RPC payload로 전달한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: StudentRegistrationSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return {
          data: "student-1",
          error: null,
        };
      },
    };

    const result = await registerStudentEnrollment(client, {
      academyId: "academy-1",
      name: "김민지",
      registeredAt: "2026-08-21",
      age: 8,
      grade: "초등 1학년",
      school: "한빛초",
      occupation: "학생",
      contact: {
        relationship: "모",
        phone: "010-1111-2222",
      },
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          lessonType: "academy",
          weeklySchedules: [
            { weekday: "monday", startTime: "15:00", endTime: "15:50" },
            { weekday: "wednesday", startTime: "15:00", endTime: "15:50" },
          ],
          progress: "바이엘 상",
          lessonFee: 150000,
          discountTotal: 10000,
          discountLabel: "형제할인",
          finalMonthlyFee: 140000,
        },
      ],
    });

    expect(calls).toEqual([
      {
        functionName: "register_student_with_enrollments",
        payload: {
          p_academy_id: "academy-1",
          p_name: "김민지",
          p_registered_on: "2026-08-21",
          p_age: 8,
          p_grade: "초등 1학년",
          p_school: "한빛초",
          p_occupation: "학생",
          p_contact_relationship: "모",
          p_contact_phone: "010-1111-2222",
          p_enrollments: [
            {
              instrument_id: "piano",
              instrument_name: "피아노",
              teacher_id: "teacher-1",
              lesson_type: "academy",
              progress: "바이엘 상",
              lesson_fee: 150000,
              discount_total: 10000,
              discount_label: "형제할인",
              final_monthly_fee: 140000,
              weekly_schedules: [
                { weekday: "월", start_time: "15:00", end_time: "15:50" },
                { weekday: "수", start_time: "15:00", end_time: "15:50" },
              ],
            },
          ],
        },
      },
    ]);
    expect(result).toMatchObject({
      studentId: "student-1",
      name: "김민지",
      contacts: [
        {
          relationship: "모",
          phone: "010-1111-2222",
          phoneLast4: "2222",
        },
      ],
      weekdayLabels: ["월", "수"],
    });
  });

  it("학원레슨에 선생님이나 시간이 없으면 RPC 호출 전에 거부한다", async () => {
    let called = false;
    const client: StudentRegistrationSupabaseClient = {
      async rpc() { called = true; return { data: "student-1", error: null }; },
    };
    const input = {
      academyId: "academy-1", name: "윤라온", registeredAt: "2026-08-21",
      contact: { relationship: "모", phone: "010-1111-2222" },
      instruments: [{
        instrumentId: "piano", instrumentName: "피아노", teacherId: "",
        lessonType: "academy" as const,
        weeklySchedules: [{ weekday: "monday" as const }],
        progress: "신규", lessonFee: 140000, discountTotal: 0,
        finalMonthlyFee: 140000,
      }],
    };

    await expect(registerStudentEnrollment(client, input)).rejects.toThrow("학원레슨");
    expect(called).toBe(false);
    input.instruments[0].teacherId = "teacher-1";
    await expect(registerStudentEnrollment(client, input)).rejects.toThrow("모든 요일");
    expect(called).toBe(false);
  });
});

describe("updateStudentProfile", () => {
  it("원생 기본 정보와 대표 수강 악기를 적용일 기준 RPC로 수정한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: StudentUpdateSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return {
          data: null,
          error: null,
        };
      },
    };

    const result = await updateStudentProfile(client, {
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민주",
      studentInstrumentId: "student-instrument-1",
      teacherId: "teacher-2",
      teacherName: "최선생",
      instrumentId: "piano",
      instrumentName: "피아노",
      lessonType: "academy",
      weekdayLabels: ["월", "목"],
      startTime: "15:30",
      endTime: "16:20",
      progress: "체르니 100",
      lessonFee: 160000,
      discountTotal: 10000,
      finalMonthlyFee: 150000,
      effectiveFrom: "2026-08-24",
    });

    expect(calls).toEqual([
      {
        functionName: "update_student_profile_from_date",
        payload: {
          p_academy_id: "academy-1",
          p_student_id: "student-1",
          p_name: "김민주",
          p_student_instrument_id: "student-instrument-1",
          p_teacher_id: "teacher-2",
          p_instrument_id: "piano",
          p_instrument_name: "피아노",
          p_lesson_type: "academy",
          p_weekdays: ["월", "목"],
          p_start_time: "15:30",
          p_end_time: "16:20",
          p_progress: "체르니 100",
          p_lesson_fee: 160000,
          p_discount_total: 10000,
          p_final_monthly_fee: 150000,
          p_effective_from: "2026-08-24",
        },
      },
    ]);
    expect(result).toMatchObject({
      name: "김민주",
      teacherNames: ["최선생"],
      weekdayLabels: ["월", "목"],
    });
  });
});

describe("student status mutations", () => {
  it("휴원/퇴원 상태 변경을 RPC로 전달한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: StudentUpdateSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return { data: null, error: null };
      },
    };

    await updateStudentStatus(client, {
      academyId: "academy-1",
      studentId: "student-1",
      status: "withdrawn",
      changedAt: "2026-08-24T00:00:00.000Z",
      reason: "이사",
    });

    expect(calls).toEqual([
      {
        functionName: "update_student_status",
        payload: {
          p_academy_id: "academy-1",
          p_student_id: "student-1",
          p_status: "withdrawn",
          p_changed_at: "2026-08-24T00:00:00.000Z",
          p_reason: "이사",
        },
      },
    ]);
  });

  it("휴원/퇴원 관리 목록을 상태별로 조회한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        status: "withdrawn",
        withdrawn_at: "2026-08-01T00:00:00+09:00",
        retention_until: "2026-08-31",
        archived_at: null,
        student_instruments: [],
      },
    ]);

    const result = await fetchStudentStatusManagementList(client, {
      academyId: "academy-1",
      status: "withdrawn",
      today: "2026-08-25",
    });

    expect(calls.find((call) => call.table === "students")).toMatchObject({
      table: "students",
      eq: [
        ["academy_id", "academy-1"],
        ["status", "withdrawn"],
      ],
      is: [["archived_at", null]],
    });
    expect(
      calls.find((call) => call.table === "entity_status_transitions"),
    ).toMatchObject({
      table: "entity_status_transitions",
      eq: [
        ["academy_id", "academy-1"],
        ["entity_type", "student"],
        ["to_status", "withdrawn"],
      ],
      order: [["changed_at", { ascending: false }]],
    });
    expect(result.items[0]).toMatchObject({
      entityType: "student",
      name: "김민지",
      statusLabel: "퇴원",
      daysRemaining: 6,
    });
  });

  it("휴원/퇴원 관리 목록에 최신 상태 변경 메모를 붙인다", async () => {
    const { client } = createSupabaseStub({
      students: [
        {
          id: "student-1",
          academy_id: "academy-1",
          name: "김민지",
          status: "suspended",
          suspended_at: "2026-08-20T00:00:00+09:00",
          archived_at: null,
          student_instruments: [],
        },
      ],
      entity_status_transitions: [
        {
          entity_type: "student",
          entity_id: "student-1",
          to_status: "suspended",
          reason: "방학 기간 휴원",
          changed_at: "2026-08-20T00:00:00+09:00",
        },
      ],
    });

    const result = await fetchStudentStatusManagementList(client, {
      academyId: "academy-1",
      status: "suspended",
      today: "2026-08-25",
    });

    expect(result.items[0]).toMatchObject({
      statusReason: "방학 기간 휴원",
    });
  });

  it("퇴원 원생 삭제를 RPC로 전달한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: StudentUpdateSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return { data: null, error: null };
      },
    };

    await deleteWithdrawnStudent(client, {
      academyId: "academy-1",
      studentId: "student-1",
    });

    expect(calls).toEqual([
      {
        functionName: "delete_withdrawn_student",
        payload: {
          p_academy_id: "academy-1",
          p_student_id: "student-1",
        },
      },
    ]);
  });
});

describe("휴원/퇴원 관리 원생 목록 검색과 페이지", () => {
  const manyStudentRows = Array.from({ length: 12 }, (_, index) => ({
    id: `student-${String(index).padStart(2, "0")}`,
    academy_id: "academy-1",
    name: index === 11 ? "하민지" : `가민지${String(index).padStart(2, "0")}`,
    status: "suspended" as const,
    suspended_at: "2026-08-20T00:00:00+09:00",
    archived_at: null,
    student_instruments: [],
  }));

  it("검색어와 페이지를 받아 해당 페이지의 원생만 돌려준다", async () => {
    const { client } = createSupabaseStub({ students: manyStudentRows });

    const secondPage = await fetchStudentStatusManagementList(client, {
      academyId: "academy-1",
      status: "suspended",
      today: "2026-08-25",
      page: 2,
      pageSize: 10,
    });
    const searched = await fetchStudentStatusManagementList(client, {
      academyId: "academy-1",
      status: "suspended",
      today: "2026-08-25",
      search: "하민",
    });

    expect(secondPage.totalItems).toBe(12);
    expect(secondPage.items.map((item) => item.name)).toEqual(["가민지10", "하민지"]);
    expect(searched.items.map((item) => item.name)).toEqual(["하민지"]);
  });

  it("검색어, 페이지, 페이지 크기를 queryKey에 포함한다", () => {
    const { client } = createSupabaseStub([]);

    const options = createStudentStatusManagementQueryOptions(client, {
      academyId: "academy-1",
      status: "withdrawn",
      search: "김",
      page: 2,
      pageSize: 20,
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "status-management",
      "student",
      "withdrawn",
      "김",
      "2",
      "20",
    ]);
  });
});

describe("createStudentListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createStudentListQueryOptions(client, {
      academyId: "academy-1",
      search: "민",
      filters: {
        teacherName: "박선생",
        instrumentName: "피아노",
        weekdayLabel: "월",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "students",
      "list",
      "all",
      "민",
      "박선생",
      "피아노",
      "월",
      "1",
      "",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});

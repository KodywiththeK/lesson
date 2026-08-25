import { describe, expect, it } from "vitest";

import {
  createStudentListQueryOptions,
  deleteWithdrawnStudent,
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
  rows: StudentSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{
    table: string;
    select?: string;
    eq?: Array<[string, string]>;
    is?: Array<[string, null]>;
  }> = [];
  const client: StudentListSupabaseClient = {
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
            then<TResult1 = { data: StudentSupabaseRow[] | null; error: Error | null }>(
              resolve?: (
                value: { data: StudentSupabaseRow[] | null; error: Error | null },
              ) => TResult1 | PromiseLike<TResult1>,
            ) {
              const value = {
                data: error ? null : rows,
                error,
              };

              return Promise.resolve(resolve ? resolve(value) : (value as TResult1));
            },
          };

          return builder;
        },
      };
    },
  };

  return { client, calls };
}

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
            { weekday: "wednesday" },
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
                { weekday: "수", start_time: null, end_time: null },
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

    expect(calls.at(-1)).toMatchObject({
      table: "students",
      eq: [
        ["academy_id", "academy-1"],
        ["status", "withdrawn"],
      ],
      is: [["archived_at", null]],
    });
    expect(result.items[0]).toMatchObject({
      entityType: "student",
      name: "김민지",
      statusLabel: "퇴원",
      daysRemaining: 6,
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

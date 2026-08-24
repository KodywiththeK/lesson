import { describe, expect, it } from "vitest";

import {
  createStudentListQueryOptions,
  fetchStudentList,
  updateStudentProfile,
  type StudentSupabaseRow,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
} from "./students";

function createSupabaseStub(
  rows: StudentSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: StudentListSupabaseClient = {
    from(table) {
      calls.push({ table });

      return {
        select(select) {
          calls[calls.length - 1].select = select;

          return {
            async eq(column, value) {
              calls[calls.length - 1].eq = [column, value];

              return {
                data: error ? null : rows,
                error,
              };
            },
          };
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
          "id, academy_id, name, registered_on, status, student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, final_monthly_fee, active, teachers!student_instruments_academy_teacher_fk(name))",
        eq: ["academy_id", "academy-1"],
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
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});

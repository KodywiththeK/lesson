import { describe, expect, it } from "vitest";

import {
  createTeacherListQueryOptions,
  deleteResignedTeacher,
  fetchTeacherList,
  registerTeacher,
  updateTeacherProfile,
  updateTeacherStatus,
  type TeacherMutationSupabaseClient,
  type TeacherListSupabaseClient,
  type TeacherSupabaseRow,
} from "./teachers";

function createSupabaseStub(
  rows: TeacherSupabaseRow[],
  error: Error | null = null,
) {
  const calls: Array<{ table: string; select?: string; eq?: [string, string] }> =
    [];
  const client: TeacherListSupabaseClient = {
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

describe("fetchTeacherList", () => {
  it("Supabase 선생님 row를 도메인 목록으로 변환하고 academy_id로 제한한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "teacher-1",
        academy_id: "academy-1",
        name: "박선생",
        part: "피아노",
        phone: "010-1111-1111",
        registered_on: "2026-08-01",
        salary_type: "ratio",
        status: "employed",
        contract_start_on: "2026-09-01",
        contract_end_on: "2027-08-31",
        teacher_work_schedules: [
          {
            id: "schedule-1",
            weekday: "월",
            start_time: "14:00:00",
            end_time: "20:00:00",
          },
        ],
        teacher_salary_settings: [
          {
            id: "salary-1",
            pay_type: "ratio",
            ratio_teacher_share: 60,
            monthly_salary: null,
            hourly_rate: null,
            active: true,
          },
        ],
      },
    ]);

    const result = await fetchTeacherList(client, {
      academyId: "academy-1",
      search: "비율제",
    });

    expect(calls).toEqual([
      {
        table: "teachers",
        select:
          "id, academy_id, name, part, phone, registered_on, salary_type, status, contract_start_on, contract_end_on, on_leave_at, resigned_at, teacher_work_schedules!teacher_work_schedules_academy_teacher_fk(id, weekday, start_time, end_time), teacher_salary_settings!teacher_salary_settings_academy_teacher_fk(id, pay_type, ratio_teacher_share, monthly_salary, hourly_rate, active)",
        eq: ["academy_id", "academy-1"],
      },
    ]);
    expect(calls[0].select).not.toContain("resident_registration");
    expect(result.items[0]).toMatchObject({
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1111-1111",
      registeredAt: "2026-08-01",
      payType: "ratio",
      status: "employed",
      contractStartOn: "2026-09-01",
      contractEndOn: "2027-08-31",
      salarySummary: "비율제 60%",
      workScheduleSummary: "월 14:00-20:00",
    });
  });

  it("Supabase 오류는 사용자에게 전달 가능한 오류로 변환한다", async () => {
    const { client } = createSupabaseStub([], new Error("permission denied"));

    await expect(
      fetchTeacherList(client, {
        academyId: "academy-1",
      }),
    ).rejects.toThrow("선생님 목록을 불러오지 못했습니다: permission denied");
  });
});

describe("teacher mutations", () => {
  it("선생님 등록을 계약/근무/급여 상세 RPC로 전달한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: TeacherMutationSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return { data: "teacher-1", error: null };
      },
    };

    const result = await registerTeacher(client, {
      academyId: "academy-1",
      name: "박선생",
      part: "피아노",
      contact: "010-1111-1111",
      registeredAt: "2026-08-21",
      contractStartOn: "2026-09-01",
      contractEndOn: "2027-08-31",
      payType: "ratio",
      ratioAcademyShare: 4,
      ratioTeacherShare: 6,
      workSchedules: [
        { weekday: "monday", startTime: "14:00", endTime: "20:00" },
        { weekday: "wednesday" },
      ],
    });

    expect(calls).toEqual([
      {
        functionName: "register_teacher_with_profile",
        payload: {
          p_academy_id: "academy-1",
          p_name: "박선생",
          p_part: "피아노",
          p_phone: "010-1111-1111",
          p_registered_on: "2026-08-21",
          p_contract_start_on: "2026-09-01",
          p_contract_end_on: "2027-08-31",
          p_pay_type: "ratio",
          p_monthly_salary: null,
          p_hourly_rate: null,
          p_ratio_teacher_share: 60,
          p_work_schedules: [
            { weekday: "월", start_time: "14:00", end_time: "20:00" },
            { weekday: "수", start_time: null, end_time: null },
          ],
        },
      },
    ]);
    expect(result).toMatchObject({
      teacherId: "teacher-1",
      name: "박선생",
      status: "employed",
      salarySummary: "비율제 60%",
      workScheduleSummary: "월 14:00-20:00, 수",
    });
  });

  it("선생님 수정, 상태 변경, 퇴사자 삭제를 RPC로 전달한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client: TeacherMutationSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload });

        return { data: null, error: null };
      },
    };

    await updateTeacherProfile(client, {
      academyId: "academy-1",
      teacherId: "teacher-1",
      name: "김선생",
      part: "피아노",
      contact: "010-2222-3333",
      registeredAt: "2026-08-21",
      contractStartOn: "2026-09-01",
      contractEndOn: "2027-08-31",
      payType: "monthly",
      monthlySalary: 2500000,
      workSchedules: [{ weekday: "friday" }],
    });
    await updateTeacherStatus(client, {
      academyId: "academy-1",
      teacherId: "teacher-1",
      status: "resigned",
      changedAt: "2026-08-25T00:00:00.000Z",
    });
    await deleteResignedTeacher(client, {
      academyId: "academy-1",
      teacherId: "teacher-1",
    });

    expect(calls.map((call) => call.functionName)).toEqual([
      "update_teacher_profile",
      "update_teacher_status",
      "delete_resigned_teacher",
    ]);
    expect(calls[0].payload).toMatchObject({
      p_teacher_id: "teacher-1",
      p_pay_type: "monthly",
      p_monthly_salary: 2500000,
    });
    expect(calls[1].payload).toMatchObject({
      p_status: "resigned",
    });
    expect(calls[2].payload).toEqual({
      p_academy_id: "academy-1",
      p_teacher_id: "teacher-1",
    });
  });
});

describe("createTeacherListQueryOptions", () => {
  it("학원 범위와 검색/필터를 queryKey와 queryFn에 함께 묶는다", async () => {
    const { client } = createSupabaseStub([]);
    const options = createTeacherListQueryOptions(client, {
      academyId: "academy-1",
      search: "박",
      filters: {
        part: "피아노",
        payType: "ratio",
        status: "employed",
      },
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "teachers",
      "list",
      "박",
      "피아노",
      "ratio",
      "employed",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});

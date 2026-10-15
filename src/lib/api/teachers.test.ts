import { describe, expect, it } from "vitest";

import {
  createTeacherListQueryOptions,
  createTeacherStatusManagementQueryOptions,
  deleteResignedTeacher,
  fetchTeacherOptions,
  fetchTeacherStatusManagementList,
  fetchTeacherList,
  registerTeacher,
  updateTeacherProfile,
  updateTeacherStatus,
  type TeacherMutationSupabaseClient,
  type TeacherListSupabaseClient,
  type TeacherSupabaseRow,
} from "./teachers";

function createSupabaseStub(
  rows:
    | TeacherSupabaseRow[]
    | Record<string, TeacherSupabaseRow[] | Array<Record<string, unknown>>>,
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
    ? { teachers: rows as Array<Record<string, unknown>> }
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
  } as TeacherListSupabaseClient;

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
          "id, academy_id, name, part, phone, registered_on, salary_type, status, contract_start_on, contract_end_on, on_leave_at, resigned_at, retention_until, archived_at, teacher_work_schedules!teacher_work_schedules_academy_teacher_fk(id, weekday, start_time, end_time), teacher_salary_settings!teacher_salary_settings_academy_teacher_fk(id, pay_type, ratio_teacher_share, monthly_salary, hourly_rate, active)",
        eq: [
          ["academy_id", "academy-1"],
          ["status", "employed"],
        ],
        is: [["archived_at", null]],
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

describe("fetchTeacherOptions", () => {
  it("드롭다운·급여 계산용 선생님은 10명을 넘어도 전부 가나다순으로 가져온다", async () => {
    const names = ["하", "가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카"];
    const { client, calls } = createSupabaseStub(
      names.map((name, index) => ({
        id: `teacher-${index}`,
        academy_id: "academy-1",
        name: `${name}선생`,
        part: "피아노",
        phone: "010-0000-0000",
        registered_on: "2026-08-01",
        salary_type: "monthly",
        status: "employed",
        teacher_work_schedules: [],
        teacher_salary_settings: [],
      })),
    );

    const options = await fetchTeacherOptions(client, "academy-1");

    expect(options).toHaveLength(12);
    expect(options.map((teacher) => teacher.name)).toEqual([
      "가선생", "나선생", "다선생", "라선생", "마선생", "바선생", "사선생", "아선생", "자선생", "차선생", "카선생", "하선생",
    ]);
    expect(calls[0].eq).toEqual([
      ["academy_id", "academy-1"],
      ["status", "employed"],
    ]);
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
      reason: "계약 종료",
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
      p_reason: "계약 종료",
    });
    expect(calls[2].payload).toEqual({
      p_academy_id: "academy-1",
      p_teacher_id: "teacher-1",
    });
  });

  it("휴직/퇴사 관리 목록을 상태별로 조회한다", async () => {
    const { client, calls } = createSupabaseStub([
      {
        id: "teacher-1",
        academy_id: "academy-1",
        name: "박선생",
        part: "피아노",
        phone: "010-1111-1111",
        registered_on: "2026-08-01",
        salary_type: "ratio",
        status: "resigned",
        contract_start_on: "2026-09-01",
        contract_end_on: "2027-08-31",
        resigned_at: "2026-08-10T00:00:00+09:00",
        retention_until: "2026-09-09",
        archived_at: null,
        teacher_work_schedules: [],
        teacher_salary_settings: [],
      },
    ]);

    const result = await fetchTeacherStatusManagementList(client, {
      academyId: "academy-1",
      status: "resigned",
      today: "2026-08-25",
    });

    expect(calls.find((call) => call.table === "teachers")).toMatchObject({
      table: "teachers",
      eq: [
        ["academy_id", "academy-1"],
        ["status", "resigned"],
      ],
      is: [["archived_at", null]],
    });
    expect(
      calls.find((call) => call.table === "entity_status_transitions"),
    ).toMatchObject({
      table: "entity_status_transitions",
      eq: [
        ["academy_id", "academy-1"],
        ["entity_type", "teacher"],
        ["to_status", "resigned"],
      ],
      order: [["changed_at", { ascending: false }]],
    });
    expect(result.items[0]).toMatchObject({
      entityType: "teacher",
      name: "박선생",
      statusLabel: "퇴사",
      daysRemaining: 15,
    });
  });

  it("휴직/퇴사 관리 목록에 최신 상태 변경 메모를 붙인다", async () => {
    const { client } = createSupabaseStub({
      teachers: [
        {
          id: "teacher-1",
          academy_id: "academy-1",
          name: "박선생",
          part: "피아노",
          phone: "010-1111-1111",
          registered_on: "2026-08-01",
          salary_type: "ratio",
          status: "on_leave",
          on_leave_at: "2026-08-20T00:00:00+09:00",
          archived_at: null,
          teacher_work_schedules: [],
          teacher_salary_settings: [],
        },
      ],
      entity_status_transitions: [
        {
          entity_type: "teacher",
          entity_id: "teacher-1",
          to_status: "on_leave",
          reason: "콩쿠르 시즌 휴직",
          changed_at: "2026-08-20T00:00:00+09:00",
        },
      ],
    });

    const result = await fetchTeacherStatusManagementList(client, {
      academyId: "academy-1",
      status: "on_leave",
      today: "2026-08-25",
    });

    expect(result.items[0]).toMatchObject({
      statusReason: "콩쿠르 시즌 휴직",
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
      "1",
      "",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });

  it("페이지와 페이지 크기가 바뀌면 queryKey도 달라진다", () => {
    const { client } = createSupabaseStub([]);
    const secondPage = createTeacherListQueryOptions(client, {
      academyId: "academy-1",
      page: 2,
      pageSize: 20,
    });
    const firstPage = createTeacherListQueryOptions(client, {
      academyId: "academy-1",
      page: 1,
      pageSize: 20,
    });

    expect(secondPage.queryKey.slice(-2)).toEqual(["2", "20"]);
    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
  });
});

describe("휴직/퇴사 관리 목록 검색과 페이지", () => {
  const manyTeacherRows = Array.from({ length: 12 }, (_, index) => ({
    id: `teacher-${String(index).padStart(2, "0")}`,
    academy_id: "academy-1",
    name: index === 11 ? "하선생" : `가선생${String(index).padStart(2, "0")}`,
    part: "피아노",
    phone: "010-0000-0000",
    registered_on: "2026-08-01",
    salary_type: "monthly" as const,
    status: "on_leave" as const,
    on_leave_at: "2026-08-20T00:00:00+09:00",
    archived_at: null,
    teacher_work_schedules: [],
    teacher_salary_settings: [],
  }));

  it("검색어와 페이지를 받아 해당 페이지의 선생님만 돌려준다", async () => {
    const { client } = createSupabaseStub({ teachers: manyTeacherRows });

    const secondPage = await fetchTeacherStatusManagementList(client, {
      academyId: "academy-1",
      status: "on_leave",
      today: "2026-08-25",
      page: 2,
      pageSize: 10,
    });
    const searched = await fetchTeacherStatusManagementList(client, {
      academyId: "academy-1",
      status: "on_leave",
      today: "2026-08-25",
      search: "하선",
    });

    expect(secondPage.totalItems).toBe(12);
    expect(secondPage.items.map((item) => item.name)).toEqual([
      "가선생10",
      "하선생",
    ]);
    expect(searched.items.map((item) => item.name)).toEqual(["하선생"]);
  });

  it("검색어, 페이지, 페이지 크기를 queryKey에 포함한다", () => {
    const { client } = createSupabaseStub([]);

    const options = createTeacherStatusManagementQueryOptions(client, {
      academyId: "academy-1",
      status: "resigned",
      search: "박",
      page: 3,
      pageSize: 30,
    });

    expect(options.queryKey).toEqual([
      "academy",
      "academy-1",
      "status-management",
      "teacher",
      "resigned",
      "박",
      "3",
      "30",
    ]);
  });
});

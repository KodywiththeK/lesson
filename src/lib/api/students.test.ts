import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentEnrollmentFields } from "@/domain/student-enrollment-edit";

import {
  createStudentListQueryOptions,
  createStudentStatusManagementQueryOptions,
  fetchStudentOptions,
  fetchStudentStatusManagementList,
  fetchStudentList,
  registerStudentEnrollment,
  updateStudentEnrollments,
  updateStudentStatus,
  type StudentSupabaseRow,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
  type StudentRegistrationSupabaseClient,
  type RegisterStudentEnrollmentInput,
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
          "id, academy_id, name, age, age_as_of_year, grade, grade_as_of_year, school, occupation, attendance_code, registered_on, status, suspended_at, withdrawn_at, retention_until, archived_at, student_contacts!student_contacts_academy_student_fk(id, created_at, relationship, phone, phone_last4), student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label, discount_kinds, referral_discount_month, referral_discount_amount, final_monthly_fee, active, student_instrument_weekly_schedules!student_iws_academy_instrument_fk(id, weekday, start_time, end_time), teachers!student_instruments_academy_teacher_fk(name))",
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
        functionName: "register_student_with_contacts",
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
          p_secondary_contact: null,
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
              discount_kinds: [],
              referral_discount_month: null,
              referral_discount_amount: 0,
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

  it("학원레슨은 선생님이 없거나 시간을 한쪽만 입력하면 RPC 전에 거부한다", async () => {
    let called = false;
    const client: StudentRegistrationSupabaseClient = {
      async rpc() { called = true; return { data: "student-1", error: null }; },
    };
    const input: RegisterStudentEnrollmentInput = {
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
    await expect(registerStudentEnrollment(client, input)).resolves.toMatchObject({ studentId: "student-1" });
    expect(called).toBe(true);
    called = false;
    input.instruments[0].weeklySchedules[0].startTime = "15:00";
    await expect(registerStudentEnrollment(client, input)).rejects.toThrow("시작 시간과 종료 시간을 함께");
    expect(called).toBe(false);
  });
});

describe("fetchStudentList 요일 표시 순서", () => {
  it("여러 악기와 요일별 행이 섞여 있어도 요일을 월→일 순서로 보여 준다", async () => {
    const { client } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        student_instruments: [
          {
            instrument_name: "피아노",
            weekdays: ["목", "월"],
            teachers: null,
            student_instrument_weekly_schedules: [
              { weekday: "목", start_time: "17:00:00", end_time: "17:50:00" },
              { weekday: "월", start_time: "15:00:00", end_time: "15:50:00" },
            ],
          },
          {
            instrument_name: "바이올린",
            weekdays: ["수"],
            teachers: null,
          },
        ],
      },
    ]);

    const list = await fetchStudentList(client, { academyId: "academy-1" });
    const [student] = list.items;

    expect(student.weekdayLabels).toEqual(["월", "수", "목"]);
    expect(student.instruments?.[0].weekdayLabels).toEqual(["월", "목"]);
    expect(student.instruments?.[0].startTime).toBe("15:00");
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
      "sort",
      "name",
      "asc",
    ]);
    await expect(options.queryFn()).resolves.toMatchObject({
      items: [],
      totalItems: 0,
    });
  });
});

describe("원생 나이·할인 필드 조회", () => {
  it("나이 기준 연도와 할인 종류, 지인 소개 할인 달을 목록 행으로 변환한다", async () => {
    const { client } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        age: 9,
        age_as_of_year: 2025,
        student_instruments: [
          {
            instrument_name: "피아노",
            weekdays: ["월", "수"],
            discount_total: 10000,
            discount_kinds: ["sibling", "referral", "unknown-kind"],
            referral_discount_month: "2026-10-01",
            referral_discount_amount: 10000,
            teachers: null,
          },
          { instrument_name: "첼로", weekdays: [], teachers: null },
        ],
      },
    ] as StudentSupabaseRow[]);

    const [student] = (await fetchStudentList(client, { academyId: "academy-1" })).items;

    expect(student).toMatchObject({ age: 9, ageAsOfYear: 2025 });
    expect(student.instruments?.[0]).toMatchObject({
      discountKinds: ["sibling", "referral"],
      referralDiscountMonth: "2026-10",
      referralDiscountAmount: 10000,
    });
    expect(student.instruments?.[1]).toMatchObject({
      discountKinds: [],
      referralDiscountAmount: 0,
    });
    expect(student.instruments?.[1].referralDiscountMonth).toBeUndefined();
  });
});

describe("registerStudentEnrollment 할인·나이", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function createRegistrationRecorder() {
    const payloads: Array<Record<string, unknown>> = [];
    const client: StudentRegistrationSupabaseClient = {
      async rpc(_functionName, payload) {
        payloads.push(payload as unknown as Record<string, unknown>);

        return { data: "student-1", error: null };
      },
    };

    return { client, payloads };
  }

  const baseInput = {
    academyId: "academy-1",
    name: "김민지",
    registeredAt: "2026-10-16",
    age: 9,
    contact: { relationship: "모", phone: "010-1111-2222" },
    instruments: [
      {
        instrumentId: "violin",
        instrumentName: "바이올린",
        teacherId: "teacher-2",
        teacherName: "최선생",
        lessonType: "private" as const,
        weeklySchedules: [{ weekday: "friday" }],
        progress: "스즈키 1~3권",
        lessonFee: 140000,
        discountTotal: 20000,
        discountLabel: "두 자녀 할인, 두 악기 할인, 지인 소개 할인",
        finalMonthlyFee: 120000,
        discountKinds: ["sibling", "multi_instrument", "referral"] as Array<
          "sibling" | "multi_instrument" | "referral"
        >,
        referralDiscountMonth: "2026-10",
        referralDiscountAmount: 10000,
      },
    ],
  };

  it("할인 종류와 소개 달(그 달 1일), 소개 할인액을 악기별 payload로 보낸다", async () => {
    const { client, payloads } = createRegistrationRecorder();

    await registerStudentEnrollment(client, baseInput);

    expect(payloads[0].p_enrollments).toEqual([
      expect.objectContaining({
        discount_total: 20000,
        discount_kinds: ["sibling", "multi_instrument", "referral"],
        referral_discount_month: "2026-10-01",
        referral_discount_amount: 10000,
        final_monthly_fee: 120000,
      }),
    ]);
  });

  it("등록한 원생 행의 나이 기준 연도는 올해(KST)이고 나이를 입력하지 않았으면 비운다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T16:00:00Z")); // KST 2027-01-01 01:00
    const { client } = createRegistrationRecorder();

    expect(await registerStudentEnrollment(client, baseInput)).toMatchObject({
      age: 9,
      ageAsOfYear: 2027,
    });
    expect(
      (await registerStudentEnrollment(client, { ...baseInput, age: undefined })).ageAsOfYear,
    ).toBeUndefined();
  });
});

describe("createStudentListQueryOptions 정렬", () => {
  it("정렬 기준과 방향이 다르면 queryKey도 달라 정렬이 바뀔 때 다시 조회한다", () => {
    const { client } = createSupabaseStub([]);
    const keyFor = (sort?: { key: "name" | "teacher"; direction: "asc" | "desc" }) =>
      createStudentListQueryOptions(client, { academyId: "academy-1", sort }).queryKey;

    expect(keyFor({ key: "teacher", direction: "desc" }).slice(-3)).toEqual(["sort", "teacher", "desc"]);
    expect(keyFor({ key: "teacher", direction: "asc" })).not.toEqual(keyFor({ key: "teacher", direction: "desc" }));
    expect(keyFor()).toEqual(keyFor({ key: "name", direction: "asc" }));
  });
});

describe("fetchStudentList 종료한 수강", () => {
  it("종료(비활성)한 악기는 목록·상세의 악기, 선생님, 요일 요약에서 뺀다", async () => {
    const { client } = createSupabaseStub([
      {
        id: "student-1",
        academy_id: "academy-1",
        name: "김민지",
        student_instruments: [
          { id: "si-piano", instrument_name: "피아노", weekdays: ["월"], active: true, teachers: { name: "박선생" } },
          { id: "si-violin", instrument_name: "바이올린", weekdays: ["수"], active: false, teachers: { name: "최선생" } },
        ],
      },
    ]);

    const result = await fetchStudentList(client, { academyId: "academy-1" });

    expect(result.items[0]).toMatchObject({
      teacherNames: ["박선생"],
      instrumentNames: ["피아노"],
      weekdayLabels: ["월"],
    });
    expect(result.items[0].instruments?.map((instrument) => instrument.studentInstrumentId)).toEqual(["si-piano"]);
  });
});

describe("updateStudentEnrollments", () => {
  const academyPiano: StudentEnrollmentFields = {
    lessonType: "academy",
    teacherId: "teacher-1",
    teacherName: "김하늘",
    instrumentId: "piano",
    instrumentName: "피아노",
    weeklySchedules: [{ weekdayLabel: "월", startTime: "15:00", endTime: "15:50" }],
    progress: "체르니 40",
    lessonFee: 200000,
    discountTotal: 10000,
    finalMonthlyFee: 190000,
  };
  const baseInput = { academyId: "academy-1", studentId: "student-1", name: " 김민지 " };

  function createRecorder(response: { data?: unknown; error?: Error | null } = {}) {
    const calls: Array<{ functionName: string; payload: Record<string, unknown> }> = [];
    const client: StudentUpdateSupabaseClient = {
      async rpc(functionName, payload) {
        calls.push({ functionName, payload: payload as unknown as Record<string, unknown> });

        return { data: (response.data ?? null) as never, error: response.error ?? null };
      },
    };

    return { client, calls };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it("이름·기본 정보·악기 변경을 RPC 한 번으로 보낸다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T03:00:00Z"));
    const { client, calls } = createRecorder();

    await updateStudentEnrollments(client, {
      ...baseInput,
      basicInfo: {
        registeredOn: "2026-03-01",
        age: 9,
        grade: " 초3 ",
        occupation: "",
        contactRelationship: "어머니",
        contactPhone: " 010-1234-5678 ",
      },
      changes: [
        { ...academyPiano, action: "update", studentInstrumentId: "si-piano" },
        {
          ...academyPiano,
          action: "add",
          startedOn: "2026-10-20",
          instrumentId: "cello",
          instrumentName: "첼로",
          discountKinds: ["multi_instrument", "referral"],
          referralDiscountMonth: "2026-10",
          referralDiscountAmount: 5000,
          discountLabel: "두 악기 할인, 지인 소개 할인",
        },
        { action: "end", studentInstrumentId: "si-violin" },
      ],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].functionName).toBe("update_student_with_contacts");
    expect(calls[0].payload).toEqual({
      p_academy_id: "academy-1",
      p_student_id: "student-1",
      p_name: "김민지",
      p_basic: {
        registered_on: "2026-03-01",
        age: 9,
        grade: "초3",
        school: null,
        occupation: null,
        contact_relationship: "어머니",
        contact_phone: "010-1234-5678",
      },
      p_instruments: [
        {
          action: "update",
          student_instrument_id: "si-piano",
          teacher_id: "teacher-1",
          instrument_id: "piano",
          instrument_name: "피아노",
          lesson_type: "academy",
          progress: "체르니 40",
          lesson_fee: 200000,
          discount_total: 10000,
          final_monthly_fee: 190000,
          effective_from: "2026-10-17",
          weekly_schedules: [{ weekday: "월", start_time: "15:00", end_time: "15:50" }],
        },
        {
          action: "add",
          started_on: "2026-10-20",
          teacher_id: "teacher-1",
          instrument_id: "cello",
          instrument_name: "첼로",
          lesson_type: "academy",
          progress: "체르니 40",
          lesson_fee: 200000,
          discount_total: 10000,
          final_monthly_fee: 190000,
          weekly_schedules: [{ weekday: "월", start_time: "15:00", end_time: "15:50" }],
          discount_kinds: ["multi_instrument", "referral"],
          referral_discount_month: "2026-10-01",
          referral_discount_amount: 5000,
          discount_label: "두 악기 할인, 지인 소개 할인",
        },
        { action: "end", student_instrument_id: "si-violin" },
      ],
    });
  });

  it("기본 정보가 없으면 p_basic은 null이고, 할인 종류를 고르지 않은 수정은 서버의 기존 할인을 건드리지 않는다", async () => {
    const { client, calls } = createRecorder();

    await updateStudentEnrollments(client, {
      ...baseInput,
      changes: [{ ...academyPiano, action: "update", studentInstrumentId: "si-piano", effectiveFrom: "2026-11-02" }],
    });

    const [update] = calls[0].payload.p_instruments as Array<Record<string, unknown>>;

    expect(calls[0].payload.p_basic).toBeNull();
    expect(update).not.toHaveProperty("discount_kinds");
    expect(update.effective_from).toBe("2026-11-02");
  });

  it("추가한 수강의 할인 종류를 고르지 않으면 빈 할인으로 보낸다", async () => {
    const { client, calls } = createRecorder();

    await updateStudentEnrollments(client, {
      ...baseInput,
      changes: [{ ...academyPiano, action: "add", startedOn: "2026-10-20", instrumentId: "cello", instrumentName: "첼로" }],
    });

    const [add] = calls[0].payload.p_instruments as Array<Record<string, unknown>>;

    expect(add).toMatchObject({
      discount_kinds: [],
      referral_discount_month: null,
      referral_discount_amount: 0,
    });
  });

  it("서버가 알려 준 추가·종료 결과를 도메인 모양으로 돌려준다", async () => {
    const { client } = createRecorder({
      data: {
        added: [{ student_instrument_id: "si-cello", instrument_id: "cello" }],
        ended: [{ student_instrument_id: "si-violin", remaining_event_count: 2 }],
      },
    });

    const result = await updateStudentEnrollments(client, {
      ...baseInput,
      changes: [
        { ...academyPiano, action: "add", startedOn: "2026-10-20", instrumentId: "cello", instrumentName: "첼로" },
        { action: "end", studentInstrumentId: "si-violin" },
      ],
    });

    expect(result).toEqual({
      addedStudentInstrumentIds: ["si-cello"],
      ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 2 }],
    });
  });

  it("검증에 걸리면 RPC를 부르지 않는다", async () => {
    const { client, calls } = createRecorder();

    await expect(updateStudentEnrollments(client, { ...baseInput, name: " ", changes: [] })).rejects.toThrow(
      "원생명은 필수입니다.",
    );
    await expect(
      updateStudentEnrollments(client, {
        ...baseInput,
        changes: [{ ...academyPiano, action: "add", startedOn: "2026-10-20", teacherId: null }],
      }),
    ).rejects.toThrow("학원레슨 선생님을 선택해야 합니다.");
    expect(calls).toHaveLength(0);
  });

  it("서버가 거부하면 서버의 한국어 사유를 담아 던진다", async () => {
    const { client } = createRecorder({ error: new Error("수강 중인 악기는 최소 1개 있어야 합니다.") });

    await expect(
      updateStudentEnrollments(client, {
        ...baseInput,
        changes: [{ action: "end", studentInstrumentId: "si-piano" }],
      }),
    ).rejects.toThrow("원생 정보를 수정하지 못했습니다: 수강 중인 악기는 최소 1개 있어야 합니다.");
  });
});

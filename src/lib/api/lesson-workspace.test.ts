import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createAcademyLessonEvent,
  deleteAcademyLessonEvent,
  fetchAcademyAttendeeCounts,
  fetchLessonWorkspaceData,
  moveAcademyLessonEvent,
  resetAcademyLessonAttendance,
  resolveAcademyLessonAbsence,
  type LessonWorkspaceSupabaseClient,
} from "./lesson-workspace";

describe("fetchLessonWorkspaceData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
        id: "memo-1",
        academyId: "academy-1",
        lessonKind: "academy",
        date: "2026-08-21",
        content: "콩쿠르 보강 확인",
        studentId: "student-1",
        studentName: "김민지",
        teacherId: "teacher-1",
        teacherName: "김하늘",
        unread: false,
      },
      {
        id: "memo-2",
        academyId: "academy-1",
        lessonKind: "private",
        date: "2026-08-22",
        content: "오유진 선생님 시간표 공유",
        studentId: null,
        studentName: null,
        teacherId: "teacher-2",
        teacherName: "오유진",
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

  it("개인레슨의 출석·결석 상태는 출결 기록에서 가져와 재조회 후에도 유지한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const privateRow = (id: string, attendanceStatus: string | null) => ({
      id,
      academy_id: "academy-1",
      student_id: "student-1",
      students: { name: "김민지" },
      instrument_id: "piano",
      instrument_name: "피아노",
      teacher_id: "teacher-1",
      teachers: { name: "박선생" },
      lesson_kind: "private",
      origin: "private",
      starts_at: "2026-08-21T15:00:00+09:00",
      ends_at: "2026-08-21T15:50:00+09:00",
      status: "scheduled",
      attendance_records: attendanceStatus
        ? [{ status: attendanceStatus, absence_reason: null, marked_at: "2026-08-21T06:00:00Z" }]
        : [],
    });
    const client = createLessonWorkspaceClient(calls, {
      eventRows: [
        privateRow("private-present", "present"),
        privateRow("private-absent", "absent"),
        privateRow("private-scheduled", null),
      ],
    });

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
    });

    expect(
      Object.fromEntries(result.privateLessons.map((lesson) => [lesson.id, lesson.status])),
    ).toEqual({
      "private-present": "present",
      "private-absent": "absent",
      "private-scheduled": "scheduled",
    });
  });

  it("학원 레슨의 보강 처리 여부와 시간 미입력 여부를 서버 값으로 읽고 보강 일정은 보강 수업으로 표시한다", async () => {
    const academyRow = (id: string, overrides: Record<string, unknown>) => ({
      id,
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
      time_unspecified: false,
      attendance_records: [],
      ...overrides,
    });
    const absent = (resolution: unknown) => [
      {
        status: "absent",
        absence_reason: "감기",
        marked_at: "2026-08-21T06:00:00Z",
        absence_resolutions: resolution,
      },
    ];
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls, {
      eventRows: [
        academyRow("unresolved", { attendance_records: absent(null) }),
        academyRow("resolved-object", { attendance_records: absent({ resolved_as: "makeup" }) }),
        academyRow("resolved-array", { attendance_records: absent([{ resolved_as: "pass" }]) }),
        academyRow("makeup-event", {
          origin: "makeup",
          source_lesson_event_id: "resolved-object",
          time_unspecified: true,
          starts_at: "2026-08-24T15:00:00+09:00",
          ends_at: "2026-08-24T15:50:00+09:00",
        }),
        academyRow("private-makeup", { lesson_kind: "private", origin: "makeup" }),
      ],
    });

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
    });
    const rows = result.academySheets.flatMap((sheet) => sheet.rows);
    const byId = (id: string) => rows.find((row) => row.lessonEventId === id);

    expect(byId("unresolved")?.absenceResolution).toBeUndefined();
    expect(byId("resolved-object")?.absenceResolution).toBe("makeup");
    expect(byId("resolved-array")?.absenceResolution).toBe("pass");
    expect(byId("makeup-event")).toMatchObject({
      originLabel: "보강 수업",
      timeUnspecified: true,
      sourceLessonEventId: "resolved-object",
    });
    expect(byId("unresolved")?.sourceLessonEventId).toBeUndefined();
    expect(byId("unresolved")?.timeUnspecified).toBeUndefined();
    expect(result.privateLessons[0]?.originLabel).toBe("보강");

    const eventsSelect = calls.find((call) => call.table === "lesson_events")?.select as string;
    expect(eventsSelect).toContain("time_unspecified");
    expect(eventsSelect).toContain("source_lesson_event_id");
    expect(eventsSelect).toContain("absence_resolutions");
  });

  it("회차권 잔여는 오늘 유효한 회차권만 같은 원생·악기끼리 합산한다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    const grant = (id: string, studentId: string, instrumentId: string, remaining: number, from: string, until: string) => ({
      id,
      academy_id: "academy-1",
      student_id: studentId,
      instrument_id: instrumentId,
      instrument_name: instrumentId === "piano" ? "피아노" : "바이올린",
      remaining_count: remaining,
      total_granted_count: remaining + 1,
      valid_from: from,
      valid_until: until,
    });
    const client = createLessonWorkspaceClient([], {
      ticketRows: [
        grant("g1", "student-1", "piano", 3, "2026-08-01", "2026-09-30"),
        grant("g2", "student-1", "piano", 2, "2026-09-01", "2026-12-31"),
        grant("g3", "student-1", "piano", 5, "2026-01-01", "2026-07-31"),
        grant("g4", "student-2", "violin", 4, "2026-10-01", "2026-12-31"),
      ],
    });

    const result = await fetchLessonWorkspaceData(client, { academyId: "academy-1", month: "2026-09" });

    expect(result.ticketBalances).toEqual([
      {
        academyId: "academy-1",
        studentId: "student-1",
        instrumentId: "piano",
        instrumentName: "피아노",
        remainingCount: 5,
        // 총 회차도 유효한 회차권만 합산한다: (3+1) + (2+1)
        totalGrantedCount: 7,
        priorLessonCount: 0,
      },
    ]);
  });

  it("회차는 회차권 유효 기간 안에서 조회한 달 이전에 잡힌 레슨 수를 이어서 센다", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-10T03:00:00Z"));
    const calls: Array<Record<string, unknown>> = [];
    const prior = (studentId: string, instrumentId: string, startsAt: string) => ({
      student_id: studentId,
      instrument_id: instrumentId,
      starts_at: startsAt,
    });
    const client = createLessonWorkspaceClient(calls, {
      ticketRows: [
        {
          id: "g1",
          academy_id: "academy-1",
          student_id: "student-1",
          instrument_id: "piano",
          instrument_name: "피아노",
          remaining_count: 4,
          total_granted_count: 8,
          valid_from: "2026-09-01",
          valid_until: "2026-12-31",
        },
      ],
      priorLessonRows: [
        prior("student-1", "piano", "2026-09-08T10:00:00+09:00"),
        prior("student-1", "piano", "2026-09-15T10:00:00+09:00"),
        prior("student-1", "piano", "2026-09-22T10:00:00+09:00"),
        // 회차권 시작 전 레슨, 회차권 없는 악기, 다른 원생은 세지 않는다.
        prior("student-1", "piano", "2026-08-25T10:00:00+09:00"),
        prior("student-1", "violin", "2026-09-10T10:00:00+09:00"),
        prior("student-2", "piano", "2026-09-10T10:00:00+09:00"),
      ],
    });

    const result = await fetchLessonWorkspaceData(client, { academyId: "academy-1", month: "2026-10" });

    expect(result.ticketBalances).toEqual([
      expect.objectContaining({ studentId: "student-1", instrumentId: "piano", priorLessonCount: 3 }),
    ]);
    const priorCall = calls.find((call) => call.select === "student_id, instrument_id, starts_at");
    expect(priorCall?.gte).toEqual(["starts_at", "2026-09-01T00:00:00+09:00"]);
    expect(priorCall?.lt).toEqual(["starts_at", "2026-10-01T00:00:00+09:00"]);
  });

  it("선생님 계정은 수강 정보 표를 읽지 않고 담당 원생 명단 RPC로 레슨원생 검색 대상을 만든다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls, {
      teacherRosterRows: [
        { student_id: "student-1", student_name: "김민지", instrument_names: ["피아노"], weekdays: ["월"] },
      ],
    });

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
      canManage: false,
    });

    expect(calls).toContainEqual(
      expect.objectContaining({
        functionName: "list_students_for_teacher",
        payload: { p_academy_id: "academy-1" },
      }),
    );
    // 개인레슨 선택지는 student_instruments(선생님은 직접 읽을 수 없음)를 embed하지 않고 RPC로만 만든다.
    // 학원 일정 선택지 조회 1건만 남는다(선생님 목록 용도).
    expect(
      calls.filter((call) => call.table === "students" && String(call.select).includes("student_instruments")),
    ).toHaveLength(1);
    expect(result.privateRegistrationOptions.students).toEqual([
      { studentId: "student-1", studentName: "김민지", instruments: [] },
    ]);
    expect(result.privateRegistrationOptions.teachers).toEqual([]);
  });

  it("원장·데스크는 기존처럼 수강 정보가 있는 원생만 레슨 등록 선택지로 받는다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    await fetchLessonWorkspaceData(client, { academyId: "academy-1", month: "2026-08" });

    expect(calls.some((call) => call.functionName === "list_students_for_teacher")).toBe(false);
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

  it("대상 컬럼 migration 전 DB에서는 기존 날짜 메모를 일반 메모로 다시 조회한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls, {
      lessonMemoMissingTargetColumns: true,
    });

    const result = await fetchLessonWorkspaceData(client, {
      academyId: "academy-1",
      month: "2026-08",
    });

    const memoSelects = calls
      .filter((call) => call.table === "lesson_calendar_memos")
      .map((call) => call.select);

    expect(memoSelects).toEqual([
      "id, academy_id, lesson_kind, memo_date, content, unread, student_id, student_name, teacher_id, teacher_name",
      "id, academy_id, lesson_kind, memo_date, content, unread",
    ]);
    expect(result.calendarMemos[0]).toMatchObject({
      id: "memo-1",
      content: "콩쿠르 보강 확인",
      studentId: null,
      teacherId: null,
    });
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

describe("resolveAcademyLessonAbsence", () => {
  it("결석을 보강으로 확정하면 사유서 내용을 RPC로 보내고 보강 일정 id와 포스트잇 기록을 돌려받는다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    const result = await resolveAcademyLessonAbsence(client, {
      academyId: "academy-1",
      sourceLessonEventId: "lesson-absent",
      studentId: "student-1",
      resolution: "makeup",
      targetDate: "2026-08-24",
      startTime: "15:00",
      endTime: "15:50",
      reason: " 감기 결석 ",
    });

    expect(calls.at(-1)).toEqual({
      functionName: "resolve_academy_lesson_absence",
      payload: {
        p_academy_id: "academy-1",
        p_source_lesson_event_id: "lesson-absent",
        p_student_id: "student-1",
        p_resolution: "makeup",
        p_target_date: "2026-08-24",
        p_start_time: "15:00",
        p_end_time: "15:50",
        p_reason: "감기 결석",
      },
    });
    expect(result).toEqual({
      resolution: "makeup",
      makeupLessonEventId: "lesson-makeup",
      memoLine: "김민지, 8/24 [월요일] 15:00 보강 - 8/21 [금요일] 감기 결석",
      month: "2026-08",
    });
  });

  it("패스는 날짜·시간·사유가 없어도 보낼 수 있고 보강 일정 id는 없다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls, {
      resolveResult: {
        resolution: "pass",
        makeup_lesson_event_id: null,
        memo_line: "김민지, 8/21 [금요일] 사유없음",
        month: "2026-08",
      },
    });

    const result = await resolveAcademyLessonAbsence(client, {
      academyId: "academy-1",
      sourceLessonEventId: "lesson-absent",
      studentId: "student-1",
      resolution: "pass",
    });

    expect(calls.at(-1)?.payload).toEqual({
      p_academy_id: "academy-1",
      p_source_lesson_event_id: "lesson-absent",
      p_student_id: "student-1",
      p_resolution: "pass",
      p_target_date: null,
      p_start_time: null,
      p_end_time: null,
      p_reason: null,
    });
    expect(result.makeupLessonEventId).toBeNull();
    expect(result.memoLine).toBe("김민지, 8/21 [금요일] 사유없음");
  });

  it("이미 처리된 결석 같은 DB 거부 사유를 저장 실패 오류에 담는다", async () => {
    const client = createLessonWorkspaceClient([], {
      rpcError: new Error("이미 보강 또는 패스로 처리된 결석입니다."),
    });

    await expect(
      resolveAcademyLessonAbsence(client, {
        academyId: "academy-1",
        sourceLessonEventId: "lesson-absent",
        studentId: "student-1",
        resolution: "pass",
      }),
    ).rejects.toThrow("결석 사유서를 저장하지 못했습니다: 이미 보강 또는 패스로 처리된 결석입니다.");
  });
});

describe("deleteAcademyLessonEvent", () => {
  it("삭제 사유와 함께 학원 일정 삭제를 RPC로 위임한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    await deleteAcademyLessonEvent(client, {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      reason: " 휴원 ",
    });

    expect(calls.at(-1)).toEqual({
      functionName: "delete_academy_lesson_event",
      payload: {
        p_academy_id: "academy-1",
        p_lesson_event_id: "lesson-1",
        p_reason: "휴원",
      },
    });
    // 일정 삭제 함수 한 번뿐이다. 원생·수강 정보 테이블은 건드리지 않는다.
    expect(calls).toHaveLength(1);
  });

  it("출결이 처리된 일정 삭제를 거부하면 사유를 오류에 담는다", async () => {
    const client = createLessonWorkspaceClient([], {
      rpcError: new Error("이미 출결 처리된 일정은 삭제할 수 없습니다."),
    });

    await expect(
      deleteAcademyLessonEvent(client, {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        reason: "휴원",
      }),
    ).rejects.toThrow("학원 일정을 삭제하지 못했습니다: 이미 출결 처리된 일정은 삭제할 수 없습니다.");
  });
});

describe("fetchAcademyAttendeeCounts", () => {
  it("그 달 정기 일정을 준비한 뒤 날짜별 학원 레슨 등원 인원을 원생 기준으로 센다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const eventRow = (id: string, studentId: string, startsAt: string, overrides = {}) => ({
      id,
      student_id: studentId,
      lesson_kind: "academy",
      status: "scheduled",
      starts_at: startsAt,
      ...overrides,
    });
    const client = createLessonWorkspaceClient(calls, {
      eventRows: [
        eventRow("a", "student-1", "2026-09-01T15:00:00+09:00"),
        eventRow("b", "student-1", "2026-09-01T17:00:00+09:00"),
        eventRow("c", "student-2", "2026-09-01T16:00:00+09:00"),
        eventRow("d", "student-3", "2026-09-02T16:00:00+09:00"),
        eventRow("e", "student-4", "2026-09-02T16:00:00+09:00", { lesson_kind: "private" }),
        eventRow("f", "student-5", "2026-09-02T16:00:00+09:00", { status: "cancelled" }),
      ],
    });

    const counts = await fetchAcademyAttendeeCounts(client, {
      academyId: "academy-1",
      month: "2026-09",
    });

    expect(calls[0]).toEqual({
      functionName: "ensure_monthly_academy_lesson_events",
      payload: { p_academy_id: "academy-1", p_month: "2026-09" },
    });
    expect(counts).toEqual({ "2026-09-01": 2, "2026-09-02": 1 });
  });

  it("정기 일정 준비에 실패하면 인원을 잘못 세지 않고 오류로 알린다", async () => {
    const client = createLessonWorkspaceClient([], { rpcError: new Error("permission denied") });

    await expect(
      fetchAcademyAttendeeCounts(client, { academyId: "academy-1", month: "2026-09" }),
    ).rejects.toThrow("다음 달 정기 일정을 준비하지 못했습니다: permission denied");
  });
});

describe("moveAcademyLessonEvent", () => {
  it("학원 레슨 1회 일정 이동을 RPC로 위임하고 이동된 row를 반환한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    const result = await moveAcademyLessonEvent(client, {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      targetDate: "2026-08-24",
      startTime: "18:00",
      endTime: "18:50",
      reason: "콩쿠르 보충",
    });

    expect(calls.at(-1)).toEqual({
      functionName: "move_academy_lesson_event",
      payload: {
        p_academy_id: "academy-1",
        p_lesson_event_id: "lesson-1",
        p_target_date: "2026-08-24",
        p_start_time: "18:00",
        p_end_time: "18:50",
        p_reason: "콩쿠르 보충",
      },
    });
    // 이동은 그 달 일정만 바꾸므로 원생·수강 정보 테이블 쓰기가 없다.
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({
      lessonEventId: "lesson-moved",
      date: "2026-08-24",
      startTime: "18:00",
      endTime: "18:50",
      origin: "rescheduled",
      originLabel: "이동",
    });
  });
});

describe("resetAcademyLessonAttendance", () => {
  it("학원 레슨 출결 초기화를 RPC로 위임한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonWorkspaceClient(calls);

    await resetAcademyLessonAttendance(client, {
      academyId: "academy-1",
      lessonEventId: "lesson-1",
      studentId: "student-1",
      reason: "오입력 정정",
    });

    expect(calls.at(-1)).toEqual({
      functionName: "reset_academy_lesson_attendance",
      payload: {
        p_academy_id: "academy-1",
        p_lesson_event_id: "lesson-1",
        p_student_id: "student-1",
        p_reason: "오입력 정정",
      },
    });
  });
});

function createLessonWorkspaceClient(
  calls: Array<Record<string, unknown>>,
  options: {
    rpcError?: Error;
    eventRows?: Array<Record<string, unknown>>;
    ticketRows?: Array<Record<string, unknown>>;
    priorLessonRows?: Array<Record<string, unknown>>;
    lessonMemoMissingTargetColumns?: boolean;
    resolveResult?: Record<string, unknown>;
    teacherRosterRows?: Array<Record<string, unknown>>;
  } = {},
): LessonWorkspaceSupabaseClient {
  return {
    async rpc(functionName: string, payload: Record<string, unknown>) {
      calls.push({ functionName, payload });

      if (functionName === "list_students_for_teacher") {
        return { data: options.teacherRosterRows ?? [], error: null };
      }

      if (functionName === "resolve_academy_lesson_absence" && !options.rpcError) {
        return {
          data: options.resolveResult ?? {
            resolution: "makeup",
            makeup_lesson_event_id: "lesson-makeup",
            memo_line: "김민지, 8/24 [월요일] 15:00 보강 - 8/21 [금요일] 감기 결석",
            month: "2026-08",
          },
          error: null,
        };
      }

      if (functionName === "move_academy_lesson_event") {
        return {
          data: {
            id: "lesson-moved",
            academy_id: payload.p_academy_id,
            student_id: "student-1",
            students: { name: "김민지" },
            instrument_id: "piano",
            instrument_name: "피아노",
            teacher_id: "teacher-1",
            teachers: { name: "박선생" },
            lesson_kind: "academy",
            origin: "rescheduled",
            starts_at: "2026-08-24T18:00:00+09:00",
            ends_at: "2026-08-24T18:50:00+09:00",
            status: "scheduled",
            attendance_records: [],
          },
          error: options.rpcError ?? null,
        };
      }

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
    ticketRows?: Array<Record<string, unknown>>;
    priorLessonRows?: Array<Record<string, unknown>>;
    lessonMemoMissingTargetColumns?: boolean;
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
      const latestCall = calls[calls.length - 1];
      latestCall.lt = [column, value];

      if (table === "lesson_calendar_memos") {
        if (
          options.lessonMemoMissingTargetColumns &&
          latestCall.select ===
            "id, academy_id, lesson_kind, memo_date, content, unread, student_id, student_name, teacher_id, teacher_name"
        ) {
          return Promise.resolve({
            data: null,
            error: new Error("column lesson_calendar_memos.student_id does not exist"),
          });
        }

        return Promise.resolve({
          data: [
            {
              id: "memo-1",
              academy_id: "academy-1",
              lesson_kind: "academy",
              memo_date: "2026-08-21",
              content: "콩쿠르 보강 확인",
              student_id:
                latestCall.select ===
                "id, academy_id, lesson_kind, memo_date, content, unread"
                  ? undefined
                  : "student-1",
              student_name:
                latestCall.select ===
                "id, academy_id, lesson_kind, memo_date, content, unread"
                  ? undefined
                  : "김민지",
              teacher_id:
                latestCall.select ===
                "id, academy_id, lesson_kind, memo_date, content, unread"
                  ? undefined
                  : "teacher-1",
              teacher_name:
                latestCall.select ===
                "id, academy_id, lesson_kind, memo_date, content, unread"
                  ? undefined
                  : "김하늘",
              unread: false,
            },
            {
              id: "memo-2",
              academy_id: "academy-1",
              lesson_kind: "private",
              memo_date: "2026-08-22",
              content: "오유진 선생님 시간표 공유",
              student_id: null,
              student_name: null,
              teacher_id: "teacher-2",
              teacher_name: "오유진",
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
          data: options.ticketRows ?? [],
          error: null,
        });
        return;
      }

      if (table === "lesson_events" && latestCall.select === "student_id, instrument_id, starts_at") {
        resolve({
          data: options.priorLessonRows ?? [],
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

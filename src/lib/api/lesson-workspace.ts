import type {
  DailyAcademyAttendanceRow,
  DailyAcademyAttendanceSheet,
  LessonEventOrigin,
} from "@/domain/academy-lesson-attendance";
import type { PrivateLesson } from "@/domain/private-lesson";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import type { LessonCalendarMemo, LessonMemoKind } from "@/lib/api/lesson-memos";

import {
  fetchAcademyLessonRegistrationOptions,
  fetchPrivateLessonRegistrationOptions,
  type PrivateLessonRegistrationOptionsSupabaseClient,
} from "./private-lessons";
import { queryKeys } from "./query-keys";

type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type LessonWorkspaceEventRow = {
  id: string;
  academy_id: string;
  student_id: string;
  students: { name: string | null } | null;
  instrument_id: string;
  instrument_name: string;
  teacher_id: string;
  teachers: { name: string | null } | null;
  lesson_kind: "academy" | "private" | "makeup";
  origin: LessonEventOrigin | null;
  starts_at: string;
  ends_at: string;
  status: string;
  attendance_records:
    | Array<{
        status: string | null;
        absence_reason: string | null;
        marked_at: string | null;
      }>
    | null;
};

type LessonTicketBalanceRow = {
  academy_id: string;
  student_id: string;
  instrument_id: string;
  instrument_name: string;
  remaining_count: number;
};

type LessonCalendarMemoRow = {
  academy_id: string;
  lesson_kind: string;
  memo_date: string;
  content: string | null;
  unread: boolean | null;
};

export type CreateAcademyLessonEventInput = {
  academyId: string;
  studentId: string;
  studentName: string;
  studentInstrumentId: string;
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  startAt: string;
  endAt: string;
  origin: Extract<LessonEventOrigin, "manual" | "special">;
  reason: string;
};

export type CreateMakeupLessonEventInput = {
  academyId: string;
  sourceLessonEventId: string;
  studentId: string;
  targetDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type MoveAcademyLessonEventInput = {
  academyId: string;
  lessonEventId: string;
  targetDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type ResetAcademyLessonAttendanceInput = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  reason?: string;
};

export type LessonWorkspaceSupabaseClient =
  PrivateLessonRegistrationOptionsSupabaseClient & {
    rpc(
      functionName: "ensure_monthly_academy_lesson_events",
      payload: {
        p_academy_id: string;
        p_month: string;
      },
    ): PromiseLike<SupabaseResult<number>>;
    rpc(
      functionName: "create_makeup_lesson_event",
      payload: {
        p_academy_id: string;
        p_source_lesson_event_id: string;
        p_student_id: string;
        p_target_date: string;
        p_start_time: string;
        p_end_time: string;
        p_reason: string;
      },
    ): PromiseLike<SupabaseResult<string>>;
    rpc(
      functionName: "move_academy_lesson_event",
      payload: {
        p_academy_id: string;
        p_lesson_event_id: string;
        p_target_date: string;
        p_start_time: string;
        p_end_time: string;
        p_reason: string;
      },
    ): PromiseLike<SupabaseResult<LessonWorkspaceEventRow>>;
    rpc(
      functionName: "reset_academy_lesson_attendance",
      payload: {
        p_academy_id: string;
        p_lesson_event_id: string;
        p_student_id: string;
        p_reason: string | null;
      },
    ): PromiseLike<SupabaseResult<null>>;
    from(table: "lesson_events"): {
      select(select: string): {
        eq(column: "academy_id", value: string): {
          gte(column: "starts_at", value: string): {
            lt(column: "starts_at", value: string): {
              order(
                column: "starts_at",
                options: { ascending: boolean },
              ): PromiseLike<SupabaseResult<LessonWorkspaceEventRow[]>>;
            };
          };
        };
      };
      insert(values: Record<string, unknown>): {
        select(select: string): {
          single(): PromiseLike<SupabaseResult<LessonWorkspaceEventRow>>;
        };
      };
    };
    from(table: "lesson_ticket_grants"): {
      select(select: string): {
        eq(
          column: "academy_id",
          value: string,
        ): PromiseLike<SupabaseResult<LessonTicketBalanceRow[]>>;
      };
    };
    from(table: "lesson_calendar_memos"): {
      select(select: string): {
        eq(column: "academy_id", value: string): {
          gte(column: "memo_date", value: string): {
            lt(
              column: "memo_date",
              value: string,
            ): PromiseLike<SupabaseResult<LessonCalendarMemoRow[]>>;
          };
        };
      };
    };
  };

export type FetchLessonWorkspaceInput = {
  academyId: string;
  month: string;
};

const LESSON_WORKSPACE_EVENTS_SELECT =
  "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, teacher_id, teachers!lesson_events_academy_teacher_fk(name), lesson_kind, origin, starts_at, ends_at, status, attendance_records!attendance_records_academy_lesson_event_fk(status, absence_reason, marked_at)";

export async function fetchLessonWorkspaceData(
  supabase: LessonWorkspaceSupabaseClient,
  input: FetchLessonWorkspaceInput,
): Promise<LessonWorkspaceDemoData> {
  const { error: ensureEventsError } = await supabase.rpc(
    "ensure_monthly_academy_lesson_events",
    {
      p_academy_id: input.academyId,
      p_month: input.month,
    },
  );

  if (ensureEventsError) {
    throw new Error(
      `레슨관리표 정기 일정을 준비하지 못했습니다: ${ensureEventsError.message}`,
    );
  }

  const range = toMonthRange(input.month);
  const [
    eventsResult,
    ticketsResult,
    memosResult,
    registrationOptions,
    privateRegistrationOptions,
  ] = await Promise.all([
      supabase
        .from("lesson_events")
        .select(LESSON_WORKSPACE_EVENTS_SELECT)
        .eq("academy_id", input.academyId)
        .gte("starts_at", range.start)
        .lt("starts_at", range.end)
        .order("starts_at", { ascending: true }),
      supabase
        .from("lesson_ticket_grants")
        .select(
          "academy_id, student_id, instrument_id, instrument_name, remaining_count",
        )
        .eq("academy_id", input.academyId),
      supabase
        .from("lesson_calendar_memos")
        .select("academy_id, lesson_kind, memo_date, content, unread")
        .eq("academy_id", input.academyId)
        .gte("memo_date", range.startDate)
        .lt("memo_date", range.endDate),
      fetchAcademyLessonRegistrationOptions(supabase, input.academyId),
      fetchPrivateLessonRegistrationOptions(supabase, input.academyId),
    ]);

  if (eventsResult.error) {
    throw new Error(`레슨관리표를 불러오지 못했습니다: ${eventsResult.error.message}`);
  }

  if (ticketsResult.error) {
    throw new Error(`회차권 잔여를 불러오지 못했습니다: ${ticketsResult.error.message}`);
  }

  if (memosResult.error) {
    throw new Error(`메모를 불러오지 못했습니다: ${memosResult.error.message}`);
  }

  const events = (eventsResult.data ?? []).filter(
    (event) => event.status === "scheduled",
  );
  const academyRows = events
    .filter((event) => event.lesson_kind === "academy")
    .map(toAcademyAttendanceRow);

  return {
    academySheets: groupAcademyRows(input.academyId, academyRows),
    privateLessons: events
      .filter((event) => event.lesson_kind === "private")
      .map(toPrivateLesson),
    ticketBalances: (ticketsResult.data ?? []).map((ticket) => ({
      academyId: ticket.academy_id,
      studentId: ticket.student_id,
      instrumentId: ticket.instrument_id,
      instrumentName: ticket.instrument_name,
      remainingCount: ticket.remaining_count,
    })),
    registrationOptions,
    privateRegistrationOptions,
    calendarMemos: (memosResult.data ?? []).flatMap(toLessonCalendarMemo),
    academyMemo: "",
    privateMemo: "",
  };
}

export async function createAcademyLessonEvent(
  supabase: LessonWorkspaceSupabaseClient,
  input: CreateAcademyLessonEventInput,
): Promise<DailyAcademyAttendanceRow> {
  const { data, error } = await supabase
    .from("lesson_events")
    .insert({
      academy_id: input.academyId,
      student_id: input.studentId,
      student_instrument_id: input.studentInstrumentId,
      series_id: null,
      teacher_id: input.teacherId,
      lesson_kind: "academy",
      origin: input.origin,
      source_lesson_event_id: null,
      counts_for_ticket: false,
      instrument_id: input.instrumentId,
      instrument_name: input.instrumentName,
      starts_at: input.startAt,
      ends_at: input.endAt,
      status: "scheduled",
      generated_from_enrollment: false,
      creation_reason: input.reason.trim(),
    })
    .select(LESSON_WORKSPACE_EVENTS_SELECT)
    .single();

  if (error) {
    throw new Error(`학원 일정을 추가하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("학원 일정을 추가했지만 반환된 데이터가 없습니다.");
  }

  return toAcademyAttendanceRow(data);
}

export async function createMakeupLessonEvent(
  supabase: LessonWorkspaceSupabaseClient,
  input: CreateMakeupLessonEventInput,
) {
  const { error } = await supabase.rpc("create_makeup_lesson_event", {
    p_academy_id: input.academyId,
    p_source_lesson_event_id: input.sourceLessonEventId,
    p_student_id: input.studentId,
    p_target_date: input.targetDate,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw new Error(`보강 일정을 저장하지 못했습니다: ${error.message}`);
  }
}

export async function moveAcademyLessonEvent(
  supabase: LessonWorkspaceSupabaseClient,
  input: MoveAcademyLessonEventInput,
): Promise<DailyAcademyAttendanceRow> {
  const { data, error } = await supabase.rpc("move_academy_lesson_event", {
    p_academy_id: input.academyId,
    p_lesson_event_id: input.lessonEventId,
    p_target_date: input.targetDate,
    p_start_time: input.startTime,
    p_end_time: input.endTime,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw new Error(`학원 일정을 이동하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("학원 일정을 이동했지만 반환된 데이터가 없습니다.");
  }

  return toAcademyAttendanceRow(data);
}

export async function resetAcademyLessonAttendance(
  supabase: LessonWorkspaceSupabaseClient,
  input: ResetAcademyLessonAttendanceInput,
) {
  const { error } = await supabase.rpc("reset_academy_lesson_attendance", {
    p_academy_id: input.academyId,
    p_lesson_event_id: input.lessonEventId,
    p_student_id: input.studentId,
    p_reason: input.reason?.trim() || null,
  });

  if (error) {
    throw new Error(`학원 수업 출결을 초기화하지 못했습니다: ${error.message}`);
  }
}

export function createLessonWorkspaceQueryOptions(
  supabase: LessonWorkspaceSupabaseClient,
  input: FetchLessonWorkspaceInput,
) {
  return {
    queryKey: queryKeys.lessonWorkspace.month(input.academyId, input.month),
    queryFn: () => fetchLessonWorkspaceData(supabase, input),
  };
}

function groupAcademyRows(
  academyId: string,
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceSheet[] {
  const byDate = new Map<string, DailyAcademyAttendanceRow[]>();

  for (const row of rows) {
    byDate.set(row.date, [...(byDate.get(row.date) ?? []), row]);
  }

  return [...byDate.entries()].map(([date, sheetRows]) =>
    toSheet(academyId, date, sheetRows),
  );
}

function toSheet(
  academyId: string,
  date: string,
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceSheet {
  return {
    academyId,
    date,
    rows,
    absenceQueue: rows
      .filter((row) => row.status === "absent")
      .map((row) => ({
        academyId,
        lessonEventId: row.lessonEventId,
        studentId: row.studentId,
        studentName: row.studentName,
        instrumentId: row.instrumentId,
        instrumentName: row.instrumentName,
        originalDate: row.date,
        reason: row.absenceReason ?? "",
        markedAt: row.markedAt ?? "",
      })),
    summary: {
      total: rows.length,
      present: rows.filter((row) => row.status === "present").length,
      absent: rows.filter((row) => row.status === "absent").length,
      pending: rows.filter((row) => row.status === "pending").length,
    },
  };
}

function toAcademyAttendanceRow(
  row: LessonWorkspaceEventRow,
): DailyAcademyAttendanceRow {
  const attendance = row.attendance_records?.[0];
  const status =
    attendance?.status === "present" || attendance?.status === "absent"
      ? attendance.status
      : "pending";

  return {
    academyId: row.academy_id,
    lessonEventId: row.id,
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    teacherId: row.teacher_id,
    teacherName: row.teachers?.name?.trim() || "선생님 없음",
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    date: toSeoulDate(row.starts_at),
    startTime: toSeoulHourMinute(row.starts_at),
    endTime: toSeoulHourMinute(row.ends_at),
    status,
    origin: normalizeOrigin(row.origin, row.lesson_kind),
    originLabel: formatOriginLabel(normalizeOrigin(row.origin, row.lesson_kind)),
    absenceReason:
      status === "absent" ? attendance?.absence_reason?.trim() : undefined,
    markedAt: attendance?.marked_at ?? undefined,
  };
}

function toPrivateLesson(row: LessonWorkspaceEventRow): PrivateLesson {
  return {
    id: row.id,
    academyId: row.academy_id,
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    teacherId: row.teacher_id,
    teacherName: row.teachers?.name?.trim() || "선생님 없음",
    startAt: row.starts_at,
    endAt: row.ends_at,
    status:
      row.status === "present" || row.status === "absent"
        ? row.status
        : "scheduled",
    origin: normalizeOrigin(row.origin, row.lesson_kind),
    originLabel: formatOriginLabel(normalizeOrigin(row.origin, row.lesson_kind)),
  };
}

function toMonthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = `${nextMonth.getUTCFullYear()}-${String(
    nextMonth.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  return {
    start: `${month}-01T00:00:00+09:00`,
    end: `${endDate}T00:00:00+09:00`,
    startDate: `${month}-01`,
    endDate,
  };
}

function toLessonCalendarMemo(row: LessonCalendarMemoRow): LessonCalendarMemo[] {
  if (row.lesson_kind !== "academy" && row.lesson_kind !== "private") {
    return [];
  }

  return [
    {
      academyId: row.academy_id,
      lessonKind: row.lesson_kind as LessonMemoKind,
      date: row.memo_date,
      content: row.content ?? "",
      unread: row.unread ?? false,
    },
  ];
}

function toSeoulDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function toSeoulHourMinute(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function normalizeOrigin(
  origin: LessonWorkspaceEventRow["origin"],
  lessonKind: LessonWorkspaceEventRow["lesson_kind"],
): LessonEventOrigin {
  if (
    origin === "regular" ||
    origin === "manual" ||
    origin === "makeup" ||
    origin === "private" ||
    origin === "special" ||
    origin === "rescheduled"
  ) {
    return origin;
  }

  return lessonKind === "private" ? "private" : "regular";
}

function formatOriginLabel(origin: LessonEventOrigin) {
  const labels: Record<LessonEventOrigin, string> = {
    regular: "정기",
    manual: "비정기",
    makeup: "보강",
    private: "개인레슨",
    special: "특강",
    rescheduled: "이동",
  };

  return labels[origin];
}

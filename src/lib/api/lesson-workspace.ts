import {
  formatAcademyLessonOriginLabel,
  toDailyAcademyAttendanceSheet,
  type AbsenceResolutionKind,
  type DailyAcademyAttendanceRow,
  type DailyAcademyAttendanceSheet,
  type LessonEventOrigin,
} from "@/domain/academy-lesson-attendance";
import { countAttendeesByDate } from "@/domain/academy-lesson-sheets";
import { getFinanceToday } from "@/domain/finance-date";
import type { PrivateLesson, PrivateLessonTicketSearchBalance } from "@/domain/private-lesson";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import {
  LESSON_CALENDAR_MEMO_SELECT,
  toLessonCalendarMemo,
  type LessonCalendarMemoRow,
} from "@/lib/api/lesson-memos";

import {
  fetchAcademyLessonRegistrationOptions,
  fetchPrivateLessonRegistrationOptions,
  type PrivateLessonRegistrationOptions,
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
  time_unspecified?: boolean | null;
  source_lesson_event_id?: string | null;
  attendance_records:
    | Array<{
        status: string | null;
        absence_reason: string | null;
        marked_at: string | null;
        /** 일대일 관계라 PostgREST가 객체 또는 배열로 준다. */
        absence_resolutions?: AbsenceResolutionRow | AbsenceResolutionRow[] | null;
      }>
    | null;
};

type AbsenceResolutionRow = { resolved_as: string | null };

/** 달 전체 조회가 아니라 날짜별 인원 집계에만 쓰는 최소 컬럼 */
type AttendeeCountEventRow = {
  student_id: string;
  lesson_kind: string;
  status: string;
  starts_at: string;
};

type LessonTicketBalanceRow = {
  academy_id: string;
  student_id: string;
  instrument_id: string;
  instrument_name: string;
  remaining_count: number;
  total_granted_count?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
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

export type ResolveAcademyLessonAbsenceInput = {
  academyId: string;
  sourceLessonEventId: string;
  studentId: string;
  resolution: AbsenceResolutionKind;
  /** 보강일(YYYY-MM-DD). 보강일 때 필수 */
  targetDate?: string;
  /** 보강 시작 시간. 없으면 DB가 원본 시간을 임시로 쓰고 시간 표시를 숨긴다. */
  startTime?: string;
  endTime?: string;
  reason?: string;
};

export type ResolveAcademyLessonAbsenceResult = {
  resolution: AbsenceResolutionKind;
  makeupLessonEventId: string | null;
  /** DB가 월별 포스트잇에 자동으로 남긴 한 줄 */
  memoLine: string;
  month: string;
};

type ResolveAcademyLessonAbsenceRpcRow = {
  resolution: AbsenceResolutionKind;
  makeup_lesson_event_id: string | null;
  memo_line: string;
  month: string;
};

export type DeleteAcademyLessonEventInput = {
  academyId: string;
  lessonEventId: string;
  reason: string;
};

export type FetchAcademyAttendeeCountsInput = {
  academyId: string;
  month: string;
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

type PriorPrivateLessonRow = {
  student_id: string;
  instrument_id: string;
  starts_at: string;
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
      functionName: "list_students_for_teacher",
      payload: { p_academy_id: string },
    ): PromiseLike<
      SupabaseResult<Array<{ student_id: string; student_name: string }>>
    >;
    rpc(
      functionName: "resolve_academy_lesson_absence",
      payload: {
        p_academy_id: string;
        p_source_lesson_event_id: string;
        p_student_id: string;
        p_resolution: AbsenceResolutionKind;
        p_target_date: string | null;
        p_start_time: string | null;
        p_end_time: string | null;
        p_reason: string | null;
      },
    ): PromiseLike<SupabaseResult<ResolveAcademyLessonAbsenceRpcRow>>;
    rpc(
      functionName: "delete_academy_lesson_event",
      payload: {
        p_academy_id: string;
        p_lesson_event_id: string;
        p_reason: string;
      },
    ): PromiseLike<SupabaseResult<null>>;
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
      select<TRow = LessonWorkspaceEventRow>(select: string): {
        eq(column: "academy_id", value: string): {
          gte(column: "starts_at", value: string): {
            lt(column: "starts_at", value: string): {
              order(
                column: "starts_at",
                options: { ascending: boolean },
              ): PromiseLike<SupabaseResult<TRow[]>>;
            };
          };
          eq(column: "lesson_kind", value: "private"): {
            eq(column: "status", value: "scheduled"): {
              gte(column: "starts_at", value: string): {
                lt(
                  column: "starts_at",
                  value: string,
                ): PromiseLike<SupabaseResult<PriorPrivateLessonRow[]>>;
              };
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
  /**
   * 원장·데스크는 true(기본). 선생님(false)은 수강료·할인이 있는 수강 정보 표를 읽을 수 없으므로
   * 레슨원생 검색 대상을 담당 원생 명단 RPC에서 받는다.
   */
  canManage?: boolean;
};

const LESSON_WORKSPACE_EVENTS_SELECT =
  "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, teacher_id, teachers!lesson_events_academy_teacher_fk(name), lesson_kind, origin, source_lesson_event_id, starts_at, ends_at, status, time_unspecified, attendance_records!attendance_records_academy_lesson_event_fk(status, absence_reason, marked_at, absence_resolutions!absence_resolutions_academy_attendance_record_fk(resolved_as))";
const ATTENDEE_COUNT_EVENTS_SELECT = "student_id, lesson_kind, status, starts_at";
const LEGACY_LESSON_CALENDAR_MEMO_SELECT =
  "id, academy_id, lesson_kind, memo_date, content, unread";

/** 선생님의 레슨원생 검색용 선택지. 이름만 필요하고 등록 폼(악기·선생님 선택)은 선생님에게 열리지 않는다. */
async function fetchTeacherStudentSearchOptions(
  supabase: LessonWorkspaceSupabaseClient,
  academyId: string,
): Promise<PrivateLessonRegistrationOptions> {
  const { data, error } = await supabase.rpc("list_students_for_teacher", {
    p_academy_id: academyId,
  });

  if (error) {
    throw new Error(`담당 원생 명단을 불러오지 못했습니다: ${error.message}`);
  }

  return {
    students: (data ?? []).map((row) => ({
      studentId: row.student_id,
      studentName: row.student_name,
      instruments: [],
    })),
    teachers: [],
  };
}

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

  const canManage = input.canManage ?? true;
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
          "academy_id, student_id, instrument_id, instrument_name, remaining_count, total_granted_count, valid_from, valid_until",
        )
        .eq("academy_id", input.academyId),
      fetchLessonCalendarMemoRows(supabase, input.academyId, range),
      fetchAcademyLessonRegistrationOptions(supabase, input.academyId),
      canManage
        ? fetchPrivateLessonRegistrationOptions(supabase, input.academyId)
        : fetchTeacherStudentSearchOptions(supabase, input.academyId),
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
    ticketBalances: await withPriorLessonCounts(
      supabase,
      input.academyId,
      range.start,
      sumValidTicketBalances(ticketsResult.data ?? [], getFinanceToday()),
    ),
    registrationOptions,
    privateRegistrationOptions,
    calendarMemos: (memosResult.data ?? [])
      .filter(isSupportedLessonCalendarMemo)
      .map(toLessonCalendarMemo),
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

/** 결석을 보강 또는 패스로 확정한다. 이중 처리 방지와 월별 포스트잇 자동 기록은 DB 함수가 맡는다. */
export async function resolveAcademyLessonAbsence(
  supabase: LessonWorkspaceSupabaseClient,
  input: ResolveAcademyLessonAbsenceInput,
): Promise<ResolveAcademyLessonAbsenceResult> {
  const { data, error } = await supabase.rpc("resolve_academy_lesson_absence", {
    p_academy_id: input.academyId,
    p_source_lesson_event_id: input.sourceLessonEventId,
    p_student_id: input.studentId,
    p_resolution: input.resolution,
    p_target_date: input.targetDate || null,
    p_start_time: input.startTime || null,
    p_end_time: input.endTime || null,
    p_reason: input.reason?.trim() || null,
  });

  if (error) {
    throw new Error(`결석 사유서를 저장하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("결석 사유서를 저장했지만 반환된 데이터가 없습니다.");
  }

  return {
    resolution: data.resolution,
    makeupLessonEventId: data.makeup_lesson_event_id,
    memoLine: data.memo_line,
    month: data.month,
  };
}

export async function deleteAcademyLessonEvent(
  supabase: LessonWorkspaceSupabaseClient,
  input: DeleteAcademyLessonEventInput,
) {
  const { error } = await supabase.rpc("delete_academy_lesson_event", {
    p_academy_id: input.academyId,
    p_lesson_event_id: input.lessonEventId,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw new Error(`학원 일정을 삭제하지 못했습니다: ${error.message}`);
  }
}

/**
 * 보강일 추천에 쓸 날짜별 등원 인원을 센다. 화면이 보고 있지 않은 달(다음 달)용이다.
 * 정기 일정이 아직 만들어지지 않았을 수 있어 그 달 일정을 먼저 준비한다.
 */
export async function fetchAcademyAttendeeCounts(
  supabase: LessonWorkspaceSupabaseClient,
  input: FetchAcademyAttendeeCountsInput,
): Promise<Record<string, number>> {
  const { error: ensureError } = await supabase.rpc("ensure_monthly_academy_lesson_events", {
    p_academy_id: input.academyId,
    p_month: input.month,
  });

  if (ensureError) {
    throw new Error(`다음 달 정기 일정을 준비하지 못했습니다: ${ensureError.message}`);
  }

  const range = toMonthRange(input.month);
  const { data, error } = await supabase
    .from("lesson_events")
    .select<AttendeeCountEventRow>(ATTENDEE_COUNT_EVENTS_SELECT)
    .eq("academy_id", input.academyId)
    .gte("starts_at", range.start)
    .lt("starts_at", range.end)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(`다음 달 등원 인원을 불러오지 못했습니다: ${error.message}`);
  }

  return countAttendeesByDate(
    (data ?? [])
      .filter((event) => event.lesson_kind === "academy" && event.status === "scheduled")
      .map((event) => ({ studentId: event.student_id, date: toSeoulDate(event.starts_at) })),
  );
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
    toDailyAcademyAttendanceSheet(academyId, date, sheetRows),
  );
}

async function fetchLessonCalendarMemoRows(
  supabase: LessonWorkspaceSupabaseClient,
  academyId: string,
  range: ReturnType<typeof toMonthRange>,
): Promise<SupabaseResult<LessonCalendarMemoRow[]>> {
  const result = await selectLessonCalendarMemos(
    supabase,
    academyId,
    range,
    LESSON_CALENDAR_MEMO_SELECT,
  );

  if (!result.error || !isMissingLessonMemoTargetColumnError(result.error)) {
    return result;
  }

  const legacyResult = await selectLessonCalendarMemos(
    supabase,
    academyId,
    range,
    LEGACY_LESSON_CALENDAR_MEMO_SELECT,
  );

  return {
    data: (legacyResult.data ?? []).map(toTargetlessLessonCalendarMemoRow),
    error: legacyResult.error,
  };
}

function selectLessonCalendarMemos(
  supabase: LessonWorkspaceSupabaseClient,
  academyId: string,
  range: ReturnType<typeof toMonthRange>,
  select: string,
) {
  return supabase
    .from("lesson_calendar_memos")
    .select(select)
    .eq("academy_id", academyId)
    .gte("memo_date", range.startDate)
    .lt("memo_date", range.endDate);
}

function isMissingLessonMemoTargetColumnError(error: Error) {
  return /lesson_calendar_memos\.(student_id|student_name|teacher_id|teacher_name)/.test(
    error.message,
  );
}

function toTargetlessLessonCalendarMemoRow(
  row: Partial<LessonCalendarMemoRow>,
): LessonCalendarMemoRow {
  return {
    id: row.id ?? "",
    academy_id: row.academy_id ?? "",
    lesson_kind: row.lesson_kind ?? "",
    memo_date: row.memo_date ?? "",
    content: row.content ?? null,
    unread: row.unread ?? null,
    student_id: null,
    student_name: null,
    teacher_id: null,
    teacher_name: null,
  };
}

function toAcademyAttendanceRow(
  row: LessonWorkspaceEventRow,
): DailyAcademyAttendanceRow {
  const attendance = row.attendance_records?.[0];
  const status = readAttendanceStatus(row) ?? "pending";

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
    originLabel: formatAcademyLessonOriginLabel(normalizeOrigin(row.origin, row.lesson_kind)),
    absenceReason:
      status === "absent" ? attendance?.absence_reason?.trim() : undefined,
    markedAt: attendance?.marked_at ?? undefined,
    absenceResolution:
      status === "absent" ? readAbsenceResolution(attendance?.absence_resolutions) : undefined,
    timeUnspecified: row.time_unspecified ? true : undefined,
    sourceLessonEventId: row.source_lesson_event_id ?? undefined,
  };
}

function readAbsenceResolution(
  embedded: AbsenceResolutionRow | AbsenceResolutionRow[] | null | undefined,
): AbsenceResolutionKind | undefined {
  const resolvedAs = (Array.isArray(embedded) ? embedded[0] : embedded)?.resolved_as;

  return resolvedAs === "makeup" || resolvedAs === "pass" ? resolvedAs : undefined;
}

type ValidTicketBalance = PrivateLessonTicketSearchBalance & {
  /** 유효한 회차권 중 가장 이른 유효 시작일. 회차를 이어서 셀 때의 시작점이다. */
  validFrom?: string;
};

/** 오늘 유효한 회차권만 같은 원생·악기끼리 합산한다. 만료됐거나 아직 시작 전인 회차권은 쓸 수 없다. */
function sumValidTicketBalances(rows: LessonTicketBalanceRow[], today: string): ValidTicketBalance[] {
  const balances = new Map<string, ValidTicketBalance>();

  for (const row of rows) {
    const isValidToday =
      (!row.valid_from || row.valid_from <= today) && (!row.valid_until || row.valid_until >= today);
    if (!isValidToday) {
      continue;
    }

    const key = `${row.academy_id}:${row.student_id}:${row.instrument_id}`;
    const current = balances.get(key);
    balances.set(key, {
      academyId: row.academy_id,
      studentId: row.student_id,
      instrumentId: row.instrument_id,
      instrumentName: row.instrument_name,
      remainingCount: (current?.remainingCount ?? 0) + row.remaining_count,
      totalGrantedCount: (current?.totalGrantedCount ?? 0) + (row.total_granted_count ?? 0),
      validFrom: earliestDate(current?.validFrom, row.valid_from ?? undefined),
    });
  }

  return [...balances.values()];
}

function earliestDate(left: string | undefined, right: string | undefined) {
  if (!left || !right) {
    return left ?? right;
  }

  return left <= right ? left : right;
}

/**
 * 개인레슨 회차(`현재/총`)를 달이 바뀌어도 이어서 세도록, 유효한 회차권 기간 안에서
 * 조회한 달 이전에 잡힌 같은 원생·악기의 취소되지 않은 레슨 수를 센다.
 */
async function withPriorLessonCounts(
  supabase: LessonWorkspaceSupabaseClient,
  academyId: string,
  monthStart: string,
  balances: ValidTicketBalance[],
): Promise<PrivateLessonTicketSearchBalance[]> {
  const earliestValidFrom = balances.reduce<string | undefined>(
    (earliest, balance) => earliestDate(earliest, balance.validFrom),
    undefined,
  );
  const rangeStart = earliestValidFrom ? `${earliestValidFrom}T00:00:00+09:00` : undefined;

  if (!rangeStart || rangeStart >= monthStart) {
    return balances.map((balance) => toBalanceWithPriorCount(balance, 0));
  }

  const { data, error } = await supabase
    .from("lesson_events")
    .select("student_id, instrument_id, starts_at")
    .eq("academy_id", academyId)
    .eq("lesson_kind", "private")
    .eq("status", "scheduled")
    .gte("starts_at", rangeStart)
    .lt("starts_at", monthStart);

  if (error) {
    throw new Error(`이전 레슨 회차를 불러오지 못했습니다: ${error.message}`);
  }

  return balances.map((balance) => {
    const validFromStart = balance.validFrom ? `${balance.validFrom}T00:00:00+09:00` : rangeStart;
    const priorLessonCount = (data ?? []).filter(
      (lesson) =>
        lesson.student_id === balance.studentId &&
        lesson.instrument_id === balance.instrumentId &&
        lesson.starts_at >= validFromStart,
    ).length;

    return toBalanceWithPriorCount(balance, priorLessonCount);
  });
}

function toBalanceWithPriorCount(
  balance: ValidTicketBalance,
  priorLessonCount: number,
): PrivateLessonTicketSearchBalance {
  const result: ValidTicketBalance = { ...balance, priorLessonCount };
  delete result.validFrom;

  return result;
}

/** 출석 여부는 lesson_events.status가 아니라 출결 기록(attendance_records)이 가진다. */
function readAttendanceStatus(row: LessonWorkspaceEventRow): "present" | "absent" | undefined {
  const status = row.attendance_records?.[0]?.status;

  return status === "present" || status === "absent" ? status : undefined;
}

function toPrivateLesson(row: LessonWorkspaceEventRow): PrivateLesson {
  const status = readAttendanceStatus(row) ?? "scheduled";

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
    status,
    absenceReason: status === "absent" ? row.attendance_records?.[0]?.absence_reason ?? undefined : undefined,
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

function isSupportedLessonCalendarMemo(row: LessonCalendarMemoRow) {
  if (row.lesson_kind !== "academy" && row.lesson_kind !== "private") {
    return false;
  }

  return true;
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

import type {
  AcademyLessonAttendanceStatus,
  DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type AcademyLessonAttendanceRecordSupabaseRow = {
  status: string | null;
  absence_reason: string | null;
  marked_at: string | null;
};

export type AcademyLessonAttendanceSupabaseRow = {
  id: string;
  academy_id: string;
  student_id: string;
  students: {
    name: string | null;
  } | null;
  teacher_id: string | null;
  teachers: {
    name: string | null;
  } | null;
  instrument_id: string;
  instrument_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  attendance_records: AcademyLessonAttendanceRecordSupabaseRow[] | null;
};

type AcademyLessonAttendanceSelectBuilder = {
  eq(
    column: "academy_id" | "lesson_kind" | "status",
    value: string,
  ): AcademyLessonAttendanceSelectBuilder;
  gte(column: "starts_at", value: string): AcademyLessonAttendanceSelectBuilder;
  lt(column: "starts_at", value: string): AcademyLessonAttendanceSelectBuilder;
  order(
    column: "starts_at",
    options: { ascending: boolean },
  ): PromiseLike<SupabaseQueryResult<AcademyLessonAttendanceSupabaseRow[]>>;
};

type AcademyLessonAttendanceUpsertBuilder = {
  select(select: "id"): PromiseLike<SupabaseQueryResult<Array<{ id: string }>>>;
};

type AcademyLessonAttendanceFromBuilder = {
  select(select: string): AcademyLessonAttendanceSelectBuilder;
  upsert(
    values: AcademyLessonAttendanceUpsertRow[],
    options: { onConflict: string },
  ): AcademyLessonAttendanceUpsertBuilder;
};

export type AcademyLessonAttendanceSupabaseClient = {
  rpc(
    functionName: "ensure_monthly_academy_lesson_events",
    payload: {
      p_academy_id: string;
      p_month: string;
    },
  ): PromiseLike<SupabaseQueryResult<number>>;
  from(
    table: "lesson_events" | "attendance_records",
  ): AcademyLessonAttendanceFromBuilder;
};

export type FetchDailyAcademyLessonAttendanceInput = {
  academyId: string;
  date: string;
};

export type MarkDailyAcademyLessonAttendanceInput = {
  academyId: string;
  records: Array<{
    lessonEventId: string;
    studentId: string;
    status: Exclude<AcademyLessonAttendanceStatus, "pending">;
    reason?: string;
    markedAt: string;
  }>;
};

type AcademyLessonAttendanceUpsertRow = {
  academy_id: string;
  lesson_event_id: string;
  student_id: string;
  status: Exclude<AcademyLessonAttendanceStatus, "pending">;
  absence_reason: string | null;
  marked_at: string;
};

const ACADEMY_LESSON_ATTENDANCE_SELECT =
  "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), teacher_id, teachers!lesson_events_academy_teacher_fk(name), instrument_id, instrument_name, starts_at, ends_at, status, attendance_records!attendance_records_academy_lesson_event_fk(status, absence_reason, marked_at)";
const SEOUL_TIME_ZONE = "Asia/Seoul";

export async function fetchDailyAcademyLessonAttendance(
  supabase: AcademyLessonAttendanceSupabaseClient,
  input: FetchDailyAcademyLessonAttendanceInput,
): Promise<DailyAcademyAttendanceSheet> {
  const { error: ensureEventsError } = await supabase.rpc(
    "ensure_monthly_academy_lesson_events",
    {
      p_academy_id: input.academyId,
      p_month: input.date.slice(0, 7),
    },
  );

  if (ensureEventsError) {
    throw new Error(
      `학원 수업 정기 일정을 준비하지 못했습니다: ${ensureEventsError.message}`,
    );
  }

  const range = toSeoulDayRange(input.date);
  const { data, error } = await supabase
    .from("lesson_events")
    .select(ACADEMY_LESSON_ATTENDANCE_SELECT)
    .eq("academy_id", input.academyId)
    .eq("lesson_kind", "academy")
    .eq("status", "scheduled")
    .gte("starts_at", range.start)
    .lt("starts_at", range.end)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(`학원 수업 출석표를 불러오지 못했습니다: ${error.message}`);
  }

  const rows = (data ?? []).map(toDailyAttendanceRow).sort((left, right) => {
    return (
      left.startTime.localeCompare(right.startTime) ||
      left.studentName.localeCompare(right.studentName, "ko-KR")
    );
  });

  return {
    academyId: input.academyId,
    date: input.date,
    rows,
    absenceQueue: rows
      .filter((row) => row.status === "absent")
      .map((row) => ({
        academyId: row.academyId,
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

export function createDailyAcademyLessonAttendanceQueryOptions(
  supabase: AcademyLessonAttendanceSupabaseClient,
  input: FetchDailyAcademyLessonAttendanceInput,
) {
  return {
    queryKey: queryKeys.academyLessons.dailyAttendance(
      input.academyId,
      input.date,
    ),
    queryFn: () => fetchDailyAcademyLessonAttendance(supabase, input),
  };
}

export async function markDailyAcademyLessonAttendance(
  supabase: AcademyLessonAttendanceSupabaseClient,
  input: MarkDailyAcademyLessonAttendanceInput,
) {
  const values = input.records.map((record) => ({
    academy_id: input.academyId,
    lesson_event_id: record.lessonEventId,
    student_id: record.studentId,
    status: record.status,
    absence_reason:
      record.status === "absent" ? (record.reason?.trim() || "결석 확인") : null,
    marked_at: record.markedAt,
  }));

  if (values.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("attendance_records")
    .upsert(values, {
      onConflict: "academy_id,lesson_event_id,student_id",
    })
    .select("id");

  if (error) {
    throw new Error(`학원 수업 출결을 저장하지 못했습니다: ${error.message}`);
  }
}

function toDailyAttendanceRow(row: AcademyLessonAttendanceSupabaseRow) {
  const attendance = row.attendance_records?.[0];
  const status = normalizeAttendanceStatus(attendance?.status);

  return {
    academyId: row.academy_id,
    lessonEventId: row.id,
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    teacherId: row.teacher_id ?? undefined,
    teacherName: row.teachers?.name?.trim() || undefined,
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    date: toSeoulDate(row.starts_at),
    startTime: toSeoulHourMinute(row.starts_at),
    endTime: toSeoulHourMinute(row.ends_at),
    status,
    absenceReason:
      status === "absent" ? attendance?.absence_reason?.trim() : undefined,
    markedAt: attendance?.marked_at ?? undefined,
  };
}

function normalizeAttendanceStatus(
  status: string | null | undefined,
): AcademyLessonAttendanceStatus {
  if (status === "present" || status === "absent") {
    return status;
  }

  return "pending";
}

function toSeoulDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  return {
    start: `${date}T00:00:00+09:00`,
    end: `${nextDay.getUTCFullYear()}-${pad2(nextDay.getUTCMonth() + 1)}-${pad2(
      nextDay.getUTCDate(),
    )}T00:00:00+09:00`,
  };
}

function toSeoulDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function toSeoulHourMinute(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

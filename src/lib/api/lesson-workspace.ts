import type {
  DailyAcademyAttendanceRow,
  DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import type { PrivateLesson } from "@/domain/private-lesson";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";

import {
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

type MonthlyMemoRow = {
  content: string | null;
};

export type LessonWorkspaceSupabaseClient =
  PrivateLessonRegistrationOptionsSupabaseClient & {
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
    };
    from(table: "lesson_ticket_grants"): {
      select(select: string): {
        eq(
          column: "academy_id",
          value: string,
        ): PromiseLike<SupabaseResult<LessonTicketBalanceRow[]>>;
      };
    };
    from(table: "monthly_memos"): {
      select(select: string): {
        eq(column: "academy_id" | "month", value: string): {
          eq(column: "academy_id" | "month", value: string): {
            maybeSingle(): PromiseLike<SupabaseResult<MonthlyMemoRow>>;
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
  "id, academy_id, student_id, students(name), instrument_id, instrument_name, teacher_id, teachers(name), lesson_kind, starts_at, ends_at, status, attendance_records(status, absence_reason, marked_at)";

export async function fetchLessonWorkspaceData(
  supabase: LessonWorkspaceSupabaseClient,
  input: FetchLessonWorkspaceInput,
): Promise<LessonWorkspaceDemoData> {
  const range = toMonthRange(input.month);
  const [eventsResult, ticketsResult, memoResult, registrationOptions] =
    await Promise.all([
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
        .from("monthly_memos")
        .select("content")
        .eq("academy_id", input.academyId)
        .eq("month", input.month)
        .maybeSingle(),
      fetchPrivateLessonRegistrationOptions(supabase, input.academyId),
    ]);

  if (eventsResult.error) {
    throw new Error(`레슨관리표를 불러오지 못했습니다: ${eventsResult.error.message}`);
  }

  if (ticketsResult.error) {
    throw new Error(`회차권 잔여를 불러오지 못했습니다: ${ticketsResult.error.message}`);
  }

  if (memoResult.error) {
    throw new Error(`메모를 불러오지 못했습니다: ${memoResult.error.message}`);
  }

  const events = eventsResult.data ?? [];
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
    academyMemo: memoResult.data?.content ?? "",
    privateMemo: memoResult.data?.content ?? "",
  };
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
  };
}

function toMonthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(year, monthIndex, 1));

  return {
    start: `${month}-01T00:00:00+09:00`,
    end: `${nextMonth.getUTCFullYear()}-${String(
      nextMonth.getUTCMonth() + 1,
    ).padStart(2, "0")}-01T00:00:00+09:00`,
  };
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

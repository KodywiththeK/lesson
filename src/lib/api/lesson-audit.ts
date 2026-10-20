export type LessonAuditKind = "academy" | "private";

export type FetchLessonAuditHistoryInput = {
  academyId: string;
  date: string;
  lessonKind: LessonAuditKind;
};

type LessonAuditRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  student_name: string | null;
  reason: string | null;
  resolution: string | null;
};

export type LessonAuditEntry = {
  id: string;
  occurredAt: string;
  label: string;
  studentName: string | null;
  reason: string | null;
};

export type LessonAuditSupabaseClient = {
  rpc(
    name: "list_lesson_change_history",
    args: {
      p_academy_id: string;
      p_lesson_date: string;
      p_lesson_kind: LessonAuditKind;
    },
  ): PromiseLike<{ data: LessonAuditRow[] | null; error: Error | null }>;
};

const EVENT_LABELS: Record<string, string> = {
  "lesson_event.rescheduled": "일정 이동",
  "lesson_event.deleted": "일정 삭제",
  "attendance.reset": "출석 초기화",
  "attendance.cancelled": "출석 취소",
  "attendance.absent": "결석 처리",
  "attendance.absence_reason_changed": "결석 사유 변경",
};

export function lessonAuditQueryKey({ academyId, date, lessonKind }: FetchLessonAuditHistoryInput) {
  return ["academy", academyId, "lesson-audit", lessonKind, date] as const;
}

function toEventLabel(row: LessonAuditRow): string {
  if (row.event_type !== "absence.resolved") {
    return EVENT_LABELS[row.event_type] ?? "수업 변경";
  }

  if (row.resolution === "pass") return "패스 확정";
  if (row.resolution === "makeup") return "보강 확정";
  return "결석 처리";
}

export async function fetchLessonAuditHistory(
  client: LessonAuditSupabaseClient,
  { academyId, date, lessonKind }: FetchLessonAuditHistoryInput,
): Promise<LessonAuditEntry[]> {
  const { data, error } = await client.rpc("list_lesson_change_history", {
    p_academy_id: academyId,
    p_lesson_date: date,
    p_lesson_kind: lessonKind,
  });

  if (error || !data) {
    throw new Error(`변경 이력을 불러오지 못했습니다: ${error?.message ?? "응답이 비어 있습니다."}`);
  }

  return data.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    label: toEventLabel(row),
    studentName: row.student_name,
    reason: row.reason,
  }));
}

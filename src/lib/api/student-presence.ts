import type { PresenceAction, PresenceLessonKind, StudentPresenceRecord } from "@/domain/student-presence";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type PresenceRosterRow = {
  student_id: string;
  student_name: string;
  /** 서버는 보강(makeup)도 돌려줄 수 있어 화면에서는 학원레슨으로 묶는다. */
  lesson_kinds: Array<PresenceLessonKind | "makeup">;
  first_starts_at: string | null;
  arrived_at: string | null;
  left_at: string | null;
};

type PresenceRpcArgs = {
  list_daily_student_presence: { p_academy_id: string; p_date: string };
  record_student_presence: {
    p_academy_id: string;
    p_student_id: string;
    p_date: string;
    p_action: PresenceAction;
  };
};

type PresenceRpcResult = {
  list_daily_student_presence: PresenceRosterRow[];
  record_student_presence: unknown;
};

export type StudentPresenceSupabaseClient = {
  rpc<TName extends keyof PresenceRpcArgs>(
    name: TName,
    args: PresenceRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<PresenceRpcResult[TName]>>;
};

/**
 * 그날 오기로 한 학생(학원·개인레슨 합침)과 등하원 기록. 선생님 계정은 서버가 담당 원생만 돌려준다.
 */
export async function fetchDailyStudentPresence(
  supabase: StudentPresenceSupabaseClient,
  input: { academyId: string; date: string },
): Promise<StudentPresenceRecord[]> {
  const { data, error } = await supabase.rpc("list_daily_student_presence", {
    p_academy_id: input.academyId,
    p_date: input.date,
  });

  if (error) {
    throw new Error(`등하원 현황을 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map(toStudentPresenceRecord);
}

/** 원장·데스크만 기록한다. 등원·하원 시각은 서버 시각으로 남는다. */
export async function recordStudentPresence(
  supabase: StudentPresenceSupabaseClient,
  input: { academyId: string; studentId: string; date: string; action: PresenceAction },
): Promise<void> {
  const { error } = await supabase.rpc("record_student_presence", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_date: input.date,
    p_action: input.action,
  });

  if (error) {
    throw new Error(`등하원을 기록하지 못했습니다: ${error.message}`);
  }
}

function toStudentPresenceRecord(row: PresenceRosterRow): StudentPresenceRecord {
  const kinds = row.lesson_kinds.map((kind) => (kind === "makeup" ? "academy" : kind));

  return {
    studentId: row.student_id,
    studentName: row.student_name,
    lessonKinds: [...new Set(kinds)],
    firstStartAt: row.first_starts_at,
    arrivedAt: row.arrived_at,
    leftAt: row.left_at,
  };
}

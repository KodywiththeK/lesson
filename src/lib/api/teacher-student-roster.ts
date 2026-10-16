import {
  buildTeacherStudentRoster,
  type BuildTeacherStudentRosterOptions,
  type TeacherStudentRosterRow,
} from "@/domain/teacher-student-roster";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type TeacherStudentRosterRpcRow = {
  student_id: string;
  student_name: string;
  instrument_names: string[] | null;
  weekdays: string[] | null;
};

export type TeacherStudentRosterSupabaseClient = {
  rpc(
    functionName: "list_students_for_teacher",
    payload: { p_academy_id: string },
  ): PromiseLike<SupabaseQueryResult<TeacherStudentRosterRpcRow[]>>;
};

/**
 * 선생님 계정은 원생 표를 직접 읽지 않고 이 RPC로 담당 원생의 이름·악기·요일만 받는다.
 * 학교·나이·수강료·연락처는 서버가 내려주지 않는다.
 */
export async function fetchTeacherStudentRoster(
  supabase: TeacherStudentRosterSupabaseClient,
  options: BuildTeacherStudentRosterOptions,
) {
  const { data, error } = await supabase.rpc("list_students_for_teacher", {
    p_academy_id: options.academyId,
  });

  if (error) {
    throw new Error(`담당 원생 명단을 불러오지 못했습니다: ${error.message}`);
  }

  return buildTeacherStudentRoster((data ?? []).map((row) => toRosterRow(options.academyId, row)), options);
}

export function createTeacherStudentRosterQueryOptions(
  supabase: TeacherStudentRosterSupabaseClient,
  options: BuildTeacherStudentRosterOptions,
) {
  return {
    queryKey: [
      ...queryKeys.academy(options.academyId),
      "students",
      "teacher-roster",
      options.search ?? "",
      String(options.page ?? 1),
      String(options.pageSize ?? ""),
    ] as const,
    queryFn: () => fetchTeacherStudentRoster(supabase, options),
  };
}

function toRosterRow(academyId: string, row: TeacherStudentRosterRpcRow): TeacherStudentRosterRow {
  return {
    academyId,
    studentId: row.student_id,
    name: row.student_name,
    instrumentNames: row.instrument_names ?? [],
    weekdayLabels: row.weekdays ?? [],
  };
}

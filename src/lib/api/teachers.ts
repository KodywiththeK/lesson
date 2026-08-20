import type { ListView } from "@/domain/common-list";
import {
  buildTeacherList,
  type BuildTeacherListOptions,
  type TeacherListRow,
} from "@/domain/teacher-list";
import type { TeacherPayType } from "@/domain/teacher";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type TeacherSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  part: string;
  phone: string | null;
  registered_on: string;
  salary_type: TeacherPayType;
};

type TeacherListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<TeacherSupabaseRow[]>>;
};

type TeacherListFromBuilder = {
  select(select: string): TeacherListSelectBuilder;
};

export type TeacherListSupabaseClient = {
  from(table: "teachers"): TeacherListFromBuilder;
};

export type FetchTeacherListOptions = BuildTeacherListOptions;

const TEACHER_LIST_SELECT =
  "id, academy_id, name, part, phone, registered_on, salary_type";

export async function fetchTeacherList(
  supabase: TeacherListSupabaseClient,
  options: FetchTeacherListOptions,
): Promise<ListView<TeacherListRow>> {
  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_LIST_SELECT)
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`선생님 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildTeacherList((data ?? []).map(toTeacherListRow), options);
}

export function createTeacherListQueryOptions(
  supabase: TeacherListSupabaseClient,
  options: FetchTeacherListOptions,
) {
  return {
    queryKey: queryKeys.teachers.list(options.academyId, {
      q: options.search,
      part: options.filters?.part,
      payType: options.filters?.payType,
    }),
    queryFn: () => fetchTeacherList(supabase, options),
  };
}

function toTeacherListRow(row: TeacherSupabaseRow): TeacherListRow {
  return {
    academyId: row.academy_id,
    teacherId: row.id,
    name: row.name,
    part: row.part,
    contact: row.phone ?? "",
    registeredAt: row.registered_on,
    payType: row.salary_type,
  };
}

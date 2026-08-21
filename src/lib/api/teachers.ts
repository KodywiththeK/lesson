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

export type RegisterTeacherInput = {
  academyId: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  payType: TeacherPayType;
};

export type TeacherMutationSupabaseClient = {
  from(table: "teachers"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<TeacherSupabaseRow>>;
      };
    };
  };
};

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

export async function registerTeacher(
  supabase: TeacherMutationSupabaseClient,
  input: RegisterTeacherInput,
): Promise<TeacherListRow> {
  const { data, error } = await supabase
    .from("teachers")
    .insert({
      academy_id: input.academyId,
      name: input.name,
      part: input.part,
      phone: input.contact || null,
      registered_on: input.registeredAt,
      salary_type: input.payType,
    })
    .select(TEACHER_LIST_SELECT)
    .single();

  if (error) {
    throw new Error(`선생님을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("선생님을 등록했지만 반환된 데이터가 없습니다.");
  }

  return toTeacherListRow(data);
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

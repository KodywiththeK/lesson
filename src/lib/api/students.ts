import type { ListView } from "@/domain/common-list";
import {
  buildStudentList,
  type BuildStudentListOptions,
  type StudentListRow,
} from "@/domain/student-list";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type StudentInstrumentSupabaseRow = {
  instrument_name: string | null;
  weekdays: string[] | null;
  teachers: {
    name: string | null;
  } | null;
};

export type StudentSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  student_instruments: StudentInstrumentSupabaseRow[] | null;
};

type StudentListSelectBuilder = {
  eq(
    column: "academy_id",
    value: string,
  ): PromiseLike<SupabaseQueryResult<StudentSupabaseRow[]>>;
};

type StudentListFromBuilder = {
  select(select: string): StudentListSelectBuilder;
};

export type StudentListSupabaseClient = {
  from(table: "students"): StudentListFromBuilder;
};

export type FetchStudentListOptions = BuildStudentListOptions;

export async function fetchStudentList(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
): Promise<ListView<StudentListRow>> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, academy_id, name, student_instruments(instrument_name, weekdays, teachers(name))",
    )
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`원생 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildStudentList((data ?? []).map(toStudentListRow), options);
}

export function createStudentListQueryOptions(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
) {
  return {
    queryKey: queryKeys.students.list(options.academyId, {
      q: options.search,
      teacherName: options.filters?.teacherName,
      instrumentName: options.filters?.instrumentName,
      weekdayLabel: options.filters?.weekdayLabel,
    }),
    queryFn: () => fetchStudentList(supabase, options),
  };
}

function toStudentListRow(row: StudentSupabaseRow): StudentListRow {
  const instruments = row.student_instruments ?? [];

  return {
    academyId: row.academy_id,
    studentId: row.id,
    name: row.name,
    teacherNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.teachers?.name),
    ),
    instrumentNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.instrument_name),
    ),
    weekdayLabels: uniqueNonEmpty(
      instruments.flatMap((instrument) => instrument.weekdays ?? []),
    ),
  };
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values.flatMap((value) => {
        const trimmedValue = value?.trim();

        return trimmedValue ? [trimmedValue] : [];
      }),
    ),
  ];
}

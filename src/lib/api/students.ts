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
  id?: string | null;
  teacher_id?: string | null;
  instrument_id?: string | null;
  instrument_name: string | null;
  lesson_type?: string | null;
  weekdays: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  progress?: string | null;
  lesson_fee?: number | null;
  discount_total?: number | null;
  final_monthly_fee?: number | null;
  active?: boolean | null;
  teachers: {
    name: string | null;
  } | null;
};

export type StudentRegistrationTeacherOptionRow = {
  id: string;
  academy_id: string;
  name: string;
  part: string;
};

export type StudentSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  registered_on?: string;
  status?: string;
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

export type RegisterStudentEnrollmentInput = {
  academyId: string;
  name: string;
  registeredAt: string;
  teacherId: string;
  teacherName: string;
  lessonType: "academy" | "private";
  weekdays: string[];
  instrumentId: string;
  instrumentName: string;
  startTime: string;
  endTime: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  finalMonthlyFee: number;
};

export type StudentRegistrationSupabaseClient = {
  from(table: "students"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<
          SupabaseQueryResult<{
            id: string;
            academy_id: string;
            name: string;
          }>
        >;
      };
    };
  };
  from(table: "student_instruments" | "lesson_series"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<{ id: string }>>;
      };
    };
  };
  from(table: "student_teacher_assignments"): {
    insert(values: Record<string, unknown> | Record<string, unknown>[]): PromiseLike<
      SupabaseQueryResult<null>
    >;
  };
};

export type StudentUpdateSupabaseClient = {
  rpc(
    functionName: "update_student_profile_from_date",
    payload: {
      p_academy_id: string;
      p_student_id: string;
      p_name: string;
      p_student_instrument_id: string | null;
      p_teacher_id: string | null;
      p_instrument_id: string;
      p_instrument_name: string;
      p_lesson_type: string;
      p_weekdays: string[];
      p_start_time: string | null;
      p_end_time: string | null;
      p_progress: string;
      p_lesson_fee: number;
      p_discount_total: number;
      p_final_monthly_fee: number;
      p_effective_from: string;
    },
  ): PromiseLike<SupabaseQueryResult<null>>;
};

export type UpdateStudentProfileInput = {
  academyId: string;
  studentId: string;
  name: string;
  studentInstrumentId?: string;
  teacherId?: string;
  teacherName?: string;
  instrumentId?: string;
  instrumentName?: string;
  lessonType?: "academy" | "private" | string;
  weekdayLabels?: string[];
  startTime?: string;
  endTime?: string;
  progress?: string;
  lessonFee?: number;
  discountTotal?: number;
  finalMonthlyFee?: number;
  effectiveFrom?: string;
};

export async function fetchStudentList(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
): Promise<ListView<StudentListRow>> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, academy_id, name, registered_on, status, student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, final_monthly_fee, active, teachers!student_instruments_academy_teacher_fk(name))",
    )
    .eq("academy_id", options.academyId);

  if (error) {
    throw new Error(`원생 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildStudentList((data ?? []).map(toStudentListRow), options);
}

export async function updateStudentProfile(
  supabase: StudentUpdateSupabaseClient,
  input: UpdateStudentProfileInput,
): Promise<StudentListRow> {
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("원생명은 필수입니다.");
  }

  const { error } = await supabase.rpc("update_student_profile_from_date", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_name: trimmedName,
    p_student_instrument_id: input.studentInstrumentId ?? null,
    p_teacher_id: input.teacherId ?? null,
    p_instrument_id: input.instrumentId ?? "",
    p_instrument_name: input.instrumentName ?? "",
    p_lesson_type: input.lessonType ?? "academy",
    p_weekdays: input.weekdayLabels ?? [],
    p_start_time: normalizeOptionalTime(input.startTime),
    p_end_time: normalizeOptionalTime(input.endTime),
    p_progress: input.progress ?? "",
    p_lesson_fee: input.lessonFee ?? 0,
    p_discount_total: input.discountTotal ?? 0,
    p_final_monthly_fee: input.finalMonthlyFee ?? 0,
    p_effective_from: input.effectiveFrom ?? toSeoulDate(new Date()),
  });

  if (error) {
    throw new Error(`원생 정보를 수정하지 못했습니다: ${error.message}`);
  }

  const instrumentNames = input.instrumentName ? [input.instrumentName] : [];
  const teacherNames = input.teacherName ? [input.teacherName] : [];
  const weekdayLabels = input.weekdayLabels ?? [];

  return {
    academyId: input.academyId,
    studentId: input.studentId,
    name: trimmedName,
    teacherNames,
    instrumentNames,
    weekdayLabels,
    instruments: input.studentInstrumentId
      ? [
          {
            studentInstrumentId: input.studentInstrumentId,
            teacherId: input.teacherId ?? null,
            teacherName: input.teacherName ?? "",
            instrumentId: input.instrumentId ?? "",
            instrumentName: input.instrumentName ?? "",
            lessonType: input.lessonType ?? "academy",
            weekdayLabels,
            startTime: input.startTime ?? "",
            endTime: input.endTime ?? "",
            progress: input.progress ?? "",
            lessonFee: input.lessonFee ?? 0,
            discountTotal: input.discountTotal ?? 0,
            finalMonthlyFee: input.finalMonthlyFee ?? 0,
            active: true,
          },
        ]
      : [],
  };
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

export async function registerStudentEnrollment(
  supabase: StudentRegistrationSupabaseClient,
  input: RegisterStudentEnrollmentInput,
): Promise<StudentListRow> {
  const { data: student, error: studentError } = await supabase
    .from("students")
    .insert({
      academy_id: input.academyId,
      name: input.name,
      status: "enrolled",
      registered_on: input.registeredAt,
    })
    .select("id, academy_id, name")
    .single();

  if (studentError) {
    throw new Error(`원생을 등록하지 못했습니다: ${studentError.message}`);
  }

  if (!student) {
    throw new Error("원생을 등록했지만 반환된 데이터가 없습니다.");
  }

  const { data: instrument, error: instrumentError } = await supabase
    .from("student_instruments")
    .insert({
      academy_id: input.academyId,
      student_id: student.id,
      teacher_id: input.teacherId,
      instrument_id: input.instrumentId,
      instrument_name: input.instrumentName,
      lesson_type: input.lessonType,
      weekdays: input.weekdays.map(toKoreanWeekdayLabel),
      start_time: input.startTime,
      end_time: input.endTime,
      progress: input.progress,
      lesson_fee: input.lessonFee,
      discount_total: input.discountTotal,
      final_monthly_fee: input.finalMonthlyFee,
    })
    .select("id")
    .single();

  if (instrumentError) {
    throw new Error(`원생 수강 악기를 등록하지 못했습니다: ${instrumentError.message}`);
  }

  if (!instrument) {
    throw new Error("원생 수강 악기를 등록했지만 반환된 데이터가 없습니다.");
  }

  const { error: assignmentError } = await supabase
    .from("student_teacher_assignments")
    .insert({
      academy_id: input.academyId,
      student_id: student.id,
      teacher_id: input.teacherId,
      instrument_name: input.instrumentName,
      active: true,
    });

  if (assignmentError) {
    throw new Error(`원생 선생님 배정을 등록하지 못했습니다: ${assignmentError.message}`);
  }

  if (input.lessonType === "academy") {
    const { error: seriesError } = await supabase
      .from("lesson_series")
      .insert({
        academy_id: input.academyId,
        student_id: student.id,
        student_instrument_id: instrument.id,
        teacher_id: input.teacherId,
        lesson_kind: "academy",
        instrument_id: input.instrumentId,
        instrument_name: input.instrumentName,
        weekdays: input.weekdays.map(toKoreanWeekdayLabel),
        start_time: input.startTime,
        end_time: input.endTime,
        effective_from: input.registeredAt,
        active: true,
      })
      .select("id")
      .single();

    if (seriesError) {
      throw new Error(`원생 정기 레슨 규칙을 등록하지 못했습니다: ${seriesError.message}`);
    }
  }

  return {
    academyId: input.academyId,
    studentId: student.id,
    name: student.name,
    teacherNames: [input.teacherName],
    instrumentNames: [input.instrumentName],
    weekdayLabels: input.weekdays.map(toKoreanWeekdayLabel),
  };
}

function toKoreanWeekdayLabel(value: string) {
  const labels: Record<string, string> = {
    monday: "월",
    tuesday: "화",
    wednesday: "수",
    thursday: "목",
    friday: "금",
    saturday: "토",
    sunday: "일",
  };

  return labels[value] ?? value;
}

function toStudentListRow(row: StudentSupabaseRow): StudentListRow {
  const instruments = row.student_instruments ?? [];

  return {
    academyId: row.academy_id,
    studentId: row.id,
    name: row.name,
    registeredOn: row.registered_on,
    status: row.status,
    teacherNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.teachers?.name),
    ),
    instrumentNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.instrument_name),
    ),
    weekdayLabels: uniqueNonEmpty(
      instruments.flatMap((instrument) => instrument.weekdays ?? []),
    ),
    instruments: instruments.map((instrument) => ({
      studentInstrumentId: instrument.id ?? "",
      teacherId: instrument.teacher_id ?? null,
      teacherName: instrument.teachers?.name ?? "",
      instrumentId: instrument.instrument_id ?? "",
      instrumentName: instrument.instrument_name ?? "",
      lessonType: instrument.lesson_type ?? "academy",
      weekdayLabels: instrument.weekdays ?? [],
      startTime: normalizeTimeForInput(instrument.start_time),
      endTime: normalizeTimeForInput(instrument.end_time),
      progress: instrument.progress ?? "",
      lessonFee: instrument.lesson_fee ?? 0,
      discountTotal: instrument.discount_total ?? 0,
      finalMonthlyFee: instrument.final_monthly_fee ?? 0,
      active: instrument.active ?? true,
    })),
  };
}

function normalizeOptionalTime(value: string | undefined) {
  return value?.trim() || null;
}

function toSeoulDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizeTimeForInput(value: string | null | undefined) {
  return value?.slice(0, 5) ?? "";
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

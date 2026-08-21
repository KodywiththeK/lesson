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
  from(table: "student_instruments"): {
    insert(values: Record<string, unknown>): {
      select(select: string): {
        single(): PromiseLike<SupabaseQueryResult<{ id: string }>>;
      };
    };
  };
  from(table: "student_teacher_assignments" | "lesson_events"): {
    insert(values: Record<string, unknown> | Record<string, unknown>[]): PromiseLike<
      SupabaseQueryResult<null>
    >;
  };
};

export async function fetchStudentList(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
): Promise<ListView<StudentListRow>> {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(instrument_name, weekdays, teachers!student_instruments_academy_teacher_fk(name))",
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
    const events = buildMonthlyLessonEvents(student.id, instrument.id, input);

    if (events.length > 0) {
      const { error: lessonError } = await supabase
        .from("lesson_events")
        .insert(events);

      if (lessonError) {
        throw new Error(`원생 레슨 일정을 등록하지 못했습니다: ${lessonError.message}`);
      }
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

function buildMonthlyLessonEvents(
  studentId: string,
  studentInstrumentId: string,
  input: RegisterStudentEnrollmentInput,
) {
  const registeredDate = new Date(`${input.registeredAt}T00:00:00+09:00`);
  const year = registeredDate.getFullYear();
  const month = registeredDate.getMonth();
  const events: Record<string, unknown>[] = [];
  const targetWeekdays = new Set(input.weekdays.map(toKoreanWeekdayLabel));

  for (
    let date = new Date(year, month, registeredDate.getDate());
    date.getMonth() === month;
    date.setDate(date.getDate() + 1)
  ) {
    if (!targetWeekdays.has(getKoreanWeekdayLabel(date))) {
      continue;
    }

    const dateValue = toDateValue(date);
    events.push({
      academy_id: input.academyId,
      student_id: studentId,
      student_instrument_id: studentInstrumentId,
      teacher_id: input.teacherId,
      lesson_kind: "academy",
      instrument_id: input.instrumentId,
      instrument_name: input.instrumentName,
      starts_at: `${dateValue} ${input.startTime}:00+09`,
      ends_at: `${dateValue} ${input.endTime}:00+09`,
      generated_from_enrollment: true,
    });
  }

  return events;
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

function getKoreanWeekdayLabel(date: Date) {
  return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
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

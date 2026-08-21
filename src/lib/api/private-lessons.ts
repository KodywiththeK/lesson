import {
  findPrivateLessonRegistrationBlocker,
  type PrivateLesson,
} from "@/domain/private-lesson";

import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type PrivateLessonRegistrationStudentOption = {
  studentId: string;
  studentName: string;
  instruments: Array<{
    studentInstrumentId: string;
    instrumentId: string;
    instrumentName: string;
  }>;
};

export type PrivateLessonRegistrationTeacherOption = {
  teacherId: string;
  teacherName: string;
  part: string;
};

export type PrivateLessonRegistrationOptions = {
  students: PrivateLessonRegistrationStudentOption[];
  teachers: PrivateLessonRegistrationTeacherOption[];
};

export type PrivateLessonRegistrationStudentSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  student_instruments:
    | Array<{
        id: string;
        instrument_id: string | null;
        instrument_name: string | null;
        lesson_type: string | null;
        active: boolean | null;
      }>
    | null;
};

export type PrivateLessonRegistrationTeacherSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  part: string | null;
};

export type PrivateLessonEventSupabaseRow = {
  id: string;
  academy_id: string;
  student_id: string;
  students: {
    name: string | null;
  } | null;
  instrument_id: string;
  instrument_name: string;
  teacher_id: string;
  teachers: {
    name: string | null;
  } | null;
  starts_at: string;
  ends_at: string;
  status: string;
};

type PrivateLessonRegistrationOptionsSelectBuilder<
  TData extends
    | PrivateLessonRegistrationStudentSupabaseRow[]
    | PrivateLessonRegistrationTeacherSupabaseRow[],
> = {
  eq(column: "academy_id", value: string): PromiseLike<SupabaseQueryResult<TData>>;
};

type PrivateLessonRegistrationOptionsFromBuilder<TData> = {
  select(select: string): PrivateLessonRegistrationOptionsSelectBuilder<
    TData extends "students"
      ? PrivateLessonRegistrationStudentSupabaseRow[]
      : PrivateLessonRegistrationTeacherSupabaseRow[]
  >;
};

export type PrivateLessonRegistrationOptionsSupabaseClient = {
  from(
    table: "students",
  ): PrivateLessonRegistrationOptionsFromBuilder<"students">;
  from(
    table: "teachers",
  ): PrivateLessonRegistrationOptionsFromBuilder<"teachers">;
};

type PrivateLessonExistingLessonBuilder = {
  eq(
    column: "academy_id" | "teacher_id" | "lesson_kind",
    value: string,
  ): PrivateLessonExistingLessonBuilder;
  order(
    column: "starts_at",
    options: { ascending: boolean },
  ): PromiseLike<SupabaseQueryResult<PrivateLessonEventSupabaseRow[]>>;
};

type PrivateLessonInsertBuilder = {
  select(select: string): {
    single(): PromiseLike<SupabaseQueryResult<PrivateLessonEventSupabaseRow>>;
  };
};

type PrivateLessonRegistrationFromBuilder = {
  select(select: string): PrivateLessonExistingLessonBuilder;
  insert(values: Record<string, unknown>): PrivateLessonInsertBuilder;
};

export type PrivateLessonRegistrationSupabaseClient = {
  from(table: "lesson_events"): PrivateLessonRegistrationFromBuilder;
};

type AttendanceRecordUpsertFromBuilder = {
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): {
    select(select: "id"): PromiseLike<SupabaseQueryResult<Array<{ id: string }>>>;
  };
};

type LessonTicketGrantUsageLookupBuilder = {
  eq(
    column: "academy_id" | "student_id" | "instrument_id",
    value: string,
  ): LessonTicketGrantUsageLookupBuilder;
  gt(column: "remaining_count", value: number): LessonTicketGrantUsageLookupBuilder;
  order(column: "valid_until", options: { ascending: boolean }): {
    limit(
      count: number,
    ): PromiseLike<SupabaseQueryResult<LessonTicketGrantUsageRow[]>>;
  };
};

type LessonTicketGrantUsageFromBuilder = {
  select(select: string): LessonTicketGrantUsageLookupBuilder;
  update(values: Record<string, unknown>): {
    eq(column: "id", value: string): PromiseLike<SupabaseQueryResult<null>>;
  };
};

type LessonTicketUsageInsertFromBuilder = {
  insert(values: Record<string, unknown>): PromiseLike<SupabaseQueryResult<null>>;
};

type LessonTicketGrantUsageRow = {
  id: string;
  remaining_count: number;
};

export type MarkPrivateLessonAttendanceSupabaseClient = {
  from(table: "attendance_records"): AttendanceRecordUpsertFromBuilder;
  from(table: "lesson_ticket_grants"): LessonTicketGrantUsageFromBuilder;
  from(table: "lesson_ticket_usages"): LessonTicketUsageInsertFromBuilder;
};

export type RegisterPrivateLessonEventInput = {
  academyId: string;
  studentId: string;
  studentName: string;
  studentInstrumentId: string;
  instrumentId: string;
  instrumentName: string;
  teacherId: string;
  teacherName: string;
  startAt: string;
  endAt: string;
};

export type MarkPrivateLessonAttendanceInput = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  instrumentId: string;
  instrumentName: string;
  status: "present" | "absent";
  markedAt: string;
};

const PRIVATE_LESSON_STUDENT_OPTIONS_SELECT =
  "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(id, instrument_id, instrument_name, lesson_type, active)";
const PRIVATE_LESSON_TEACHER_OPTIONS_SELECT = "id, academy_id, name, part";
const PRIVATE_LESSON_EVENT_SELECT =
  "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, teacher_id, teachers!lesson_events_academy_teacher_fk(name), starts_at, ends_at, status";

export async function fetchPrivateLessonRegistrationOptions(
  supabase: PrivateLessonRegistrationOptionsSupabaseClient,
  academyId: string,
): Promise<PrivateLessonRegistrationOptions> {
  const [studentsResult, teachersResult] = await Promise.all([
    supabase
      .from("students")
      .select(PRIVATE_LESSON_STUDENT_OPTIONS_SELECT)
      .eq("academy_id", academyId),
    supabase
      .from("teachers")
      .select(PRIVATE_LESSON_TEACHER_OPTIONS_SELECT)
      .eq("academy_id", academyId),
  ]);

  if (studentsResult.error) {
    throw new Error(
      `개인레슨 원생 선택지를 불러오지 못했습니다: ${studentsResult.error.message}`,
    );
  }

  if (teachersResult.error) {
    throw new Error(
      `개인레슨 선생님 선택지를 불러오지 못했습니다: ${teachersResult.error.message}`,
    );
  }

  return {
    students: (studentsResult.data ?? []).map(toPrivateLessonStudentOption),
    teachers: (teachersResult.data ?? []).map(toPrivateLessonTeacherOption),
  };
}

export function createPrivateLessonRegistrationOptionsQueryOptions(
  supabase: PrivateLessonRegistrationOptionsSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.privateLessons.registrationOptions(academyId),
    queryFn: () => fetchPrivateLessonRegistrationOptions(supabase, academyId),
  };
}

export async function registerPrivateLessonEvent(
  supabase: PrivateLessonRegistrationSupabaseClient,
  input: RegisterPrivateLessonEventInput,
): Promise<PrivateLesson> {
  const existingLessons = await fetchTeacherPrivateLessons(supabase, input);
  const blocker = findPrivateLessonRegistrationBlocker(existingLessons, {
    academyId: input.academyId,
    studentId: input.studentId,
    instrumentId: input.instrumentId,
    teacherId: input.teacherId,
    startAt: input.startAt,
    endAt: input.endAt,
  });

  if (blocker) {
    throw new Error(blocker.message);
  }

  const { data, error } = await supabase
    .from("lesson_events")
    .insert({
      academy_id: input.academyId,
      student_id: input.studentId,
      student_instrument_id: input.studentInstrumentId,
      teacher_id: input.teacherId,
      lesson_kind: "private",
      instrument_id: input.instrumentId,
      instrument_name: input.instrumentName,
      starts_at: input.startAt,
      ends_at: input.endAt,
      status: "scheduled",
      generated_from_enrollment: false,
    })
    .select(PRIVATE_LESSON_EVENT_SELECT)
    .single();

  if (error) {
    throw new Error(`개인레슨을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("개인레슨을 등록했지만 반환된 데이터가 없습니다.");
  }

  return toPrivateLesson(data);
}

export async function markPrivateLessonAttendance(
  supabase: MarkPrivateLessonAttendanceSupabaseClient,
  input: MarkPrivateLessonAttendanceInput,
) {
  const { error: attendanceError } = await supabase
    .from("attendance_records")
    .upsert(
      {
        academy_id: input.academyId,
        lesson_event_id: input.lessonEventId,
        student_id: input.studentId,
        status: input.status,
        absence_reason: input.status === "absent" ? "결석 확인" : null,
        marked_at: input.markedAt,
      },
      {
        onConflict: "academy_id,lesson_event_id,student_id",
      },
    )
    .select("id");

  if (attendanceError) {
    throw new Error(`개인레슨 출결을 저장하지 못했습니다: ${attendanceError.message}`);
  }

  if (input.status === "absent") {
    return;
  }

  const { data: tickets, error: ticketError } = await supabase
    .from("lesson_ticket_grants")
    .select("id, remaining_count")
    .eq("academy_id", input.academyId)
    .eq("student_id", input.studentId)
    .eq("instrument_id", input.instrumentId)
    .gt("remaining_count", 0)
    .order("valid_until", { ascending: true })
    .limit(1);

  if (ticketError) {
    throw new Error(`차감할 회차권을 확인하지 못했습니다: ${ticketError.message}`);
  }

  const ticket = tickets?.[0];

  if (!ticket) {
    throw new Error(`${input.instrumentName} 회차권 잔여가 없습니다.`);
  }

  const { error: updateError } = await supabase
    .from("lesson_ticket_grants")
    .update({
      remaining_count: Math.max(0, ticket.remaining_count - 1),
    })
    .eq("id", ticket.id);

  if (updateError) {
    throw new Error(`회차권 잔여를 차감하지 못했습니다: ${updateError.message}`);
  }

  const { error: usageError } = await supabase.from("lesson_ticket_usages").insert({
    academy_id: input.academyId,
    lesson_ticket_grant_id: ticket.id,
    lesson_event_id: input.lessonEventId,
    student_id: input.studentId,
    instrument_id: input.instrumentId,
    used_at: input.markedAt,
  });

  if (usageError) {
    throw new Error(`회차권 사용 이력을 저장하지 못했습니다: ${usageError.message}`);
  }
}

async function fetchTeacherPrivateLessons(
  supabase: PrivateLessonRegistrationSupabaseClient,
  input: RegisterPrivateLessonEventInput,
): Promise<PrivateLesson[]> {
  const { data, error } = await supabase
    .from("lesson_events")
    .select(PRIVATE_LESSON_EVENT_SELECT)
    .eq("academy_id", input.academyId)
    .eq("teacher_id", input.teacherId)
    .eq("lesson_kind", "private")
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(`개인레슨 시간 충돌을 확인하지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map(toPrivateLesson);
}

function toPrivateLessonStudentOption(
  row: PrivateLessonRegistrationStudentSupabaseRow,
): PrivateLessonRegistrationStudentOption {
  return {
    studentId: row.id,
    studentName: row.name,
    instruments: (row.student_instruments ?? []).flatMap((instrument) => {
      if (
        instrument.active !== true ||
        instrument.lesson_type !== "private" ||
        !instrument.instrument_id ||
        !instrument.instrument_name?.trim()
      ) {
        return [];
      }

      return [
        {
          studentInstrumentId: instrument.id,
          instrumentId: instrument.instrument_id,
          instrumentName: instrument.instrument_name,
        },
      ];
    }),
  };
}

function toPrivateLessonTeacherOption(
  row: PrivateLessonRegistrationTeacherSupabaseRow,
): PrivateLessonRegistrationTeacherOption {
  return {
    teacherId: row.id,
    teacherName: row.name,
    part: row.part ?? "",
  };
}

function toPrivateLesson(row: PrivateLessonEventSupabaseRow): PrivateLesson {
  return {
    id: row.id,
    academyId: row.academy_id,
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    teacherId: row.teacher_id,
    teacherName: row.teachers?.name?.trim() || "이름 없음",
    startAt: row.starts_at,
    endAt: row.ends_at,
    status: row.status === "cancelled" || row.status === "deleted"
      ? "cancelled"
      : "scheduled",
  };
}

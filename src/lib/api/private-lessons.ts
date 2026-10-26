import { compareKoreanNames } from "@/domain/common-list";
import {
  deriveLessonMinutes,
  findPrivateLessonRegistrationBlocker,
  getPrivateAbsenceReasonError,
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
    /** 원생이 이 악기를 배우는 담당 선생님. 등록 폼의 기본 선생님으로 쓴다. */
    teacherId?: string;
    /** 원생 등록에서 정한 월 레슨 횟수. */
    sessionsPerMonth?: number;
    /** 원생 등록에서 정한 회당 길이. 이전 데이터는 대표 시작·종료 시각의 차이를 사용한다. */
    lessonMinutes?: number;
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

export type PrivateLessonAvailability = {
  studentId: string;
  instrumentId: string;
  remainingCount: number;
  reservedCount: number;
  availableCount: number;
};

export type PrivateLessonAvailabilitySupabaseClient = {
  rpc(
    functionName: "get_private_lesson_availability",
    payload: { p_academy_id: string; p_lesson_date: string },
  ): PromiseLike<SupabaseQueryResult<Array<{
    student_id: string;
    instrument_id: string;
    remaining_count: number;
    reserved_count: number;
    available_count: number;
  }>>>;
};

export async function fetchPrivateLessonAvailability(
  supabase: PrivateLessonAvailabilitySupabaseClient,
  academyId: string,
  lessonDate: string,
): Promise<PrivateLessonAvailability[]> {
  const { data, error } = await supabase.rpc("get_private_lesson_availability", {
    p_academy_id: academyId,
    p_lesson_date: lessonDate,
  });
  if (error) throw new Error(`예약 가능 회차를 불러오지 못했습니다: ${error.message}`);
  return (data ?? []).map((row) => ({
    studentId: row.student_id,
    instrumentId: row.instrument_id,
    remainingCount: row.remaining_count,
    reservedCount: row.reserved_count,
    availableCount: row.available_count,
  }));
}

type LessonRegistrationOptionLessonType = "academy" | "private";

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
        teacher_id?: string | null;
        sessions_per_month?: number | null;
        lesson_duration_minutes?: number | null;
        start_time?: string | null;
        end_time?: string | null;
      }>
    | null;
};

export type PrivateLessonRegistrationTeacherSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  part: string | null;
  status?: string | null;
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
  origin?: string | null;
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

export type MarkPrivateLessonAttendanceSupabaseClient = {
  rpc(
    functionName: "mark_private_lesson_attendance",
    payload: {
      p_academy_id: string;
      p_lesson_event_id: string;
      p_student_id: string;
      p_instrument_id: string;
      p_status: "present" | "absent";
      p_marked_at: string;
      /** 결석일 때만 보낸다. 비우면 서버가 기본 문구(결석 확인)를 쓴다. */
      p_reason: string | null;
    },
  ): PromiseLike<SupabaseQueryResult<null>>;
};

export type CancelPrivateLessonAttendanceSupabaseClient = {
  rpc(
    functionName: "cancel_private_lesson_attendance",
    payload: {
      p_academy_id: string;
      p_lesson_event_id: string;
      p_student_id: string;
      p_instrument_id: string;
    },
  ): PromiseLike<SupabaseQueryResult<{ cancelled: boolean; restored_ticket: boolean }>>;
};

export type PrivateLessonMutationSupabaseClient = {
  rpc(
    functionName: "update_private_lesson_event" | "delete_private_lesson_event",
    payload: Record<string, string | null>,
  ): PromiseLike<SupabaseQueryResult<{ event_id: string }>>;
};

export type UpdatePrivateLessonEventInput = {
  academyId: string;
  eventId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
  reason?: string;
};

export async function updatePrivateLessonEvent(
  supabase: PrivateLessonMutationSupabaseClient,
  input: UpdatePrivateLessonEventInput,
) {
  const { error } = await supabase.rpc("update_private_lesson_event", {
    p_academy_id: input.academyId,
    p_event_id: input.eventId,
    p_teacher_id: input.teacherId,
    p_starts_at: input.startAt,
    p_ends_at: input.endAt,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(`개인레슨 일정을 수정하지 못했습니다: ${error.message}`);
}

export async function deletePrivateLessonEvent(
  supabase: PrivateLessonMutationSupabaseClient,
  academyId: string,
  eventId: string,
) {
  const { error } = await supabase.rpc("delete_private_lesson_event", {
    p_academy_id: academyId,
    p_event_id: eventId,
  });
  if (error) throw new Error(`개인레슨 일정을 삭제하지 못했습니다: ${error.message}`);
}

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

export type CancelPrivateLessonAttendanceInput = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  instrumentId: string;
};

export type MarkPrivateLessonAttendanceInput = {
  academyId: string;
  lessonEventId: string;
  studentId: string;
  instrumentId: string;
  instrumentName: string;
  status: "present" | "absent";
  markedAt: string;
  /** 결석 사유(선택, 100자). 출석 처리에서는 무시한다. */
  reason?: string;
};

const PRIVATE_LESSON_STUDENT_OPTIONS_SELECT =
  "id, academy_id, name, student_instruments!student_instruments_academy_student_fk(id, instrument_id, instrument_name, lesson_type, active, teacher_id, sessions_per_month, lesson_duration_minutes, start_time, end_time)";
const PRIVATE_LESSON_TEACHER_OPTIONS_SELECT = "id, academy_id, name, part, status";
const PRIVATE_LESSON_EVENT_SELECT =
  "id, academy_id, student_id, students!lesson_events_academy_student_fk(name), instrument_id, instrument_name, teacher_id, teachers!lesson_events_academy_teacher_fk(name), starts_at, ends_at, status, origin";

export async function fetchPrivateLessonRegistrationOptions(
  supabase: PrivateLessonRegistrationOptionsSupabaseClient,
  academyId: string,
): Promise<PrivateLessonRegistrationOptions> {
  return fetchLessonRegistrationOptionsByType(supabase, academyId, {
    lessonType: "private",
    studentErrorLabel: "개인레슨 원생 선택지",
    teacherErrorLabel: "개인레슨 선생님 선택지",
  });
}

export async function fetchAcademyLessonRegistrationOptions(
  supabase: PrivateLessonRegistrationOptionsSupabaseClient,
  academyId: string,
): Promise<PrivateLessonRegistrationOptions> {
  return fetchLessonRegistrationOptionsByType(supabase, academyId, {
    lessonType: "academy",
    studentErrorLabel: "학원 일정 원생 선택지",
    teacherErrorLabel: "학원 일정 선생님 선택지",
  });
}

async function fetchLessonRegistrationOptionsByType(
  supabase: PrivateLessonRegistrationOptionsSupabaseClient,
  academyId: string,
  options: {
    lessonType: LessonRegistrationOptionLessonType;
    studentErrorLabel: string;
    teacherErrorLabel: string;
  },
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
      `${options.studentErrorLabel}를 불러오지 못했습니다: ${studentsResult.error.message}`,
    );
  }

  if (teachersResult.error) {
    throw new Error(
      `${options.teacherErrorLabel}를 불러오지 못했습니다: ${teachersResult.error.message}`,
    );
  }

  return {
    students: (studentsResult.data ?? [])
      .map((student) =>
        toLessonRegistrationStudentOption(student, options.lessonType),
      )
      .filter((student) => student.instruments.length > 0)
      .sort((left, right) => compareKoreanNames(left.studentName, right.studentName)),
    // 휴직·퇴사 선생님은 새 레슨 담당으로 고르지 못하게 재직 중인 선생님만 보여 준다.
    teachers: (teachersResult.data ?? [])
      .filter((teacher) => (teacher.status ?? "employed") === "employed")
      .map(toPrivateLessonTeacherOption)
      .sort((left, right) => compareKoreanNames(left.teacherName, right.teacherName)),
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
      origin: "private",
      series_id: null,
      source_lesson_event_id: null,
      counts_for_ticket: true,
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
  const reason = input.status === "absent" ? input.reason?.trim() || null : null;
  const reasonError = getPrivateAbsenceReasonError(reason ?? undefined);

  if (reasonError) {
    throw new Error(reasonError);
  }

  const { error } = await supabase.rpc("mark_private_lesson_attendance", {
    p_academy_id: input.academyId,
    p_lesson_event_id: input.lessonEventId,
    p_student_id: input.studentId,
    p_instrument_id: input.instrumentId,
    p_status: input.status,
    p_marked_at: input.markedAt,
    p_reason: reason,
  });

  if (error) {
    throw new Error(`개인레슨 출결을 저장하지 못했습니다: ${error.message}`);
  }
}

/** 등원 확인을 취소하고 차감했던 회차권 1회를 서버에서 복구한다. */
export async function cancelPrivateLessonAttendance(
  supabase: CancelPrivateLessonAttendanceSupabaseClient,
  input: CancelPrivateLessonAttendanceInput,
) {
  const { data, error } = await supabase.rpc("cancel_private_lesson_attendance", {
    p_academy_id: input.academyId,
    p_lesson_event_id: input.lessonEventId,
    p_student_id: input.studentId,
    p_instrument_id: input.instrumentId,
  });

  if (error) {
    throw new Error(`등원 확인을 취소하지 못했습니다: ${error.message}`);
  }
  if (!data) {
    throw new Error("등원 확인 취소 결과를 확인하지 못했습니다. 다시 조회해 주세요.");
  }
  return { cancelled: data.cancelled, restoredTicket: data.restored_ticket };
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

function toLessonRegistrationStudentOption(
  row: PrivateLessonRegistrationStudentSupabaseRow,
  lessonType: LessonRegistrationOptionLessonType,
): PrivateLessonRegistrationStudentOption {
  return {
    studentId: row.id,
    studentName: row.name,
    instruments: (row.student_instruments ?? []).flatMap((instrument) => {
      if (
        instrument.active !== true ||
        instrument.lesson_type !== lessonType ||
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
          teacherId: instrument.teacher_id ?? undefined,
          ...(lessonType === "private"
            ? {
                lessonMinutes: getRegistrationLessonMinutes(
                  instrument.lesson_duration_minutes,
                  instrument.start_time,
                  instrument.end_time,
                ),
                sessionsPerMonth: instrument.sessions_per_month ?? undefined,
              }
            : {}),
        },
      ];
    }),
  };
}

function getRegistrationLessonMinutes(
  configuredMinutes: number | null | undefined,
  legacyStartTime: string | null | undefined,
  legacyEndTime: string | null | undefined,
) {
  if (configuredMinutes && configuredMinutes > 0) return configuredMinutes;
  if (!legacyStartTime || !legacyEndTime) return undefined;
  return deriveLessonMinutes(legacyStartTime, legacyEndTime);
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
    origin: "private",
    originLabel: "개인레슨",
  };
}

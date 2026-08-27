import type { ListView } from "@/domain/common-list";
import {
  buildStudentList,
  type BuildStudentListOptions,
  type StudentInstrumentWeeklySchedule,
  type StudentListRow,
} from "@/domain/student-list";
import {
  buildStatusManagementList,
  type StatusManagementListItem,
} from "@/domain/status-management";

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
  discount_label?: string | null;
  final_monthly_fee?: number | null;
  active?: boolean | null;
  student_instrument_weekly_schedules?:
    | StudentInstrumentWeeklyScheduleSupabaseRow[]
    | null;
  teachers: {
    name: string | null;
  } | null;
};

export type StudentInstrumentWeeklyScheduleSupabaseRow = {
  id?: string | null;
  weekday: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type StudentContactSupabaseRow = {
  id?: string | null;
  relationship: string | null;
  phone: string | null;
  phone_last4?: string | null;
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
  age?: number | null;
  grade?: string | null;
  school?: string | null;
  occupation?: string | null;
  attendance_code?: string | null;
  registered_on?: string;
  status?: string;
  suspended_at?: string | null;
  withdrawn_at?: string | null;
  retention_until?: string | null;
  archived_at?: string | null;
  student_contacts?: StudentContactSupabaseRow[] | null;
  student_instruments: StudentInstrumentSupabaseRow[] | null;
};

type StudentListSelectBuilder =
  PromiseLike<SupabaseQueryResult<StudentSupabaseRow[]>> & {
    eq(column: string, value: string): StudentListSelectBuilder;
    is(column: string, value: null): StudentListSelectBuilder;
  };

type EntityStatusTransitionSupabaseRow = {
  entity_type: string | null;
  entity_id: string | null;
  to_status: string | null;
  reason: string | null;
  changed_at: string | null;
};

type EntityStatusTransitionSelectBuilder =
  PromiseLike<SupabaseQueryResult<EntityStatusTransitionSupabaseRow[]>> & {
    eq(column: string, value: string): EntityStatusTransitionSelectBuilder;
    order(
      column: string,
      options?: { ascending?: boolean },
    ): EntityStatusTransitionSelectBuilder;
  };

type StudentListFromBuilder = {
  select(select: string): StudentListSelectBuilder;
};

type EntityStatusTransitionFromBuilder = {
  select(select: string): EntityStatusTransitionSelectBuilder;
};

export type StudentListSupabaseClient = {
  from(table: "students"): StudentListFromBuilder;
  from(table: "entity_status_transitions"): EntityStatusTransitionFromBuilder;
};

export type FetchStudentListOptions = BuildStudentListOptions;

export type RegisterStudentEnrollmentInput = {
  academyId: string;
  name: string;
  registeredAt: string;
  age?: number;
  grade?: string;
  school?: string;
  occupation?: string;
  contact: {
    relationship: string;
    phone: string;
  };
  instruments: RegisterStudentEnrollmentInstrumentInput[];
};

export type RegisterStudentEnrollmentInstrumentInput = {
  teacherId?: string | null;
  teacherName?: string;
  lessonType: "academy" | "private";
  instrumentId: string;
  instrumentName: string;
  weeklySchedules: RegisterStudentWeeklyScheduleInput[];
  progress: string;
  lessonFee: number;
  discountTotal: number;
  discountLabel?: string;
  finalMonthlyFee: number;
};

export type RegisterStudentWeeklyScheduleInput = {
  weekday: string;
  startTime?: string;
  endTime?: string;
};

export type StudentRegistrationSupabaseClient = {
  rpc(
    functionName: "register_student_with_enrollments",
    payload: RegisterStudentEnrollmentRpcPayload,
  ): PromiseLike<SupabaseQueryResult<string>>;
};

type RegisterStudentEnrollmentRpcPayload = {
  p_academy_id: string;
  p_name: string;
  p_registered_on: string;
  p_age: number | null;
  p_grade: string | null;
  p_school: string | null;
  p_occupation: string | null;
  p_contact_relationship: string;
  p_contact_phone: string;
  p_enrollments: Array<{
    instrument_id: string;
    instrument_name: string;
    teacher_id: string | null;
    lesson_type: string;
    progress: string;
    lesson_fee: number;
    discount_total: number;
    discount_label: string | null;
    final_monthly_fee: number;
    weekly_schedules: Array<{
      weekday: string;
      start_time: string | null;
      end_time: string | null;
    }>;
  }>;
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
  rpc(
    functionName: "update_student_status",
    payload: {
      p_academy_id: string;
      p_student_id: string;
      p_status: "enrolled" | "suspended" | "withdrawn";
      p_changed_at: string;
      p_reason?: string | null;
    },
  ): PromiseLike<SupabaseQueryResult<null>>;
  rpc(
    functionName: "delete_withdrawn_student",
    payload: {
      p_academy_id: string;
      p_student_id: string;
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

const STUDENT_LIST_SELECT =
  "id, academy_id, name, age, grade, school, occupation, attendance_code, registered_on, status, suspended_at, withdrawn_at, retention_until, archived_at, student_contacts!student_contacts_academy_student_fk(id, relationship, phone, phone_last4), student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label, final_monthly_fee, active, student_instrument_weekly_schedules!student_iws_academy_instrument_fk(id, weekday, start_time, end_time), teachers!student_instruments_academy_teacher_fk(name))";
const STATUS_TRANSITION_SELECT =
  "entity_type, entity_id, to_status, reason, changed_at";

export async function fetchStudentList(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
): Promise<ListView<StudentListRow>> {
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_LIST_SELECT)
    .eq("academy_id", options.academyId)
    .eq("status", "enrolled")
    .is("archived_at", null);

  if (error) {
    throw new Error(`원생 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildStudentList((data ?? []).map(toStudentListRow), options);
}

export async function fetchStudentStatusManagementList(
  supabase: StudentListSupabaseClient,
  options: {
    academyId: string;
    status: "suspended" | "withdrawn";
    today?: string;
  },
): Promise<ListView<StatusManagementListItem>> {
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_LIST_SELECT)
    .eq("academy_id", options.academyId)
    .eq("status", options.status)
    .is("archived_at", null);

  if (error) {
    throw new Error(`휴원/퇴원 원생 목록을 불러오지 못했습니다: ${error.message}`);
  }

  const statusReasons = await fetchLatestStatusReasonMap(supabase, {
    academyId: options.academyId,
    entityType: "student",
    status: options.status,
  });

  return buildStatusManagementList(
    (data ?? []).map((row) => {
      const student = toStudentListRow(row);

      return {
        academyId: student.academyId,
        entityType: "student",
        entityId: student.studentId,
        name: student.name,
        status: options.status,
        changedAt:
          options.status === "withdrawn"
            ? student.withdrawnAt
            : student.suspendedAt,
        retentionUntil: student.retentionUntil,
        archivedAt: student.archivedAt,
        primaryInfo: formatJoinedValue(student.instrumentNames),
        secondaryInfo: formatJoinedValue(student.teacherNames),
        detailSummary: formatJoinedValue(student.weekdayLabels),
        statusReason: statusReasons.get(student.studentId),
      };
    }),
    {
      academyId: options.academyId,
      entityType: "student",
      status: options.status,
      today: options.today,
    },
  );
}

async function fetchLatestStatusReasonMap(
  supabase: StudentListSupabaseClient,
  options: {
    academyId: string;
    entityType: "student";
    status: "suspended" | "withdrawn";
  },
) {
  const { data, error } = await supabase
    .from("entity_status_transitions")
    .select(STATUS_TRANSITION_SELECT)
    .eq("academy_id", options.academyId)
    .eq("entity_type", options.entityType)
    .eq("to_status", options.status)
    .order("changed_at", { ascending: false });

  if (error) {
    throw new Error(`원생 상태 변경 메모를 불러오지 못했습니다: ${error.message}`);
  }

  return buildLatestReasonMap(data ?? []);
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
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? ""),
    }),
    queryFn: () => fetchStudentList(supabase, options),
  };
}

export function createStudentStatusManagementQueryOptions(
  supabase: StudentListSupabaseClient,
  options: {
    academyId: string;
    status: "suspended" | "withdrawn";
    today?: string;
  },
) {
  return {
    queryKey: queryKeys.statusManagement.list(options.academyId, {
      entityType: "student",
      status: options.status,
    }),
    queryFn: () => fetchStudentStatusManagementList(supabase, options),
  };
}

export async function registerStudentEnrollment(
  supabase: StudentRegistrationSupabaseClient,
  input: RegisterStudentEnrollmentInput,
): Promise<StudentListRow> {
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("원생명은 필수입니다.");
  }

  if (input.instruments.length === 0) {
    throw new Error("하나 이상의 수강 악기가 필요합니다.");
  }

  const { data: studentId, error } = await supabase.rpc(
    "register_student_with_enrollments",
    {
      p_academy_id: input.academyId,
      p_name: trimmedName,
      p_registered_on: input.registeredAt,
      p_age: input.age ?? null,
      p_grade: normalizeOptionalText(input.grade),
      p_school: normalizeOptionalText(input.school),
      p_occupation: normalizeOptionalText(input.occupation),
      p_contact_relationship: input.contact.relationship.trim() || "본인",
      p_contact_phone: input.contact.phone.trim(),
      p_enrollments: input.instruments.map((instrument) => ({
        instrument_id: instrument.instrumentId,
        instrument_name: instrument.instrumentName,
        teacher_id: instrument.teacherId || null,
        lesson_type: instrument.lessonType,
        progress: instrument.progress,
        lesson_fee: instrument.lessonFee,
        discount_total: instrument.discountTotal,
        discount_label: normalizeOptionalText(instrument.discountLabel),
        final_monthly_fee: instrument.finalMonthlyFee,
        weekly_schedules: instrument.weeklySchedules.map((schedule) => ({
          weekday: toKoreanWeekdayLabel(schedule.weekday),
          start_time: normalizeOptionalTime(schedule.startTime),
          end_time: normalizeOptionalTime(schedule.endTime),
        })),
      })),
    },
  );

  if (error) {
    throw new Error(`원생을 등록하지 못했습니다: ${error.message}`);
  }

  if (!studentId) {
    throw new Error("원생을 등록했지만 반환된 데이터가 없습니다.");
  }

  const instruments = input.instruments.map((instrument) => ({
    studentInstrumentId: "",
    teacherId: instrument.teacherId ?? null,
    teacherName: instrument.teacherName ?? "",
    instrumentId: instrument.instrumentId,
    instrumentName: instrument.instrumentName,
    lessonType: instrument.lessonType,
    weekdayLabels: uniqueNonEmpty(
      instrument.weeklySchedules.map((schedule) =>
        toKoreanWeekdayLabel(schedule.weekday),
      ),
    ),
    startTime: instrument.weeklySchedules[0]?.startTime ?? "",
    endTime: instrument.weeklySchedules[0]?.endTime ?? "",
    progress: instrument.progress,
    lessonFee: instrument.lessonFee,
    discountTotal: instrument.discountTotal,
    discountLabel: instrument.discountLabel,
    finalMonthlyFee: instrument.finalMonthlyFee,
    active: true,
    weeklySchedules: instrument.weeklySchedules.map((schedule) => ({
      weekday: schedule.weekday,
      weekdayLabel: toKoreanWeekdayLabel(schedule.weekday),
      startTime: schedule.startTime ?? "",
      endTime: schedule.endTime ?? "",
    })),
  }));

  return {
    academyId: input.academyId,
    studentId,
    name: trimmedName,
    age: input.age,
    grade: input.grade,
    school: input.school,
    occupation: input.occupation,
    registeredOn: input.registeredAt,
    status: "enrolled",
    contacts: [
      {
        contactId: "",
        relationship: input.contact.relationship,
        phone: input.contact.phone,
        phoneLast4: getPhoneLast4(input.contact.phone),
      },
    ],
    teacherNames: uniqueNonEmpty(input.instruments.map((item) => item.teacherName)),
    instrumentNames: uniqueNonEmpty(input.instruments.map((item) => item.instrumentName)),
    weekdayLabels: uniqueNonEmpty(
      instruments.flatMap((instrument) => instrument.weekdayLabels),
    ),
    instruments,
  };
}

export async function updateStudentStatus(
  supabase: StudentUpdateSupabaseClient,
  input: {
    academyId: string;
    studentId: string;
    status: "enrolled" | "suspended" | "withdrawn";
    changedAt?: string;
    reason?: string;
  },
) {
  const { error } = await supabase.rpc("update_student_status", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_status: input.status,
    p_changed_at: input.changedAt ?? new Date().toISOString(),
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw new Error(`원생 상태를 변경하지 못했습니다: ${error.message}`);
  }
}

export async function deleteWithdrawnStudent(
  supabase: StudentUpdateSupabaseClient,
  input: {
    academyId: string;
    studentId: string;
  },
) {
  const { error } = await supabase.rpc("delete_withdrawn_student", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
  });

  if (error) {
    throw new Error(`퇴원 원생을 삭제하지 못했습니다: ${error.message}`);
  }
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
  const mappedInstruments = instruments.map((instrument) =>
    toStudentListInstrument(instrument),
  );

  return {
    academyId: row.academy_id,
    studentId: row.id,
    name: row.name,
    age: row.age ?? undefined,
    grade: row.grade ?? undefined,
    school: row.school ?? undefined,
    occupation: row.occupation ?? undefined,
    attendanceCode: row.attendance_code ?? undefined,
    registeredOn: row.registered_on,
    status: row.status,
    suspendedAt: row.suspended_at ?? undefined,
    withdrawnAt: row.withdrawn_at ?? undefined,
    retentionUntil: row.retention_until ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    contacts: (row.student_contacts ?? []).map((contact) => ({
      contactId: contact.id ?? "",
      relationship: contact.relationship ?? "",
      phone: contact.phone ?? "",
      phoneLast4: contact.phone_last4 ?? undefined,
    })),
    teacherNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.teachers?.name),
    ),
    instrumentNames: uniqueNonEmpty(
      instruments.map((instrument) => instrument.instrument_name),
    ),
    weekdayLabels: uniqueNonEmpty(
      mappedInstruments.flatMap((instrument) => instrument.weekdayLabels),
    ),
    instruments: mappedInstruments,
  };
}

function toStudentListInstrument(instrument: StudentInstrumentSupabaseRow) {
  const weeklySchedules = normalizeWeeklySchedulesForRow(instrument);

  return {
    studentInstrumentId: instrument.id ?? "",
    teacherId: instrument.teacher_id ?? null,
    teacherName: instrument.teachers?.name ?? "",
    instrumentId: instrument.instrument_id ?? "",
    instrumentName: instrument.instrument_name ?? "",
    lessonType: instrument.lesson_type ?? "academy",
    weekdayLabels: uniqueNonEmpty(
      weeklySchedules.map((schedule) => schedule.weekdayLabel),
    ),
    startTime: weeklySchedules[0]?.startTime ?? normalizeTimeForInput(instrument.start_time),
    endTime: weeklySchedules[0]?.endTime ?? normalizeTimeForInput(instrument.end_time),
    progress: instrument.progress ?? "",
    lessonFee: instrument.lesson_fee ?? 0,
    discountTotal: instrument.discount_total ?? 0,
    discountLabel: instrument.discount_label ?? undefined,
    finalMonthlyFee: instrument.final_monthly_fee ?? 0,
    active: instrument.active ?? true,
    weeklySchedules,
  };
}

function normalizeWeeklySchedulesForRow(
  instrument: StudentInstrumentSupabaseRow,
): StudentInstrumentWeeklySchedule[] {
  const scheduleRows = instrument.student_instrument_weekly_schedules ?? [];

  if (scheduleRows.length > 0) {
    return scheduleRows.map((schedule) => ({
      scheduleId: schedule.id ?? undefined,
      weekday: toWeekdayValue(schedule.weekday ?? ""),
      weekdayLabel: toKoreanWeekdayLabel(schedule.weekday ?? ""),
      startTime: normalizeTimeForInput(schedule.start_time),
      endTime: normalizeTimeForInput(schedule.end_time),
    }));
  }

  return (instrument.weekdays ?? []).map((weekday) => ({
    weekday: toWeekdayValue(weekday),
    weekdayLabel: toKoreanWeekdayLabel(weekday),
    startTime: normalizeTimeForInput(instrument.start_time),
    endTime: normalizeTimeForInput(instrument.end_time),
  }));
}

function normalizeOptionalTime(value: string | undefined) {
  return value?.trim() || null;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || null;
}

function buildLatestReasonMap(rows: EntityStatusTransitionSupabaseRow[]) {
  const reasons = new Map<string, string | undefined>();

  for (const row of rows) {
    const entityId = row.entity_id;
    const reason = row.reason?.trim();

    if (!entityId || reasons.has(entityId)) {
      continue;
    }

    reasons.set(entityId, reason || undefined);
  }

  return reasons;
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

function formatJoinedValue(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function getPhoneLast4(phone: string) {
  return phone.replace(/\D/g, "").slice(-4) || undefined;
}

function toWeekdayValue(value: string) {
  const weekdays: Record<string, string> = {
    월: "monday",
    화: "tuesday",
    수: "wednesday",
    목: "thursday",
    금: "friday",
    토: "saturday",
    일: "sunday",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
  };

  return weekdays[value] ?? value;
}

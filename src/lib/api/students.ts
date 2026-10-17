import { compareKoreanNames, type ListView } from "@/domain/common-list";
import {
  buildStudentList,
  DEFAULT_STUDENT_SORT,
  type BuildStudentListOptions,
  type StudentInstrumentWeeklySchedule,
  type StudentListRow,
} from "@/domain/student-list";
import {
  buildStatusManagementList,
  type StatusManagementFetchOptions,
  type StatusManagementListItem,
} from "@/domain/status-management";
import { getFinanceToday } from "@/domain/finance-date";
import {
  getStudentEnrollmentValidationError,
  type StudentBasicInfoInput,
  type StudentEnrollmentChange,
  type StudentEnrollmentFields,
  type StudentEnrollmentSaveResult,
  type UpdateStudentEnrollmentsInput,
} from "@/domain/student-enrollment-edit";
import { STUDENT_DISCOUNTS, type StudentDiscountKind } from "@/domain/lesson-pricing";
import {
  getAcademyScheduleValidationError,
  type StudentInstrumentDiscountSelection,
} from "@/domain/student-registration";

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
  discount_kinds?: string[] | null;
  referral_discount_month?: string | null;
  referral_discount_amount?: number | null;
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
  age_as_of_year?: number | null;
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

export type RegisterStudentEnrollmentInstrumentInput = StudentInstrumentDiscountSelection & {
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
    discount_kinds: StudentDiscountKind[];
    referral_discount_month: string | null;
    referral_discount_amount: number;
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
    functionName: "update_student_with_enrollments",
    payload: UpdateStudentEnrollmentsRpcPayload,
  ): PromiseLike<SupabaseQueryResult<UpdateStudentEnrollmentsRpcResult>>;
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
};

export type { StudentBasicInfoInput };

type EnrollmentRpcFields = {
  teacher_id: string | null;
  instrument_id: string;
  instrument_name: string;
  lesson_type: string;
  progress: string;
  lesson_fee: number;
  discount_total: number;
  final_monthly_fee: number;
  weekly_schedules: Array<{ weekday: string; start_time: string | null; end_time: string | null }>;
  discount_kinds?: StudentDiscountKind[];
  referral_discount_month?: string | null;
  referral_discount_amount?: number;
  discount_label?: string | null;
};

type EnrollmentRpcChange =
  | ({ action: "update"; student_instrument_id: string; effective_from: string } & EnrollmentRpcFields)
  | ({ action: "add"; started_on: string } & EnrollmentRpcFields)
  | { action: "end"; student_instrument_id: string };

type UpdateStudentEnrollmentsRpcPayload = {
  p_academy_id: string;
  p_student_id: string;
  p_name: string;
  p_basic: {
    registered_on: string;
    age: number | null;
    grade: string | null;
    school: string | null;
    occupation: string | null;
    contact_relationship: string;
    contact_phone: string;
  } | null;
  p_instruments: EnrollmentRpcChange[];
};

type UpdateStudentEnrollmentsRpcResult = {
  added?: Array<{ student_instrument_id: string; instrument_id?: string }>;
  ended?: Array<{ student_instrument_id: string; remaining_event_count?: number }>;
};

const STUDENT_LIST_SELECT =
  "id, academy_id, name, age, age_as_of_year, grade, school, occupation, attendance_code, registered_on, status, suspended_at, withdrawn_at, retention_until, archived_at, student_contacts!student_contacts_academy_student_fk(id, relationship, phone, phone_last4), student_instruments!student_instruments_academy_student_fk(id, teacher_id, instrument_id, instrument_name, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label, discount_kinds, referral_discount_month, referral_discount_amount, final_monthly_fee, active, student_instrument_weekly_schedules!student_iws_academy_instrument_fk(id, weekday, start_time, end_time), teachers!student_instruments_academy_teacher_fk(name))";
const STATUS_TRANSITION_SELECT =
  "entity_type, entity_id, to_status, reason, changed_at";

async function fetchEnrolledStudentRows(
  supabase: StudentListSupabaseClient,
  academyId: string,
): Promise<StudentListRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_LIST_SELECT)
    .eq("academy_id", academyId)
    .eq("status", "enrolled")
    .is("archived_at", null);

  if (error) {
    throw new Error(`원생 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map(toStudentListRow);
}

export async function fetchStudentList(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
): Promise<ListView<StudentListRow>> {
  return buildStudentList(await fetchEnrolledStudentRows(supabase, options.academyId), options);
}

/** 드롭다운용. 페이지로 자르지 않고 재원 원생 전체를 가나다순으로 준다. */
export async function fetchStudentOptions(
  supabase: StudentListSupabaseClient,
  academyId: string,
): Promise<StudentListRow[]> {
  const rows = await fetchEnrolledStudentRows(supabase, academyId);

  return rows.sort(
    (left, right) =>
      compareKoreanNames(left.name, right.name) || compareKoreanNames(left.studentId, right.studentId),
  );
}

export function createStudentOptionsQueryOptions(
  supabase: StudentListSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.students.options(academyId),
    queryFn: () => fetchStudentOptions(supabase, academyId),
  };
}

type StudentStatusManagementOptions = StatusManagementFetchOptions<
  "suspended" | "withdrawn"
>;

export async function fetchStudentStatusManagementList(
  supabase: StudentListSupabaseClient,
  options: StudentStatusManagementOptions,
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
      ...options,
      entityType: "student",
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

/**
 * 이름·기본 정보·수강 변경(수정·추가·종료)을 RPC 한 번으로 저장한다. 서버가 한 트랜잭션으로 처리하므로
 * 실패하면 아무것도 저장되지 않는다. 악기는 바꿀 수 없고, 다른 악기로 바꾸려면 종료하고 추가한다.
 */
export async function updateStudentEnrollments(
  supabase: StudentUpdateSupabaseClient,
  input: UpdateStudentEnrollmentsInput,
): Promise<StudentEnrollmentSaveResult> {
  const validationError = getStudentEnrollmentValidationError(input);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data, error } = await supabase.rpc("update_student_with_enrollments", {
    p_academy_id: input.academyId,
    p_student_id: input.studentId,
    p_name: input.name.trim(),
    p_basic: input.basicInfo ? toBasicInfoPayload(input.basicInfo) : null,
    p_instruments: input.changes.map(toEnrollmentRpcChange),
  });

  if (error) {
    throw new Error(`원생 정보를 수정하지 못했습니다: ${error.message}`);
  }

  return {
    addedStudentInstrumentIds: (data?.added ?? []).map((added) => added.student_instrument_id),
    ended: (data?.ended ?? []).map((ended) => ({
      studentInstrumentId: ended.student_instrument_id,
      remainingEventCount: ended.remaining_event_count ?? 0,
    })),
  };
}

function toBasicInfoPayload(basicInfo: StudentBasicInfoInput) {
  return {
    registered_on: basicInfo.registeredOn,
    age: basicInfo.age ?? null,
    grade: normalizeOptionalText(basicInfo.grade),
    school: normalizeOptionalText(basicInfo.school),
    occupation: normalizeOptionalText(basicInfo.occupation),
    contact_relationship: basicInfo.contactRelationship.trim() || "본인",
    contact_phone: basicInfo.contactPhone.trim(),
  };
}

function toEnrollmentRpcChange(change: StudentEnrollmentChange): EnrollmentRpcChange {
  if (change.action === "end") {
    return { action: "end", student_instrument_id: change.studentInstrumentId };
  }

  if (change.action === "update") {
    return {
      action: "update",
      student_instrument_id: change.studentInstrumentId,
      ...toEnrollmentRpcFields(change),
      effective_from: change.effectiveFrom ?? getFinanceToday(),
      // 할인 종류를 고르지 않은 수정은 서버의 기존 할인 종류를 유지하도록 보내지 않는다.
      ...(change.discountKinds ? toDiscountRpcFields(change) : {}),
    };
  }

  return {
    action: "add",
    started_on: change.startedOn,
    ...toEnrollmentRpcFields(change),
    ...toDiscountRpcFields(change),
  };
}

function toEnrollmentRpcFields(fields: StudentEnrollmentFields) {
  return {
    teacher_id: fields.teacherId || null,
    instrument_id: fields.instrumentId,
    instrument_name: fields.instrumentName,
    lesson_type: fields.lessonType,
    progress: fields.progress,
    lesson_fee: fields.lessonFee,
    discount_total: fields.discountTotal,
    final_monthly_fee: fields.finalMonthlyFee,
    weekly_schedules: fields.weeklySchedules.map((schedule) => ({
      weekday: schedule.weekdayLabel,
      start_time: normalizeOptionalTime(schedule.startTime),
      end_time: normalizeOptionalTime(schedule.endTime),
    })),
  };
}

function toDiscountRpcFields(fields: StudentEnrollmentFields) {
  return {
    ...toDiscountPayload(fields),
    discount_label: normalizeOptionalText(fields.discountLabel),
  };
}

export function createStudentListQueryOptions(
  supabase: StudentListSupabaseClient,
  options: FetchStudentListOptions,
) {
  return {
    queryKey: createStudentListQueryKey(options),
    queryFn: () => fetchStudentList(supabase, options),
  };
}

/** 학원·검색·필터·페이지에 정렬 기준을 이어 붙인다. `queryKeys.students.list`에 정렬 항목이 없어 뒤에 덧붙인다. */
export function createStudentListQueryKey(options: FetchStudentListOptions) {
  const sort = options.sort ?? DEFAULT_STUDENT_SORT;

  return [
    ...queryKeys.students.list(options.academyId, {
      q: options.search,
      teacherName: options.filters?.teacherName,
      instrumentName: options.filters?.instrumentName,
      weekdayLabel: options.filters?.weekdayLabel,
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? ""),
    }),
    "sort",
    sort.key,
    sort.direction,
  ] as const;
}

export function createStudentStatusManagementQueryOptions(
  supabase: StudentListSupabaseClient,
  options: StudentStatusManagementOptions,
) {
  return {
    queryKey: queryKeys.statusManagement.list(options.academyId, {
      entityType: "student",
      status: options.status,
      q: options.search,
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? ""),
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

  for (const instrument of input.instruments) {
    const scheduleError = getAcademyScheduleValidationError(instrument);
    if (scheduleError) throw new Error(scheduleError);
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
        ...toDiscountPayload(instrument),
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

  const instruments = input.instruments.map((instrument) => {
    const discount = toDiscountPayload(instrument);

    return {
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
      discountKinds: discount.discount_kinds,
      referralDiscountMonth: discount.referral_discount_month?.slice(0, 7),
      referralDiscountAmount: discount.referral_discount_amount,
      finalMonthlyFee: instrument.finalMonthlyFee,
      active: true,
      weeklySchedules: instrument.weeklySchedules.map((schedule) => ({
        weekday: schedule.weekday,
        weekdayLabel: toKoreanWeekdayLabel(schedule.weekday),
        startTime: schedule.startTime ?? "",
        endTime: schedule.endTime ?? "",
      })),

    };
  });

  return {
    academyId: input.academyId,
    studentId,
    name: trimmedName,
    age: input.age,
    ageAsOfYear: input.age === undefined ? undefined : getCurrentFinanceYear(),
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

const WEEKDAY_LABEL_ORDER = ["월", "화", "수", "목", "금", "토", "일"];

function weekdayOrder(label: string) {
  const index = WEEKDAY_LABEL_ORDER.indexOf(label);

  return index === -1 ? WEEKDAY_LABEL_ORDER.length : index;
}

function sortWeekdayLabels(labels: string[]) {
  return [...labels].sort((left, right) => weekdayOrder(left) - weekdayOrder(right));
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
  // 종료(비활성)한 수강은 목록·상세에 보이지 않는다. active가 비어 있는 이전 행은 수강 중으로 본다.
  const instruments = (row.student_instruments ?? []).filter((instrument) => instrument.active !== false);
  const mappedInstruments = instruments.map((instrument) =>
    toStudentListInstrument(instrument),
  );

  return {
    academyId: row.academy_id,
    studentId: row.id,
    name: row.name,
    age: row.age ?? undefined,
    ageAsOfYear: row.age_as_of_year ?? undefined,
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
    weekdayLabels: sortWeekdayLabels(
      uniqueNonEmpty(mappedInstruments.flatMap((instrument) => instrument.weekdayLabels)),
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
    discountKinds: toKnownDiscountKinds(instrument.discount_kinds),
    referralDiscountMonth: instrument.referral_discount_month?.slice(0, 7),
    referralDiscountAmount: instrument.referral_discount_amount ?? 0,
    finalMonthlyFee: instrument.final_monthly_fee ?? 0,
    active: instrument.active ?? true,
    weeklySchedules,
  };
}

function normalizeWeeklySchedulesForRow(
  instrument: StudentInstrumentSupabaseRow,
): StudentInstrumentWeeklySchedule[] {
  const scheduleRows = instrument.student_instrument_weekly_schedules ?? [];
  const schedules: StudentInstrumentWeeklySchedule[] =
    scheduleRows.length > 0
      ? scheduleRows.map((schedule) => ({
          scheduleId: schedule.id ?? undefined,
          weekday: toWeekdayValue(schedule.weekday ?? ""),
          weekdayLabel: toKoreanWeekdayLabel(schedule.weekday ?? ""),
          startTime: normalizeTimeForInput(schedule.start_time),
          endTime: normalizeTimeForInput(schedule.end_time),
        }))
      : (instrument.weekdays ?? []).map((weekday) => ({
          weekday: toWeekdayValue(weekday),
          weekdayLabel: toKoreanWeekdayLabel(weekday),
          startTime: normalizeTimeForInput(instrument.start_time),
          endTime: normalizeTimeForInput(instrument.end_time),
        }));

  return [...schedules].sort(
    (left, right) =>
      weekdayOrder(left.weekdayLabel) - weekdayOrder(right.weekdayLabel),
  );
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

function getCurrentFinanceYear() {
  return Number(getFinanceToday().slice(0, 4));
}

const REFERRAL_DISCOUNT_KIND: StudentDiscountKind = "referral";
const KNOWN_DISCOUNT_KINDS: readonly string[] = STUDENT_DISCOUNTS.map((discount) => discount.kind);

function toKnownDiscountKinds(kinds: string[] | null | undefined): StudentDiscountKind[] {
  return (kinds ?? []).filter((kind): kind is StudentDiscountKind =>
    KNOWN_DISCOUNT_KINDS.includes(kind),
  );
}

/** 소개 달·소개 할인액은 지인 소개 할인을 고른 경우에만 보낸다. 서버에는 그 달 1일(`YYYY-MM-01`)로 저장한다. */
function toDiscountPayload(selection: StudentInstrumentDiscountSelection) {
  const discountKinds = selection.discountKinds ?? [];
  const hasReferral = discountKinds.includes(REFERRAL_DISCOUNT_KIND);

  return {
    discount_kinds: discountKinds,
    referral_discount_month:
      hasReferral && selection.referralDiscountMonth
        ? `${selection.referralDiscountMonth}-01`
        : null,
    referral_discount_amount: hasReferral ? (selection.referralDiscountAmount ?? 0) : 0,
  };
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

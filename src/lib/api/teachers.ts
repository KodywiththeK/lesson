import { compareKoreanNames, type ListView } from "@/domain/common-list";
import {
  buildTeacherList,
  formatTeacherSalarySummary,
  formatTeacherWorkScheduleSummary,
  type BuildTeacherListOptions,
  type TeacherListRow,
  type TeacherWorkSchedule,
} from "@/domain/teacher-list";
import {
  buildTeacherSalarySetting,
  normalizeWorkSchedules,
  type TeacherPayType,
  type TeacherStatus,
  type TeacherWorkScheduleInput,
} from "@/domain/teacher";
import {
  maskResidentRegistration,
  validateResidentRegistration,
} from "@/domain/teacher-resident-registration";
import {
  buildStatusManagementList,
  type StatusManagementFetchOptions,
  type StatusManagementListItem,
} from "@/domain/status-management";

import { toUserMessage } from "@/lib/errors/user-message";

import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type TeacherWorkScheduleRow = {
  id: string;
  weekday: string;
  start_time: string | null;
  end_time: string | null;
};

type TeacherSalarySettingRow = {
  id: string;
  pay_type: TeacherPayType;
  ratio_teacher_share: number | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
  active: boolean;
};

export type TeacherSupabaseRow = {
  id: string;
  academy_id: string;
  name: string;
  part: string;
  phone: string | null;
  registered_on: string;
  salary_type: TeacherPayType;
  status?: TeacherStatus | null;
  contract_start_on?: string | null;
  contract_end_on?: string | null;
  on_leave_at?: string | null;
  resigned_at?: string | null;
  retention_until?: string | null;
  archived_at?: string | null;
  /** 마스킹된 주민등록번호만 읽는다. 암호문 컬럼은 어떤 조회에서도 읽지 않는다. */
  resident_registration_masked?: string | null;
  teacher_work_schedules?: TeacherWorkScheduleRow[] | null;
  teacher_salary_settings?: TeacherSalarySettingRow[] | null;
};

type EntityStatusTransitionSupabaseRow = {
  entity_type: string | null;
  entity_id: string | null;
  to_status: string | null;
  reason: string | null;
  changed_at: string | null;
};

type TeacherListFromBuilder = {
  select(select: string): PagedSelectQuery<TeacherSupabaseRow>;
};

type EntityStatusTransitionFromBuilder = {
  select(select: string): PagedSelectQuery<EntityStatusTransitionSupabaseRow>;
};

export type TeacherListSupabaseClient = {
  from(table: "teachers"): TeacherListFromBuilder;
  from(table: "entity_status_transitions"): EntityStatusTransitionFromBuilder;
};

export type FetchTeacherListOptions = BuildTeacherListOptions;

export type TeacherProfileMutationInput = {
  academyId: string;
  teacherId?: string;
  name: string;
  part: string;
  contact: string;
  registeredAt: string;
  contractStartOn: string;
  contractEndOn: string;
  /** 급여 항목은 원장만 보낸다. `payType`이 없으면 급여 설정은 저장하지 않고 기존 값을 그대로 둔다. */
  payType?: TeacherPayType;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioAcademyShare?: number;
  ratioTeacherShare?: number;
  workSchedules?: TeacherWorkScheduleInput[];
  /** 원장만 보낸다. 비어 있으면 저장하지 않고, 있으면 프로필 저장 뒤 전용 RPC로 암호화해 저장한다. */
  residentRegistration?: string;
};

export type RegisterTeacherInput = TeacherProfileMutationInput;

export type UpdateTeacherProfileInput = TeacherProfileMutationInput & {
  teacherId: string;
};

export type UpdateTeacherStatusInput = {
  academyId: string;
  teacherId: string;
  status: TeacherStatus;
  changedAt?: string;
  reason?: string;
};

export type DeleteResignedTeacherInput = {
  academyId: string;
  teacherId: string;
};

export type RevealTeacherResidentRegistrationInput = {
  academyId: string;
  teacherId: string;
};

type TeacherRpcName =
  | "register_teacher_with_profile"
  | "update_teacher_profile"
  | "update_teacher_status"
  | "delete_resigned_teacher"
  | "set_teacher_resident_registration"
  | "reveal_teacher_resident_registration";

/** 프로필은 저장됐지만 주민등록번호 저장만 실패했다. 호출부가 같은 프로필을 다시 등록하지 않도록 다른 오류로 구분한다. */
export class ResidentRegistrationSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResidentRegistrationSaveError";
  }
}

export type TeacherMutationSupabaseClient = {
  rpc(
    functionName: TeacherRpcName,
    payload: Record<string, unknown>,
  ): PromiseLike<SupabaseQueryResult<string | null>>;
};

const TEACHER_LIST_SELECT =
  "id, academy_id, name, part, phone, registered_on, salary_type, status, contract_start_on, contract_end_on, on_leave_at, resigned_at, retention_until, archived_at, resident_registration_masked, teacher_work_schedules!teacher_work_schedules_academy_teacher_fk(id, weekday, start_time, end_time), teacher_salary_settings!teacher_salary_settings_academy_teacher_fk(id, pay_type, ratio_teacher_share, monthly_salary, hourly_rate, active)";
/** 급여 설정 없이 등록하면 서버가 teachers.salary_type에 임시로 넣는 값과 같다(20261018090100). */
const DEFAULT_PAY_TYPE_WITHOUT_SETTING: TeacherPayType = "monthly";
const UNSET_SALARY_SUMMARY = "급여 미설정";
const STATUS_TRANSITION_SELECT =
  "entity_type, entity_id, to_status, reason, changed_at";

const WEEKDAY_LABELS: Record<string, string> = {
  monday: "월",
  tuesday: "화",
  wednesday: "수",
  thursday: "목",
  friday: "금",
  saturday: "토",
  sunday: "일",
  월: "월",
  화: "화",
  수: "수",
  목: "목",
  금: "금",
  토: "토",
  일: "일",
};

/**
 * 선생님을 id순으로 끝까지 읽는다. `status`가 없으면 재직·휴직·퇴사를 모두 읽는다.
 * 기본은 보관 처리되지 않은 선생님만이고, `includeArchived`면 보관된 선생님도 읽는다.
 */
function fetchTeacherRows(
  supabase: TeacherListSupabaseClient,
  input: { academyId: string; status?: TeacherStatus; failureMessage: string; includeArchived?: boolean },
): Promise<TeacherSupabaseRow[]> {
  return fetchAllRows(input.failureMessage, (from, to) => {
    const query = supabase
      .from("teachers")
      .select(TEACHER_LIST_SELECT)
      .eq("academy_id", input.academyId);
    const filtered = input.status ? query.eq("status", input.status) : query;

    const scoped = input.includeArchived ? filtered : filtered.is("archived_at", null);

    return scoped.order("id").range(from, to);
  });
}

async function fetchEmployedTeacherRows(
  supabase: TeacherListSupabaseClient,
  academyId: string,
): Promise<TeacherListRow[]> {
  const rows = await fetchTeacherRows(supabase, {
    academyId,
    status: "employed",
    failureMessage: "선생님 목록을 불러오지 못했습니다",
  });

  return rows.map(toTeacherListRow);
}

export async function fetchTeacherList(
  supabase: TeacherListSupabaseClient,
  options: FetchTeacherListOptions,
): Promise<ListView<TeacherListRow>> {
  return buildTeacherList(await fetchEmployedTeacherRows(supabase, options.academyId), options);
}

/** 드롭다운·급여 계산처럼 페이지로 자르면 안 되는 용도. 재직 선생님 전체를 가나다순으로 준다. */
export async function fetchTeacherOptions(
  supabase: TeacherListSupabaseClient,
  academyId: string,
): Promise<TeacherListRow[]> {
  return sortTeachersByName(await fetchEmployedTeacherRows(supabase, academyId));
}

/** 급여 계산용. 과거 달 급여에는 지금 휴직·퇴사한 선생님도 포함되므로 보관 처리되지 않은 모든 상태를 가나다순으로 준다. */
export async function fetchPayrollTeachers(
  supabase: TeacherListSupabaseClient,
  academyId: string,
): Promise<TeacherListRow[]> {
  // 보관된 선생님도 그 달 지급 기록이 있을 수 있어 포함한다. 활동·정산 기록이 없는 선생님은 급여 도메인이 걸러 낸다.
  const rows = await fetchTeacherRows(supabase, {
    academyId,
    failureMessage: "선생님 목록을 불러오지 못했습니다",
    includeArchived: true,
  });

  return sortTeachersByName(rows.map(toTeacherListRow));
}

function sortTeachersByName(teachers: TeacherListRow[]) {
  return teachers.sort(
    (left, right) =>
      compareKoreanNames(left.name, right.name) || compareKoreanNames(left.teacherId, right.teacherId),
  );
}

export function createTeacherOptionsQueryOptions(
  supabase: TeacherListSupabaseClient,
  academyId: string,
) {
  return {
    queryKey: queryKeys.teachers.options(academyId),
    queryFn: () => fetchTeacherOptions(supabase, academyId),
  };
}

type TeacherStatusManagementOptions = StatusManagementFetchOptions<
  "on_leave" | "resigned"
>;

export async function fetchTeacherStatusManagementList(
  supabase: TeacherListSupabaseClient,
  options: TeacherStatusManagementOptions,
): Promise<ListView<StatusManagementListItem>> {
  const rows = await fetchTeacherRows(supabase, {
    academyId: options.academyId,
    status: options.status,
    failureMessage: "휴직/퇴사 선생님 목록을 불러오지 못했습니다",
  });

  const statusReasons = await fetchLatestStatusReasonMap(supabase, {
    academyId: options.academyId,
    entityType: "teacher",
    status: options.status,
  });

  return buildStatusManagementList(
    rows.map((row) => {
      const teacher = toTeacherListRow(row);

      return {
        academyId: teacher.academyId,
        entityType: "teacher",
        entityId: teacher.teacherId,
        name: teacher.name,
        status: options.status,
        changedAt:
          options.status === "resigned"
            ? teacher.resignedAt
            : teacher.onLeaveAt,
        retentionUntil: teacher.retentionUntil,
        archivedAt: teacher.archivedAt,
        primaryInfo: teacher.part,
        secondaryInfo: teacher.contact,
        detailSummary: teacher.workScheduleSummary,
        statusReason: statusReasons.get(teacher.teacherId),
      };
    }),
    {
      ...options,
      entityType: "teacher",
    },
  );
}

async function fetchLatestStatusReasonMap(
  supabase: TeacherListSupabaseClient,
  options: {
    academyId: string;
    entityType: "teacher";
    status: "on_leave" | "resigned";
  },
) {
  const rows = await fetchAllRows("선생님 상태 변경 메모를 불러오지 못했습니다", (from, to) =>
    supabase
      .from("entity_status_transitions")
      .select(STATUS_TRANSITION_SELECT)
      .eq("academy_id", options.academyId)
      .eq("entity_type", options.entityType)
      .eq("to_status", options.status)
      .order("changed_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

  return buildLatestReasonMap(rows);
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
      status: options.filters?.status,
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? ""),
    }),
    queryFn: () => fetchTeacherList(supabase, options),
  };
}

export function createTeacherStatusManagementQueryOptions(
  supabase: TeacherListSupabaseClient,
  options: TeacherStatusManagementOptions,
) {
  return {
    queryKey: queryKeys.statusManagement.list(options.academyId, {
      entityType: "teacher",
      status: options.status,
      q: options.search,
      page: String(options.page ?? 1),
      pageSize: String(options.pageSize ?? ""),
    }),
    queryFn: () => fetchTeacherStatusManagementList(supabase, options),
  };
}

export async function registerTeacher(
  supabase: TeacherMutationSupabaseClient,
  input: RegisterTeacherInput,
): Promise<TeacherListRow> {
  const residentRegistration = readResidentRegistration(input.residentRegistration);
  const payload = buildTeacherProfilePayload(input);
  const { data, error } = await supabase.rpc(
    "register_teacher_with_profile",
    payload,
  );

  if (error) {
    throw new Error(`선생님을 등록하지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("선생님을 등록했지만 반환된 데이터가 없습니다.");
  }

  if (residentRegistration) {
    await saveResidentRegistration(supabase, {
      academyId: input.academyId,
      teacherId: data,
      residentRegistration,
      savedProfile: "선생님은 등록했지만",
    });
  }

  return buildOptimisticTeacherRow(input, data, residentRegistration);
}

export async function updateTeacherProfile(
  supabase: TeacherMutationSupabaseClient,
  input: UpdateTeacherProfileInput,
) {
  const residentRegistration = readResidentRegistration(input.residentRegistration);
  const { error } = await supabase.rpc("update_teacher_profile", {
    ...buildTeacherProfilePayload(input),
    p_teacher_id: input.teacherId,
  });

  if (error) {
    throw new Error(`선생님 정보를 수정하지 못했습니다: ${error.message}`);
  }

  if (residentRegistration) {
    await saveResidentRegistration(supabase, {
      academyId: input.academyId,
      teacherId: input.teacherId,
      residentRegistration,
      savedProfile: "선생님 정보는 수정했지만",
    });
  }
}

/** 원장 전용 원문 열람. 서버가 호출마다 열람 기록을 남기므로 필요할 때 한 명씩만 부른다. */
export async function revealTeacherResidentRegistration(
  supabase: TeacherMutationSupabaseClient,
  input: RevealTeacherResidentRegistrationInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("reveal_teacher_resident_registration", {
    p_academy_id: input.academyId,
    p_teacher_id: input.teacherId,
  });

  if (error) {
    throw new Error(`주민등록번호 원문을 불러오지 못했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("등록된 주민등록번호가 없습니다.");
  }

  return data;
}

export async function updateTeacherStatus(
  supabase: TeacherMutationSupabaseClient,
  input: UpdateTeacherStatusInput,
) {
  const { error } = await supabase.rpc("update_teacher_status", {
    p_academy_id: input.academyId,
    p_teacher_id: input.teacherId,
    p_status: input.status,
    p_changed_at: input.changedAt ?? new Date().toISOString(),
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw new Error(`선생님 상태를 변경하지 못했습니다: ${error.message}`);
  }
}

export async function deleteResignedTeacher(
  supabase: TeacherMutationSupabaseClient,
  input: DeleteResignedTeacherInput,
) {
  const { error } = await supabase.rpc("delete_resigned_teacher", {
    p_academy_id: input.academyId,
    p_teacher_id: input.teacherId,
  });

  if (error) {
    throw new Error(`퇴사 선생님을 삭제하지 못했습니다: ${error.message}`);
  }
}

/** 비어 있으면 저장하지 않는다는 뜻으로 undefined, 있으면 형식을 검증해 `######-#######`로 정규화한다. */
function readResidentRegistration(value: string | undefined) {
  if (!value?.trim()) {
    return undefined;
  }

  const result = validateResidentRegistration(value);

  if (!result.ok) {
    throw new Error(result.reason);
  }

  return result.normalized;
}

async function saveResidentRegistration(
  supabase: TeacherMutationSupabaseClient,
  input: {
    academyId: string;
    teacherId: string;
    residentRegistration: string;
    /** 오류 문구 앞머리: 프로필 저장은 끝났음을 알려 같은 입력을 다시 등록하지 않게 한다. */
    savedProfile: string;
  },
) {
  const { error } = await supabase.rpc("set_teacher_resident_registration", {
    p_academy_id: input.academyId,
    p_teacher_id: input.teacherId,
    p_resident_registration: input.residentRegistration,
  });

  if (error) {
    throw new ResidentRegistrationSaveError(
      `${input.savedProfile} 주민등록번호를 저장하지 못했습니다. ${toUserMessage(error)} 선생님 상세에서 수정해 다시 입력해 주세요.`,
    );
  }
}

function buildTeacherProfilePayload(input: TeacherProfileMutationInput) {
  const salary = readSalarySetting(input);
  const workSchedules = normalizeWorkSchedules(input.workSchedules ?? []).map(
    (schedule) => ({
      weekday: toWeekdayLabel(schedule.weekday),
      start_time: schedule.startTime ?? null,
      end_time: schedule.endTime ?? null,
    }),
  );

  return {
    p_academy_id: input.academyId,
    p_name: input.name.trim(),
    p_part: input.part.trim(),
    p_phone: input.contact.trim() || null,
    p_registered_on: input.registeredAt,
    p_contract_start_on: input.contractStartOn,
    p_contract_end_on: input.contractEndOn,
    p_pay_type: salary?.payType ?? null,
    p_monthly_salary:
      salary?.payType === "monthly" ? salary.monthlySalary : null,
    p_hourly_rate: salary?.payType === "hourly" ? salary.hourlyRate : null,
    p_ratio_teacher_share:
      salary?.payType === "ratio" ? salary.ratioTeacherShare : null,
    p_work_schedules: workSchedules,
  };
}

/** 급여 형태가 없으면(원장이 아닌 사용자의 입력) 급여 설정이 없는 것으로 본다. */
function readSalarySetting(input: TeacherProfileMutationInput) {
  return input.payType
    ? buildTeacherSalarySetting({ ...input, payType: input.payType })
    : undefined;
}

function buildOptimisticTeacherRow(
  input: RegisterTeacherInput,
  teacherId: string,
  residentRegistration: string | undefined,
): TeacherListRow {
  const salary = readSalarySetting(input);
  const workSchedules = normalizeWorkSchedules(input.workSchedules ?? []).map(
    (schedule, index) => ({
      scheduleId: `optimistic-${teacherId}-${index}`,
      weekday: schedule.weekday,
      weekdayLabel: toWeekdayLabel(schedule.weekday),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    }),
  );
  const row: TeacherListRow = {
    academyId: input.academyId,
    teacherId,
    name: input.name.trim(),
    part: input.part.trim(),
    contact: input.contact.trim(),
    registeredAt: input.registeredAt,
    payType: salary?.payType ?? DEFAULT_PAY_TYPE_WITHOUT_SETTING,
    status: "employed",
    contractStartOn: input.contractStartOn,
    contractEndOn: input.contractEndOn,
    workSchedules,
    monthlySalary: salary?.payType === "monthly" ? salary.monthlySalary : undefined,
    hourlyRate: salary?.payType === "hourly" ? salary.hourlyRate : undefined,
    ratioTeacherShare:
      salary?.payType === "ratio" ? salary.ratioTeacherShare : undefined,
    residentRegistrationMasked: residentRegistration
      ? maskResidentRegistration(residentRegistration)
      : undefined,
  };

  return {
    ...row,
    salarySummary: salary ? formatTeacherSalarySummary(row) : UNSET_SALARY_SUMMARY,
    workScheduleSummary: formatTeacherWorkScheduleSummary(workSchedules),
  };
}

function toTeacherListRow(row: TeacherSupabaseRow): TeacherListRow {
  const activeSalarySetting =
    row.teacher_salary_settings?.find(
      (setting) => setting.active && setting.pay_type === row.salary_type,
    ) ??
    row.teacher_salary_settings?.find((setting) => setting.active) ??
    null;
  const workSchedules = (row.teacher_work_schedules ?? []).map(
    toTeacherWorkSchedule,
  );
  const mapped: TeacherListRow = {
    academyId: row.academy_id,
    teacherId: row.id,
    name: row.name,
    part: row.part,
    contact: row.phone ?? "",
    registeredAt: row.registered_on,
    payType: activeSalarySetting?.pay_type ?? row.salary_type,
    status: row.status ?? "employed",
    contractStartOn: row.contract_start_on ?? undefined,
    contractEndOn: row.contract_end_on ?? undefined,
    onLeaveAt: row.on_leave_at ?? undefined,
    resignedAt: row.resigned_at ?? undefined,
    retentionUntil: row.retention_until ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    monthlySalary: activeSalarySetting?.monthly_salary ?? undefined,
    hourlyRate: activeSalarySetting?.hourly_rate ?? undefined,
    ratioTeacherShare: activeSalarySetting?.ratio_teacher_share ?? undefined,
    workSchedules,
    residentRegistrationMasked: row.resident_registration_masked ?? undefined,
  };

  return {
    ...mapped,
    salarySummary: activeSalarySetting
      ? formatTeacherSalarySummary(mapped)
      : UNSET_SALARY_SUMMARY,
    workScheduleSummary: formatTeacherWorkScheduleSummary(workSchedules),
  };
}

function toTeacherWorkSchedule(row: TeacherWorkScheduleRow): TeacherWorkSchedule {
  const startTime = row.start_time ? row.start_time.slice(0, 5) : undefined;
  const endTime = row.end_time ? row.end_time.slice(0, 5) : undefined;

  return {
    scheduleId: row.id,
    weekday: row.weekday,
    weekdayLabel: toWeekdayLabel(row.weekday),
    startTime,
    endTime,
  };
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

function toWeekdayLabel(value: string) {
  return WEEKDAY_LABELS[value] ?? value;
}

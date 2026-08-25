import type { ListView } from "@/domain/common-list";
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
  buildStatusManagementList,
  type StatusManagementListItem,
} from "@/domain/status-management";

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
  teacher_work_schedules?: TeacherWorkScheduleRow[] | null;
  teacher_salary_settings?: TeacherSalarySettingRow[] | null;
};

type TeacherListSelectBuilder =
  PromiseLike<SupabaseQueryResult<TeacherSupabaseRow[]>> & {
    eq(column: string, value: string): TeacherListSelectBuilder;
    is(column: string, value: null): TeacherListSelectBuilder;
  };

type TeacherListFromBuilder = {
  select(select: string): TeacherListSelectBuilder;
};

export type TeacherListSupabaseClient = {
  from(table: "teachers"): TeacherListFromBuilder;
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
  payType: TeacherPayType;
  monthlySalary?: number;
  hourlyRate?: number;
  ratioAcademyShare?: number;
  ratioTeacherShare?: number;
  workSchedules?: TeacherWorkScheduleInput[];
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

type TeacherRpcName =
  | "register_teacher_with_profile"
  | "update_teacher_profile"
  | "update_teacher_status"
  | "delete_resigned_teacher";

export type TeacherMutationSupabaseClient = {
  rpc(
    functionName: TeacherRpcName,
    payload: Record<string, unknown>,
  ): PromiseLike<SupabaseQueryResult<string | null>>;
};

const TEACHER_LIST_SELECT =
  "id, academy_id, name, part, phone, registered_on, salary_type, status, contract_start_on, contract_end_on, on_leave_at, resigned_at, retention_until, archived_at, teacher_work_schedules!teacher_work_schedules_academy_teacher_fk(id, weekday, start_time, end_time), teacher_salary_settings!teacher_salary_settings_academy_teacher_fk(id, pay_type, ratio_teacher_share, monthly_salary, hourly_rate, active)";

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

export async function fetchTeacherList(
  supabase: TeacherListSupabaseClient,
  options: FetchTeacherListOptions,
): Promise<ListView<TeacherListRow>> {
  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_LIST_SELECT)
    .eq("academy_id", options.academyId)
    .eq("status", "employed")
    .is("archived_at", null);

  if (error) {
    throw new Error(`선생님 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildTeacherList((data ?? []).map(toTeacherListRow), options);
}

export async function fetchTeacherStatusManagementList(
  supabase: TeacherListSupabaseClient,
  options: {
    academyId: string;
    status: "on_leave" | "resigned";
    today?: string;
  },
): Promise<ListView<StatusManagementListItem>> {
  const { data, error } = await supabase
    .from("teachers")
    .select(TEACHER_LIST_SELECT)
    .eq("academy_id", options.academyId)
    .eq("status", options.status)
    .is("archived_at", null);

  if (error) {
    throw new Error(`휴직/퇴사 선생님 목록을 불러오지 못했습니다: ${error.message}`);
  }

  return buildStatusManagementList(
    (data ?? []).map((row) => {
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
      };
    }),
    {
      academyId: options.academyId,
      entityType: "teacher",
      status: options.status,
      today: options.today,
    },
  );
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
    }),
    queryFn: () => fetchTeacherList(supabase, options),
  };
}

export function createTeacherStatusManagementQueryOptions(
  supabase: TeacherListSupabaseClient,
  options: {
    academyId: string;
    status: "on_leave" | "resigned";
    today?: string;
  },
) {
  return {
    queryKey: queryKeys.statusManagement.list(options.academyId, {
      entityType: "teacher",
      status: options.status,
    }),
    queryFn: () => fetchTeacherStatusManagementList(supabase, options),
  };
}

export async function registerTeacher(
  supabase: TeacherMutationSupabaseClient,
  input: RegisterTeacherInput,
): Promise<TeacherListRow> {
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

  return buildOptimisticTeacherRow(input, data);
}

export async function updateTeacherProfile(
  supabase: TeacherMutationSupabaseClient,
  input: UpdateTeacherProfileInput,
) {
  const { error } = await supabase.rpc("update_teacher_profile", {
    ...buildTeacherProfilePayload(input),
    p_teacher_id: input.teacherId,
  });

  if (error) {
    throw new Error(`선생님 정보를 수정하지 못했습니다: ${error.message}`);
  }
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

function buildTeacherProfilePayload(input: TeacherProfileMutationInput) {
  const salary = buildTeacherSalarySetting(input);
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
    p_pay_type: input.payType,
    p_monthly_salary:
      salary.payType === "monthly" ? salary.monthlySalary : null,
    p_hourly_rate: salary.payType === "hourly" ? salary.hourlyRate : null,
    p_ratio_teacher_share:
      salary.payType === "ratio" ? salary.ratioTeacherShare : null,
    p_work_schedules: workSchedules,
  };
}

function buildOptimisticTeacherRow(
  input: RegisterTeacherInput,
  teacherId: string,
): TeacherListRow {
  const salary = buildTeacherSalarySetting(input);
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
    payType: input.payType,
    status: "employed",
    contractStartOn: input.contractStartOn,
    contractEndOn: input.contractEndOn,
    workSchedules,
    monthlySalary: salary.payType === "monthly" ? salary.monthlySalary : undefined,
    hourlyRate: salary.payType === "hourly" ? salary.hourlyRate : undefined,
    ratioTeacherShare:
      salary.payType === "ratio" ? salary.ratioTeacherShare : undefined,
  };

  return {
    ...row,
    salarySummary: formatTeacherSalarySummary(row),
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
  };

  return {
    ...mapped,
    salarySummary: formatTeacherSalarySummary(mapped),
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

function toWeekdayLabel(value: string) {
  return WEEKDAY_LABELS[value] ?? value;
}

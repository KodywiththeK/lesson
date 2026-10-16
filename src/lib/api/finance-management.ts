import type { BookSale, LedgerEntry } from "@/domain/book-sale";
import type { PayrollLessonSource, PayrollRecord } from "@/domain/payroll";
import type { StudentEnrollment } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import type { LessonTicketListItem } from "@/domain/lesson-ticket";
import type { LessonTicketIncomeRegistration } from "@/domain/lesson-ticket-income";
import type { TuitionRecord } from "@/domain/tuition-income";
import { toMonthDateRange } from "@/domain/finance-date";

import {
  fetchFinanceLedgerList,
  type FinanceLedgerListSupabaseClient,
} from "./finance";
import {
  fetchAllLessonTickets,
  type LessonTicketListSupabaseClient,
} from "./lesson-tickets";
import { BOOK_RELEASE_SELECT, toBookSale, type BookReleaseSupabaseRow } from "./books";
import { fetchAllRows, type PagedSelectQuery } from "./paged-query";
import { fetchPayrollTeachers, type TeacherListSupabaseClient } from "./teachers";
import { queryKeys } from "./query-keys";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type FinancePaymentRpcName =
  | "ensure_monthly_fixed_income_snapshots"
  | "mark_fixed_income_snapshot_paid"
  | "mark_fixed_income_snapshot_unpaid"
  | "mark_fixed_income_snapshot_overdue"
  | "clear_fixed_income_snapshot_overdue"
  | "mark_salary_settlement_paid"
  | "cancel_salary_settlement_paid";

export type FinancePaymentSupabaseClient = {
  rpc(
    functionName: FinancePaymentRpcName,
    payload: Record<string, unknown>,
  ): PromiseLike<SupabaseQueryResult<FinancePaymentSupabaseResult>>;
};

export type FinancePaymentSupabaseResult =
  | FixedIncomeSnapshotFinanceRow[]
  | FixedIncomeSnapshotFinanceRow
  | SalarySettlementFinanceRow;

export type FinanceManagementSupabaseClient = FinanceLedgerListSupabaseClient &
  LessonTicketListSupabaseClient &
  TeacherListSupabaseClient &
  FinancePaymentSupabaseClient & {
    from(table: "students"): {
      select(select: string): PagedSelectQuery<StudentFinanceRow>;
    };
    from(table: "book_releases"): {
      select(select: string): PagedSelectQuery<BookReleaseSupabaseRow>;
    };
    from(table: "lesson_events"): {
      select(select: string): PagedSelectQuery<LessonEventFinanceRow>;
    };
    from(table: "salary_settlements"): {
      select(select: string): PagedSelectQuery<SalarySettlementFinanceRow>;
    };
    from(table: "fixed_income_snapshots"): {
      select(select: string): PagedSelectQuery<FixedIncomeSnapshotFinanceRow>;
    };
    from(table: "lesson_ticket_registrations"): {
      select(select: string): PagedSelectQuery<LessonTicketRegistrationFinanceRow>;
    };
  };

type LessonTicketRegistrationFinanceRow = {
  id: string;
  academy_id: string;
  lesson_ticket_grant_id: string;
  registered_at: string;
  granted_count: number;
  valid_until: string;
  original_paid_amount: number;
  ledger_entry_id: string | null;
};

type StudentFinanceRow = {
  id: string;
  academy_id: string;
  name: string;
  registered_on: string;
  student_instruments:
    | Array<{
        id: string;
        instrument_id: string | null;
        instrument_name: string | null;
        teacher_id: string | null;
        lesson_type: string | null;
        weekdays: string[] | null;
        start_time: string | null;
        end_time: string | null;
        progress: string | null;
        lesson_fee: number | null;
        discount_total: number | null;
        discount_label: string | null;
        final_monthly_fee: number | null;
        active: boolean | null;
        teachers: { name: string | null } | null;
      }>
    | null;
};

type LessonEventFinanceRow = {
  id: string;
  academy_id: string;
  student_id: string;
  teacher_id: string | null;
  lesson_kind: Exclude<PayrollLessonSource["lessonKind"], "makeup">;
  origin?: string | null;
  instrument_id: string;
  instrument_name: string;
  starts_at: string;
  ends_at: string;
  students: { name: string | null } | null;
  student_instruments: { final_monthly_fee: number | null } | null;
  attendance_records:
    | Array<{
        status: PayrollLessonSource["status"] | null;
      }>
    | null;
};

type FixedIncomeSnapshotFinanceRow = {
  id: string;
  academy_id: string;
  month: string;
  student_id: string;
  student_instrument_id: string | null;
  student_name: string;
  instrument_id: string;
  instrument_name: string;
  amount: number;
  status: TuitionRecord["status"];
  paid_at: string | null;
  due_on?: string | null;
  lesson_fee?: number | null;
  discount_total?: number | null;
  discount_label?: string | null;
  progress?: string | null;
  paid_ledger_entry_id?: string | null;
};

type SalarySettlementFinanceRow = {
  id: string;
  academy_id: string;
  teacher_id: string;
  teacher_name: string;
  month: string;
  pay_type: PayrollRecord["payType"];
  base_pay: number;
  withholding_tax: number;
  net_pay: number;
  status: PayrollRecord["status"];
  paid_at: string | null;
  lesson_event_ids: string[] | null;
  paid_ledger_entry_id?: string | null;
};

export type FinanceManagementQueryData = {
  ledgerEntries: LedgerEntry[];
  enrollments: StudentEnrollment[];
  tickets: LessonTicketListItem[];
  ticketRegistrations: LessonTicketIncomeRegistration[];
  bookSales: BookSale[];
  teachers: TeacherListRow[];
  payrollLessonSources: PayrollLessonSource[];
  salarySettlements: PayrollRecord[];
  /** 그 달 월 수강료 snapshot(읽기 전용). 급여의 월 수강료 계산에 쓴다. */
  monthTuitionSnapshots: TuitionRecord[];
};

export type FetchFinanceManagementDataOptions = {
  /** 조회할 달 `YYYY-MM`. 월 합계·급여 계산이 그 달 데이터만 서버에서 읽게 한다. */
  month: string;
};

const FINANCE_STUDENT_SELECT =
  "id, academy_id, name, registered_on, student_instruments!student_instruments_academy_student_fk(id, instrument_id, instrument_name, teacher_id, lesson_type, weekdays, start_time, end_time, progress, lesson_fee, discount_total, discount_label, final_monthly_fee, active, teachers!student_instruments_academy_teacher_fk(name))";
const FINANCE_LESSON_EVENT_SELECT =
  "id, academy_id, student_id, teacher_id, lesson_kind, origin, instrument_id, instrument_name, starts_at, ends_at, students!lesson_events_academy_student_fk(name), student_instruments!lesson_events_academy_student_instrument_fk(final_monthly_fee), attendance_records!attendance_records_academy_lesson_event_fk(status)";
const FINANCE_SALARY_SETTLEMENT_SELECT =
  "id, academy_id, teacher_id, teacher_name, month, pay_type, base_pay, withholding_tax, net_pay, status, paid_at, lesson_event_ids, paid_ledger_entry_id";
const FINANCE_TUITION_SNAPSHOT_SELECT =
  "id, academy_id, month, student_id, student_instrument_id, student_name, instrument_id, instrument_name, progress, lesson_fee, discount_total, discount_label, amount, due_on, status, paid_at, paid_ledger_entry_id";
const FINANCE_TICKET_REGISTRATION_SELECT =
  "id, academy_id, lesson_ticket_grant_id, registered_at, granted_count, valid_until, original_paid_amount, ledger_entry_id";

export async function fetchFinanceManagementData(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
  { month }: FetchFinanceManagementDataOptions,
): Promise<FinanceManagementQueryData> {
  const [
    monthLedgerEntries,
    lessonTicketLedgerEntries,
    enrollments,
    tickets,
    ticketRegistrations,
    bookSales,
    teachers,
    payrollLessonSources,
    salarySettlements,
    monthTuitionSnapshots,
  ] = await Promise.all([
    fetchFinanceLedgerList(supabase, { academyId, dateRange: toMonthDateRange(month) }),
    // 회차권 등록의 원장은 다른 달로 옮겨졌을 수 있어 월과 무관하게 읽는다(누락으로 오해하지 않게).
    fetchFinanceLedgerList(supabase, { academyId, filters: { source: "lesson-ticket" } }),
    fetchFinanceEnrollments(supabase, academyId),
    fetchAllLessonTickets(supabase, academyId),
    fetchLessonTicketIncomeRegistrations(supabase, academyId),
    fetchFinanceBookSales(supabase, academyId, month),
    fetchPayrollTeachers(supabase, academyId),
    fetchPayrollLessonSources(supabase, academyId, month),
    fetchSalarySettlements(supabase, academyId, month),
    fetchMonthTuitionSnapshotRows(supabase, { academyId, month }),
  ]);

  const ledgerEntries = [
    ...new Map([...monthLedgerEntries, ...lessonTicketLedgerEntries].map((entry) => [entry.ledgerId, entry])).values(),
  ];

  return {
    ledgerEntries,
    enrollments,
    tickets,
    ticketRegistrations,
    bookSales,
    teachers,
    payrollLessonSources,
    salarySettlements,
    monthTuitionSnapshots,
  };
}

export async function fetchLessonTicketIncomeRegistrations(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
): Promise<LessonTicketIncomeRegistration[]> {
  const rows = await fetchAllRows("회차권 등록 내역을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("lesson_ticket_registrations")
      .select(FINANCE_TICKET_REGISTRATION_SELECT)
      .eq("academy_id", academyId)
      .order("id")
      .range(from, to),
  );

  return rows.map((row) => ({
    registrationId: row.id,
    academyId: row.academy_id,
    ticketId: row.lesson_ticket_grant_id,
    registeredAt: row.registered_at,
    grantedCount: row.granted_count,
    validUntil: row.valid_until,
    originalPaidAmount: row.original_paid_amount,
    ledgerEntryId: row.ledger_entry_id,
  }));
}

/** 그 달 월 수강료 snapshot을 읽기만 한다. 월 snapshot 생성(`ensure_…` RPC)은 호출하지 않는다. */
export async function fetchMonthTuitionSnapshotRows(
  supabase: FinanceManagementSupabaseClient,
  input: { academyId: string; month: string },
): Promise<TuitionRecord[]> {
  const rows = await fetchAllRows("월별 수강료를 불러오지 못했습니다", (from, to) =>
    supabase
      .from("fixed_income_snapshots")
      .select(FINANCE_TUITION_SNAPSHOT_SELECT)
      .eq("academy_id", input.academyId)
      .eq("month", input.month)
      .order("id")
      .range(from, to),
  );

  return rows.map(toTuitionRecord);
}

export async function fetchMonthlyTuitionSnapshots(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    month: string;
  },
): Promise<TuitionRecord[]> {
  const { data, error } = await supabase.rpc(
    "ensure_monthly_fixed_income_snapshots",
    {
      p_academy_id: input.academyId,
      p_month: input.month,
    },
  );

  if (error) {
    throw new Error(`월별 수강료를 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as FixedIncomeSnapshotFinanceRow[]).map(
    toTuitionRecord,
  );
}

export function createMonthlyTuitionSnapshotsQueryOptions(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    month: string;
  },
) {
  return {
    queryKey: [...queryKeys.finance.all(input.academyId), "tuition-snapshots", input.month] as const,
    queryFn: () => fetchMonthlyTuitionSnapshots(supabase, input),
  };
}

export async function markMonthlyTuitionAsPaid(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    tuitionId: string;
    paidAt: string;
  },
): Promise<TuitionRecord> {
  const { data, error } = await supabase.rpc(
    "mark_fixed_income_snapshot_paid",
    {
      p_academy_id: input.academyId,
      p_snapshot_id: input.tuitionId,
      p_paid_at: input.paidAt,
    },
  );

  if (error) {
    throw new Error(`수강료 입금 처리에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("수강료 입금 처리 후 반환된 데이터가 없습니다.");
  }

  return toTuitionRecord(data as FixedIncomeSnapshotFinanceRow);
}

export async function markMonthlyTuitionAsUnpaid(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    tuitionId: string;
  },
): Promise<TuitionRecord> {
  const { data, error } = await supabase.rpc(
    "mark_fixed_income_snapshot_unpaid",
    {
      p_academy_id: input.academyId,
      p_snapshot_id: input.tuitionId,
    },
  );

  if (error) {
    throw new Error(`수강료 입금 취소에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("수강료 입금 취소 후 반환된 데이터가 없습니다.");
  }

  return toTuitionRecord(data as FixedIncomeSnapshotFinanceRow);
}

export async function markMonthlyTuitionAsOverdue(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    tuitionId: string;
  },
): Promise<TuitionRecord> {
  const { data, error } = await supabase.rpc("mark_fixed_income_snapshot_overdue", {
    p_academy_id: input.academyId,
    p_snapshot_id: input.tuitionId,
  });

  if (error) {
    throw new Error(`수강료 미납 처리에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("수강료 미납 처리 후 반환된 데이터가 없습니다.");
  }

  return toTuitionRecord(data as FixedIncomeSnapshotFinanceRow);
}

/** 미납으로 기록한 수강료를 미입금으로 되돌린다. 원장은 건드리지 않는다. */
export async function clearMonthlyTuitionOverdue(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    tuitionId: string;
  },
): Promise<TuitionRecord> {
  const { data, error } = await supabase.rpc("clear_fixed_income_snapshot_overdue", {
    p_academy_id: input.academyId,
    p_snapshot_id: input.tuitionId,
  });

  if (error) {
    throw new Error(`수강료 미납 해제에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("수강료 미납 해제 후 반환된 데이터가 없습니다.");
  }

  return toTuitionRecord(data as FixedIncomeSnapshotFinanceRow);
}

export type YearlyTuitionSnapshotsInput = {
  academyId: string;
  year: number;
  /** 입금 완료분만 필요한 악기별 그래프처럼 서버에서 상태를 걸러야 할 때. */
  status?: "paid";
};

/** 선택한 연도 1~12월의 월 수강료 snapshot. 전체 수입 그래프의 악기별 수입 집계에 쓴다. */
export async function fetchYearlyTuitionSnapshots(
  supabase: FinanceManagementSupabaseClient,
  input: YearlyTuitionSnapshotsInput,
): Promise<TuitionRecord[]> {
  const rows = await fetchAllRows("연간 수강료를 불러오지 못했습니다", (from, to) => {
    const query = supabase
      .from("fixed_income_snapshots")
      .select(FINANCE_TUITION_SNAPSHOT_SELECT)
      .eq("academy_id", input.academyId);
    const filtered = input.status ? query.eq("status", input.status) : query;

    return filtered
      .gte("month", `${input.year}-01`)
      .lte("month", `${input.year}-12`)
      .order("month")
      .order("id")
      .range(from, to);
  });

  return rows.map(toTuitionRecord);
}

export function createYearlyTuitionSnapshotsQueryOptions(
  supabase: FinanceManagementSupabaseClient,
  input: YearlyTuitionSnapshotsInput,
) {
  return {
    queryKey: [
      ...queryKeys.finance.all(input.academyId),
      "tuition-snapshots",
      "year",
      input.year,
      input.status ?? "all",
    ] as const,
    queryFn: () => fetchYearlyTuitionSnapshots(supabase, input),
  };
}

export async function markPayrollSettlementAsPaid(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    payroll: PayrollRecord;
    paidAt: string;
  },
): Promise<PayrollRecord> {
  const { data, error } = await supabase.rpc("mark_salary_settlement_paid", {
    p_academy_id: input.academyId,
    p_teacher_id: input.payroll.teacherId,
    p_teacher_name: input.payroll.teacherName,
    p_month: input.payroll.month,
    p_pay_type: input.payroll.payType,
    p_base_pay: input.payroll.basePay,
    p_withholding_tax: input.payroll.withholdingTax,
    p_net_pay: input.payroll.netPay,
    p_lesson_event_ids: input.payroll.lessonEventIds,
    p_paid_at: input.paidAt,
  });

  if (error) {
    throw new Error(`급여 지급 확정에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("급여 지급 확정 후 반환된 데이터가 없습니다.");
  }

  return toPayrollRecord(data as SalarySettlementFinanceRow);
}

export async function cancelPayrollSettlementPaid(
  supabase: FinancePaymentSupabaseClient,
  input: {
    academyId: string;
    teacherId: string;
    month: string;
  },
): Promise<PayrollRecord> {
  const { data, error } = await supabase.rpc("cancel_salary_settlement_paid", {
    p_academy_id: input.academyId,
    p_teacher_id: input.teacherId,
    p_month: input.month,
  });

  if (error) {
    throw new Error(`급여 지급 취소에 실패했습니다: ${error.message}`);
  }

  if (!data || Array.isArray(data)) {
    throw new Error("급여 지급 취소 후 반환된 데이터가 없습니다.");
  }

  return toPayrollRecord(data as SalarySettlementFinanceRow);
}

async function fetchFinanceEnrollments(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
) {
  const rows = await fetchAllRows("수강 정보를 불러오지 못했습니다", (from, to) =>
    supabase
      .from("students")
      .select(FINANCE_STUDENT_SELECT)
      .eq("academy_id", academyId)
      .order("id")
      .range(from, to),
  );

  return rows.flatMap(toStudentEnrollments);
}

/** 그 달에 결제 완료된 교재 판매만 읽는다(수입은 결제일 기준). */
async function fetchFinanceBookSales(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
  month: string,
) {
  const paidRange = toMonthDateRange(month);
  const rows = await fetchAllRows("교재 내역을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("book_releases")
      .select(BOOK_RELEASE_SELECT)
      .eq("academy_id", academyId)
      .eq("status", "paid")
      .gte("paid_at", paidRange.from)
      .lte("paid_at", paidRange.to)
      .order("paid_at")
      .order("id")
      .range(from, to),
  );

  return rows.map(toBookSale);
}

/** 그 달(한국 시간) 예정 수업만 읽는다. 취소·삭제·이동으로 대체된 일정은 급여 계산의 예정 수업 수에서 뺀다. */
async function fetchPayrollLessonSources(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
  month: string,
) {
  const rows = await fetchAllRows("급여 계산용 수업을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("lesson_events")
      .select(FINANCE_LESSON_EVENT_SELECT)
      .eq("academy_id", academyId)
      .eq("status", "scheduled")
      .gte("starts_at", toKoreanMonthStart(month))
      .lt("starts_at", toKoreanMonthStart(toNextMonth(month)))
      .order("starts_at")
      .order("id")
      .range(from, to),
  );

  return rows.map(toPayrollLessonSource);
}

async function fetchSalarySettlements(
  supabase: FinanceManagementSupabaseClient,
  academyId: string,
  month: string,
): Promise<PayrollRecord[]> {
  const rows = await fetchAllRows("급여 지급 내역을 불러오지 못했습니다", (from, to) =>
    supabase
      .from("salary_settlements")
      .select(FINANCE_SALARY_SETTLEMENT_SELECT)
      .eq("academy_id", academyId)
      .eq("month", month)
      .order("id")
      .range(from, to),
  );

  return rows.map(toPayrollRecord);
}

function toKoreanMonthStart(month: string) {
  return `${month}-01T00:00:00+09:00`;
}

function toNextMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));

  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toStudentEnrollments(row: StudentFinanceRow): StudentEnrollment[] {
  return (row.student_instruments ?? []).flatMap((instrument) => {
    if (
      instrument.active !== true ||
      !instrument.instrument_id ||
      !instrument.instrument_name
    ) {
      return [];
    }

    return [
      {
        academyId: row.academy_id,
        enrollmentId: instrument.id,
        studentId: row.id,
        studentName: row.name,
        instrumentId: instrument.instrument_id,
        instrumentName: instrument.instrument_name,
        teacherId: instrument.teacher_id ?? "",
        teacherName: instrument.teachers?.name ?? "",
        lessonType: instrument.lesson_type === "private" ? "private" : "academy",
        active: true,
        weekdays: [],
        weeklySchedules: (instrument.weekdays ?? []).map((weekday) => ({
          weekday: weekday as StudentEnrollment["weekdays"][number],
          startTime: instrument.start_time ?? undefined,
          endTime: instrument.end_time ?? undefined,
        })),
        startTime: instrument.start_time ?? undefined,
        endTime: instrument.end_time ?? undefined,
        progress: instrument.progress ?? "",
        lessonFee: instrument.lesson_fee ?? 0,
        discountTotal: instrument.discount_total ?? 0,
        discountLabel: instrument.discount_label ?? undefined,
        finalMonthlyFee: instrument.final_monthly_fee ?? 0,
      },
    ];
  });
}

function toPayrollLessonSource(row: LessonEventFinanceRow): PayrollLessonSource {
  return {
    academyId: row.academy_id,
    lessonEventId: row.id,
    teacherId: row.teacher_id ?? "",
    studentId: row.student_id,
    studentName: row.students?.name?.trim() || "이름 없음",
    instrumentName: row.instrument_name,
    lessonKind: row.origin === "makeup" ? "makeup" : row.lesson_kind,
    origin: row.origin ?? undefined,
    status: row.attendance_records?.[0]?.status ?? "scheduled",
    startedAt: row.starts_at,
    endedAt: row.ends_at,
    monthlyLessonFee: row.student_instruments?.final_monthly_fee ?? 0,
  };
}

function toTuitionRecord(row: FixedIncomeSnapshotFinanceRow): TuitionRecord {
  return {
    academyId: row.academy_id,
    tuitionId: row.id,
    month: row.month,
    studentId: row.student_id,
    studentName: row.student_name,
    enrollmentId: row.student_instrument_id ?? row.instrument_id,
    instrumentId: row.instrument_id,
    instrumentName: row.instrument_name,
    progress: row.progress ?? "",
    lessonFee: row.lesson_fee ?? row.amount,
    discountTotal: row.discount_total ?? 0,
    discountLabel: row.discount_label ?? undefined,
    amount: row.amount,
    dueOn: row.due_on ?? `${row.month}-01`,
    status: row.status,
    paidAt: row.paid_at ?? undefined,
    paidLedgerEntryId: row.paid_ledger_entry_id,
  };
}

function toPayrollRecord(row: SalarySettlementFinanceRow): PayrollRecord {
  return {
    academyId: row.academy_id,
    payrollId: row.id,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    month: row.month,
    payType: row.pay_type,
    basePay: row.base_pay,
    withholdingTax: row.withholding_tax,
    netPay: row.net_pay,
    status: row.status,
    paidAt: row.paid_at ?? undefined,
    lessonEventIds: row.lesson_event_ids ?? [],
    ledgerEntryId: row.paid_ledger_entry_id,
  };
}

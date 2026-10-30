import { type QueryKey } from "@tanstack/react-query";
import type { BookSale, LedgerEntry } from "@/domain/book-sale";
import { type BuildFinanceLedgerListOptions } from "@/domain/finance-ledger";
import type { LessonTicketListItem } from "@/domain/lesson-ticket";
import { type LessonTicketIncomeRegistration } from "@/domain/lesson-ticket-income";
import { type PayrollLessonSource, type PayrollRecord } from "@/domain/payroll";
import type { StudentEnrollment } from "@/domain/student-registration";
import type { TeacherListRow } from "@/domain/teacher-list";
import { type TuitionRecord } from "@/domain/tuition-income";
import { type FinanceLedgerListSupabaseClient, type FinanceLedgerMutationSupabaseClient } from "@/lib/api/finance";

export type FinanceLedgerListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LedgerEntry[]>;
};

export type FinanceLedgerListQueryOptionsFactory = (
  options: BuildFinanceLedgerListOptions,
) => FinanceLedgerListQueryOptions;

export type FinanceManagementData = {
  /** 공휴일 검증과 정기 일정 재계산을 완료했는지. 데모에는 적용하지 않는다. */
  holidayScheduleReady?: boolean;
  ledgerEntries: LedgerEntry[];
  enrollments: StudentEnrollment[];
  studentRegisteredOnById?: Record<string, string>;
  tickets: LessonTicketListItem[];
  ticketRegistrations?: LessonTicketIncomeRegistration[];
  bookSales: BookSale[];
  teachers: TeacherListRow[];
  academySheets?: FinanceManagementAttendanceSheets;
  payrollLessonSources?: PayrollLessonSource[];
  salarySettlements?: PayrollRecord[];
  /** 그 달의 월 수강료 snapshot(읽기만). 급여의 학원 레슨 월 수강료로 우선 쓴다. */
  monthTuitionSnapshots?: TuitionRecord[];
};

export type FinanceManagementAttendanceSheets = Record<
  string,
  {
    rows: Array<{
      academyId: string;
      lessonEventId: string;
      studentId: string;
      studentName: string;
      teacherId?: string;
      instrumentId: string;
      instrumentName: string;
      date: string;
      startTime: string;
      endTime: string;
      status: PayrollLessonSource["status"];
      origin?: string;
    }>;
  }
>;
export type FinanceDataScreenProps = {
  academyId: string;
  financeData: FinanceManagementData;
  /** 지급 확정 직전에 최신 데이터를 다시 불러온다. 금액이 달라졌는지 확인하는 데 쓴다. */
  refetchFinanceData?: () => Promise<FinanceManagementData | undefined>;
  markPayrollPaid?: (input: {
    academyId: string;
    payroll: PayrollRecord;
    paidAt: string;
  }) => Promise<PayrollRecord>;
  markTuitionPaid?: (input: {
    academyId: string;
    tuitionId: string;
    paidAt: string;
    paymentMethod: import("@/domain/tuition-income").TuitionPaymentMethod;
  }) => Promise<TuitionRecord>;
  markTuitionUnpaid?: (input: {
    academyId: string;
    tuitionId: string;
  }) => Promise<TuitionRecord>;
  markTuitionOverdue?: (input: {
    academyId: string;
    tuitionId: string;
  }) => Promise<TuitionRecord>;
  cancelPayrollPaid?: (input: {
    academyId: string;
    teacherId: string;
    month: string;
  }) => Promise<PayrollRecord>;
  /** 선택한 연도의 입출입내역(전체 수입의 연간 합계·그래프). 없으면 `financeData.ledgerEntries`를 쓴다. */
  yearlyLedgerQueryOptionsFactory?: (year: number) => {
    queryKey: QueryKey;
    queryFn: () => Promise<LedgerEntry[]>;
  };
  /** 선택한 연도 1~12월 월 수강료 snapshot(전체 수입 그래프의 악기별 수입 집계). */
  yearlyTuitionQueryOptionsFactory?: (year: number) => {
    queryKey: QueryKey;
    queryFn: () => Promise<TuitionRecord[]>;
  };
  tuitionSnapshotsQueryOptionsFactory?: (
    month: string,
  ) => {
    queryKey: QueryKey;
    queryFn: () => Promise<TuitionRecord[]>;
  };
};

export type FinanceLedgerSupabaseClient = FinanceLedgerListSupabaseClient &
  FinanceLedgerMutationSupabaseClient;

export type SupabaseClientState =
  | {
      client: FinanceLedgerSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

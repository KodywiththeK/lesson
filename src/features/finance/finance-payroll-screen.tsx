"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { StatTile } from "@/components/shared/stat-tile";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildListView } from "@/domain/common-list";
import {
  buildPayrollRows as buildDomainPayrollRows,
  formatPayType,
  type PayrollLessonSource,
  type PayrollRecord,
  type PrivateLessonFeeSource,
} from "@/domain/payroll";
import type { TeacherListRow } from "@/domain/teacher-list";
import { toUserMessage } from "@/lib/errors/user-message";
import { hasLessonRecordChangedSincePayment } from "./finance-payroll-changes";
import { FinanceDataScreenProps, FinanceManagementData } from "./finance-types";
import { FinanceConfirmDialog, PaymentDialog } from "@/components/management/payment-dialog";
import {
  FinanceAmount,
  FinanceListSearch,
  FinanceMonthSummary,
  formatWon,
  invalidateFinanceQueries,
  useFinanceMonth,
  useSearchableListPaging,
} from "./finance-shared";

const UNSUPPORTED_HANDLER_MESSAGE = "이 화면에서는 처리할 수 없습니다.";
const ZERO_PAY_REASON = "이번 달 등원 확인이 없어 지급할 금액이 없습니다.";
const ZERO_HOURLY_PAY_REASON = "이번 달 출근 일정에 해당하는 근무 시간이 없어 지급할 금액이 없습니다.";
const LESSON_RECORD_CHANGED_MESSAGE = "지급 후 등원 기록이 변경되었습니다. 지급액은 그대로입니다.";

/** 급여 표 한 행. 계산·정산 기록(`payroll`)에 화면에서 함께 보여 줄 선생님 정보를 붙였다. */
type PayrollRow = {
  payroll: PayrollRecord;
  part: string;
  paySetting: string;
  hasLessonRecordChanged: boolean;
};

export function FinancePayrollScreen({
  academyId,
  financeData,
  markPayrollPaid,
  cancelPayrollPaid,
  refetchFinanceData,
}: FinanceDataScreenProps) {
  const queryClient = useQueryClient();
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const { search, changeSearch, paging } = useSearchableListPaging();
  const [paymentTarget, setPaymentTarget] = useState<PayrollRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PayrollRecord | null>(null);
  // 급여는 선생님 전체로 계산하고, 검색과 페이지는 표에 보여 줄 행만 고른다.
  const rows = useMemo(
    () => buildPayrollViewRows(financeData, academyId, month),
    [academyId, financeData, month],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.payroll.teacherName,
        getTieBreaker: (row) => row.payroll.payrollId,
        search,
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );
  const pendingPayTotal = sumNetPay(rows, (payroll) => payroll.status === "pending" && !payroll.issue);
  const paidPayTotal = sumNetPay(rows, (payroll) => payroll.status === "paid");
  const markPayrollPaidMutation = useMutation({
    mutationFn: async (input: { payroll: PayrollRecord; paidAt: string }) => {
      if (!markPayrollPaid) {
        throw new Error(UNSUPPORTED_HANDLER_MESSAGE);
      }

      // 오래된 화면이나 다른 곳에서 바뀐 등원 기록으로 계산한 금액이 확정되지 않도록, 확정 직전에 최신 데이터로 다시 계산한다.
      const payroll = refetchFinanceData
        ? await readFreshPayroll(refetchFinanceData, input.payroll, academyId)
        : input.payroll;

      await markPayrollPaid({
        academyId,
        payroll,
        paidAt: input.paidAt,
      });
    },
    onSuccess: () => {
      setPaymentTarget(null);
      toast.success("급여 지급을 확정했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      if (error instanceof PayrollChangedError) {
        setPaymentTarget(null);
      }

      toast.error("급여 지급 확정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const cancelPayrollPaidMutation = useMutation({
    mutationFn: async (payroll: PayrollRecord) => {
      if (!cancelPayrollPaid) {
        throw new Error(UNSUPPORTED_HANDLER_MESSAGE);
      }

      await cancelPayrollPaid({
        academyId,
        teacherId: payroll.teacherId,
        month: payroll.month,
      });
    },
    onSuccess: () => {
      setCancelTarget(null);
      toast.success("급여 지급을 취소했습니다.");
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("급여 지급 취소에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  return (
    <section className="grid gap-4" aria-label="선생님 월급">
      <SectionHeader title="선생님 월급 관리" description="등록된 선생님별 급여를 설정하고 관리합니다." />
      <FinanceMonthSummary
        amount={pendingPayTotal}
        label="지급 예정 급여"
        maxMonth={maxMonth}
        month={month}
        tone="total"
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      <StatTile label="지급 완료 급여" emphasized={false}>
        <FinanceAmount amount={paidPayTotal} />
      </StatTile>
      <FinanceListSearch
        label="선생님 월급 검색"
        placeholder="선생님 이름"
        value={search}
        onChange={changeSearch}
      />
      <SectionCard padded={false}>
        <Table aria-label="선생님 월급">
          <TableHeader>
            <TableRow>
              {PAYROLL_COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsView.items.map((row) => (
              <PayrollTableRow
                key={row.payroll.payrollId}
                row={row}
                onRequestPayment={setPaymentTarget}
                onRequestCancel={setCancelTarget}
              />
            ))}
          </TableBody>
        </Table>
        {rowsView.totalItems === 0 ? (
          <EmptyState>
            {rows.length === 0 ? "등록된 선생님이 없습니다." : "조건에 맞는 선생님이 없습니다."}
          </EmptyState>
        ) : null}
        <ListPagination
          itemLabel="선생님 월급"
          countUnit="명"
          view={rowsView}
          onPageChange={paging.goToPage}
          onPageSizeChange={paging.changePageSize}
        />
      </SectionCard>
      <PaymentDialog
        open={Boolean(paymentTarget)}
        title="급여 지급 확정"
        description="확인하면 입출입내역에 지출이 기록됩니다."
        dateLabel="지급일"
        contextMonth={month}
        pending={markPayrollPaidMutation.isPending}
        onConfirm={(paidAt) => {
          if (!paymentTarget) {
            return;
          }

          markPayrollPaidMutation.mutate({
            payroll: paymentTarget,
            paidAt,
          });
        }}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
      />
      <FinanceConfirmDialog
        open={Boolean(cancelTarget)}
        title="지급을 취소할까요?"
        description="연결된 입출입내역(지출) 1건이 삭제되고 미지급 상태로 돌아갑니다."
        confirmLabel="지급 취소"
        pending={cancelPayrollPaidMutation.isPending}
        onConfirm={() => cancelTarget && cancelPayrollPaidMutation.mutate(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      />
    </section>
  );
}

const PAYROLL_COLUMNS = [
  "선생님",
  "담당 파트",
  "급여 형태·설정",
  "기본급여(세전)",
  "원천징수(3.3%)",
  "최종지급액(세후)",
  "산출 근거",
  "지급 상태",
  "관리",
] as const;

function PayrollTableRow({
  row,
  onRequestPayment,
  onRequestCancel,
}: {
  row: PayrollRow;
  onRequestPayment: (payroll: PayrollRecord) => void;
  onRequestCancel: (payroll: PayrollRecord) => void;
}) {
  const { payroll } = row;
  const [teacher, part, setting, basePay, tax, netPay, basis, status, manage] = PAYROLL_COLUMNS;

  return (
    <TableRow>
      <TableCell label={teacher} className="font-medium">{payroll.teacherName}</TableCell>
      <TableCell label={part}>{row.part}</TableCell>
      <TableCell label={setting}>{row.paySetting}</TableCell>
      <TableCell label={basePay}>{formatWon(payroll.basePay)}</TableCell>
      <TableCell label={tax}>{formatWon(payroll.withholdingTax)}</TableCell>
      <TableCell label={netPay} className="font-semibold">{formatWon(payroll.netPay)}</TableCell>
      <TableCell label={basis} className="whitespace-normal">
        <PayrollBasis row={row} />
      </TableCell>
      <TableCell label={status}>
        <PayrollStatus payroll={payroll} />
      </TableCell>
      <TableCell label={manage} className="whitespace-normal">
        <PayrollActions payroll={payroll} onRequestPayment={onRequestPayment} onRequestCancel={onRequestCancel} />
      </TableCell>
    </TableRow>
  );
}

function PayrollBasis({ row }: { row: PayrollRow }) {
  const { payroll } = row;

  return (
    <div className="grid gap-1 text-sm">
      {payroll.basis ? <p>{payroll.basis}</p> : null}
      {payroll.issue ? <p className="text-destructive">설정 확인 필요: {payroll.issue}</p> : null}
      {payroll.note ? <p className="text-muted-foreground">{payroll.note}</p> : null}
      {row.hasLessonRecordChanged ? <p className="text-destructive">{LESSON_RECORD_CHANGED_MESSAGE}</p> : null}
    </div>
  );
}

function PayrollStatus({ payroll }: { payroll: PayrollRecord }) {
  if (payroll.status === "pending") {
    return <Badge variant="outline">미지급</Badge>;
  }

  return (
    <div className="grid justify-items-start gap-1">
      <Badge variant="secondary">지급 완료</Badge>
      {payroll.paidAt ? <p className="text-xs text-muted-foreground">지급일 {payroll.paidAt}</p> : null}
      {payroll.ledgerEntryId === null ? <Badge variant="destructive">원장 기록 없음</Badge> : null}
    </div>
  );
}

function PayrollActions({
  payroll,
  onRequestPayment,
  onRequestCancel,
}: {
  payroll: PayrollRecord;
  onRequestPayment: (payroll: PayrollRecord) => void;
  onRequestCancel: (payroll: PayrollRecord) => void;
}) {
  if (payroll.status === "paid") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-label={`${payroll.teacherName} 급여 지급 취소`}
        onClick={() => onRequestCancel(payroll)}
      >
        지급 취소
      </Button>
    );
  }

  if (payroll.issue) {
    return null;
  }

  const hasNothingToPay = payroll.netPay <= 0;
  const reasonId = `payroll-zero-reason-${payroll.payrollId}`;

  return (
    <div className="grid justify-items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={hasNothingToPay}
        aria-label={`${payroll.teacherName} 급여 지급 확정`}
        aria-describedby={hasNothingToPay ? reasonId : undefined}
        onClick={() => onRequestPayment(payroll)}
      >
        지급 확정
      </Button>
      {hasNothingToPay ? (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {payroll.payType === "hourly" ? ZERO_HOURLY_PAY_REASON : ZERO_PAY_REASON}
        </p>
      ) : null}
    </div>
  );
}

export class PayrollChangedError extends Error {
  constructor(payType: PayrollRecord["payType"]) {
    // 시급제 금액은 등원 기록이 아니라 선생님의 출근 일정에서 나온다.
    const changed = payType === "hourly" ? "출근 일정" : "등원 기록";

    super(`${changed}이 바뀌어 금액이 달라졌습니다. 새 금액을 확인한 뒤 다시 확정해 주세요.`);
  }
}

/** 최신 데이터로 같은 선생님의 급여를 다시 계산해 화면에서 본 금액·수업과 같을 때만 그 값을 돌려준다. */
async function readFreshPayroll(
  refetchFinanceData: () => Promise<FinanceManagementData | undefined>,
  shown: PayrollRecord,
  academyId: string,
) {
  const fresh = await refetchFinanceData();
  const current = fresh
    ? buildPayrollRows(fresh, academyId, shown.month).find((payroll) => payroll.teacherId === shown.teacherId)
    : undefined;

  if (
    !current ||
    current.netPay !== shown.netPay ||
    current.basePay !== shown.basePay ||
    hasLessonRecordChangedSincePayment(shown.lessonEventIds, current.lessonEventIds)
  ) {
    throw new PayrollChangedError(shown.payType);
  }

  return current;
}

function sumNetPay(rows: PayrollRow[], include: (payroll: PayrollRecord) => boolean) {
  return rows.reduce((total, row) => (include(row.payroll) ? total + row.payroll.netPay : total), 0);
}

/** 급여 설정을 사람이 읽는 문구로 만든다. 지급 후 선생님 설정이 바뀌었으면 급여 형태만 보여 준다. */
function formatPaySetting(payType: PayrollRecord["payType"], teacher: TeacherListRow | undefined) {
  const label = formatPayType(payType);
  const detail = teacher?.payType === payType ? readPaySettingDetail(teacher) : undefined;

  return detail ? `${label} · ${detail}` : label;
}

function readPaySettingDetail(teacher: TeacherListRow) {
  if (teacher.payType === "ratio") {
    return teacher.ratioTeacherShare === undefined ? undefined : `선생님 ${teacher.ratioTeacherShare}%`;
  }

  const amount = teacher.payType === "hourly" ? teacher.hourlyRate : teacher.monthlySalary;

  return amount ? formatWon(amount) : undefined;
}

function buildPayrollViewRows(data: FinanceManagementData, academyId: string, month: string): PayrollRow[] {
  const payrolls = buildPayrollRows(data, academyId, month);
  const teachersById = new Map(data.teachers.map((teacher) => [teacher.teacherId, teacher]));
  const hasPaidPayroll = payrolls.some((payroll) => payroll.status === "paid");
  // 지급 후 등원 기록 변경 여부는 지급 기록을 빼고 다시 계산한 수업과 비교한다.
  const currentPayrolls = hasPaidPayroll
    ? new Map(
        buildPayrollRows({ ...data, salarySettlements: undefined }, academyId, month).map((payroll) => [
          payroll.teacherId,
          payroll,
        ]),
      )
    : new Map<string, PayrollRecord>();

  return payrolls.map((payroll) => {
    const teacher = teachersById.get(payroll.teacherId);

    return {
      payroll,
      part: teacher?.part ?? "",
      paySetting: formatPaySetting(payroll.payType, teacher),
      // 지급 후 급여 형태가 바뀌었으면 수업 목록을 비교할 수 없으므로(월급제는 목록이 비어 있다) 경고하지 않는다.
      hasLessonRecordChanged:
        payroll.status === "paid" &&
        currentPayrolls.get(payroll.teacherId)?.payType === payroll.payType &&
        hasLessonRecordChangedSincePayment(
          payroll.lessonEventIds,
          currentPayrolls.get(payroll.teacherId)?.lessonEventIds ?? [],
        ),
    };
  });
}

export function buildPayrollRows(
  data: FinanceManagementData,
  academyId: string,
  month: string,
): PayrollRecord[] {
  return buildDomainPayrollRows({
    academyId,
    month,
    teachers: data.teachers,
    lessons: data.payrollLessonSources ?? toPayrollLessonSources(data, academyId),
    privateLessonFees: toPrivateLessonFeeSources(data),
    tuitionFees: (data.monthTuitionSnapshots ?? []).map((snapshot) => ({
      studentId: snapshot.studentId,
      instrumentName: snapshot.instrumentName,
      amount: snapshot.amount,
    })),
    settlements: data.salarySettlements,
  });
}

/** 개인레슨 1회 레슨비 계산에 쓰는 회차권 등록 기록(결제 금액 ÷ 부여 회수). */
function toPrivateLessonFeeSources(data: FinanceManagementData): PrivateLessonFeeSource[] {
  const ticketsById = new Map(data.tickets.map((ticket) => [ticket.ticketId, ticket]));

  return (data.ticketRegistrations ?? []).flatMap((registration) => {
    const ticket = ticketsById.get(registration.ticketId);

    return ticket
      ? [
          {
            studentId: ticket.studentId,
            instrumentName: ticket.instrumentName,
            registeredAt: registration.registeredAt,
            validUntil: registration.validUntil,
            grantedCount: registration.grantedCount,
            paidAmount: registration.originalPaidAmount,
          },
        ]
      : [];
  });
}

export function toPayrollLessonSources(
  data: FinanceManagementData,
  academyId: string,
): PayrollLessonSource[] {
  return Object.values(data.academySheets ?? {}).flatMap((sheet) =>
    sheet.rows
      .filter((row) => row.academyId === academyId && row.teacherId)
      .map((row) => {
        const enrollment = data.enrollments.find(
          (candidate) =>
            candidate.studentId === row.studentId &&
            candidate.instrumentId === row.instrumentId,
        );

        return {
          academyId: row.academyId,
          lessonEventId: row.lessonEventId,
          teacherId: row.teacherId ?? "",
          studentId: row.studentId,
          studentName: row.studentName,
          instrumentName: row.instrumentName,
          lessonKind: row.origin === "makeup" ? "makeup" : "academy",
          origin: row.origin,
          status: row.status,
          startedAt: `${row.date}T${row.startTime}:00+09:00`,
          endedAt: `${row.date}T${row.endTime}:00+09:00`,
          monthlyLessonFee: enrollment?.finalMonthlyFee ?? 0,
        };
      }),
  );
}

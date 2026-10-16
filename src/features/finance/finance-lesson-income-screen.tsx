"use client";

import { useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buildListView, compareKoreanNames } from "@/domain/common-list";
import { buildPrivateLessonIncomeRows, type PrivateLessonIncomeRow } from "@/domain/lesson-ticket-income";
import {
  createMonthlyTuitionSnapshot,
  formatTuitionStatus,
  getTuitionActions,
  selectOverdueTuitions,
  type TuitionAction,
  type TuitionRecord,
  type TuitionStatus,
} from "@/domain/tuition-income";
import { toUserMessage } from "@/lib/errors/user-message";
import { queryKeys } from "@/lib/api/query-keys";
import { FinanceDataScreenProps, FinanceManagementData } from "./finance-types";
import { FinanceConfirmDialog, PaymentDialog } from "@/components/management/payment-dialog";
import {
  EmptyListMessage,
  FinanceAmount,
  FinanceListSearch,
  FinanceMonthSummary,
  formatWon,
  invalidateFinanceQueries,
  useFinanceMonth,
  useSearchableListPaging,
} from "./finance-shared";

export type LessonIncomeRow = {
  id: string;
  studentId: string;
  studentName: string;
  instrumentName: string;
  progress: string;
  lessonFee: number;
  discountTotal: number;
  finalAmount: number;
} & (
  | { source: "tuition"; lessonKindLabel: "학원레슨 월수강료"; record: TuitionRecord }
  | { source: "lesson-ticket"; lessonKindLabel: "개인레슨 회차권"; status: PrivateLessonIncomeRow["status"] }
);

type TuitionRow = Extract<LessonIncomeRow, { source: "tuition" }>;
type TuitionActionKind = TuitionAction["action"];
type TuitionCommand =
  | { kind: "pay"; row: TuitionRow; paidAt: string }
  | { kind: "overdue" | "clear-overdue" | "cancel-payment"; row: TuitionRow };

const UNSUPPORTED_MESSAGE = "이 화면에서는 처리할 수 없습니다.";
const LEDGER_MISSING_LABEL = "원장 기록 없음";

const COMMAND_MESSAGES: Record<TuitionCommand["kind"], { success: string; failure: string }> = {
  pay: { success: "입금 처리했습니다.", failure: "입금 처리에 실패했습니다." },
  overdue: { success: "미납으로 기록했습니다.", failure: "미납 처리에 실패했습니다." },
  "clear-overdue": { success: "미납을 해제했습니다.", failure: "미납 해제에 실패했습니다." },
  "cancel-payment": { success: "입금을 취소했습니다.", failure: "입금 취소에 실패했습니다." },
};

const ACTION_BUTTONS: Record<
  TuitionActionKind,
  { label: string; ariaSuffix: string; variant: "default" | "outline" }
> = {
  pay: { label: "입금", ariaSuffix: "입금 처리", variant: "default" },
  overdue: { label: "미납", ariaSuffix: "미납 처리", variant: "outline" },
  "clear-overdue": { label: "미납 해제", ariaSuffix: "미납 해제", variant: "outline" },
  "cancel-payment": { label: "입금 취소", ariaSuffix: "입금 취소", variant: "outline" },
};

const TUITION_STATUS_BADGE_VARIANTS: Record<TuitionStatus, "outline" | "secondary" | "destructive"> = {
  unpaid: "outline",
  paid: "secondary",
  overdue: "destructive",
};

export function FinanceLessonIncomeScreen({
  academyId,
  financeData,
  markTuitionOverdue,
  clearTuitionOverdue,
  markTuitionPaid,
  markTuitionUnpaid,
  tuitionSnapshotsQueryOptionsFactory,
}: FinanceDataScreenProps) {
  const queryClient = useQueryClient();
  const headingId = useId();
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const { search, changeSearch, paging } = useSearchableListPaging();
  const [payTarget, setPayTarget] = useState<TuitionRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TuitionRow | null>(null);
  const tuitionSnapshotsQuery = useQuery(
    tuitionSnapshotsQueryOptionsFactory?.(month) ??
      createFallbackTuitionSnapshotsQueryOptions(financeData, academyId, month),
  );
  const rows = useMemo(
    () => tuitionSnapshotsQuery.isSuccess
      ? buildLessonIncomeRows(financeData, academyId, month, tuitionSnapshotsQuery.data)
      : [],
    [academyId, financeData, month, tuitionSnapshotsQuery.data, tuitionSnapshotsQuery.isSuccess],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.studentName,
        getTieBreaker: getLessonIncomeTieBreaker,
        search,
        searchFields: [(row) => row.studentName, (row) => row.instrumentName],
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );
  const overdueTuitions = useMemo(
    () => selectOverdueTuitions(tuitionSnapshotsQuery.data ?? []),
    [tuitionSnapshotsQuery.data],
  );
  const totalAmount = rows.reduce((total, row) => total + row.finalAmount, 0);
  const emptyMessage = getEmptyMessage(rows.length, rowsView.totalItems);
  const tuitionCommand = useMutation({
    mutationFn: async (command: TuitionCommand) => {
      const target = { academyId, tuitionId: command.row.id };

      if (command.kind === "pay" && markTuitionPaid) {
        await markTuitionPaid({ ...target, paidAt: command.paidAt });
      } else if (command.kind === "overdue" && markTuitionOverdue) {
        await markTuitionOverdue(target);
      } else if (command.kind === "clear-overdue" && clearTuitionOverdue) {
        await clearTuitionOverdue(target);
      } else if (command.kind === "cancel-payment" && markTuitionUnpaid) {
        await markTuitionUnpaid(target);
      } else {
        throw new Error(UNSUPPORTED_MESSAGE);
      }
    },
    onSuccess: (_result, command) => {
      setPayTarget(null);
      setCancelTarget(null);
      toast.success(COMMAND_MESSAGES[command.kind].success);
      invalidateFinanceQueries(queryClient, academyId);
    },
    onError: (error, command) => {
      toast.error(COMMAND_MESSAGES[command.kind].failure, {
        description: toUserMessage(error),
      });
    },
  });

  function requestTuitionAction(action: TuitionActionKind, row: TuitionRow) {
    if (action === "pay") {
      setPayTarget(row);
    } else if (action === "cancel-payment") {
      setCancelTarget(row);
    } else {
      tuitionCommand.mutate({ kind: action, row });
    }
  }

  return (
    <section className="grid gap-4" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className="text-lg font-semibold">학원 고정 수입 (원생 레슨 수입)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          원생/선생님 관리에서 작성된 레슨비 및 할인 정보를 직관적으로 보여줍니다.
        </p>
      </div>
      <FinanceMonthSummary
        amount={totalAmount}
        label="전체 금액 합산"
        maxMonth={maxMonth}
        month={month}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      {tuitionSnapshotsQuery.isSuccess ? (
        <div className="flex justify-end">
          <OverdueTuitionDialog month={month} overdueTuitions={overdueTuitions} />
        </div>
      ) : null}
      <FinanceListSearch
        label="레슨수입 검색"
        placeholder="원생명, 악기"
        value={search}
        onChange={changeSearch}
      />
      {tuitionSnapshotsQuery.isError ? (
        <ListStatusAlert
          message="월별 수강료를 불러오지 못했습니다."
          detail={toUserMessage(tuitionSnapshotsQuery.error)}
          onRetry={() => void tuitionSnapshotsQuery.refetch()}
        />
      ) : null}
      {tuitionSnapshotsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">월별 수강료를 불러오는 중입니다.</p>
      ) : null}
      <div className="rounded-lg border border-border bg-card">
        <Table aria-label="학원 레슨수입">
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">이름</TableHead>
              <TableHead className="px-4 py-3">레슨종류</TableHead>
              <TableHead className="px-4 py-3">악기</TableHead>
              <TableHead className="px-4 py-3">진도</TableHead>
              <TableHead className="px-4 py-3">레슨비</TableHead>
              <TableHead className="px-4 py-3">할인</TableHead>
              <TableHead className="px-4 py-3">최종금액</TableHead>
              <TableHead className="px-4 py-3 text-right">입금 상태</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsView.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell label="이름" className="px-4 py-3 font-medium">{row.studentName}</TableCell>
                <TableCell label="레슨종류" className="px-4 py-3">{row.lessonKindLabel}</TableCell>
                <TableCell label="악기" className="px-4 py-3">{row.instrumentName}</TableCell>
                <TableCell label="진도" className="px-4 py-3">{row.progress}</TableCell>
                <TableCell label="레슨비" className="px-4 py-3">{formatWon(row.lessonFee)}</TableCell>
                <TableCell label="할인" className="px-4 py-3">{formatWon(row.discountTotal)}</TableCell>
                <TableCell label="최종금액" className="px-4 py-3 font-semibold">
                  {formatWon(row.finalAmount)}
                </TableCell>
                <TableCell label="입금 상태" className="px-4 py-3 text-right">
                  <LessonIncomePaymentStatus
                    row={row}
                    disabled={tuitionCommand.isPending}
                    onAction={requestTuitionAction}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {tuitionSnapshotsQuery.isSuccess ? (
          <>
            {emptyMessage ? <EmptyListMessage>{emptyMessage}</EmptyListMessage> : null}
            <ListPagination
              itemLabel="레슨수입"
              countUnit="건"
              view={rowsView}
              onPageChange={paging.goToPage}
              onPageSizeChange={paging.changePageSize}
            />
          </>
        ) : null}
      </div>
      <PaymentDialog
        open={Boolean(payTarget)}
        title="입금 처리"
        description="확인하면 입출입내역에 수입이 기록됩니다."
        dateLabel="입금일"
        contextMonth={month}
        pending={tuitionCommand.isPending}
        onConfirm={(paidAt) => {
          if (payTarget) {
            tuitionCommand.mutate({ kind: "pay", row: payTarget, paidAt });
          }
        }}
        onOpenChange={(open) => !open && setPayTarget(null)}
      />
      <FinanceConfirmDialog
        open={Boolean(cancelTarget)}
        title="입금을 취소할까요?"
        description="연결된 입출입내역 1건이 삭제되고 미입금 상태로 돌아갑니다."
        confirmLabel="입금 취소"
        pending={tuitionCommand.isPending}
        onConfirm={() => {
          if (cancelTarget) {
            tuitionCommand.mutate({ kind: "cancel-payment", row: cancelTarget });
          }
        }}
        onOpenChange={(open) => !open && setCancelTarget(null)}
      />
    </section>
  );
}

/** 그 달 데이터가 아예 없는 경우와 검색 결과만 없는 경우를 구분해 안내한다. */
function getEmptyMessage(rowCount: number, matchedCount: number) {
  if (rowCount === 0) {
    return "등록된 원생 레슨 수입 정보가 없습니다.";
  }

  return matchedCount === 0 ? "조건에 맞는 레슨수입이 없습니다." : null;
}

/** 미납을 누른 원생만 모아 보여 준다. 입금하거나 미납을 해제하면 목록에서 빠진다. */
function OverdueTuitionDialog({
  month,
  overdueTuitions,
}: {
  month: string;
  overdueTuitions: TuitionRecord[];
}) {
  const overdueStudentCount = new Set(overdueTuitions.map((record) => record.studentId)).size;
  const overdueTotal = overdueTuitions.reduce((total, record) => total + record.amount, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <UsersRound aria-hidden="true" />
          미납 인원 {overdueStudentCount}명
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>미납 인원</DialogTitle>
          <DialogDescription>{month} 수강료 미납 현황</DialogDescription>
        </DialogHeader>
        {overdueTuitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">미납 인원이 없습니다.</p>
        ) : (
          <>
            <ul className="max-h-80 divide-y overflow-y-auto">
              {overdueTuitions.map((record) => (
                <li key={record.tuitionId} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{record.studentName} · {record.instrumentName}</span>
                  <span className="shrink-0 font-medium">{formatWon(record.amount)}</span>
                </li>
              ))}
            </ul>
            <p className="flex items-center justify-between gap-3 border-t pt-3 text-sm font-semibold">
              <span>합계</span>
              <FinanceAmount amount={overdueTotal} tone="expense" />
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LessonIncomePaymentStatus({
  row,
  disabled,
  onAction,
}: {
  row: LessonIncomeRow;
  disabled: boolean;
  onAction: (action: TuitionActionKind, row: TuitionRow) => void;
}) {
  if (row.source === "lesson-ticket") {
    const statusLabel = {
      paid: "입금 완료",
      "zero-amount": "0원 등록",
      "missing-ledger": LEDGER_MISSING_LABEL,
    }[row.status];
    return <Badge variant={row.status === "missing-ledger" ? "destructive" : "secondary"}>{statusLabel}</Badge>;
  }

  return <TuitionPaymentStatus row={row} disabled={disabled} onAction={onAction} />;
}

function TuitionPaymentStatus({
  row,
  disabled,
  onAction,
}: {
  row: TuitionRow;
  disabled: boolean;
  onAction: (action: TuitionActionKind, row: TuitionRow) => void;
}) {
  const disabledReasonId = useId();
  const { status, paidLedgerEntryId } = row.record;
  const actions = getTuitionActions(row.record);
  const payDisabledReason = actions.find(
    (candidate): candidate is Extract<TuitionAction, { action: "pay" }> => candidate.action === "pay",
  )?.disabledReason;
  const isLedgerMissing = status === "paid" && paidLedgerEntryId === null;

  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge variant={TUITION_STATUS_BADGE_VARIANTS[status]}>{formatTuitionStatus(status)}</Badge>
        {isLedgerMissing ? <Badge variant="destructive">{LEDGER_MISSING_LABEL}</Badge> : null}
        {actions.map((candidate) => {
          const button = ACTION_BUTTONS[candidate.action];
          const isBlocked = candidate.action === "pay" && Boolean(candidate.disabledReason);

          return (
            <Button
              key={candidate.action}
              type="button"
              size="sm"
              variant={button.variant}
              disabled={disabled || isBlocked}
              aria-label={`${row.studentName} ${row.instrumentName} ${button.ariaSuffix}`}
              aria-describedby={isBlocked ? disabledReasonId : undefined}
              onClick={() => onAction(candidate.action, row)}
            >
              {button.label}
            </Button>
          );
        })}
      </div>
      {payDisabledReason ? (
        <p id={disabledReasonId} className="text-xs text-muted-foreground">{payDisabledReason}</p>
      ) : null}
    </div>
  );
}

export function buildLessonIncomeRows(
  data: FinanceManagementData,
  academyId: string,
  month: string,
  tuitionSnapshots?: TuitionRecord[],
): LessonIncomeRow[] {
  const academyRows = (
    tuitionSnapshots ?? buildFallbackTuitionSnapshots(data, academyId, month)
  ).map((snapshot) => ({
    id: snapshot.tuitionId,
    studentId: snapshot.studentId,
    source: "tuition" as const,
    studentName: snapshot.studentName,
    lessonKindLabel: "학원레슨 월수강료" as const,
    instrumentName: snapshot.instrumentName,
    progress: snapshot.progress,
    lessonFee: snapshot.lessonFee,
    discountTotal: snapshot.discountTotal,
    finalAmount: snapshot.amount,
    record: snapshot,
  }));
  const privateRows = buildPrivateLessonIncomeRows(
    data.ticketRegistrations ?? [],
    data.tickets,
    data.ledgerEntries,
    academyId,
    month,
  );

  return [...academyRows, ...privateRows].sort(
    (left, right) =>
      compareKoreanNames(left.studentName, right.studentName) ||
      compareKoreanNames(getLessonIncomeTieBreaker(left), getLessonIncomeTieBreaker(right)),
  );
}

/** 이름이 같은 원생은 악기 순서, 그다음 id로 순서를 고정한다. */
export function getLessonIncomeTieBreaker(row: LessonIncomeRow) {
  return `${row.instrumentName} ${row.id}`;
}

export function createFallbackTuitionSnapshotsQueryOptions(
  data: FinanceManagementData,
  academyId: string,
  month: string,
) {
  return {
    queryKey: [...queryKeys.finance.all(academyId), "tuition-snapshots", month, "fallback"] as const,
    queryFn: async () => buildFallbackTuitionSnapshots(data, academyId, month),
  };
}

export function buildFallbackTuitionSnapshots(
  data: FinanceManagementData,
  academyId: string,
  month: string,
) {
  return createMonthlyTuitionSnapshot(
    data.enrollments.map((enrollment) => ({
      academyId: enrollment.academyId,
      studentId: enrollment.studentId,
      studentName: enrollment.studentName,
      enrollmentId: enrollment.enrollmentId,
      instrumentId: enrollment.instrumentId,
      instrumentName: enrollment.instrumentName,
      monthlyAmount: enrollment.finalMonthlyFee,
      registeredOn: `${month}-01`,
      lessonFee: enrollment.lessonFee,
      discountTotal: enrollment.discountTotal,
      discountLabel: enrollment.discountLabel,
      progress: enrollment.progress,
      effectiveFrom: month,
      active: enrollment.lessonType === "academy" && enrollment.active,
    })),
    { academyId, month },
  );
}


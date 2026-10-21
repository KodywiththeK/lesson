"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { ListStatusAlert } from "@/components/management/list-controls";
import { MonthField } from "@/components/operations/date-time-fields";
import { Label } from "@/components/ui/label";
import {
  formatTuitionStatus,
  selectOverdueTuitions,
  summarizeTuitionStatus,
  type TuitionRecord,
  type TuitionStatus,
} from "@/domain/tuition-income";
import { toUserMessage } from "@/lib/errors/user-message";
import { FinanceAmount, formatWon, useFinanceMonth, type FinanceAmountTone } from "./finance-shared";
import type { FinanceDataScreenProps } from "./finance-types";

const STATUS_CARDS: Array<{ status: TuitionStatus; tone: FinanceAmountTone }> = [
  { status: "paid", tone: "income" },
  { status: "unpaid", tone: "neutral" },
  { status: "overdue", tone: "expense" },
];

/** 선택한 월의 수납/미납 현황. 월 수강료 snapshot을 읽어 입금 완료·미입금·미납과 미납 인원을 보여 준다. */
export function TuitionStatusSection({
  tuitionSnapshotsQueryOptionsFactory,
}: Pick<FinanceDataScreenProps, "tuitionSnapshotsQueryOptionsFactory">) {
  if (!tuitionSnapshotsQueryOptionsFactory) {
    return (
      <SectionCard role="region" aria-label="수납 현황">
        <SectionHeader title="수납/미납 현황" description="수납 현황은 실제 데이터에서만 볼 수 있습니다." />
      </SectionCard>
    );
  }

  return <LiveTuitionStatus queryOptionsFactory={tuitionSnapshotsQueryOptionsFactory} />;
}

function LiveTuitionStatus({
  queryOptionsFactory,
}: {
  queryOptionsFactory: NonNullable<FinanceDataScreenProps["tuitionSnapshotsQueryOptionsFactory"]>;
}) {
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const snapshotsQuery = useQuery({ ...queryOptionsFactory(month), placeholderData: keepPreviousData });

  return (
    <SectionCard role="region" aria-label="수납 현황" className="grid gap-3">
      <SectionHeader
        title="수납/미납 현황"
        actions={
          <Label className="grid gap-1 text-sm font-medium sm:min-w-44">
            <span>조회 월</span>
            <MonthField aria-label="수납 현황 월 선택" required max={maxMonth} value={month} onValueChange={setMonth} />
          </Label>
        }
      />
      {snapshotsQuery.isError ? (
        <ListStatusAlert
          message="월 수납 현황을 불러오지 못했습니다."
          detail={toUserMessage(snapshotsQuery.error)}
          onRetry={() => void snapshotsQuery.refetch()}
        />
      ) : null}
      {snapshotsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">월 수납 현황을 불러오는 중입니다.</p>
      ) : null}
      {snapshotsQuery.isSuccess ? <TuitionStatusDetail records={snapshotsQuery.data} /> : null}
    </SectionCard>
  );
}

function TuitionStatusDetail({ records }: { records: TuitionRecord[] }) {
  const summary = summarizeTuitionStatus(records);
  const overdueRecords = selectOverdueTuitions(records);
  const overdueStudentCount = countStudents(overdueRecords);

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        {STATUS_CARDS.map(({ status, tone }) => (
          <div key={status} className="rounded-md border border-border p-3">
            <p className="text-sm text-muted-foreground">{formatTuitionStatus(status)}</p>
            <p className="mt-1 text-lg font-semibold">{countStudents(records.filter((record) => record.status === status))}명</p>
            <p className="text-sm">
              <FinanceAmount amount={summary[status].amount} tone={tone} />
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{`미납 인원 ${overdueStudentCount}명`}</p>
        {overdueRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground">미납 인원이 없습니다.</p>
        ) : (
          <ul aria-label="미납 인원" className="divide-y rounded-md border border-border">
            {overdueRecords.map((record) => (
              <li key={record.tuitionId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{record.studentName} · {record.instrumentName}</span>
                <span className="shrink-0 font-medium">{formatWon(record.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** 한 원생이 악기를 여러 개 배우면 수강 건수가 아니라 한 명으로 센다. */
function countStudents(records: TuitionRecord[]) {
  return new Set(records.map((record) => record.studentId)).size;
}

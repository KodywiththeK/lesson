import { StatTile } from "@/components/shared/stat-tile";
import type { LedgerMonthTotals } from "@/domain/finance-ledger";
import { FinanceAmount, type FinanceAmountTone } from "./finance-shared";

/** 선택한 월 전체의 입금·출금 합계. 검색·필터·페이지와 무관하다. */
export function LedgerMonthSummary({ totals }: { totals: LedgerMonthTotals | null }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SummaryCard label="월별 총 수입 (입금)" tone="income" amount={totals?.income} />
      <SummaryCard label="월별 총 출금" tone="expense" amount={totals?.expense} />
    </div>
  );
}

function SummaryCard({
  amount,
  label,
  tone,
}: {
  /** 아직 불러오지 못했으면 비워 두고 "-"로 보여 준다. */
  amount: number | undefined;
  label: string;
  tone: FinanceAmountTone;
}) {
  return (
    <StatTile role="group" aria-label={label} label={label}>
      {amount === undefined ? "-" : <FinanceAmount amount={amount} tone={tone} />}
    </StatTile>
  );
}

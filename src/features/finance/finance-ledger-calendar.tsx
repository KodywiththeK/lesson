import type { LedgerEntry } from "@/domain/book-sale";
import { buildFinanceCalendarDays } from "@/domain/finance-ledger";
import { FinanceAmount } from "./finance-shared";

export function FinanceLedgerCalendar({
  entries,
  month,
}: {
  entries: LedgerEntry[];
  month: string;
}) {
  const calendarDays = buildFinanceCalendarDays(entries, {
    academyId: entries[0]?.academyId ?? "",
    month,
  });
  const [year, monthIndex] = month.split("-").map(Number);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div
        role="grid"
        aria-label={`${year}년 ${monthIndex}월 입출금 캘린더`}
        className="grid grid-cols-7 gap-1 sm:gap-2"
      >
        {calendarDays.map((day) => (
          <div
            key={day.date}
            role="gridcell"
            className="min-h-24 rounded-md border border-border bg-background p-2"
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {Number(day.date.slice(-2))}
            </p>
            {day.income > 0 ? (
              <p className="mt-2 text-xs font-medium">
                <span className="sr-only">입금 </span>
                <span aria-hidden="true">+</span>
                <FinanceAmount amount={day.income} tone="income" />
              </p>
            ) : null}
            {day.expense > 0 ? (
              <p className="text-xs font-medium">
                <span className="sr-only">출금 </span>
                <span aria-hidden="true">-</span>
                <FinanceAmount amount={day.expense} tone="expense" />
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

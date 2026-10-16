"use client";

import { useId, useMemo } from "react";
import { ListPagination } from "@/components/management/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BookSale } from "@/domain/book-sale";
import { calculateBookAmount } from "@/domain/book-stock";
import { buildListView } from "@/domain/common-list";
import { FinanceDataScreenProps } from "./finance-types";
import {
  EmptyListMessage,
  FinanceListSearch,
  FinanceMonthSummary,
  formatWon,
  sumOf,
  useFinanceMonth,
  useSearchableListPaging,
} from "./finance-shared";

export type BookFinanceRow = {
  id: string;
  studentName: string;
  bookTitle: string;
  /** 출고 시점의 단가. */
  price: number;
  quantity: number;
  /** 금액 = 단가 × 수량. */
  amount: number;
  shippedAt: string;
  paidAt: string;
  /** 입금 때 만든 원장 행. null이면 원장 행이 사라진 결제 완료 건이다(값을 읽지 않은 환경은 undefined). */
  paidLedgerEntryId?: string | null;
};

export function FinanceBooksScreen({
  academyId,
  financeData,
}: FinanceDataScreenProps) {
  const headingId = useId();
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const { search, changeSearch, paging } = useSearchableListPaging();
  const rows = useMemo(
    () => buildBookFinanceRows(financeData.bookSales, academyId, month),
    [academyId, financeData.bookSales, month],
  );
  const rowsView = useMemo(
    () =>
      buildListView(rows, {
        getName: (row) => row.studentName,
        getTieBreaker: getBookFinanceTieBreaker,
        search,
        searchFields: [(row) => row.studentName, (row) => row.bookTitle],
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [rows, search, paging.page, paging.pageSize],
  );
  const emptyMessage = rows.length === 0 ? "결제 완료된 교재 내역이 없습니다." : "조건에 맞는 교재내역이 없습니다.";

  return (
    <section className="grid gap-4" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className="text-lg font-semibold">교재 결제 완료 내역 수입</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          교재 관리의 &apos;결제 완료&apos; 상태인 데이터만 자동으로 반영됩니다.
        </p>
      </div>
      <FinanceMonthSummary
        amount={sumOf(rows, "amount")}
        label="교재 수입 총합"
        maxMonth={maxMonth}
        month={month}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      <FinanceListSearch
        label="교재내역 검색"
        placeholder="원생명, 교재명"
        value={search}
        onChange={changeSearch}
      />
      <div className="rounded-lg border border-border bg-card">
        <Table aria-label="교재내역">
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">이름</TableHead>
              <TableHead className="px-4 py-3">도서명</TableHead>
              <TableHead className="px-4 py-3">가격</TableHead>
              <TableHead className="px-4 py-3">수량</TableHead>
              <TableHead className="px-4 py-3">금액</TableHead>
              <TableHead className="px-4 py-3">출고일</TableHead>
              <TableHead className="px-4 py-3">입금일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsView.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell label="이름" className="px-4 py-3 font-medium">{row.studentName}</TableCell>
                <TableCell label="도서명" className="px-4 py-3">{row.bookTitle}</TableCell>
                <TableCell label="가격" className="px-4 py-3">{formatWon(row.price)}</TableCell>
                <TableCell label="수량" className="px-4 py-3">{row.quantity}권</TableCell>
                <TableCell label="금액" className="px-4 py-3">{formatWon(row.amount)}</TableCell>
                <TableCell label="출고일" className="px-4 py-3">{row.shippedAt}</TableCell>
                <TableCell label="입금일" className="px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    {row.paidAt}
                    {row.paidLedgerEntryId === null ? <Badge variant="destructive">원장 기록 없음</Badge> : null}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rowsView.totalItems === 0 ? <EmptyListMessage>{emptyMessage}</EmptyListMessage> : null}
        <ListPagination
          itemLabel="교재내역"
          countUnit="건"
          view={rowsView}
          onPageChange={paging.goToPage}
          onPageSizeChange={paging.changePageSize}
        />
      </div>
    </section>
  );
}

/** 교재 관리에서 결제 완료된 건 중 입금일이 `month`(`YYYY-MM`)에 속하는 건만 모은다. */
export function buildBookFinanceRows(
  sales: BookSale[],
  academyId: string,
  month: string,
): BookFinanceRow[] {
  return sales.flatMap((sale) =>
    sale.academyId === academyId && sale.status === "paid" && sale.paidAt.startsWith(month)
      ? [
          {
            id: sale.saleId,
            studentName: sale.studentName,
            bookTitle: sale.bookTitle,
            price: sale.price,
            quantity: sale.quantity,
            amount: calculateBookAmount(sale.price, sale.quantity),
            shippedAt: sale.shippedAt,
            paidAt: sale.paidAt,
            paidLedgerEntryId: sale.paidLedgerEntryId,
          },
        ]
      : [],
  );
}

/** 이름이 같은 원생은 출고일이 이른 순서, 그다음 id로 순서를 고정한다. */
export function getBookFinanceTieBreaker(row: BookFinanceRow) {
  return `${row.shippedAt} ${row.id}`;
}

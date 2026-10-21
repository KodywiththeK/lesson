"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BookSale } from "@/domain/book-sale";
import { calculateBookCashFlow, groupBookSalesByShipment } from "@/domain/book-finance";
import { calculateBookOrderTotal, type BookOrder } from "@/domain/book-order";
import { calculateBookAmount } from "@/domain/book-stock";
import { buildListView } from "@/domain/common-list";
import { FinanceDataScreenProps } from "./finance-types";
import {
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

type FinanceBooksScreenProps = FinanceDataScreenProps & {
  bookOrdersQueryOptions?: { queryKey: QueryKey; queryFn: () => Promise<BookOrder[]> };
};

export function FinanceBooksScreen({
  academyId,
  financeData,
  bookOrdersQueryOptions,
}: FinanceBooksScreenProps) {
  const headingId = useId();
  const { month, setMonth, maxMonth } = useFinanceMonth();
  const { search, changeSearch, paging } = useSearchableListPaging();
  const [expandedShipments, setExpandedShipments] = useState<string[]>([]);
  const rows = useMemo(
    () => buildBookFinanceRows(financeData.bookSales, academyId, month),
    [academyId, financeData.bookSales, month],
  );
  const groupedRows = useMemo(() => {
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const shipmentGroups = groupBookSalesByShipment(
      financeData.bookSales.filter((sale) => sale.status === "paid" && sale.paidAt.startsWith(month)),
      academyId,
    );
    return shipmentGroups.flatMap((group) => {
      const items = group.items.flatMap((sale) => {
        const row = rowsById.get(sale.saleId);
        return row ? [row] : [];
      });
      return items.length > 0 ? [{ ...items[0], id: group.id, items, amount: group.amount }] : [];
    });
  }, [academyId, financeData.bookSales, month, rows]);
  const cashFlow = useMemo(
    () => calculateBookCashFlow(financeData.ledgerEntries, academyId, month),
    [academyId, financeData.ledgerEntries, month],
  );
  const ordersQuery = useQuery({
    queryKey: bookOrdersQueryOptions?.queryKey ?? ["book-orders", academyId, "disabled"],
    queryFn: bookOrdersQueryOptions?.queryFn ?? (async () => []),
    enabled: Boolean(bookOrdersQueryOptions),
  });
  const monthOrders = (ordersQuery.data ?? []).filter((order) =>
    [order.orderedOn, order.receivedOn, order.paidOn].some((date) => date?.startsWith(month)),
  );
  const rowsView = useMemo(
    () =>
      buildListView(groupedRows, {
        getName: (row) => row.studentName,
        getTieBreaker: getBookFinanceTieBreaker,
        search,
        searchFields: [(row) => row.studentName, (row) => row.items.map((item) => item.bookTitle).join(" ")],
        page: paging.page,
        pageSize: paging.pageSize,
      }),
    [groupedRows, search, paging.page, paging.pageSize],
  );
  const emptyMessage = rows.length === 0 ? "결제 완료된 교재 내역이 없습니다." : "조건에 맞는 교재내역이 없습니다.";

  return (
    <section className="grid gap-4" aria-labelledby={headingId}>
      <SectionHeader
        headingId={headingId}
        title="교재 결제 완료 내역 수입"
        description="교재 관리의 '결제 완료' 상태인 데이터만 자동으로 반영됩니다."
      />
      <FinanceMonthSummary
        amount={bookOrdersQueryOptions ? cashFlow.income : sumOf(rows, "amount")}
        label="교재 수입 총합"
        maxMonth={maxMonth}
        month={month}
        onChangeMonth={(nextMonth) => {
          setMonth(nextMonth);
          paging.resetPage();
        }}
      />
      {bookOrdersQueryOptions || financeData.ledgerEntries.length > 0 ? <div className="grid grid-cols-1 gap-2 border-y py-3 text-sm min-[481px]:grid-cols-3" aria-label="교재 원장 수지">
        <p>원장 수입 <strong className="ml-2 tabular-nums">{formatWon(cashFlow.income)}</strong></p>
        <p>발주 지급 <strong className="ml-2 tabular-nums">{formatWon(cashFlow.expenses)}</strong></p>
        <p>차액 <strong className="ml-2 tabular-nums">{formatWon(cashFlow.net)}</strong></p>
      </div> : null}
      <FinanceListSearch
        label="교재내역 검색"
        placeholder="원생명, 교재명"
        value={search}
        onChange={changeSearch}
      />
      <SectionCard padded={false}>
        <Table aria-label="교재내역">
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>도서명</TableHead>
              <TableHead>가격</TableHead>
              <TableHead>수량</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>출고일</TableHead>
              <TableHead>입금일</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsView.items.flatMap((row) => [
              <TableRow key={row.id}>
                <TableCell label="이름" className="font-medium">{row.studentName}</TableCell>
                <TableCell label="도서명">{row.items.length === 1 ? row.bookTitle : (
                  <Button variant="ghost" size="sm" aria-expanded={expandedShipments.includes(row.id)} onClick={() =>
                    setExpandedShipments((current) => current.includes(row.id)
                      ? current.filter((id) => id !== row.id) : [...current, row.id])
                  }>품목 {row.items.length}개 {expandedShipments.includes(row.id) ? "접기" : "보기"}</Button>
                )}</TableCell>
                <TableCell label="가격">{row.items.length === 1 ? formatWon(row.price) : "품목별"}</TableCell>
                <TableCell label="수량">{row.items.reduce((total, item) => total + item.quantity, 0)}권</TableCell>
                <TableCell label="금액">{formatWon(row.amount)}</TableCell>
                <TableCell label="출고일">{row.shippedAt}</TableCell>
                <TableCell label="입금일">
                  <span className="flex flex-wrap items-center gap-2">
                    {row.items.length === 1 ? row.paidAt : "품목별 확인"}
                    {row.items.some((item) => item.paidLedgerEntryId === null) ? <Badge variant="destructive">원장 기록 없음</Badge> : null}
                  </span>
                </TableCell>
              </TableRow>,
              ...(expandedShipments.includes(row.id) ? [<TableRow key={`${row.id}:items`}>
                <TableCell colSpan={7} className="bg-muted/30">
                  <ul className="grid gap-1 text-sm">{row.items.map((item) => <li key={item.id}>
                    {item.bookTitle} · {item.quantity}권 · {formatWon(item.amount)} · 입금 {item.paidAt}
                  </li>)}</ul>
                </TableCell>
              </TableRow>] : []),
            ])}
          </TableBody>
        </Table>
        {rowsView.totalItems === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
        <ListPagination
          itemLabel="교재내역"
          countUnit="건"
          view={rowsView}
          onPageChange={paging.goToPage}
          onPageSizeChange={paging.changePageSize}
        />
      </SectionCard>
      {bookOrdersQueryOptions ? <section className="grid gap-2" aria-label="교재 발주·입고·지급 내역">
        <SectionHeader as="h3" title="발주·입고·지급" />
        {ordersQuery.isPending ? <p className="text-sm text-muted-foreground">발주 내역을 불러오는 중입니다.</p> : null}
        {ordersQuery.isError ? <p role="alert" className="text-sm text-destructive">발주 내역을 불러오지 못했습니다. 다시 열어 주세요.</p> : null}
        {ordersQuery.isSuccess && monthOrders.length === 0 ? <p className="text-sm text-muted-foreground">이달의 발주·입고·지급 내역이 없습니다.</p> : null}
        {monthOrders.length > 0 ? <Table aria-label="발주·입고·지급">
          <TableHeader><TableRow><TableHead>거래처</TableHead><TableHead>품목</TableHead><TableHead>매입액</TableHead><TableHead>발주일</TableHead><TableHead>입고일</TableHead><TableHead>지급일</TableHead></TableRow></TableHeader>
          <TableBody>{monthOrders.map((order) => <TableRow key={order.id}>
            <TableCell label="거래처">{order.vendorName}</TableCell>
            <TableCell label="품목" className="whitespace-normal">{order.items.map((item) => `${item.title} ${item.quantity}권`).join(", ")}</TableCell>
            <TableCell label="매입액">{formatWon(calculateBookOrderTotal(order.items))}</TableCell>
            <TableCell label="발주일">{order.orderedOn}</TableCell>
            <TableCell label="입고일">{order.receivedOn ?? "미입고"}</TableCell>
            <TableCell label="지급일">{order.paidOn ?? "미지급"}{order.ledgerMismatch ? <Badge variant="destructive" className="ml-2">원장 불일치</Badge> : null}</TableCell>
          </TableRow>)}</TableBody>
        </Table> : null}
      </section> : null}
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

import { Undo2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBookSaleStatus, type BookPaidRow } from "@/domain/book-sale";

import { formatQuantity, formatWon } from "./book-format";

type BookPaidTableProps = {
  sales: BookPaidRow[];
  /** 검색어가 있어 비어 보이는 것인지, 그 달 결제 완료가 정말 없는 것인지 빈 안내를 가른다. */
  isSearching: boolean;
  /** 결제 취소는 원장만 한다. 데스크는 읽기 전용이다. */
  canCancelPayment: boolean;
  onCancelPayment: (sale: BookPaidRow) => void;
};

export function BookPaidTable({ sales, isSearching, canCancelPayment, onCancelPayment }: BookPaidTableProps) {
  if (sales.length === 0) {
    return (
      <EmptyState>
        {isSearching ? "조건에 맞는 결제 완료 내역이 없습니다." : "결제 완료 내역이 없습니다."}
      </EmptyState>
    );
  }

  return (
    <Table aria-label="결제 완료 목록">
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>도서명</TableHead>
          <TableHead>가격</TableHead>
          <TableHead>수량</TableHead>
          <TableHead>금액</TableHead>
          <TableHead>출고일</TableHead>
          <TableHead>입금일</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.saleId}>
            <TableCell label="이름" className="font-medium">
              {sale.studentName}
            </TableCell>
            <TableCell label="도서명">
              {sale.bookTitle}
            </TableCell>
            <TableCell label="가격" className="tabular-nums">
              {formatWon(sale.price)}
            </TableCell>
            <TableCell label="수량" className="tabular-nums">
              {formatQuantity(sale.quantity)}
            </TableCell>
            <TableCell label="금액" className="tabular-nums">
              {formatWon(sale.amount)}
            </TableCell>
            <TableCell label="출고일" className="tabular-nums">
              {sale.shippedAt}
            </TableCell>
            <TableCell label="입금일" className="tabular-nums">
              {sale.paidAt}
            </TableCell>
            <TableCell label="상태">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatBookSaleStatus("paid")}</Badge>
                {sale.ledgerMissing ? <Badge variant="destructive">원장 기록 없음</Badge> : null}
              </div>
            </TableCell>
            <TableCell label="관리">
              {canCancelPayment ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${sale.studentName} ${sale.bookTitle} 결제 취소`}
                  onClick={() => onCancelPayment(sale)}
                >
                  <Undo2 aria-hidden="true" />
                  결제 취소
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

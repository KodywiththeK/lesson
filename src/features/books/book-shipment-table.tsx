import { Pencil, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BookShipmentRow } from "@/domain/book-sale";

import { formatQuantity, formatWon } from "./book-format";

type BookShipmentTableProps = {
  shipments: BookShipmentRow[];
  /** 검색어가 있어 비어 보이는 것인지, 대기 건이 정말 없는 것인지 빈 안내를 가른다. */
  isSearching: boolean;
  onEdit: (shipment: BookShipmentRow) => void;
  onDelete: (shipment: BookShipmentRow) => void;
};

export function BookShipmentTable({
  shipments,
  isSearching,
  onEdit,
  onDelete,
}: BookShipmentTableProps) {
  if (shipments.length === 0) {
    return (
      <EmptyState>
        {isSearching ? "조건에 맞는 출고 내역이 없습니다." : "대기 중인 출고 내역이 없습니다."}
      </EmptyState>
    );
  }

  return (
    <Table aria-label="출고 목록">
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>도서명</TableHead>
          <TableHead>가격</TableHead>
          <TableHead>수량</TableHead>
          <TableHead>금액</TableHead>
          <TableHead>출고일</TableHead>
          <TableHead>관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shipments.map((shipment) => {
          const rowName = `${shipment.studentName} ${shipment.bookTitle}`;

          return (
            <TableRow key={shipment.saleId}>
              <TableCell label="이름" className="font-medium">
                {shipment.studentName}
              </TableCell>
              <TableCell label="도서명">
                {shipment.bookTitle}
              </TableCell>
              <TableCell label="가격" className="tabular-nums">
                {formatWon(shipment.price)}
              </TableCell>
              <TableCell label="수량" className="tabular-nums">
                {formatQuantity(shipment.quantity)}
              </TableCell>
              <TableCell label="금액" className="tabular-nums">
                {formatWon(shipment.amount)}
              </TableCell>
              <TableCell label="출고일" className="tabular-nums">
                {shipment.shippedAt}
              </TableCell>
              <TableCell label="관리">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${rowName} 수정`}
                    onClick={() => onEdit(shipment)}
                  >
                    <Pencil aria-hidden="true" />
                    수정
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${rowName} 삭제`}
                    onClick={() => onDelete(shipment)}
                  >
                    <Trash2 aria-hidden="true" />
                    삭제
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

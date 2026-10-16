import { Pencil, Trash2 } from "lucide-react";

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
import type { BookStockListRow } from "@/domain/book-stock";

import { formatBookPrice } from "./book-stock-format";

type BookStockTableProps = {
  books: BookStockListRow[];
  /** 목록이 비었을 때 보일 안내. 검색 결과 없음과 재고 도서 없음이 다르다. */
  emptyMessage: string;
  onEdit: (book: BookStockListRow) => void;
  onDelete: (book: BookStockListRow) => void;
};

export function BookStockTable({ books, emptyMessage, onEdit, onDelete }: BookStockTableProps) {
  if (books.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <Table aria-label="교재 재고 목록">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">도서명</TableHead>
          <TableHead className="px-4 py-3">가격</TableHead>
          <TableHead className="px-4 py-3">권수</TableHead>
          <TableHead className="px-4 py-3">입고일</TableHead>
          <TableHead className="px-4 py-3">관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {books.map((book) => (
          <TableRow key={book.bookId}>
            <TableCell label="도서명" className="px-4 py-3 font-medium break-words">
              {book.title}
            </TableCell>
            <TableCell label="가격" className="px-4 py-3 tabular-nums">
              {formatBookPrice(book.price)}
            </TableCell>
            <TableCell label="권수" className="px-4 py-3 tabular-nums">
              <span className="inline-flex flex-wrap items-center gap-2">
                {book.quantity}
                {book.isOutOfStock ? <Badge variant="destructive">재고 없음</Badge> : null}
              </span>
            </TableCell>
            <TableCell label="입고일" className="px-4 py-3 tabular-nums">
              {book.stockedOn}
            </TableCell>
            <TableCell label="관리" className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${book.title} 수정`}
                  onClick={() => onEdit(book)}
                >
                  <Pencil aria-hidden="true" />
                  수정
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${book.title} 삭제`}
                  onClick={() => onDelete(book)}
                >
                  <Trash2 aria-hidden="true" />
                  삭제
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

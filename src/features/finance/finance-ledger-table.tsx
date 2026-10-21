import { Pencil, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LedgerEntry } from "@/domain/book-sale";
import { type ListView, type PageSizeOption } from "@/domain/common-list";
import { formatLedgerCategory, formatLedgerEntrySource, formatLedgerEntryType } from "@/domain/finance-ledger";
import { FinanceAmount, formatWon } from "./finance-shared";

/** 같은 이름의 버튼이 여러 개 생기지 않도록 날짜와 금액까지 담은 행 이름. */
function describeLedgerEntry(entry: LedgerEntry) {
  return `${entry.occurredOn} ${entry.description} ${formatWon(entry.amount)}`;
}

export function FinanceLedgerTable({
  emptyMessage,
  isRefreshing,
  view,
  onDelete,
  onEdit,
  onPageChange,
  onPageSizeChange,
}: {
  emptyMessage: string;
  /** 검색·필터를 바꿔 새로 불러오는 중이면 이전 표를 유지하면서 갱신 중임을 알린다. */
  isRefreshing: boolean;
  view: ListView<LedgerEntry>;
  onDelete: (entry: LedgerEntry) => void;
  onEdit: (entry: LedgerEntry) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
}) {
  return (
    <SectionCard padded={false} aria-busy={isRefreshing}>
      {view.items.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <Table aria-label="입출금 내역">
          <TableHeader>
            <TableRow>
              <TableHead>발생일</TableHead>
              <TableHead>유형</TableHead>
              <TableHead>출처</TableHead>
              <TableHead>분류</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>설명</TableHead>
              <TableHead className="text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.map((entry) => (
              <TableRow key={entry.ledgerId}>
                <TableCell label="발생일">{entry.occurredOn}</TableCell>
                <TableCell label="유형">
                  <Badge variant={entry.type === "income" ? "secondary" : "outline"}>
                    {formatLedgerEntryType(entry.type)}
                  </Badge>
                </TableCell>
                <TableCell label="출처">
                  {formatLedgerEntrySource(entry.source)}
                </TableCell>
                <TableCell label="분류">
                  {formatLedgerCategory(entry.category)}
                </TableCell>
                <TableCell label="금액">
                  <FinanceAmount amount={entry.amount} tone={entry.type} />
                </TableCell>
                <TableCell label="설명" className="font-medium">
                  {entry.description}
                </TableCell>
                <TableCell label="관리">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${describeLedgerEntry(entry)} 수정`}
                      onClick={() => onEdit(entry)}
                    >
                      <Pencil aria-hidden="true" />
                      수정
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${describeLedgerEntry(entry)} 삭제`}
                      onClick={() => onDelete(entry)}
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
      )}
      <ListPagination
        itemLabel="입출금 내역"
        countUnit="건"
        view={view}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </SectionCard>
  );
}

export function LedgerDeleteDialog({
  entry,
  isDeleting,
  onConfirm,
  onOpenChange,
}: {
  entry: LedgerEntry | null;
  isDeleting: boolean;
  onConfirm: (entry: LedgerEntry) => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 입출금 내역을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            삭제하면 되돌릴 수 없습니다. 수강료·교재·급여로 자동 기록된 내역은 원래
            기록과의 연결이 끊어질 수 있습니다. 수강료 입금은 &apos;학원 고정 수입&apos;에서
            입금 취소, 급여는 &apos;선생님 월급&apos;에서 지급 취소로 되돌릴 수 있습니다. 교재 수입을 지우면
            &apos;교재 내역&apos;에는 결제 완료로 남고 &apos;원장 기록 없음&apos;으로 표시됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {entry ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm font-medium">
            {entry.occurredOn} · {entry.description} · {formatWon(entry.amount)}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting || !entry}
            onClick={(event) => {
              event.preventDefault();

              if (entry) {
                onConfirm(entry);
              }
            }}
          >
            {isDeleting ? "삭제 중" : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

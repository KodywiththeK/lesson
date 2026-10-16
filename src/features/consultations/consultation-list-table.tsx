import { Pencil, Trash2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ConsultationListRow } from "@/domain/consultation-list";
import { toFinanceDate } from "@/domain/finance-date";

const EMPTY_VALUE = "-";

type ConsultationListTableProps = {
  consultations: ConsultationListRow[];
  onEnrollStudent: (consultation: ConsultationListRow) => void;
  onEdit: (consultation: ConsultationListRow) => void;
  onDelete: (consultation: ConsultationListRow) => void;
};

export function ConsultationListTable({
  consultations,
  onEnrollStudent,
  onEdit,
  onDelete,
}: ConsultationListTableProps) {
  if (consultations.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 상담 기록이 없습니다.
      </p>
    );
  }

  return (
    <Table aria-label="상담 목록">
      <TableHeader className="bg-muted text-muted-foreground">
        <TableRow>
          <TableHead className="px-4 py-3">접수일</TableHead>
          <TableHead className="px-4 py-3">이름</TableHead>
          <TableHead className="px-4 py-3">나이</TableHead>
          <TableHead className="px-4 py-3">악기</TableHead>
          <TableHead className="px-4 py-3">전화번호</TableHead>
          <TableHead className="px-4 py-3">학교</TableHead>
          <TableHead className="px-4 py-3">특이사항</TableHead>
          <TableHead className="px-4 py-3">관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {consultations.map((consultation) => (
          <TableRow key={consultation.consultationId}>
            <TableCell label="접수일" className="px-4 py-3 tabular-nums">
              {toFinanceDate(consultation.receivedAt)}
            </TableCell>
            <TableCell label="이름" className="px-4 py-3 font-medium">
              {consultation.name}
            </TableCell>
            <TableCell label="나이" className="px-4 py-3">
              {consultation.age === undefined ? EMPTY_VALUE : `${consultation.age}세`}
            </TableCell>
            <TableCell label="악기" className="px-4 py-3">
              {consultation.instrumentNames.join(", ") || EMPTY_VALUE}
            </TableCell>
            <TableCell label="전화번호" className="px-4 py-3 tabular-nums">
              {consultation.phone}
            </TableCell>
            <TableCell label="학교" className="px-4 py-3">
              {consultation.school || EMPTY_VALUE}
            </TableCell>
            <TableCell
              label="특이사항"
              className="px-4 py-3 break-words whitespace-pre-wrap lg:max-w-72 lg:min-w-48"
            >
              {consultation.memo || EMPTY_VALUE}
            </TableCell>
            <TableCell label="관리" className="px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${consultation.name} 원생 등록`}
                  onClick={() => onEnrollStudent(consultation)}
                >
                  <UserPlus aria-hidden="true" />
                  원생 등록
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${consultation.name} 수정`}
                  onClick={() => onEdit(consultation)}
                >
                  <Pencil aria-hidden="true" />
                  수정
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${consultation.name} 삭제`}
                  onClick={() => onDelete(consultation)}
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

import { Pencil, Trash2, UserPlus } from "lucide-react";

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
      <EmptyState>
        조건에 맞는 상담 기록이 없습니다.
      </EmptyState>
    );
  }

  return (
    <Table aria-label="상담 목록">
      <TableHeader>
        <TableRow>
          <TableHead>접수일</TableHead>
          <TableHead>이름</TableHead>
          <TableHead>나이</TableHead>
          <TableHead>악기</TableHead>
          <TableHead>전화번호</TableHead>
          <TableHead>학교</TableHead>
          <TableHead>특이사항</TableHead>
          <TableHead>관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {consultations.map((consultation) => (
          <TableRow key={consultation.consultationId}>
            <TableCell label="접수일" className="tabular-nums">
              {toFinanceDate(consultation.receivedAt)}
            </TableCell>
            <TableCell label="이름" className="font-medium">
              {consultation.name}
            </TableCell>
            <TableCell label="나이">
              {consultation.age === undefined ? EMPTY_VALUE : `${consultation.age}세`}
            </TableCell>
            <TableCell label="악기">
              {consultation.instrumentNames.join(", ") || EMPTY_VALUE}
            </TableCell>
            <TableCell label="전화번호" className="tabular-nums">
              {consultation.phone}
            </TableCell>
            <TableCell label="학교">
              {consultation.school || EMPTY_VALUE}
            </TableCell>
            <TableCell
              label="특이사항"
              className="break-words whitespace-pre-wrap lg:max-w-72 lg:min-w-48"
            >
              {consultation.memo || EMPTY_VALUE}
            </TableCell>
            <TableCell label="관리">
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

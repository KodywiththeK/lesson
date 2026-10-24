"use client";

import { Eye } from "lucide-react";

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
import {
  formatTeacherContractPeriod,
  formatTeacherPayType,
  formatTeacherStatus,
  type TeacherListRow,
} from "@/domain/teacher-list";

const SALARY_COLUMN = "급여";
const TEACHER_COLUMNS = [
  "선생님",
  "상태",
  "담당 파트",
  "연락처",
  "계약 기간",
  "주민등록번호",
  "근무시간",
] as const;

type TeacherListTableProps = {
  teachers: TeacherListRow[];
  /** 급여 컬럼은 원장에게만 보여 준다(데스크는 급여 정보를 읽을 수 없다). */
  isOwner: boolean;
  onSelectTeacher: (teacher: TeacherListRow) => void;
};

export function TeacherListTable({ teachers, isOwner, onSelectTeacher }: TeacherListTableProps) {
  if (teachers.length === 0) {
    return (
      <EmptyState>
        조건에 맞는 선생님이 없습니다.
      </EmptyState>
    );
  }

  const [name, status, part, contact, contractPeriod, residentRegistration, workSchedule] = TEACHER_COLUMNS;
  const columns = isOwner ? [...TEACHER_COLUMNS, SALARY_COLUMN, "관리"] : [...TEACHER_COLUMNS, "관리"];

  return (
    <Table aria-label="선생님 목록">
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column} className={column === "관리" ? "text-right" : undefined}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {teachers.map((teacher) => {
          const currentStatus = teacher.status ?? "employed";

          return (
            <TableRow key={teacher.teacherId}>
              <TableCell label={name} className="font-medium">
                {teacher.name}
              </TableCell>
              <TableCell label={status}>
                <Badge variant={currentStatus === "employed" ? "default" : "outline"}>
                  {formatTeacherStatus(currentStatus)}
                </Badge>
              </TableCell>
              <TableCell label={part}>{teacher.part}</TableCell>
              <TableCell label={contact}>
                {teacher.contact || "-"}
              </TableCell>
              <TableCell label={contractPeriod} className="tabular-nums">
                {formatTeacherContractPeriod(teacher.contractStartOn, teacher.contractEndOn)}
              </TableCell>
              <TableCell label={residentRegistration} className="tabular-nums">
                {teacher.residentRegistrationMasked || "-"}
              </TableCell>
              <TableCell label={workSchedule}>
                {teacher.workScheduleSummary ?? "-"}
              </TableCell>
              {isOwner ? (
                <TableCell label={SALARY_COLUMN}>
                  {teacher.salarySummary ?? formatTeacherPayType(teacher.payType)}
                </TableCell>
              ) : null}
              <TableCell label="관리" className="text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${teacher.name} 자세히보기`}
                  onClick={() => onSelectTeacher(teacher)}
                >
                  <Eye aria-hidden="true" />
                  자세히보기
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

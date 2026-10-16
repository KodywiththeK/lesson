"use client";

import { Check, MoveRight, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import { AttendanceBadge, OriginBadge } from "@/features/lessons/lesson-badges";
import { formatLessonTimeRange } from "@/features/lessons/workspace-helpers";

export type AttendanceChoice = "present" | "absent";

/** 아직 확인을 누르기 전에 고른 원생별 등원/결석. 확인해야 저장되고 취소하면 버린다. */
export type AttendanceDraft = Record<string, AttendanceChoice>;

type StatusFilter = "all" | DailyAcademyAttendanceRow["status"];

export function isAttendanceEditable(row: DailyAcademyAttendanceRow) {
  return !row.absenceResolution;
}

export function AcademyAttendanceChecklist({
  date,
  rows,
  draft,
  canManage,
  isBusy,
  onChoose,
  onChooseMany,
  onReset,
  onMove,
  onDelete,
}: {
  date: string;
  rows: DailyAcademyAttendanceRow[];
  draft: AttendanceDraft;
  canManage: boolean;
  isBusy: boolean;
  onChoose: (row: DailyAcademyAttendanceRow, choice: AttendanceChoice | null) => void;
  onChooseMany: (rows: DailyAcademyAttendanceRow[], choice: AttendanceChoice) => void;
  onReset: (row: DailyAcademyAttendanceRow) => void;
  onMove: (row: DailyAcademyAttendanceRow) => void;
  onDelete: (row: DailyAcademyAttendanceRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const query = search.trim().toLocaleLowerCase("ko-KR");
  const isNarrowed = query.length > 0 || statusFilter !== "all";
  const visibleRows = rows.filter(
    (row) =>
      (statusFilter === "all" || row.status === statusFilter) &&
      (query.length === 0 ||
        [row.studentName, row.instrumentName, row.teacherName ?? ""].some((value) =>
          value.toLocaleLowerCase("ko-KR").includes(query),
        )),
  );
  const visibleEditableRows = visibleRows.filter(isAttendanceEditable);
  const getChoice = (row: DailyAcademyAttendanceRow): AttendanceChoice | undefined =>
    draft[row.lessonEventId] ?? (row.status === "pending" ? undefined : row.status);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
        <Label className="grid gap-1 text-sm font-medium">
          <span>원생 검색</span>
          <Input
            role="searchbox"
            aria-label="원생 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="원생명, 악기, 선생님"
          />
        </Label>
        <Label className="grid gap-1 text-sm font-medium">
          <span>출결 상태</span>
          <NativeSelect
            aria-label="출결 상태 필터"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <NativeSelectOption value="all">전체</NativeSelectOption>
            <NativeSelectOption value="pending">대기</NativeSelectOption>
            <NativeSelectOption value="present">출석</NativeSelectOption>
            <NativeSelectOption value="absent">결석</NativeSelectOption>
          </NativeSelect>
        </Label>
      </div>
      {canManage ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <AttendanceTally rows={rows} getChoice={getChoice} />
          <div className="flex flex-wrap items-center gap-2">
            {isNarrowed ? (
              <span className="text-xs text-muted-foreground">
                검색 결과 {visibleEditableRows.length}명에게만 적용됩니다
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || visibleEditableRows.length === 0}
              onClick={() => onChooseMany(visibleEditableRows, "present")}
            >
              <Check aria-hidden="true" />
              전체 등원
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || visibleEditableRows.length === 0}
              onClick={() => onChooseMany(visibleEditableRows, "absent")}
            >
              <X aria-hidden="true" />
              전체 결석
            </Button>
          </div>
        </div>
      ) : null}
      <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
        <Table aria-label={`${date} 출석 확인 목록`} className="lg:min-w-[56rem]">
          <TableHeader className="sticky top-0 bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">원생</TableHead>
              <TableHead className="px-4 py-3">시간</TableHead>
              <TableHead className="px-4 py-3">수업</TableHead>
              <TableHead className="px-4 py-3">상태</TableHead>
              {canManage ? (
                <>
                  <TableHead className="px-4 py-3">등원(O) / 결석(X)</TableHead>
                  <TableHead className="px-4 py-3 text-right">처리</TableHead>
                </>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row.lessonEventId}>
                <TableCell label="원생" className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <strong className="text-sm">{row.studentName}</strong>
                    <span className="text-xs text-muted-foreground">
                      {row.teacherName ?? "선생님 없음"}
                    </span>
                  </div>
                </TableCell>
                <TableCell label="시간" className="px-4 py-3">{formatLessonTimeRange(row)}</TableCell>
                <TableCell label="수업" className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <OriginBadge label={row.originLabel} />
                    <Badge variant="secondary">{row.instrumentName}</Badge>
                  </div>
                </TableCell>
                <TableCell label="상태" className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <AttendanceBadge status={row.status} />
                    <ResolutionBadge resolution={row.absenceResolution} />
                  </div>
                </TableCell>
                {canManage ? (
                  <>
                    <TableCell label="등원(O) / 결석(X)" className="px-4 py-3">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        aria-label={`${row.studentName} 출결 선택`}
                        value={getChoice(row) ?? ""}
                        disabled={isBusy || !isAttendanceEditable(row)}
                        onValueChange={(value) =>
                          onChoose(row, value === "present" || value === "absent" ? value : null)
                        }
                      >
                        <ToggleGroupItem value="present" aria-label={`${row.studentName} 등원`}>
                          O
                        </ToggleGroupItem>
                        <ToggleGroupItem value="absent" aria-label={`${row.studentName} 결석`}>
                          X
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </TableCell>
                    <TableCell label="처리" className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 일정 이동`}
                          disabled={isBusy}
                          onClick={() => onMove(row)}
                        >
                          <MoveRight aria-hidden="true" />
                          이동
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 일정 삭제`}
                          disabled={isBusy}
                          onClick={() => onDelete(row)}
                        >
                          <Trash2 aria-hidden="true" />
                          삭제
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 출결 초기화`}
                          disabled={isBusy || row.status === "pending" || !isAttendanceEditable(row)}
                          onClick={() => onReset(row)}
                        >
                          <RotateCcw aria-hidden="true" />
                          초기화
                        </Button>
                      </div>
                    </TableCell>
                  </>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          선택한 날짜에 예정된 학원 레슨이 없습니다.
        </p>
      ) : null}
      {rows.length > 0 && visibleRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">검색 조건에 맞는 원생이 없습니다.</p>
      ) : null}
    </div>
  );
}

function AttendanceTally({
  rows,
  getChoice,
}: {
  rows: DailyAcademyAttendanceRow[];
  getChoice: (row: DailyAcademyAttendanceRow) => AttendanceChoice | undefined;
}) {
  const choices = rows.map(getChoice);
  const present = choices.filter((choice) => choice === "present").length;
  const absent = choices.filter((choice) => choice === "absent").length;

  return (
    <p className="text-sm text-muted-foreground">
      등원 {present}명 · 결석 {absent}명 · 선택 전 {rows.length - present - absent}명
    </p>
  );
}

function ResolutionBadge({ resolution }: { resolution: DailyAcademyAttendanceRow["absenceResolution"] }) {
  if (!resolution) {
    return null;
  }

  return <Badge variant="outline">{resolution === "makeup" ? "보강 완료" : "패스 완료"}</Badge>;
}

"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Check, ClipboardCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { DateField } from "@/components/operations/date-time-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DailyAcademyAttendanceSheet } from "@/domain/academy-lesson-attendance";
import {
  createDailyAcademyLessonAttendanceQueryOptions,
  markDailyAcademyLessonAttendance,
  type AcademyLessonAttendanceSupabaseClient,
  type FetchDailyAcademyLessonAttendanceInput,
  type MarkDailyAcademyLessonAttendanceInput,
} from "@/lib/api/academy-lessons";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type DailyAcademyLessonAttendanceQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<DailyAcademyAttendanceSheet>;
};

export type DailyAcademyLessonAttendanceQueryFactory = (
  input: FetchDailyAcademyLessonAttendanceInput,
) => DailyAcademyLessonAttendanceQueryOptions;

type AcademyLessonAttendanceScreenProps = {
  academyId: string;
  academyName: string;
  initialDate?: string;
  onDateChange?: (date: string) => void;
  attendanceQueryFactory?: DailyAcademyLessonAttendanceQueryFactory;
  markAttendance?: (
    input: MarkDailyAcademyLessonAttendanceInput,
  ) => Promise<void>;
};

type SupabaseClientState =
  | {
      client: AcademyLessonAttendanceSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function AcademyLessonAttendanceScreen({
  academyId,
  academyName,
  initialDate,
  onDateChange,
  attendanceQueryFactory,
  markAttendance,
}: AcademyLessonAttendanceScreenProps) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => initialDate ?? toTodayDateInputValue());
  const [open, setOpen] = useState(false);
  const hasInjectedQuery = Boolean(attendanceQueryFactory);
  const hasInjectedMutation = Boolean(markAttendance);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedQuery && hasInjectedMutation
        ? null
        : createAcademyLessonAttendanceSupabaseClient(),
    [hasInjectedMutation, hasInjectedQuery],
  );
  const attendanceQueryOptions = attendanceQueryFactory
    ? attendanceQueryFactory({ academyId, date })
    : createDefaultAttendanceQueryOptions(
        { academyId, date },
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const attendanceQuery = useQuery({
    queryKey: attendanceQueryOptions.queryKey,
    queryFn: attendanceQueryOptions.queryFn,
    enabled: open && (hasInjectedQuery || !supabaseClientState?.error),
  });
  const markAttendanceMutation = useMutation({
    mutationFn:
      markAttendance ??
      createDefaultMarkAttendance(
        supabaseClientState ?? createMissingSupabaseClientState(),
      ),
    onSuccess: () => {
      toast.success("출결을 저장했습니다.");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.academyLessons.dailyAttendance(academyId, date),
      });
    },
    onError: (error) => {
      toast.error("출결 저장에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const canOpenAttendance = Boolean(date);

  return (
    <section className="grid gap-4" aria-labelledby="academy-attendance-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="academy-attendance-heading" className="text-2xl font-semibold">
            학원 피아노 출석 확인
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Label className="grid gap-1 text-sm font-medium">
            <span>출석 날짜</span>
            <DateField
              aria-label="출석 날짜"
              className="min-w-40"
              value={date}
              onValueChange={(nextDate) => {
                setDate(nextDate);
                onDateChange?.(nextDate);
              }}
            />
          </Label>
          <Button
            type="button"
            disabled={!canOpenAttendance}
            onClick={() => setOpen(true)}
          >
            <ClipboardCheck aria-hidden="true" />
            출석 확인
          </Button>
        </div>
      </div>

      {!hasInjectedQuery && supabaseClientState?.error ? (
        <ListStatusAlert
          message="Supabase 환경변수가 설정되면 학원 수업 출석표를 불러올 수 있습니다."
          detail={supabaseClientState.error.message}
        />
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{date} 출석 확인</DialogTitle>
            <DialogDescription>
              선택한 날짜의 학원 피아노 수업을 출석 또는 결석으로 처리합니다.
            </DialogDescription>
          </DialogHeader>
          <DailyAttendanceDialogBody
            sheet={attendanceQuery.data}
            isLoading={attendanceQuery.isLoading}
            error={attendanceQuery.isError ? attendanceQuery.error : null}
            isSaving={markAttendanceMutation.isPending}
            onMarkAll={(status) =>
              attendanceQuery.data
                ? markAttendanceMutation.mutate({
                    academyId,
                    records: attendanceQuery.data.rows.map((row) => ({
                      lessonEventId: row.lessonEventId,
                      studentId: row.studentId,
                      status,
                      reason: status === "absent" ? "결석 확인" : undefined,
                      markedAt: new Date().toISOString(),
                    })),
                  })
                : undefined
            }
            onMarkStudent={(row, status) =>
              markAttendanceMutation.mutate({
                academyId,
                records: [
                  {
                    lessonEventId: row.lessonEventId,
                    studentId: row.studentId,
                    status,
                    reason: status === "absent" ? "결석 확인" : undefined,
                    markedAt: new Date().toISOString(),
                  },
                ],
              })
            }
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DailyAttendanceDialogBody({
  sheet,
  isLoading,
  error,
  isSaving,
  onMarkAll,
  onMarkStudent,
}: {
  sheet: DailyAcademyAttendanceSheet | undefined;
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  onMarkAll: (status: "present" | "absent") => void;
  onMarkStudent: (
    row: DailyAcademyAttendanceSheet["rows"][number],
    status: "present" | "absent",
  ) => void;
}) {
  if (error) {
    return (
      <ListStatusAlert
        message="학원 수업 출석표를 불러오지 못했습니다."
        detail={error.message}
      />
    );
  }

  if (isLoading || !sheet) {
    return (
      <p className="text-sm text-muted-foreground">
        학원 수업 출석표를 불러오는 중입니다.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">전체 {sheet.summary.total}</Badge>
        <Badge variant="outline">출석 {sheet.summary.present}</Badge>
        <Badge variant="outline">결석 {sheet.summary.absent}</Badge>
        <Badge variant="outline">대기 {sheet.summary.pending}</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>원생</TableHead>
            <TableHead>악기</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sheet.rows.map((row) => (
            <TableRow key={row.lessonEventId}>
              <TableCell>
                {row.startTime}-{row.endTime}
              </TableCell>
              <TableCell className="font-medium">{row.studentName}</TableCell>
              <TableCell>{row.instrumentName}</TableCell>
              <TableCell>
                <AttendanceStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button
                    aria-label={`${row.studentName} 출석`}
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => onMarkStudent(row, "present")}
                  >
                    <Check aria-hidden="true" />
                    출석
                  </Button>
                  <Button
                    aria-label={`${row.studentName} 결석`}
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => onMarkStudent(row, "absent")}
                  >
                    <X aria-hidden="true" />
                    결석
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {sheet.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          선택한 날짜에 예정된 학원 수업이 없습니다.
        </p>
      ) : null}

      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={isSaving || sheet.rows.length === 0}
          onClick={() => onMarkAll("absent")}
        >
          <X aria-hidden="true" />
          전체 결석
        </Button>
        <Button
          type="button"
          disabled={isSaving || sheet.rows.length === 0}
          onClick={() => onMarkAll("present")}
        >
          <Check aria-hidden="true" />
          전체 출석
        </Button>
      </DialogFooter>
    </div>
  );
}

function AttendanceStatusBadge({
  status,
}: {
  status: DailyAcademyAttendanceSheet["rows"][number]["status"];
}) {
  if (status === "present") {
    return <Badge>출석</Badge>;
  }

  if (status === "absent") {
    return <Badge variant="destructive">결석</Badge>;
  }

  return <Badge variant="secondary">대기</Badge>;
}

function createDefaultAttendanceQueryOptions(
  input: FetchDailyAcademyLessonAttendanceInput,
  supabaseClientState: SupabaseClientState,
): DailyAcademyLessonAttendanceQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.academyLessons.dailyAttendance(
        input.academyId,
        input.date,
      ),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createDailyAcademyLessonAttendanceQueryOptions(
    supabaseClientState.client,
    input,
  );
}

function createDefaultMarkAttendance(supabaseClientState: SupabaseClientState) {
  if (supabaseClientState.error) {
    return async () => {
      throw supabaseClientState.error;
    };
  }

  return (input: MarkDailyAcademyLessonAttendanceInput) =>
    markDailyAcademyLessonAttendance(supabaseClientState.client, input);
}

function createAcademyLessonAttendanceSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as AcademyLessonAttendanceSupabaseClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function createMissingSupabaseClientState(): SupabaseClientState {
  return {
    client: null,
    error: new Error("Supabase client 상태를 만들지 못했습니다."),
  };
}

function toTodayDateInputValue() {
  const now = new Date();

  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(
    now.getDate(),
  )}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

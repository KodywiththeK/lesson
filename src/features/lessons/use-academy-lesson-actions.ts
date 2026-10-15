"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  buildMakeupLessonTimes,
  checkAbsenceResolutionInput,
} from "@/domain/academy-lesson-absence";
import {
  checkAcademyLessonEditable,
  checkAcademyLessonMoveTarget,
  type DailyAcademyAttendanceRow,
} from "@/domain/academy-lesson-attendance";
import {
  appendAcademyAttendanceRow,
  passAbsenceOfDeletedMakeup,
  removeAcademyAttendanceRow,
  resetAttendanceSheets,
  resolveAbsenceInSheets,
  updateAttendanceSheets,
  type AcademySheetsByDate,
} from "@/domain/academy-lesson-sheets";
import { formatAbsenceResolutionMemoLine } from "@/domain/monthly-memo";
import {
  markDailyAcademyLessonAttendance,
  type AcademyLessonAttendanceSupabaseClient,
} from "@/lib/api/academy-lessons";
import {
  deleteAcademyLessonEvent,
  moveAcademyLessonEvent,
  resetAcademyLessonAttendance,
  resolveAcademyLessonAbsence,
  type LessonWorkspaceSupabaseClient,
  type ResolveAcademyLessonAbsenceResult,
} from "@/lib/api/lesson-workspace";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { lessonMonthlyNoteQueryKey } from "@/features/lessons/use-lesson-monthly-note";
import {
  toMakeupAttendanceRow,
  toMovedAcademyAttendanceRow,
} from "@/features/lessons/workspace-helpers";
import type {
  AbsenceResolutionDraft,
  AttendanceSelection,
  DeleteLessonDraft,
  MoveLessonDraft,
} from "@/features/lessons/workspace-types";

export type AcademyLessonActionsClient = LessonWorkspaceSupabaseClient &
  AcademyLessonAttendanceSupabaseClient;

type AbsenceResolvedNotice = Pick<ResolveAcademyLessonAbsenceResult, "month" | "memoLine">;

/**
 * 학원 레슨표의 쓰기 동작(출결 저장·초기화·이동·삭제·결석 사유서). 처리 결과는 화면의 시간표에 바로 반영한다.
 * client가 있으면 DB 함수를 부르고, 없으면(데모·주입 데이터) 화면 안에서만 반영한다.
 * 각 동작은 성공하면 true를 돌려주며, 실패하면 사용자 문구 toast를 띄우고 false를 돌려준다.
 */
export function useAcademyLessonActions({
  academyId,
  selectedMonth,
  client,
  updateSheets,
  onAbsenceResolved,
}: {
  academyId: string;
  selectedMonth: string;
  client: AcademyLessonActionsClient | null;
  updateSheets: (update: (sheets: AcademySheetsByDate) => AcademySheetsByDate) => void;
  /** 사유서 확정으로 월별 메모에 한 줄이 자동 기록됐을 때 알린다. */
  onAbsenceResolved?: (notice: AbsenceResolvedNotice) => void;
}) {
  const queryClient = useQueryClient();
  const requireClient = () => {
    if (!client) {
      throw new Error("Supabase client 상태를 만들지 못했습니다.");
    }

    return client;
  };
  const refreshWorkspace = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
    });
  };
  const failureToast = (title: string) => (error: unknown) => {
    toast.error(title, { description: toUserMessage(error) });
  };

  const saveAttendanceMutation = useMutation({
    mutationFn: (input: Parameters<typeof markDailyAcademyLessonAttendance>[1]) =>
      markDailyAcademyLessonAttendance(requireClient(), input),
    onSuccess: () => {
      refreshWorkspace();
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) });
    },
    onError: failureToast("학원 수업 출결 저장에 실패했습니다."),
  });
  const resetMutation = useMutation({
    mutationFn: async (rows: DailyAcademyAttendanceRow[]) => {
      for (const row of rows) {
        await resetAcademyLessonAttendance(requireClient(), {
          academyId,
          lessonEventId: row.lessonEventId,
          studentId: row.studentId,
          reason: "출결 상태 초기화",
        });
      }
    },
    onSuccess: () => {
      refreshWorkspace();
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) });
    },
    onError: failureToast("학원 수업 출결 초기화에 실패했습니다."),
  });
  const moveMutation = useMutation({
    mutationFn: (draft: MoveLessonDraft) =>
      moveAcademyLessonEvent(requireClient(), {
        academyId,
        lessonEventId: draft.row.lessonEventId,
        targetDate: draft.targetDate,
        startTime: draft.startTime,
        endTime: draft.endTime,
        reason: draft.reason,
      }),
    onSuccess: refreshWorkspace,
    onError: failureToast("학원 일정 이동에 실패했습니다."),
  });
  const deleteMutation = useMutation({
    mutationFn: (draft: DeleteLessonDraft) =>
      deleteAcademyLessonEvent(requireClient(), {
        academyId,
        lessonEventId: draft.row.lessonEventId,
        reason: draft.reason,
      }),
    onSuccess: refreshWorkspace,
    onError: failureToast("학원 일정 삭제에 실패했습니다."),
  });
  const resolveMutation = useMutation({
    mutationFn: (input: Parameters<typeof resolveAcademyLessonAbsence>[1]) =>
      resolveAcademyLessonAbsence(requireClient(), input),
    onSuccess: (result) => {
      refreshWorkspace();
      // 사유서 내용은 DB가 월별 메모지에 자동 기록하므로 메모지를 다시 불러오게 한다.
      void queryClient.invalidateQueries({
        queryKey: lessonMonthlyNoteQueryKey(academyId, "academy", result.month),
      });
    },
    onError: failureToast("결석 사유서 저장에 실패했습니다."),
  });

  const isBusy = [
    saveAttendanceMutation,
    resetMutation,
    moveMutation,
    deleteMutation,
    resolveMutation,
  ].some((mutation) => mutation.isPending);

  /** 출석확인에서 고른 원생별 등원/결석을 한꺼번에 저장한다. */
  const saveAttendance = async (selections: AttendanceSelection[]) => {
    const markedAt = new Date().toISOString();
    const records = selections.map(({ row, status }) => ({
      lessonEventId: row.lessonEventId,
      studentId: row.studentId,
      status,
      markedAt,
    }));

    if (records.length === 0) {
      return true;
    }

    try {
      if (client) {
        await saveAttendanceMutation.mutateAsync({ academyId, records });
      }
    } catch {
      return false;
    }

    updateSheets((sheets) => updateAttendanceSheets(sheets, academyId, records));
    const absentCount = records.filter((record) => record.status === "absent").length;
    toast.success(
      absentCount > 0
        ? `출석을 저장했습니다. 결석 ${absentCount}명은 결석인원에서 처리해 주세요.`
        : "출석을 저장했습니다.",
    );

    return true;
  };

  /** 출결을 대기 상태로 되돌린다. 이미 보강·패스로 처리한 결석은 DB가 거부한다. */
  const resetAttendance = async (rows: DailyAcademyAttendanceRow[], successMessage: string) => {
    if (rows.length === 0) {
      return true;
    }

    try {
      if (client) {
        await resetMutation.mutateAsync(rows);
      }
    } catch {
      return false;
    }

    updateSheets((sheets) =>
      resetAttendanceSheets(
        sheets,
        academyId,
        rows.map((row) => ({ lessonEventId: row.lessonEventId, studentId: row.studentId })),
      ),
    );
    toast.success(successMessage);

    return true;
  };

  /** 이동에 성공하면 새로 생긴 일정 row를, 막히거나 실패하면 null을 돌려준다. */
  const moveLesson = async (draft: MoveLessonDraft) => {
    const guard = [
      checkAcademyLessonEditable(draft.row, "move"),
      checkAcademyLessonMoveTarget(draft.row, draft.targetDate),
    ].find((check) => !check.ok);

    if (guard && !guard.ok) {
      toast.error(guard.reason);
      return null;
    }

    let moved: DailyAcademyAttendanceRow;

    try {
      moved = client ? await moveMutation.mutateAsync(draft) : toMovedAcademyAttendanceRow(draft);
    } catch {
      return null;
    }

    updateSheets((sheets) =>
      appendAcademyAttendanceRow(
        removeAcademyAttendanceRow(sheets, academyId, draft.row.lessonEventId),
        academyId,
        moved,
      ),
    );
    toast.success("학원 일정을 이동했습니다.");

    return moved;
  };

  /** 달력에서 끌어 놓은 일정. 시간은 그대로 두고 날짜만 옮기며 사유는 묻지 않는다. */
  const moveLessonToDate = (row: DailyAcademyAttendanceRow, targetDate: string) =>
    moveLesson({
      row,
      targetDate,
      startTime: row.startTime,
      endTime: row.endTime,
      reason: "",
    });

  const deleteLesson = async (draft: DeleteLessonDraft) => {
    if (!draft.reason.trim()) {
      toast.error("삭제 사유를 입력해 주세요.");
      return false;
    }

    try {
      if (client) {
        await deleteMutation.mutateAsync(draft);
      }
    } catch {
      return false;
    }

    // 보강 일정을 지우면 연결된 결석은 보강 없는 패스 처리로 바뀐다(DB도 같게 처리).
    updateSheets((sheets) =>
      removeAcademyAttendanceRow(
        passAbsenceOfDeletedMakeup(sheets, academyId, draft.row),
        academyId,
        draft.row.lessonEventId,
      ),
    );
    toast.success(
      draft.row.origin === "makeup"
        ? "보강 일정을 삭제했습니다. 해당 결석은 보강 없이 패스로 처리됩니다."
        : "학원 일정을 삭제했습니다.",
    );

    return true;
  };

  /** 결석 사유서를 확정한다. 보강이면 보강일에 [보강 수업] 일정이 생기고 원본은 결석 기록으로 남는다. */
  const resolveAbsence = async (draft: AbsenceResolutionDraft) => {
    const { row } = draft;
    const inputCheck = checkAbsenceResolutionInput(draft, row);

    if (!inputCheck.ok) {
      toast.error(inputCheck.reason);
      return false;
    }

    const { resolution } = inputCheck;
    const times = buildMakeupLessonTimes(row, resolution === "makeup" ? draft.startTime : undefined);

    if (!times.ok) {
      toast.error(times.reason);
      return false;
    }

    const targetDate = resolution === "makeup" ? draft.targetDate : undefined;
    let makeupLessonEventId = `makeup-${row.lessonEventId}-${draft.targetDate}`;
    let notice: AbsenceResolvedNotice;

    try {
      if (client) {
        const result = await resolveMutation.mutateAsync({
          academyId,
          sourceLessonEventId: row.lessonEventId,
          studentId: row.studentId,
          resolution,
          targetDate,
          startTime: times.timeUnspecified ? undefined : times.startTime,
          endTime: times.timeUnspecified ? undefined : times.endTime,
          reason: draft.reason,
        });
        makeupLessonEventId = result.makeupLessonEventId ?? makeupLessonEventId;
        notice = { month: result.month, memoLine: result.memoLine };
      } else {
        notice = {
          month: row.date.slice(0, 7),
          memoLine: formatAbsenceResolutionMemoLine({
            studentName: row.studentName,
            resolution,
            absentDate: row.date,
            makeupDate: targetDate,
            makeupTime: times.timeUnspecified ? undefined : times.startTime,
            reason: draft.reason,
          }),
        };
      }
    } catch {
      return false;
    }

    updateSheets((sheets) =>
      resolveAbsenceInSheets(sheets, academyId, {
        lessonEventId: row.lessonEventId,
        resolution,
        reason: draft.reason,
        makeupRow: targetDate
          ? toMakeupAttendanceRow({
              source: row,
              lessonEventId: makeupLessonEventId,
              targetDate,
              times,
            })
          : undefined,
      }),
    );
    onAbsenceResolved?.(notice);
    toast.success(resolution === "makeup" ? "보강 일정을 저장했습니다." : "패스로 처리했습니다.");

    return true;
  };

  return {
    saveAttendance,
    resetAttendance,
    moveLesson,
    moveLessonToDate,
    deleteLesson,
    resolveAbsence,
    isBusy,
  };
}

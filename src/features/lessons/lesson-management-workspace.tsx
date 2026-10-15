"use client";

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { CalendarPlus, Search, Send, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePageHeaderActions } from "@/components/layout/page-actions";
import {
  checkAcademyLessonEditable,
  findUnresolvedAbsences,
  formatAcademyLessonOriginLabel,
  type DailyAcademyAttendanceRow,
  type DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import {
  countAttendeesByDate,
  type AcademySheetsByDate,
} from "@/domain/academy-lesson-sheets";
import {
  findMakeupWindowMonths,
  findRegularWeekdays,
  recommendMakeupDates,
} from "@/domain/academy-makeup-recommendation";
import { buildWeekdayAttendanceSummary } from "@/domain/academy-weekday-summary";
import { compareKoreanNames } from "@/domain/common-list";
import { appendMonthlyMemoLine } from "@/domain/monthly-memo";
import { toUserMessage } from "@/lib/errors/user-message";
import type { AcademyLessonAttendanceSupabaseClient } from "@/lib/api/academy-lessons";
import {
  buildPrivateLessonSessionLabels,
  buildPrivateLessonStudentSearchResults,
  describePrivateAttendanceCancellation,
  describePrivateAttendanceChange,
  type PrivateLesson,
  type PrivateLessonStatus,
} from "@/domain/private-lesson";
import type {
  CancelPrivateLessonAttendanceInput,
  CancelPrivateLessonAttendanceSupabaseClient,
  MarkPrivateLessonAttendanceSupabaseClient,
  RegisterPrivateLessonEventInput,
} from "@/lib/api/private-lessons";
import {
  cancelPrivateLessonAttendance,
  markPrivateLessonAttendance,
} from "@/lib/api/private-lessons";
import {
  createAcademyLessonEvent,
  createLessonWorkspaceQueryOptions,
  fetchAcademyAttendeeCounts,
  type CreateAcademyLessonEventInput,
  type LessonWorkspaceSupabaseClient,
} from "@/lib/api/lesson-workspace";
import {
  createLessonCalendarMemo,
  deleteLessonCalendarMemo,
  updateLessonCalendarMemo,
  type LessonCalendarMemo,
  type LessonMemoSupabaseClient,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import { queryKeys } from "@/lib/api/query-keys";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AcademyAbsenceDialog } from "@/features/lessons/academy-absence-dialog";
import { AcademyAbsenceResolutionDialog } from "@/features/lessons/academy-absence-resolution-dialog";
import { AcademyDayAttendanceDialog } from "@/features/lessons/academy-day-attendance-dialog";
import { AcademyLessonDeleteDialog } from "@/features/lessons/academy-lesson-delete-dialog";
import { AcademyLessonEventDialog } from "@/features/lessons/academy-lesson-event-dialog";
import { AcademyLessonTableView } from "@/features/lessons/academy-lesson-table-view";
import { MoveAcademyLessonDialog } from "@/features/lessons/academy-move-dialog";
import { AcademyWeekdaySummary } from "@/features/lessons/academy-weekday-summary";
import { LessonMonthCalendar } from "@/features/lessons/lesson-month-calendar";
import { LessonMonthlyNotePostit } from "@/features/lessons/lesson-monthly-note";
import { useAcademyLessonActions } from "@/features/lessons/use-academy-lesson-actions";
import { useLessonMonthlyNote } from "@/features/lessons/use-lesson-monthly-note";
import type { LessonMonthlyNoteSupabaseClient } from "@/lib/api/lesson-monthly-notes";
import {
  LessonToolbar,
  LessonViewTabs,
} from "@/features/lessons/lesson-toolbar";
import { PrivateDayAttendanceDialog } from "@/features/lessons/private-day-attendance-dialog";
import { PrivateLessonTableView } from "@/features/lessons/private-lesson-table-view";
import { ScheduleDialog } from "@/features/lessons/private-schedule-dialog";
import { PrivateLessonStudentSearchDialog } from "@/features/lessons/private-student-search-dialog";
import {
  indexSheets,
  appendAcademyAttendanceRow,
  createEmptySheet,
  updateSelectedDate,
  updateSelectedMonth,
  createEmptyWorkspaceData,
  toAcademyCalendarEvent,
  toPrivateCalendarEvent,
  compareCalendarEvents,
  compareAcademyAttendanceRows,
  comparePrivateLessonsByTime,
  toRegisteredPrivateLesson,
  toCalendarAriaLabel,
  getTodayDate,
  toSeoulDate,
  toSeoulHourMinute,
} from "@/features/lessons/workspace-helpers";
import {
  getLessonMemosForDate,
  toMemoCountMap,
  toLocalLessonCalendarMemo,
  applyLessonCalendarMemoUpdate,
  toAcademyMemoTargetOptions,
  toPrivateMemoTargetOptions,
} from "@/features/lessons/workspace-memo-helpers";
import type {
  AbsenceResolutionDraft,
  DeleteLessonDraft,
  MoveLessonDraft,
  LessonTab,
  LessonView,
} from "@/features/lessons/workspace-types";

import { PrivateLessonRegistrationScreen } from "../private-lessons/private-lesson-registration-screen";

export type { LessonRouteKind } from "@/features/lessons/workspace-types";

type LessonManagementWorkspaceProps = {
  academyId: string;
  academyName: string;
  lessonKind?: LessonTab;
  initialDate?: string;
  /** false면 선생님처럼 학원 일정을 변경할 수 없는 역할이다. 쓰기 버튼을 숨기고 조회만 보여 준다. */
  canManage?: boolean;
  demoData?: LessonWorkspaceDemoData;
  onRegisterPrivateLesson?: (input: RegisterPrivateLessonEventInput) => Promise<void>;
  onMarkPrivateLessonAttendance?: (
    lessonId: string,
    status: "present" | "absent",
  ) => void;
  /** 등원 확인을 취소해 예정 상태로 되돌리고 회차권 1회를 복구한다. */
  onCancelPrivateLessonAttendance?: (lessonId: string) => void;
};

type LessonWorkspaceClient = LessonWorkspaceSupabaseClient &
  AcademyLessonAttendanceSupabaseClient &
  MarkPrivateLessonAttendanceSupabaseClient &
  CancelPrivateLessonAttendanceSupabaseClient &
  LessonMemoSupabaseClient &
  LessonMonthlyNoteSupabaseClient;

type SupabaseClientState =
  | {
      client: LessonWorkspaceClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const internalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export function LessonManagementWorkspaceWithProviders(
  props: LessonManagementWorkspaceProps,
) {
  return (
    <QueryClientProvider client={internalQueryClient}>
      <LessonManagementWorkspace {...props} />
    </QueryClientProvider>
  );
}

export function LessonManagementWorkspace({
  academyId,
  academyName,
  lessonKind = "academy",
  initialDate = getTodayDate(),
  canManage = true,
  demoData,
  onRegisterPrivateLesson,
  onMarkPrivateLessonAttendance,
  onCancelPrivateLessonAttendance,
}: LessonManagementWorkspaceProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [academyView, setAcademyView] = useState<LessonView>("calendar");
  const [privateView, setPrivateView] = useState<LessonView>("calendar");
  const selectedMonth = selectedDate.slice(0, 7);
  const hasInjectedData = Boolean(demoData);
  const supabaseClientState = useMemo(
    () => (hasInjectedData ? null : createLessonSupabaseClient()),
    [hasInjectedData],
  );
  const emptyWorkspaceData = useMemo(() => createEmptyWorkspaceData(), []);
  const workspaceQueryOptions =
    !hasInjectedData && supabaseClientState && !supabaseClientState.error
      ? createLessonWorkspaceQueryOptions(supabaseClientState.client, {
          academyId,
          month: selectedMonth,
        })
      : null;
  const workspaceQuery = useQuery({
    queryKey:
      workspaceQueryOptions?.queryKey ??
      queryKeys.lessonWorkspace.month(academyId, selectedMonth),
    queryFn: workspaceQueryOptions?.queryFn ?? (async () => emptyWorkspaceData),
    enabled: Boolean(workspaceQueryOptions),
  });
  const monthlyNote = useLessonMonthlyNote({
    academyId,
    lessonKind,
    month: selectedMonth,
    client: supabaseClientState?.client ?? null,
    enabled: canManage,
  });
  const loadedWorkspaceData = demoData ?? workspaceQuery.data;
  const initialWorkspaceData = loadedWorkspaceData ?? emptyWorkspaceData;
  const indexedWorkspaceSheets = useMemo(
    () => indexSheets(initialWorkspaceData.academySheets),
    [initialWorkspaceData.academySheets],
  );
  const [academySheetsOverride, setAcademySheetsOverride] = useState<Record<
    string,
    DailyAcademyAttendanceSheet
  > | null>(null);
  const [privateLessonsOverride, setPrivateLessonsOverride] = useState<
    PrivateLesson[] | null
  >(null);
  const [calendarMemosOverride, setCalendarMemosOverride] = useState<
    LessonCalendarMemo[] | null
  >(null);
  const academySheets = academySheetsOverride ?? indexedWorkspaceSheets;
  const privateLessons =
    privateLessonsOverride ?? initialWorkspaceData.privateLessons;
  const calendarMemos =
    calendarMemosOverride ?? initialWorkspaceData.calendarMemos;
  const academyMemoCounts = useMemo(
    () => toMemoCountMap(calendarMemos, "academy"),
    [calendarMemos],
  );
  const privateMemoCounts = useMemo(
    () => toMemoCountMap(calendarMemos, "private"),
    [calendarMemos],
  );
  const [absentOpen, setAbsentOpen] = useState(false);
  const [academyEventOpen, setAcademyEventOpen] = useState(false);
  const [academyDayOpen, setAcademyDayOpen] = useState(false);
  const [privateDayOpen, setPrivateDayOpen] = useState(false);
  const [privateRegisterOpen, setPrivateRegisterOpen] = useState(false);
  const [privateStudentSearchOpen, setPrivateStudentSearchOpen] =
    useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [resolutionDraft, setResolutionDraft] =
    useState<AbsenceResolutionDraft | null>(null);
  const [moveLessonDraft, setMoveLessonDraft] = useState<MoveLessonDraft | null>(
    null,
  );
  const [deleteLessonDraft, setDeleteLessonDraft] =
    useState<DeleteLessonDraft | null>(null);
  const academyEvents = useMemo(
    () =>
      Object.values(academySheets)
        .flatMap((sheet) => sheet.rows.map(toAcademyCalendarEvent))
        .sort(compareCalendarEvents),
    [academySheets],
  );
  const privateSessionLabels = useMemo(
    () =>
      buildPrivateLessonSessionLabels(
        privateLessons,
        initialWorkspaceData.ticketBalances,
      ),
    [privateLessons, initialWorkspaceData.ticketBalances],
  );
  const privateEvents = useMemo(
    () =>
      privateLessons
        .map((lesson) =>
          toPrivateCalendarEvent(lesson, privateSessionLabels.get(lesson.id)),
        )
        .sort(compareCalendarEvents),
    [privateLessons, privateSessionLabels],
  );
  const academyTableRows = useMemo(
    () =>
      Object.values(academySheets)
        .flatMap((sheet) => sheet.rows)
        .sort(compareAcademyAttendanceRows),
    [academySheets],
  );
  const privateTableRows = useMemo(
    () => [...privateLessons].sort(comparePrivateLessonsByTime),
    [privateLessons],
  );
  const selectedAcademySheet =
    academySheets[selectedDate] ?? createEmptySheet(academyId, selectedDate);
  const selectedAcademyEvents = [...selectedAcademySheet.rows].sort(
    (left, right) =>
      left.startTime.localeCompare(right.startTime) ||
      compareKoreanNames(left.studentName, right.studentName),
  );
  const selectedPrivateLessons = privateLessons
    .filter((lesson) => toSeoulDate(lesson.startAt) === selectedDate)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  const selectedAcademyMemos = getLessonMemosForDate(
    calendarMemos,
    "academy",
    selectedDate,
  );
  const selectedPrivateMemos = getLessonMemosForDate(
    calendarMemos,
    "private",
    selectedDate,
  );
  const selectedAcademyMemoTargets = toAcademyMemoTargetOptions(selectedAcademyEvents);
  const selectedPrivateMemoTargets = toPrivateMemoTargetOptions(selectedPrivateLessons);
  const unresolvedAbsences = findUnresolvedAbsences(selectedAcademyEvents);
  const weekdaySummary = useMemo(
    () => buildWeekdayAttendanceSummary(academyTableRows, selectedMonth),
    [academyTableRows, selectedMonth],
  );
  const privateRegistrationOptions =
    initialWorkspaceData.privateRegistrationOptions;
  const registrationOptionsQueryFactory = useMemo(
    () =>
      demoData
        ? (targetAcademyId: string) => ({
            queryKey: [
              "demo",
              "private-registration-options",
              targetAcademyId,
            ] as QueryKey,
            queryFn: async () => demoData.privateRegistrationOptions,
          })
        : undefined,
    [demoData],
  );
  const savePrivateAttendanceMutation = useMutation({
    mutationFn: (input: Parameters<typeof markPrivateLessonAttendance>[1]) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return markPrivateLessonAttendance(supabaseClientState.client, input);
    },
    onSuccess: (_data, input) => {
      setPrivateLessonsOverride((current) =>
        (current ?? privateLessons).map((candidate) =>
          candidate.id === input.lessonEventId
            ? {
                ...candidate,
                status: input.status,
              }
            : candidate,
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-tickets"],
      });
    },
    onError: (error) => {
      toast.error("개인레슨 출결 저장에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const setPrivateLessonStatus = (lessonId: string, status: PrivateLessonStatus) => {
    setPrivateLessonsOverride((current) =>
      (current ?? privateLessons).map((candidate) =>
        candidate.id === lessonId ? { ...candidate, status } : candidate,
      ),
    );
  };
  const cancelPrivateAttendanceMutation = useMutation({
    mutationFn: (input: CancelPrivateLessonAttendanceInput) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return cancelPrivateLessonAttendance(supabaseClientState.client, input);
    },
    onSuccess: (_data, input) => {
      setPrivateLessonStatus(input.lessonEventId, "scheduled");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-tickets"],
      });
      toast.success(describePrivateAttendanceCancellation());
    },
    onError: (error) => {
      toast.error("등원 확인 취소에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const createMemoMutation = useMutation({
    mutationFn: (input: LessonCalendarMemoPayload) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return createLessonCalendarMemo(supabaseClientState.client, input);
    },
    onSuccess: (memo) => {
      setCalendarMemosOverride((current) => [...(current ?? calendarMemos), memo]);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      toast.success("메모를 등록했습니다.");
    },
    onError: (error) => {
      toast.error("메모 추가에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const updateMemoMutation = useMutation({
    mutationFn: (input: UpdateLessonCalendarMemoInput) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return updateLessonCalendarMemo(supabaseClientState.client, input);
    },
    onSuccess: (memo) => {
      setCalendarMemosOverride((current) =>
        (current ?? calendarMemos).map((candidate) =>
          candidate.id === memo.id ? memo : candidate,
        ),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      toast.success("메모를 수정했습니다.");
    },
    onError: (error) => {
      toast.error("메모 수정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const deleteMemoMutation = useMutation({
    mutationFn: (input: { academyId: string; memoId: string }) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return deleteLessonCalendarMemo(supabaseClientState.client, input);
    },
    onSuccess: (_data, input) => {
      setCalendarMemosOverride((current) =>
        (current ?? calendarMemos).filter((memo) => memo.id !== input.memoId),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      toast.success("메모를 삭제했습니다.");
    },
    onError: (error) => {
      toast.error("메모 삭제에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const createCalendarMemo = (input: LessonCalendarMemoPayload) => {
    if (!demoData && supabaseClientState?.client) {
      createMemoMutation.mutate(input);
      return;
    }

    setCalendarMemosOverride((current) => [
      ...(current ?? calendarMemos),
      toLocalLessonCalendarMemo(input),
    ]);
    toast.success("메모를 등록했습니다.");
  };
  const updateCalendarMemo = (input: UpdateLessonCalendarMemoInput) => {
    if (!demoData && supabaseClientState?.client) {
      updateMemoMutation.mutate(input);
      return;
    }

    setCalendarMemosOverride((current) =>
      (current ?? calendarMemos).map((memo) =>
        memo.id === input.memoId ? applyLessonCalendarMemoUpdate(memo, input) : memo,
      ),
    );
    toast.success("메모를 수정했습니다.");
  };
  const deleteCalendarMemo = async (memoId: string) => {
    if (!demoData && supabaseClientState?.client) {
      await deleteMemoMutation.mutateAsync({ academyId, memoId });
      return;
    }

    setCalendarMemosOverride((current) =>
      (current ?? calendarMemos).filter((memo) => memo.id !== memoId),
    );
    toast.success("메모를 삭제했습니다.");
  };
  const createAcademyEventMutation = useMutation({
    mutationFn: (input: CreateAcademyLessonEventInput) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return createAcademyLessonEvent(supabaseClientState.client, input);
    },
    onSuccess: (row) => {
      setAcademySheetsOverride((current) =>
        appendAcademyAttendanceRow(current ?? academySheets, academyId, row),
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      toast.success("학원 일정을 추가했습니다.");
    },
    onError: (error) => {
      toast.error("학원 일정 추가에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const privateLessonStudentResults = useMemo(
    () =>
      buildPrivateLessonStudentSearchResults(
        privateRegistrationOptions.students.map((student) => ({
          academyId,
          studentId: student.studentId,
          studentName: student.studentName,
        })),
        initialWorkspaceData.ticketBalances,
        privateLessons,
        { academyId },
      ),
    [
      academyId,
      privateRegistrationOptions.students,
      initialWorkspaceData.ticketBalances,
      privateLessons,
    ],
  );

  const updateAcademySheets = (
    update: (sheets: AcademySheetsByDate) => AcademySheetsByDate,
  ) => setAcademySheetsOverride((current) => update(current ?? academySheets));
  const resetWorkspaceOverrides = () => {
    setAcademySheetsOverride(null);
    setPrivateLessonsOverride(null);
    setCalendarMemosOverride(null);
  };

  const academyActions = useAcademyLessonActions({
    academyId,
    selectedMonth,
    client: supabaseClientState?.client ?? null,
    updateSheets: updateAcademySheets,
    // 실서비스는 DB가 월별 메모에 자동 기록하고, 데모는 이 화면의 메모지에 한 줄을 더한다.
    onAbsenceResolved: supabaseClientState?.client
      ? undefined
      : (notice) =>
          monthlyNote.save(
            appendMonthlyMemoLine(monthlyNote.note?.content ?? "", notice.memoLine),
          ),
  });

  // 보강일 후보가 다음 달로 넘어가면 그 달 등원 인원은 따로 조회한다(데모는 가진 데이터로만 센다).
  const nextMonthToCount = resolutionDraft
    ? findMakeupWindowMonths(resolutionDraft.row.date)[1]
    : undefined;
  const attendeeCountsClient = supabaseClientState?.client ?? null;
  const nextMonthAttendeeCounts = useQuery({
    queryKey: [
      ...queryKeys.lessonWorkspace.month(academyId, nextMonthToCount ?? selectedMonth),
      "attendee-counts",
    ],
    queryFn: () => {
      if (!attendeeCountsClient || !nextMonthToCount) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return fetchAcademyAttendeeCounts(attendeeCountsClient, {
        academyId,
        month: nextMonthToCount,
      });
    },
    enabled: Boolean(attendeeCountsClient && nextMonthToCount),
  });
  const makeupRecommendations = useMemo(
    () =>
      resolutionDraft
        ? recommendMakeupDates({
            absentDate: resolutionDraft.row.date,
            regularWeekdays: findRegularWeekdays(
              academyTableRows,
              resolutionDraft.row.studentId,
            ),
            attendeeCountByDate: {
              ...countAttendeesByDate(academyTableRows),
              ...nextMonthAttendeeCounts.data,
            },
          })
        : [],
    [academyTableRows, nextMonthAttendeeCounts.data, resolutionDraft],
  );

  const selectAcademyDate = (date: string) =>
    updateSelectedDate(date, {
      selectedMonth,
      setSelectedDate,
      resetOverrides: resetWorkspaceOverrides,
    });
  const requestAcademyMove = (row: DailyAcademyAttendanceRow) => {
    const editable = checkAcademyLessonEditable(row, "move");

    if (!editable.ok) {
      toast.error(editable.reason);
      return;
    }

    setMoveLessonDraft({
      row,
      targetDate: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      reason: "",
    });
  };
  const requestAcademyDelete = (row: DailyAcademyAttendanceRow) => {
    const editable = checkAcademyLessonEditable(row, "delete");

    if (!editable.ok) {
      toast.error(editable.reason);
      return;
    }

    setDeleteLessonDraft({ row, reason: "" });
  };
  const confirmAcademyMove = async (draft: MoveLessonDraft) => {
    const moved = await academyActions.moveLesson(draft);

    if (moved) {
      setMoveLessonDraft(null);
      // 이동한 날짜를 이어서 보여 준다. 같은 달 안에서만 옮기므로 화면 데이터는 그대로다.
      setSelectedDate(moved.date);
    }
  };
  const dropAcademyEvent = (eventId: string, targetDate: string) => {
    const row = academyTableRows.find((candidate) => candidate.lessonEventId === eventId);

    if (row) {
      void academyActions.moveLessonToDate(row, targetDate);
    }
  };
  const confirmAcademyDelete = async (draft: DeleteLessonDraft) => {
    if (await academyActions.deleteLesson(draft)) {
      setDeleteLessonDraft(null);
    }
  };
  const confirmAbsenceResolution = async (draft: AbsenceResolutionDraft) => {
    if (await academyActions.resolveAbsence(draft)) {
      setResolutionDraft(null);
    }
  };

  const markPrivateLesson = (lesson: PrivateLesson, status: "present" | "absent") => {
    if (!onMarkPrivateLessonAttendance && supabaseClientState?.client) {
      savePrivateAttendanceMutation.mutate(
        {
          academyId,
          lessonEventId: lesson.id,
          studentId: lesson.studentId,
          instrumentId: lesson.instrumentId,
          instrumentName: lesson.instrumentName,
          status,
          markedAt: new Date().toISOString(),
        },
        {
          onSuccess: () =>
            toast.success(describePrivateAttendanceChange(lesson.status, status)),
        },
      );
      return;
    }

    onMarkPrivateLessonAttendance?.(lesson.id, status);
    setPrivateLessonStatus(lesson.id, status);
    toast.success(describePrivateAttendanceChange(lesson.status, status));
  };

  const cancelPrivateLessonCheckIn = (lesson: PrivateLesson) => {
    if (!onCancelPrivateLessonAttendance && supabaseClientState?.client) {
      cancelPrivateAttendanceMutation.mutate({
        academyId,
        lessonEventId: lesson.id,
        studentId: lesson.studentId,
        instrumentId: lesson.instrumentId,
      });
      return;
    }

    onCancelPrivateLessonAttendance?.(lesson.id);
    setPrivateLessonStatus(lesson.id, "scheduled");
    toast.success(describePrivateAttendanceCancellation());
  };

  const registerPrivateLessonLocally = useCallback(
    async (input: RegisterPrivateLessonEventInput) => {
      if (onRegisterPrivateLesson) {
        await onRegisterPrivateLesson(input);
      }
      return toRegisteredPrivateLesson(input);
    },
    [onRegisterPrivateLesson],
  );
  const addRegisteredPrivateLesson = useCallback(
    (lesson: PrivateLesson) => {
      setPrivateLessonsOverride((current) => [...(current ?? privateLessons), lesson]);
    },
    [privateLessons, setPrivateLessonsOverride],
  );
  const privateRegistrationProps = useMemo(
    () => ({
      academyId,
      academyName,
      registrationOptionsQueryFactory,
      ticketBalances: initialWorkspaceData.ticketBalances,
      existingLessons: privateLessons,
      registerPrivateLesson:
        demoData || onRegisterPrivateLesson ? registerPrivateLessonLocally : undefined,
      onRegistered: addRegisteredPrivateLesson,
    }),
    [
      academyId,
      academyName,
      addRegisteredPrivateLesson,
      demoData,
      initialWorkspaceData.ticketBalances,
      onRegisterPrivateLesson,
      privateLessons,
      registerPrivateLessonLocally,
      registrationOptionsQueryFactory,
    ],
  );

  // 선생님은 학원 레슨표를 조회만 하므로 일정 추가·결석 처리 버튼을 두지 않는다.
  const academyHeaderActions = useMemo(
    () =>
      canManage ? (
        <>
          <Button type="button" onClick={() => setAcademyEventOpen(true)}>
            <CalendarPlus aria-hidden="true" />
            일정 추가
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setAbsentOpen(true)}
          >
            <X aria-hidden="true" />
            결석인원
          </Button>
        </>
      ) : null,
    [canManage, setAbsentOpen, setAcademyEventOpen],
  );
  const privateHeaderActions = useMemo(
    () => (
      <>
        {canManage ? (
          <PrivateLessonRegistrationScreen
            {...privateRegistrationProps}
            displayMode="button"
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => setPrivateStudentSearchOpen(true)}
        >
          <Search aria-hidden="true" />
          레슨원생 검색
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setScheduleOpen(true)}
        >
          <Send aria-hidden="true" />
          레슨시간표 보내기
        </Button>
      </>
    ),
    [
      canManage,
      privateRegistrationProps,
      setPrivateStudentSearchOpen,
      setScheduleOpen,
    ],
  );
  const lessonHeaderActions =
    lessonKind === "academy" ? academyHeaderActions : privateHeaderActions;
  const isHeaderActionMounted = usePageHeaderActions(lessonHeaderActions);
  // 학원 레슨 메모는 원장·데스크만 읽을 수 있어 관리 권한이 없으면 메모지를 두지 않는다.
  const monthlyNotePostit = canManage ? (
    <LessonMonthlyNotePostit
      lessonKind={lessonKind}
      month={selectedMonth}
      note={monthlyNote.note}
      isLoading={monthlyNote.isLoading}
      isSaving={monthlyNote.isSaving}
      isMarkingRead={monthlyNote.isMarkingRead}
      loadErrorMessage={monthlyNote.loadErrorMessage}
      onSave={monthlyNote.save}
      onMarkRead={monthlyNote.markRead}
    />
  ) : null;

  if (!hasInjectedData && supabaseClientState?.error) {
    return (
      <ListStatusAlert
        message="레슨관리표를 불러오지 못했습니다."
        detail={toUserMessage(supabaseClientState.error)}
      />
    );
  }

  if (!hasInjectedData && workspaceQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        레슨관리표를 불러오는 중입니다.
      </p>
    );
  }

  if (!hasInjectedData && workspaceQuery.isError) {
    return (
      <ListStatusAlert
        message="레슨관리표를 불러오지 못했습니다."
        detail={toUserMessage(workspaceQuery.error)}
      />
    );
  }

  return (
    <section className="grid gap-4" aria-label={`${academyName} 레슨 시간표 운영`}>
      {!isHeaderActionMounted && lessonHeaderActions ? (
        <LessonToolbar
          ariaLabel={lessonKind === "academy" ? "학원레슨 도구" : "개인레슨 도구"}
          actions={lessonHeaderActions}
        />
      ) : null}

      {lessonKind === "academy" ? (
        <div className="relative grid min-w-0 gap-4">
          <LessonViewTabs
            labelPrefix="학원레슨"
            value={academyView}
            onValueChange={setAcademyView}
          />
          {monthlyNotePostit}
          {canManage ? null : (
            <Alert>
              <AlertDescription>
                학원 레슨표는 조회만 할 수 있습니다. 출석 확인, 일정 이동·삭제, 결석 처리는 원장
                또는 데스크에서 해 주세요.
              </AlertDescription>
            </Alert>
          )}
          <AcademyWeekdaySummary month={selectedMonth} summary={weekdaySummary} />
          {academyView === "calendar" ? (
            <LessonMonthCalendar
              ariaLabel={toCalendarAriaLabel(selectedDate, "학원레슨 캘린더")}
              selectedDate={selectedDate}
              events={academyEvents}
              memoCounts={academyMemoCounts}
              variant="academy"
              onMoveEvent={canManage ? dropAcademyEvent : undefined}
              onChangeMonth={(month) => {
                updateSelectedMonth(month, {
                  selectedDate,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
              }}
              onSelectDate={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
                setAcademyDayOpen(true);
              }}
            />
          ) : (
            <AcademyLessonTableView
              selectedDate={selectedDate}
              rows={selectedAcademyEvents}
              onChangeDate={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
              }}
              onOpenDay={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
                setAcademyDayOpen(true);
              }}
            />
          )}
        </div>
      ) : (
        <div className="relative grid min-w-0 gap-4">
          <LessonViewTabs
            labelPrefix="개인레슨"
            value={privateView}
            onValueChange={setPrivateView}
          />
          {monthlyNotePostit}
          {privateView === "calendar" ? (
            <LessonMonthCalendar
              ariaLabel={toCalendarAriaLabel(selectedDate, "개인레슨 캘린더")}
              selectedDate={selectedDate}
              events={privateEvents}
              memoCounts={privateMemoCounts}
              variant="private"
              onChangeMonth={(month) => {
                updateSelectedMonth(month, {
                  selectedDate,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
              }}
              onSelectDate={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
                setPrivateDayOpen(true);
              }}
            />
          ) : (
            <PrivateLessonTableView
              selectedMonth={selectedMonth}
              selectedDate={selectedDate}
              lessons={privateTableRows}
              onChangeMonth={(month) => {
                updateSelectedMonth(month, {
                  selectedDate,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
              }}
              onOpenDay={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: resetWorkspaceOverrides,
                });
                setPrivateDayOpen(true);
              }}
            />
          )}
        </div>
      )}

      <AcademyAbsenceDialog
        open={absentOpen}
        date={selectedDate}
        rows={unresolvedAbsences}
        isBusy={academyActions.isBusy}
        onOpenChange={setAbsentOpen}
        onChangeDate={selectAcademyDate}
        onConfirmAbsence={(row) =>
          setResolutionDraft({
            row,
            resolution: "",
            targetDate: "",
            startTime: "",
            reason: "",
          })
        }
        onCancelAbsence={(row) =>
          void academyActions.resetAttendance(
            [row],
            "결석을 취소하고 출결을 대기 상태로 되돌렸습니다.",
          )
        }
      />

      <AcademyAbsenceResolutionDialog
        draft={resolutionDraft}
        recommendations={makeupRecommendations}
        isSaving={academyActions.isBusy}
        onChange={setResolutionDraft}
        onClose={() => setResolutionDraft(null)}
        onConfirm={confirmAbsenceResolution}
      />

      <AcademyLessonDeleteDialog
        draft={deleteLessonDraft}
        isDeleting={academyActions.isBusy}
        onChange={setDeleteLessonDraft}
        onClose={() => setDeleteLessonDraft(null)}
        onConfirm={confirmAcademyDelete}
      />

      <AcademyLessonEventDialog
        open={academyEventOpen}
        academyId={academyId}
        selectedDate={selectedDate}
        options={initialWorkspaceData.registrationOptions}
        onOpenChange={setAcademyEventOpen}
        onSave={(input) => {
          if (!demoData && supabaseClientState?.client) {
            createAcademyEventMutation.mutate(input, {
              onSuccess: () => setAcademyEventOpen(false),
            });
            return;
          }

          setAcademySheetsOverride((current) =>
            appendAcademyAttendanceRow(current ?? academySheets, academyId, {
              academyId,
              lessonEventId: `academy-manual-${Date.now()}`,
              studentId: input.studentId,
              studentName: input.studentName,
              teacherId: input.teacherId,
              teacherName: input.teacherName,
              instrumentId: input.instrumentId,
              instrumentName: input.instrumentName,
              date: toSeoulDate(input.startAt),
              startTime: toSeoulHourMinute(input.startAt),
              endTime: toSeoulHourMinute(input.endAt),
              status: "pending",
              origin: input.origin,
              originLabel: formatAcademyLessonOriginLabel(input.origin),
            }),
          );
          setAcademyEventOpen(false);
          toast.success("학원 일정을 추가했습니다.");
        }}
      />

      <AcademyDayAttendanceDialog
        open={academyDayOpen}
        academyId={academyId}
        date={selectedDate}
        rows={selectedAcademyEvents}
        memos={selectedAcademyMemos}
        memoTargets={selectedAcademyMemoTargets}
        canManage={canManage}
        isBusy={academyActions.isBusy}
        onOpenChange={setAcademyDayOpen}
        onCreateMemo={(input) => createCalendarMemo(input)}
        onUpdateMemo={(input) => updateCalendarMemo(input)}
        onDeleteMemo={deleteCalendarMemo}
        onConfirmAttendance={academyActions.saveAttendance}
        onReset={(row) =>
          void academyActions.resetAttendance([row], "출결을 초기화했습니다.")
        }
        onMove={requestAcademyMove}
        onDelete={requestAcademyDelete}
      />

      <MoveAcademyLessonDialog
        draft={moveLessonDraft}
        onChange={setMoveLessonDraft}
        onClose={() => setMoveLessonDraft(null)}
        onConfirm={confirmAcademyMove}
      />

      <PrivateDayAttendanceDialog
        open={privateDayOpen}
        academyId={academyId}
        date={selectedDate}
        lessons={selectedPrivateLessons}
        sessionLabels={privateSessionLabels}
        memos={selectedPrivateMemos}
        memoTargets={selectedPrivateMemoTargets}
        canManage={canManage}
        onOpenChange={setPrivateDayOpen}
        onCreateMemo={(input) => createCalendarMemo(input)}
        onUpdateMemo={(input) => updateCalendarMemo(input)}
        onDeleteMemo={deleteCalendarMemo}
        onMark={markPrivateLesson}
        onCancelAttendance={cancelPrivateLessonCheckIn}
        onRegisterOnDate={
          canManage
            ? () => {
                setPrivateDayOpen(false);
                setPrivateRegisterOpen(true);
              }
            : undefined
        }
      />

      {canManage && lessonKind === "private" ? (
        <PrivateLessonRegistrationScreen
          {...privateRegistrationProps}
          displayMode="dialog"
          open={privateRegisterOpen}
          onOpenChange={setPrivateRegisterOpen}
          initialDate={selectedDate}
        />
      ) : null}

      <ScheduleDialog
        open={scheduleOpen}
        lessons={privateLessons}
        registrationOptions={privateRegistrationOptions}
        selectedDate={selectedDate}
        onOpenChange={setScheduleOpen}
      />

      <PrivateLessonStudentSearchDialog
        open={privateStudentSearchOpen}
        results={privateLessonStudentResults}
        onOpenChange={setPrivateStudentSearchOpen}
      />
    </section>
  );
}

function createLessonSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as LessonWorkspaceClient,
      error: null,
    };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

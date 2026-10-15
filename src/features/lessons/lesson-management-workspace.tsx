"use client";

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  FileText,
  MoveRight,
  RotateCcw,
  Table2,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import { DateField, DateTimeField, MonthField, TimeField } from "@/components/operations/date-time-fields";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePageHeaderActions } from "@/components/layout/page-actions";
import type {
  DailyAcademyAttendanceRow,
  DailyAcademyAttendanceSheet,
  LessonEventOrigin,
} from "@/domain/academy-lesson-attendance";
import { compareKoreanNames, paginateItems } from "@/domain/common-list";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  markDailyAcademyLessonAttendance,
  type AcademyLessonAttendanceSupabaseClient,
} from "@/lib/api/academy-lessons";
import {
  buildPrivateLessonStudentSearchResults,
  describePrivateAttendanceChange,
  type PrivateLesson,
  type PrivateLessonStudentSearchResult,
} from "@/domain/private-lesson";
import type {
  MarkPrivateLessonAttendanceSupabaseClient,
  PrivateLessonRegistrationOptions,
  RegisterPrivateLessonEventInput,
} from "@/lib/api/private-lessons";
import { markPrivateLessonAttendance } from "@/lib/api/private-lessons";
import {
  createAcademyLessonEvent,
  createMakeupLessonEvent,
  createLessonWorkspaceQueryOptions,
  moveAcademyLessonEvent,
  resetAcademyLessonAttendance,
  type CreateAcademyLessonEventInput,
  type LessonWorkspaceSupabaseClient,
  type MoveAcademyLessonEventInput,
} from "@/lib/api/lesson-workspace";
import {
  createLessonCalendarMemo,
  deleteLessonCalendarMemo,
  updateLessonCalendarMemo,
  type LessonCalendarMemo,
  type LessonMemoKind,
  type LessonMemoSupabaseClient,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import { queryKeys } from "@/lib/api/query-keys";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { PrivateLessonRegistrationScreen } from "../private-lessons/private-lesson-registration-screen";

type LessonManagementWorkspaceProps = {
  academyId: string;
  academyName: string;
  lessonKind?: LessonTab;
  initialDate?: string;
  demoData?: LessonWorkspaceDemoData;
  onRegisterPrivateLesson?: (input: RegisterPrivateLessonEventInput) => Promise<void>;
  onMarkPrivateLessonAttendance?: (
    lessonId: string,
    status: "present" | "absent",
  ) => void;
};

type LessonWorkspaceClient = LessonWorkspaceSupabaseClient &
  AcademyLessonAttendanceSupabaseClient &
  MarkPrivateLessonAttendanceSupabaseClient &
  LessonMemoSupabaseClient;

type SupabaseClientState =
  | {
      client: LessonWorkspaceClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

type CalendarEvent = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  status: "present" | "absent" | "pending" | "scheduled";
  origin?: LessonEventOrigin;
  originLabel?: string;
};

type MakeupDraft = {
  lessonEventId: string;
  studentId: string;
  studentName: string;
  startTime: string;
  endTime: string;
  targetDate: string;
  reason: string;
};

type MoveLessonDraft = {
  row: DailyAcademyAttendanceRow;
  targetDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

export type LessonRouteKind = "academy" | "private";
type LessonTab = LessonRouteKind;
type LessonView = "calendar" | "table";

type LessonMemoTargetOption = {
  id: string;
  name: string;
};

type LessonMemoTargetOptions = {
  students: LessonMemoTargetOption[];
  teachers: LessonMemoTargetOption[];
};

type LessonMemoDraft = {
  studentId: string;
  teacherId: string;
  content: string;
};

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourMinuteFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const internalQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});
let localMemoIdSequence = 0;

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
  demoData,
  onRegisterPrivateLesson,
  onMarkPrivateLessonAttendance,
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
  const [privateStudentSearchOpen, setPrivateStudentSearchOpen] =
    useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [makeupDraft, setMakeupDraft] = useState<MakeupDraft | null>(null);
  const [moveLessonDraft, setMoveLessonDraft] = useState<MoveLessonDraft | null>(
    null,
  );
  const [resolvedAbsenceIds, setResolvedAbsenceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const academyEvents = useMemo(
    () =>
      Object.values(academySheets)
        .flatMap((sheet) => sheet.rows.map(toAcademyCalendarEvent))
        .sort(compareCalendarEvents),
    [academySheets],
  );
  const privateEvents = useMemo(
    () => privateLessons.map(toPrivateCalendarEvent).sort(compareCalendarEvents),
    [privateLessons],
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
  const unresolvedAbsences = academyTableRows.filter(
    (row) =>
      row.date.startsWith(selectedMonth) &&
      row.status === "absent" &&
      !resolvedAbsenceIds.has(row.lessonEventId),
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
  const saveAcademyAttendanceMutation = useMutation({
    mutationFn: (input: Parameters<typeof markDailyAcademyLessonAttendance>[1]) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return markDailyAcademyLessonAttendance(supabaseClientState.client, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) });
    },
    onError: (error) => {
      toast.error("학원 수업 출결 저장에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const resetAcademyAttendanceMutation = useMutation({
    mutationFn: async (input: {
      academyId: string;
      records: Array<{
        lessonEventId: string;
        studentId: string;
      }>;
      reason?: string;
    }) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      for (const record of input.records) {
        await resetAcademyLessonAttendance(supabaseClientState.client, {
          academyId: input.academyId,
          lessonEventId: record.lessonEventId,
          studentId: record.studentId,
          reason: input.reason,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(academyId) });
    },
    onError: (error) => {
      toast.error("학원 수업 출결 초기화에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const moveAcademyLessonMutation = useMutation({
    mutationFn: (input: MoveAcademyLessonEventInput) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return moveAcademyLessonEvent(supabaseClientState.client, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      toast.success("학원 일정을 이동했습니다.");
    },
    onError: (error) => {
      toast.error("학원 일정 이동에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
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
  const createMakeupEventMutation = useMutation({
    mutationFn: (input: Parameters<typeof createMakeupLessonEvent>[1]) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return createMakeupLessonEvent(supabaseClientState.client, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
    },
    onError: (error) => {
      toast.error("보강 일정 저장에 실패했습니다.", {
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

  const resetWorkspaceOverrides = () => {
    setAcademySheetsOverride(null);
    setPrivateLessonsOverride(null);
    setCalendarMemosOverride(null);
  };

  const applyAcademyAttendance = (
    records: Array<{
      lessonEventId: string;
      studentId: string;
      status: "present" | "absent";
      reason?: string;
      markedAt: string;
    }>,
  ) => {
    setAcademySheetsOverride((current) =>
      updateAttendanceSheets(current ?? academySheets, academyId, records),
    );
  };

  const markAcademyAttendanceRows = (
    rows: DailyAcademyAttendanceRow[],
    status: "present" | "absent",
    reason?: string,
  ) => {
    const markedAt = new Date().toISOString();
    const records = rows.map((row) => ({
      lessonEventId: row.lessonEventId,
      studentId: row.studentId,
      status,
      reason: status === "absent" ? reason?.trim() || "일괄 결석 처리" : undefined,
      markedAt,
    }));

    if (records.length === 0) {
      return;
    }

    if (!demoData && supabaseClientState?.client) {
      saveAcademyAttendanceMutation.mutate(
        { academyId, records },
        {
          onSuccess: () => applyAcademyAttendance(records),
        },
      );
      return;
    }

    applyAcademyAttendance(records);
  };

  const resetAcademyAttendanceRows = (
    rows: DailyAcademyAttendanceRow[],
    reason = "출결 상태 초기화",
  ) => {
    const records = rows.map((row) => ({
      lessonEventId: row.lessonEventId,
      studentId: row.studentId,
    }));

    if (records.length === 0) {
      return;
    }

    const applyReset = () => {
      setAcademySheetsOverride((current) =>
        resetAttendanceSheets(current ?? academySheets, academyId, records),
      );
    };

    if (!demoData && supabaseClientState?.client) {
      resetAcademyAttendanceMutation.mutate(
        { academyId, records, reason },
        { onSuccess: applyReset },
      );
      return;
    }

    applyReset();
  };

  const moveAcademyLessonRow = (draft: MoveLessonDraft) => {
    const movedRow = toMovedAcademyAttendanceRow(draft);
    const applyMove = (row: DailyAcademyAttendanceRow) => {
      setAcademySheetsOverride((current) =>
        appendAcademyAttendanceRow(
          removeAcademyAttendanceRow(
            current ?? academySheets,
            academyId,
            draft.row.lessonEventId,
          ),
          academyId,
          row,
        ),
      );
      updateSelectedDate(row.date, {
        selectedMonth,
        setSelectedDate,
        resetOverrides: () => undefined,
      });
      setMoveLessonDraft(null);
    };

    if (!demoData && supabaseClientState?.client) {
      moveAcademyLessonMutation.mutate(
        {
          academyId,
          lessonEventId: draft.row.lessonEventId,
          targetDate: draft.targetDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
          reason: draft.reason,
        },
        { onSuccess: applyMove },
      );
      return;
    }

    applyMove(movedRow);
    toast.success("학원 일정을 이동했습니다.");
  };

  const academyHeaderActions = useMemo(
    () => (
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
          미등원인원
        </Button>
      </>
    ),
    [setAbsentOpen, setAcademyEventOpen],
  );
  const privateHeaderActions = useMemo(
    () => (
      <>
        <PrivateLessonRegistrationScreen
          academyId={academyId}
          academyName={academyName}
          displayMode="button"
          registrationOptionsQueryFactory={registrationOptionsQueryFactory}
          ticketBalances={initialWorkspaceData.ticketBalances}
          registerPrivateLesson={
            demoData || onRegisterPrivateLesson
              ? async (input) => {
                  if (onRegisterPrivateLesson) {
                    await onRegisterPrivateLesson(input);
                  }
                  return toRegisteredPrivateLesson(input);
                }
              : undefined
          }
          onRegistered={(lesson) => {
            setPrivateLessonsOverride((current) => [
              ...(current ?? privateLessons),
              lesson,
            ]);
          }}
        />
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
      academyId,
      academyName,
      demoData,
      initialWorkspaceData.ticketBalances,
      onRegisterPrivateLesson,
      privateLessons,
      registrationOptionsQueryFactory,
      setPrivateLessonsOverride,
      setPrivateStudentSearchOpen,
      setScheduleOpen,
    ],
  );
  const lessonHeaderActions =
    lessonKind === "academy" ? academyHeaderActions : privateHeaderActions;
  const isHeaderActionMounted = usePageHeaderActions(lessonHeaderActions);

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
      {!isHeaderActionMounted ? (
        <LessonToolbar
          ariaLabel={lessonKind === "academy" ? "학원레슨 도구" : "개인레슨 도구"}
          actions={lessonHeaderActions}
        />
      ) : null}

      {lessonKind === "academy" ? (
        <div className="grid min-w-0 gap-4">
          <LessonViewTabs
            labelPrefix="학원레슨"
            value={academyView}
            onValueChange={setAcademyView}
          />
          {academyView === "calendar" ? (
            <LessonMonthCalendar
              ariaLabel={toCalendarAriaLabel(selectedDate, "학원레슨 캘린더")}
              selectedDate={selectedDate}
              events={academyEvents}
              memoCounts={academyMemoCounts}
              variant="academy"
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
        <div className="grid min-w-0 gap-4">
          <LessonViewTabs
            labelPrefix="개인레슨"
            value={privateView}
            onValueChange={setPrivateView}
          />
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

      <AbsentDialog
        open={absentOpen}
        month={selectedMonth}
        rows={unresolvedAbsences}
        onOpenChange={setAbsentOpen}
        onMarkPresent={(row) => markAcademyAttendanceRows([row], "present")}
        onOpenMakeup={(row) =>
          setMakeupDraft({
            lessonEventId: row.lessonEventId,
            studentId: row.studentId,
            studentName: row.studentName,
            startTime: row.startTime,
            endTime: row.endTime,
            targetDate: selectedDate,
            reason: "",
          })
        }
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
              originLabel: formatOriginLabel(input.origin),
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
        onOpenChange={setAcademyDayOpen}
        onCreateMemo={(input) => createCalendarMemo(input)}
        onUpdateMemo={(input) => updateCalendarMemo(input)}
        onDeleteMemo={deleteCalendarMemo}
        onMark={(row, status) => markAcademyAttendanceRows([row], status, "결석 확인")}
        onMarkMany={markAcademyAttendanceRows}
        onReset={resetAcademyAttendanceRows}
        onMove={(row) =>
          setMoveLessonDraft({
            row,
            targetDate: row.date,
            startTime: row.startTime,
            endTime: row.endTime,
            reason: "",
          })
        }
      />

      <MoveAcademyLessonDialog
        draft={moveLessonDraft}
        onChange={setMoveLessonDraft}
        onClose={() => setMoveLessonDraft(null)}
        onConfirm={moveAcademyLessonRow}
      />

      <PrivateDayAttendanceDialog
        open={privateDayOpen}
        academyId={academyId}
        date={selectedDate}
        lessons={selectedPrivateLessons}
        memos={selectedPrivateMemos}
        memoTargets={selectedPrivateMemoTargets}
        onOpenChange={setPrivateDayOpen}
        onCreateMemo={(input) => createCalendarMemo(input)}
        onUpdateMemo={(input) => updateCalendarMemo(input)}
        onDeleteMemo={deleteCalendarMemo}
        onMark={(lesson, status) => {
          const markedAt = new Date().toISOString();
          if (onMarkPrivateLessonAttendance) {
            onMarkPrivateLessonAttendance(lesson.id, status);
            setPrivateLessonsOverride((current) =>
              (current ?? privateLessons).map((candidate) =>
                candidate.id === lesson.id
                  ? {
                      ...candidate,
                      status,
                    }
                  : candidate,
              ),
            );
            toast.success(describePrivateAttendanceChange(lesson.status, status));
          } else if (supabaseClientState?.client) {
            savePrivateAttendanceMutation.mutate(
              {
                academyId,
                lessonEventId: lesson.id,
                studentId: lesson.studentId,
                instrumentId: lesson.instrumentId,
                instrumentName: lesson.instrumentName,
                status,
                markedAt,
              },
              {
                onSuccess: () =>
                  toast.success(describePrivateAttendanceChange(lesson.status, status)),
              },
            );
          }
        }}
      />

      <MakeupDialog
        draft={makeupDraft}
        onChange={setMakeupDraft}
        onClose={() => setMakeupDraft(null)}
        onConfirm={(draft) => {
          if (!demoData && supabaseClientState?.client) {
            createMakeupEventMutation.mutate({
              academyId,
              sourceLessonEventId: draft.lessonEventId,
              studentId: draft.studentId,
              targetDate: draft.targetDate,
              startTime: draft.startTime,
              endTime: draft.endTime,
              reason: draft.reason,
            }, {
              onSuccess: () => {
                setResolvedAbsenceIds((current) =>
                  new Set(current).add(draft.lessonEventId),
                );
                setMakeupDraft(null);
                setAbsentOpen(false);
                toast.success("보강 일정을 저장했습니다.");
              },
            });
            return;
          }

          setResolvedAbsenceIds((current) => new Set(current).add(draft.lessonEventId));
          setAcademySheetsOverride((current) =>
            appendAcademyAttendanceRow(
              current ?? academySheets,
              academyId,
              toMakeupAttendanceRow({
                academyId,
                draft,
                sourceRows: selectedAcademyEvents,
              }),
            ),
          );
          setMakeupDraft(null);
          setAbsentOpen(false);
          toast.success("보강 일정을 저장했습니다.");
        }}
      />

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

function AcademyLessonEventDialog({
  open,
  academyId,
  selectedDate,
  options,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  academyId: string;
  selectedDate: string;
  options: PrivateLessonRegistrationOptions;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateAcademyLessonEventInput) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [origin, setOrigin] = useState<"manual" | "special">("manual");
  const [startAt, setStartAt] = useState(`${selectedDate}T15:00`);
  const [endAt, setEndAt] = useState(`${selectedDate}T15:50`);
  const [reason, setReason] = useState("");
  const selectedStudent = options.students.find(
    (student) => student.studentId === studentId,
  );
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const selectedTeacher = options.teachers.find(
    (teacher) => teacher.teacherId === teacherId,
  );
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    Boolean(selectedTeacher) &&
    Boolean(startAt) &&
    Boolean(endAt) &&
    reason.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setStartAt(`${selectedDate}T15:00`);
          setEndAt(`${selectedDate}T15:50`);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>학원 일정 추가</DialogTitle>
          <DialogDescription>
            정기 일정과 별도로 캘린더에 표시할 학원 레슨을 등록합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();

            if (!selectedStudent || !selectedInstrument || !selectedTeacher) {
              return;
            }

            onSave({
              academyId,
              studentId: selectedStudent.studentId,
              studentName: selectedStudent.studentName,
              studentInstrumentId: selectedInstrument.studentInstrumentId,
              instrumentId: selectedInstrument.instrumentId,
              instrumentName: selectedInstrument.instrumentName,
              teacherId: selectedTeacher.teacherId,
              teacherName: selectedTeacher.teacherName,
              startAt: toSeoulIsoOffset(startAt),
              endAt: toSeoulIsoOffset(endAt),
              origin,
              reason,
            });
          }}
        >
          <Label className="grid gap-1">
            <span>원생</span>
            <NativeSelect
              aria-label="원생"
              value={studentId}
              onChange={(event) => {
                const nextStudentId = event.target.value;
                const nextStudent = options.students.find(
                  (student) => student.studentId === nextStudentId,
                );

                setStudentId(nextStudentId);
                setInstrumentId(nextStudent?.instruments[0]?.instrumentId ?? "");
              }}
            >
              <NativeSelectOption value="">원생 선택</NativeSelectOption>
              {options.students.map((student) => (
                <NativeSelectOption key={student.studentId} value={student.studentId}>
                  {student.studentName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>악기</span>
            <NativeSelect
              aria-label="악기"
              value={instrumentId}
              disabled={!selectedStudent}
              onChange={(event) => setInstrumentId(event.target.value)}
            >
              <NativeSelectOption value="">악기 선택</NativeSelectOption>
              {(selectedStudent?.instruments ?? []).map((instrument) => (
                <NativeSelectOption
                  key={instrument.instrumentId}
                  value={instrument.instrumentId}
                >
                  {instrument.instrumentName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>선생님</span>
            <NativeSelect
              aria-label="선생님"
              value={teacherId}
              disabled={!selectedInstrument}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <NativeSelectOption value="">선생님 선택</NativeSelectOption>
              {options.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}
                  {teacher.part ? ` / ${teacher.part}` : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1">
            <span>일정 유형</span>
            <NativeSelect
              aria-label="일정 유형"
              value={origin}
              onChange={(event) =>
                setOrigin(event.target.value === "special" ? "special" : "manual")
              }
            >
              <NativeSelectOption value="manual">비정기</NativeSelectOption>
              <NativeSelectOption value="special">특강</NativeSelectOption>
            </NativeSelect>
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="grid gap-1">
              <span>시작 시간</span>
              <DateTimeField
                aria-label="시작 시간"
                value={startAt}
                onValueChange={setStartAt}
              />
            </Label>
            <Label className="grid gap-1">
              <span>종료 시간</span>
              <DateTimeField
                aria-label="종료 시간"
                value={endAt}
                onValueChange={setEndAt}
              />
            </Label>
          </div>
          <Label className="grid gap-1">
            <span>추가 사유</span>
            <Textarea
              aria-label="추가 사유"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </Label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              저장
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LessonToolbar({
  ariaLabel,
  actions,
}: {
  ariaLabel: string;
  actions: ReactNode;
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        {actions}
      </div>
    </div>
  );
}

function LessonViewTabs({
  labelPrefix,
  value,
  onValueChange,
}: {
  labelPrefix: string;
  value: LessonView;
  onValueChange: (value: LessonView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onValueChange(toLessonView(nextValue))}
      className="gap-3"
    >
      <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
        <TabsTrigger value="calendar">
          <CalendarDays aria-hidden="true" />
          {labelPrefix} 캘린더뷰
        </TabsTrigger>
        <TabsTrigger value="table">
          <Table2 aria-hidden="true" />
          {labelPrefix} 테이블뷰
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function LessonMonthControl({
  variantLabel,
  selectedMonth,
  onChangeMonth,
}: {
  variantLabel: string;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${variantLabel} 이전 달`}
          onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Label className="sr-only" htmlFor={`${toControlId(variantLabel)}-month`}>
          {variantLabel} 월 선택
        </Label>
        <MonthField
          id={`${toControlId(variantLabel)}-month`}
          aria-label={`${variantLabel} 월 선택`}
          required
          value={selectedMonth}
          onValueChange={onChangeMonth}
          className="w-40"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`${variantLabel} 다음 달`}
          onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {formatMonthLabel(selectedMonth)}
      </p>
    </div>
  );
}

function LessonMonthCalendar({
  ariaLabel,
  selectedDate,
  events,
  memoCounts,
  variant,
  onChangeMonth,
  onSelectDate,
}: {
  ariaLabel: string;
  selectedDate: string;
  events: CalendarEvent[];
  memoCounts: Map<string, number>;
  variant: "academy" | "private";
  onChangeMonth: (month: string) => void;
  onSelectDate: (date: string) => void;
}) {
  const calendarDates = buildCalendarDates(selectedDate);
  const selectedMonth = selectedDate.slice(0, 7);
  const today = getTodayDate();
  const variantLabel = variant === "academy" ? "학원 레슨 캘린더" : "개인레슨 캘린더";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3">
        <LessonMonthControl
          variantLabel={variantLabel}
          selectedMonth={selectedMonth}
          onChangeMonth={onChangeMonth}
        />
      </div>
      <div className="mb-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        role="grid"
        aria-label={ariaLabel}
        className="grid grid-cols-7 gap-1 sm:gap-2"
      >
        {calendarDates.map((date) => {
          const dayEvents = events.filter((event) => event.date === date);
          const isSelected = date === selectedDate;
          const memoCount = memoCounts.get(date) ?? 0;
          const isCurrentMonth = date.startsWith(selectedMonth);
          const isToday = date === today;

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-current={isToday ? "date" : undefined}
              aria-selected={isSelected}
              className={`flex min-h-20 min-w-0 flex-col gap-1 rounded-md border bg-background p-1 text-left transition-colors hover:bg-accent/40 aria-selected:border-primary aria-selected:ring-2 aria-selected:ring-ring/25 sm:min-h-32 sm:p-2 ${isCurrentMonth ? "" : "opacity-45"} ${isToday ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"}`}
              onClick={() => onSelectDate(date)}
            >
              <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                <span>{Number(date.slice(-2))}</span>
                {isToday ? (
                  <span className="rounded-sm bg-primary px-1 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    오늘
                  </span>
                ) : null}
              </span>
              {memoCount > 0 ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-muted px-1 py-0.5 text-xs font-medium text-muted-foreground">
                  <FileText aria-hidden="true" className="size-3" />
                  메모 {memoCount}
                </span>
              ) : null}
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  className={`min-w-0 rounded-sm px-1 py-1 text-xs font-medium leading-4 sm:px-2 ${getEventTone(event.status, variant)}`}
                >
                  <span className="block truncate sm:hidden">
                    {event.title.slice(0, 2)}
                  </span>
                  <span className="hidden truncate sm:block">{event.title}</span>
                  <span className="hidden truncate font-normal opacity-80 sm:block">
                    {event.originLabel ? `[${event.originLabel}] ` : ""}
                    {event.startTime} {event.subtitle}
                  </span>
                </span>
              ))}
              {dayEvents.length > 3 ? (
                <span className="text-xs text-muted-foreground">
                  +{dayEvents.length - 3}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LessonMemoTabPanel({
  academyId,
  lessonKind,
  date,
  memos,
  targets,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
}: {
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  memos: LessonCalendarMemo[];
  targets: LessonMemoTargetOptions;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LessonMemoDraft>(() =>
    createEmptyMemoDraft(),
  );
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoToDelete, setMemoToDelete] = useState<LessonCalendarMemo | null>(null);
  const [isDeletingMemo, setIsDeletingMemo] = useState(false);
  const editingMemo = memos.find((memo) => memo.id === editingMemoId) ?? null;
  const canSubmit = canSubmitLessonMemo(draft, targets);
  const submitLabel = editingMemo ? "메모 수정 저장" : "메모 등록";

  const confirmDeleteMemo = async () => {
    if (!memoToDelete || isDeletingMemo) {
      return;
    }

    setIsDeletingMemo(true);
    try {
      await onDeleteMemo(memoToDelete.id);
    } catch {
      // 실패 안내는 삭제를 요청한 쪽에서 이미 보여 준다. 확인 창을 열어 둬서 다시 시도할 수 있게 한다.
      return;
    } finally {
      setIsDeletingMemo(false);
    }

    if (editingMemoId === memoToDelete.id) {
      setDraft(createEmptyMemoDraft());
      setEditingMemoId(null);
    }
    setMemoToDelete(null);
  };

  const submitMemo = () => {
    const resolvedTarget = resolveLessonMemoTarget(draft, targets);

    if (!resolvedTarget || !canSubmit) {
      return;
    }

    if (editingMemo) {
      onUpdateMemo({
        academyId,
        memoId: editingMemo.id,
        content: draft.content.trim(),
        ...resolvedTarget,
      });
    } else {
      onCreateMemo({
        academyId,
        lessonKind,
        date,
        content: draft.content.trim(),
        ...resolvedTarget,
      });
    }

    setDraft(createEmptyMemoDraft());
    setEditingMemoId(null);
  };

  return (
    <div className="grid gap-3">
      <form
        className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submitMemo();
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Label className="grid gap-1 text-sm font-medium">
            <span>관련 원생</span>
            <NativeSelect
              aria-label="관련 원생"
              value={draft.studentId}
              onChange={(event) =>
                setDraft((current) =>
                  ({
                    ...current,
                    studentId: event.target.value,
                  }),
                )
              }
            >
              <NativeSelectOption value="">선택 안 함</NativeSelectOption>
              {targets.students.map((student) => (
                <NativeSelectOption key={student.id} value={student.id}>
                  {student.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-medium">
            <span>관련 선생님</span>
            <NativeSelect
              aria-label="관련 선생님"
              value={draft.teacherId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  teacherId: event.target.value,
                }))
              }
            >
              <NativeSelectOption value="">선택 안 함</NativeSelectOption>
              {targets.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
        </div>
        <Label className="grid gap-2 text-sm font-medium">
          <span>메모 내용</span>
          <Textarea
            aria-label="메모 내용"
            className="min-h-28"
            value={draft.content}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
          />
        </Label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSubmit}>
            <FileText aria-hidden="true" />
            {submitLabel}
          </Button>
          {editingMemo ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(createEmptyMemoDraft());
                setEditingMemoId(null);
              }}
            >
              수정 취소
            </Button>
          ) : null}
        </div>
      </form>

      <div className="grid gap-2">
        {memos.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            선택한 날짜에 작성된 메모가 없습니다.
          </p>
        ) : null}
        {memos.map((memo) => (
          <article
            key={memo.id}
            className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap gap-1">
                {toLessonMemoTargetBadges(memo).map((label) => (
                  <Badge key={label} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
              <p className="whitespace-pre-wrap text-sm">{memo.content}</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${memo.content} 메모 수정`}
                onClick={() => {
                  setDraft(toLessonMemoDraft(memo));
                  setEditingMemoId(memo.id);
                }}
              >
                수정
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`${memo.content} 메모 삭제`}
                onClick={() => setMemoToDelete(memo)}
              >
                삭제
              </Button>
            </div>
          </article>
        ))}
      </div>
      <AlertDialog
        open={Boolean(memoToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeletingMemo) {
            setMemoToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 메모를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제한 메모는 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="line-clamp-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {memoToDelete?.content}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingMemo}>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingMemo}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteMemo();
              }}
            >
              {isDeletingMemo ? "삭제 중" : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AcademyLessonTableView({
  selectedDate,
  rows,
  onChangeDate,
  onOpenDay,
}: {
  selectedDate: string;
  rows: DailyAcademyAttendanceRow[];
  onChangeDate: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">일별 학원 레슨</p>
          <h3 className="text-base font-semibold">{selectedDate}</h3>
        </div>
        <Label className="grid gap-1 text-sm font-medium sm:min-w-48">
          <span>테이블 날짜</span>
          <DateField
            aria-label="학원 레슨 테이블 날짜 선택"
            required
            value={selectedDate}
            onValueChange={onChangeDate}
          />
        </Label>
      </div>
      <Table
        aria-label={`${selectedDate} 학원 레슨 테이블`}
        className="min-w-[54rem]"
      >
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">시간</TableHead>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">선생님</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
            <TableHead className="px-4 py-3 text-right">처리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                선택한 날짜에 등록된 학원 레슨이 없습니다.
              </TableCell>
            </TableRow>
          ) : null}
          {rows.map((row) => (
            <TableRow key={row.lessonEventId} data-state="selected">
              <TableCell className="px-4 py-3">
                {row.startTime}-{row.endTime}
              </TableCell>
              <TableCell className="px-4 py-3 font-medium">
                {row.studentName}
              </TableCell>
              <TableCell className="px-4 py-3">{row.instrumentName}</TableCell>
              <TableCell className="px-4 py-3">{row.teacherName ?? "-"}</TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  <OriginBadge label={row.originLabel} />
                  <AttendanceBadge status={row.status} />
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`${row.studentName} 출석 확인 열기`}
                  onClick={() => onOpenDay(row.date)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  출석 확인
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PrivateLessonTableView({
  selectedMonth,
  selectedDate,
  lessons,
  onChangeMonth,
  onOpenDay,
}: {
  selectedMonth: string;
  selectedDate: string;
  lessons: PrivateLesson[];
  onChangeMonth: (month: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const monthLessons = lessons.filter((lesson) =>
    toSeoulDate(lesson.startAt).startsWith(selectedMonth),
  );
  const view = paginateItems(monthLessons, { page, pageSize });
  const changeMonth = (month: string) => {
    resetPage();
    onChangeMonth(month);
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid gap-3 p-3">
        <LessonMonthControl
          variantLabel="개인레슨 테이블"
          selectedMonth={selectedMonth}
          onChangeMonth={changeMonth}
        />
        <Table
          aria-label={`${formatMonthLabel(selectedMonth)} 개인레슨 테이블`}
          className="min-w-[54rem]"
        >
          <TableHeader className="bg-muted text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">날짜</TableHead>
              <TableHead className="px-4 py-3">시간</TableHead>
              <TableHead className="px-4 py-3">원생</TableHead>
              <TableHead className="px-4 py-3">악기</TableHead>
              <TableHead className="px-4 py-3">선생님</TableHead>
              <TableHead className="px-4 py-3">상태</TableHead>
              <TableHead className="px-4 py-3 text-right">처리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  해당 월에 등록된 개인레슨이 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
            {view.items.map((lesson) => {
              const date = toSeoulDate(lesson.startAt);

              return (
                <TableRow
                  key={lesson.id}
                  data-state={date === selectedDate ? "selected" : undefined}
                >
                  <TableCell className="px-4 py-3">{date}</TableCell>
                  <TableCell className="px-4 py-3">
                    {toSeoulHourMinute(lesson.startAt)}-
                    {toSeoulHourMinute(lesson.endAt)}
                  </TableCell>
                  <TableCell className="px-4 py-3 font-medium">
                    {lesson.studentName}
                  </TableCell>
                  <TableCell className="px-4 py-3">{lesson.instrumentName}</TableCell>
                  <TableCell className="px-4 py-3">{lesson.teacherName}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge
                      variant={lesson.status === "present" ? "default" : "outline"}
                    >
                      {formatPrivateLessonStatus(lesson.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${lesson.studentName} 개인레슨 출석 확인 열기`}
                      onClick={() => onOpenDay(date)}
                    >
                      <ClipboardCheck aria-hidden="true" />
                      출석 확인
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        itemLabel="개인레슨"
        countUnit="건"
        view={view}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
      />
    </div>
  );
}

function AcademyDayAttendanceDialog({
  open,
  academyId,
  date,
  rows,
  memos,
  memoTargets,
  onOpenChange,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onMark,
  onMarkMany,
  onReset,
  onMove,
}: {
  open: boolean;
  academyId: string;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  onOpenChange: (open: boolean) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  onMark: (
    row: DailyAcademyAttendanceRow,
    status: "present" | "absent",
  ) => void;
  onMarkMany: (
    rows: DailyAcademyAttendanceRow[],
    status: "present" | "absent",
    reason?: string,
  ) => void;
  onReset: (rows: DailyAcademyAttendanceRow[], reason?: string) => void;
  onMove: (row: DailyAcademyAttendanceRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "present" | "absent"
  >("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkAbsenceReason, setBulkAbsenceReason] = useState("");
  const filteredRows = rows.filter((row) => {
    const query = search.trim().toLocaleLowerCase("ko-KR");
    const matchesSearch =
      query.length === 0 ||
      [row.studentName, row.instrumentName, row.teacherName ?? ""].some((value) =>
        value.toLocaleLowerCase("ko-KR").includes(query),
      );
    const matchesStatus =
      statusFilter === "all" ? true : row.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
  const selectedRows = rows.filter((row) => selectedIds.has(row.lessonEventId));
  const allVisibleSelected =
    filteredRows.length > 0 &&
    filteredRows.every((row) => selectedIds.has(row.lessonEventId));
  const toggleRow = (lessonEventId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(lessonEventId)) {
        next.delete(lessonEventId);
      } else {
        next.add(lessonEventId);
      }

      return next;
    });
  };
  const toggleVisibleRows = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        for (const row of filteredRows) {
          next.delete(row.lessonEventId);
        }
      } else {
        for (const row of filteredRows) {
          next.add(row.lessonEventId);
        }
      }

      return next;
    });
  };
  const markSelected = (status: "present" | "absent") => {
    onMarkMany(selectedRows, status, bulkAbsenceReason);
    setSelectedIds(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{date} 출석 확인</DialogTitle>
          <DialogDescription>
            선택한 날짜의 학원 수업 출결, 일정 이동, 메모를 한 화면에서 정리합니다.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="attendance" className="gap-3">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="attendance">출석관리</TabsTrigger>
            <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance" className="grid gap-3 overflow-hidden">
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
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as "all" | "pending" | "present" | "absent",
                  )
                }
              >
                <NativeSelectOption value="all">전체</NativeSelectOption>
                <NativeSelectOption value="pending">대기</NativeSelectOption>
                <NativeSelectOption value="present">출석</NativeSelectOption>
                <NativeSelectOption value="absent">결석</NativeSelectOption>
              </NativeSelect>
            </Label>
          </div>
          <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 lg:flex-row lg:items-end lg:justify-between">
            <Label className="grid gap-1 text-sm font-medium lg:min-w-72">
              <span>일괄 결석 사유</span>
              <Input
                aria-label="일괄 결석 사유"
                value={bulkAbsenceReason}
                onChange={(event) => setBulkAbsenceReason(event.target.value)}
                placeholder="비워두면 일괄 결석 처리"
              />
            </Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onMarkMany(filteredRows, "present")}
                disabled={filteredRows.length === 0}
              >
                <Check aria-hidden="true" />
                현재 목록 {filteredRows.length}건 출석
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onMarkMany(filteredRows, "absent", bulkAbsenceReason)}
                disabled={filteredRows.length === 0}
              >
                <X aria-hidden="true" />
                현재 목록 {filteredRows.length}건 결석
              </Button>
              <Button
                type="button"
                onClick={() => markSelected("present")}
                disabled={selectedRows.length === 0}
              >
                <Check aria-hidden="true" />
                선택출석
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => markSelected("absent")}
                disabled={selectedRows.length === 0}
              >
                <X aria-hidden="true" />
                선택결석
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onReset(selectedRows);
                  setSelectedIds(new Set());
                }}
                disabled={selectedRows.length === 0}
              >
                <RotateCcw aria-hidden="true" />
                선택 초기화
              </Button>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
            <Table aria-label={`${date} 출석 확인 목록`} className="min-w-[68rem]">
              <TableHeader className="sticky top-0 bg-muted text-muted-foreground">
                <TableRow>
                  <TableHead className="w-12 px-3 py-3">
                    <Checkbox
                      aria-label="현재 목록 전체 선택"
                      checked={allVisibleSelected}
                      onCheckedChange={toggleVisibleRows}
                    />
                  </TableHead>
                  <TableHead className="px-4 py-3">원생</TableHead>
                  <TableHead className="px-4 py-3">시간</TableHead>
                  <TableHead className="px-4 py-3">수업</TableHead>
                  <TableHead className="px-4 py-3">상태</TableHead>
                  <TableHead className="px-4 py-3 text-right">처리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.lessonEventId}>
                    <TableCell className="px-3 py-3">
                      <Checkbox
                        aria-label={`${row.studentName} 선택`}
                        checked={selectedIds.has(row.lessonEventId)}
                        onCheckedChange={() => toggleRow(row.lessonEventId)}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <strong className="text-sm">{row.studentName}</strong>
                        <span className="text-xs text-muted-foreground">
                          {row.teacherName ?? "선생님 없음"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {row.startTime}-{row.endTime}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <OriginBadge label={row.originLabel} />
                        <Badge variant="secondary">{row.instrumentName}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <AttendanceBadge status={row.status} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 일정 이동`}
                          onClick={() => onMove(row)}
                        >
                          <MoveRight aria-hidden="true" />
                          일정 이동
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 출결 초기화`}
                          onClick={() => onReset([row])}
                        >
                          <RotateCcw aria-hidden="true" />
                          초기화
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          aria-label={`${row.studentName} 출석`}
                          onClick={() => onMark(row, "present")}
                        >
                          <Check aria-hidden="true" />
                          출석
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${row.studentName} 결석`}
                          onClick={() => onMark(row, "absent")}
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
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              선택한 날짜에 예정된 학원 레슨이 없습니다.
            </p>
          ) : null}
          {rows.length > 0 && filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              검색 조건에 맞는 원생이 없습니다.
            </p>
          ) : null}
          </TabsContent>
          <TabsContent value="memos">
            <LessonMemoTabPanel
              academyId={academyId}
              lessonKind="academy"
              date={date}
              memos={memos}
              targets={memoTargets}
              onCreateMemo={onCreateMemo}
              onUpdateMemo={onUpdateMemo}
              onDeleteMemo={onDeleteMemo}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveAcademyLessonDialog({
  draft,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: MoveLessonDraft | null;
  onChange: (draft: MoveLessonDraft | null) => void;
  onClose: () => void;
  onConfirm: (draft: MoveLessonDraft) => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft?.row.studentName ?? "원생"} 일정 이동</DialogTitle>
          <DialogDescription>
            정기 스케줄은 유지하고 선택한 이번 일정만 다른 날짜와 시간으로 옮깁니다.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{draft.row.studentName}</p>
              <p className="mt-1 text-muted-foreground">
                기존 {draft.row.date} {draft.row.startTime}-{draft.row.endTime} ·{" "}
                {draft.row.instrumentName}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Label className="grid gap-1 text-sm font-medium">
                <span>이동 날짜</span>
                <DateField
                  aria-label="이동 날짜"
                  value={draft.targetDate}
                  onValueChange={(nextValue) =>
                    onChange({ ...draft, targetDate: nextValue })
                  }
                />
              </Label>
              <Label className="grid gap-1 text-sm font-medium">
                <span>시작 시간</span>
                <TimeField
                  aria-label="시작 시간"
                  value={draft.startTime}
                  onValueChange={(nextValue) =>
                    onChange({ ...draft, startTime: nextValue })
                  }
                />
              </Label>
              <Label className="grid gap-1 text-sm font-medium">
                <span>종료 시간</span>
                <TimeField
                  aria-label="종료 시간"
                  value={draft.endTime}
                  onValueChange={(nextValue) =>
                    onChange({ ...draft, endTime: nextValue })
                  }
                />
              </Label>
            </div>
            <Label className="grid gap-1 text-sm font-medium">
              <span>이동 사유</span>
              <Textarea
                value={draft.reason}
                onChange={(event) => onChange({ ...draft, reason: event.target.value })}
                placeholder="예: 콩쿠르 보충"
              />
            </Label>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            disabled={
              !draft ||
              !draft.targetDate ||
              !draft.startTime ||
              !draft.endTime ||
              draft.endTime <= draft.startTime
            }
            onClick={() => draft && onConfirm(draft)}
          >
            이동 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrivateDayAttendanceDialog({
  open,
  academyId,
  date,
  lessons,
  memos,
  memoTargets,
  onOpenChange,
  onCreateMemo,
  onUpdateMemo,
  onDeleteMemo,
  onMark,
}: {
  open: boolean;
  academyId: string;
  date: string;
  lessons: PrivateLesson[];
  memos: LessonCalendarMemo[];
  memoTargets: LessonMemoTargetOptions;
  onOpenChange: (open: boolean) => void;
  onCreateMemo: (input: LessonCalendarMemoPayload) => void;
  onUpdateMemo: (input: UpdateLessonCalendarMemoInput) => void;
  onDeleteMemo: (memoId: string) => Promise<void>;
  onMark: (lesson: PrivateLesson, status: "present" | "absent") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{date} 개인레슨 출석 확인</DialogTitle>
          <DialogDescription>
            출석 처리 시 원생의 동일 악기 회차권을 1회 차감합니다.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="attendance" className="gap-3">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
            <TabsTrigger value="attendance">출석관리</TabsTrigger>
            <TabsTrigger value="memos">메모 {memos.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance" className="grid gap-2">
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                선택한 날짜에 개인레슨이 없습니다.
              </p>
            ) : null}
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm">{lesson.studentName}</strong>
                    <OriginBadge label={lesson.originLabel} />
                    <Badge
                      variant={lesson.status === "present" ? "default" : "outline"}
                    >
                      {formatPrivateLessonStatus(lesson.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {toSeoulHourMinute(lesson.startAt)}-
                    {toSeoulHourMinute(lesson.endAt)} · {lesson.instrumentName} ·{" "}
                    {lesson.teacherName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    aria-label={`${lesson.studentName} 개인레슨 출석`}
                    disabled={lesson.status === "present"}
                    onClick={() => onMark(lesson, "present")}
                  >
                    <Check aria-hidden="true" />
                    출석
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`${lesson.studentName} 개인레슨 결석`}
                    disabled={lesson.status === "absent"}
                    onClick={() => onMark(lesson, "absent")}
                  >
                    <X aria-hidden="true" />
                    결석
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="memos">
            <LessonMemoTabPanel
              academyId={academyId}
              lessonKind="private"
              date={date}
              memos={memos}
              targets={memoTargets}
              onCreateMemo={onCreateMemo}
              onUpdateMemo={onUpdateMemo}
              onDeleteMemo={onDeleteMemo}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AbsentDialog({
  open,
  month,
  rows,
  onOpenChange,
  onMarkPresent,
  onOpenMakeup,
}: {
  open: boolean;
  month: string;
  rows: DailyAcademyAttendanceRow[];
  onOpenChange: (open: boolean) => void;
  onMarkPresent: (row: DailyAcademyAttendanceRow) => void;
  onOpenMakeup: (row: DailyAcademyAttendanceRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{formatMonthLabel(month)} 미등원 인원</DialogTitle>
          <DialogDescription>
            선택한 달 전체의 결석 원생을 날짜별로 확인하고 보강 또는 출석으로 정리합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">미등원 인원이 없습니다.</p>
          ) : null}
          {rows.map((row) => (
            <div
              key={row.lessonEventId}
              className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold">{row.studentName}</p>
                <p className="text-sm text-muted-foreground">
                  {row.date} · {row.startTime}-{row.endTime} ·{" "}
                  {row.absenceReason ?? "사유 없음"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`${row.studentName} 보강 입력`}
                  onClick={() => onOpenMakeup(row)}
                >
                  <ClipboardCheck aria-hidden="true" />
                  보강 입력
                </Button>
                <Button
                  type="button"
                  aria-label={`${row.studentName} 출석 처리`}
                  onClick={() => onMarkPresent(row)}
                >
                  <Check aria-hidden="true" />
                  출석 처리
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MakeupDialog({
  draft,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: MakeupDraft | null;
  onChange: (draft: MakeupDraft | null) => void;
  onClose: () => void;
  onConfirm: (draft: MakeupDraft) => void;
}) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>보강 입력</DialogTitle>
          <DialogDescription>{draft?.studentName ?? ""}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm font-medium">
              <span>보강일</span>
              <DateField
                aria-label="보강일"
                value={draft.targetDate}
                onValueChange={(nextValue) =>
                  onChange({ ...draft, targetDate: nextValue })
                }
              />
            </Label>
            <Label className="grid gap-1 text-sm font-medium">
              <span>보강 사유</span>
              <Textarea
                aria-label="보강 사유"
                value={draft.reason}
                onChange={(event) =>
                  onChange({ ...draft, reason: event.target.value })
                }
              />
            </Label>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            disabled={!draft?.targetDate || !draft.reason.trim()}
            onClick={() => (draft ? onConfirm(draft) : undefined)}
          >
            보강 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  lessons,
  registrationOptions,
  selectedDate,
  onOpenChange,
}: {
  open: boolean;
  lessons: PrivateLesson[];
  registrationOptions: PrivateLessonRegistrationOptions;
  selectedDate: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [teacherId, setTeacherId] = useState(
    registrationOptions.teachers[0]?.teacherId ?? "",
  );
  const monthPrefix = selectedDate.slice(0, 7);
  const teacherLessons = lessons
    .filter(
      (lesson) =>
        lesson.teacherId === teacherId && toSeoulDate(lesson.startAt).startsWith(monthPrefix),
    )
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  const scheduleText =
    teacherLessons.length === 0
      ? "해당 월에 등록된 레슨이 없습니다."
      : teacherLessons
          .map((lesson) => {
            const date = toSeoulDate(lesson.startAt);
            return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ${lesson.studentName} ${toSeoulHourMinute(lesson.startAt)} ${lesson.instrumentName}`;
          })
          .join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>레슨시간표 보내기</DialogTitle>
          <DialogDescription>{monthPrefix}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1 text-sm font-medium">
            <span>선생님</span>
            <NativeSelect
              aria-label="선생님 선택"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              {registrationOptions.teachers.map((teacher) => (
                <NativeSelectOption key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm font-medium">
            <span>시간표 내용</span>
            <Textarea
              aria-label="시간표 내용"
              className="min-h-40 font-mono text-sm"
              readOnly
              value={scheduleText}
            />
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(scheduleText);
                toast.success("시간표를 복사했습니다. 메시지에 붙여넣어 보내세요.");
              } catch {
                toast.error("시간표를 복사하지 못했습니다.", {
                  description: "시간표 내용을 직접 선택해 복사해 주세요.",
                });
              }
            }}
          >
            <Clipboard aria-hidden="true" />
            복사
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrivateLessonStudentSearchDialog({
  open,
  results,
  onOpenChange,
}: {
  open: boolean;
  results: PrivateLessonStudentSearchResult[];
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const filteredResults = results.filter((result) =>
    search.trim()
      ? result.studentName
          .toLocaleLowerCase("ko-KR")
          .includes(search.trim().toLocaleLowerCase("ko-KR"))
      : true,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>레슨원생 검색</DialogTitle>
          <DialogDescription>
            개인레슨 원생의 회차권 잔여와 최근 레슨 상태를 확인합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1 text-sm font-medium">
            <span>검색</span>
            <Input
              aria-label="레슨원생 검색어"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="원생명"
            />
          </Label>
          <div className="grid max-h-[24rem] gap-2 overflow-y-auto pr-1">
            {filteredResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                조건에 맞는 개인레슨 원생이 없습니다.
              </p>
            ) : null}
            {filteredResults.map((result) => (
              <article
                key={result.studentId}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {result.studentName}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatRecentPrivateLesson(result.recentLesson)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.remainingTickets.length === 0 ? (
                      <Badge variant="secondary">회차권 없음</Badge>
                    ) : null}
                    {result.remainingTickets.map((ticket) => (
                      <Badge key={ticket.instrumentId} variant="outline">
                        {ticket.instrumentName} {ticket.remainingCount}회
                      </Badge>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AttendanceBadge({
  status,
}: {
  status: DailyAcademyAttendanceRow["status"];
}) {
  if (status === "present") {
    return <Badge>출석</Badge>;
  }

  if (status === "absent") {
    return <Badge variant="destructive">결석</Badge>;
  }

  return <Badge variant="secondary">대기</Badge>;
}

function OriginBadge({ label }: { label: string | undefined }) {
  if (!label) {
    return null;
  }

  return <Badge variant="outline">{label}</Badge>;
}

function indexSheets(sheets: DailyAcademyAttendanceSheet[]) {
  return Object.fromEntries(sheets.map((sheet) => [sheet.date, sheet]));
}

function updateAttendanceSheets(
  sheets: Record<string, DailyAcademyAttendanceSheet>,
  academyId: string,
  records: Array<{
    lessonEventId: string;
    studentId: string;
    status: "present" | "absent";
    reason?: string;
    markedAt: string;
  }>,
) {
  const next = { ...sheets };

  for (const record of records) {
    const sheet = Object.values(next).find((candidate) =>
      candidate.rows.some((row) => row.lessonEventId === record.lessonEventId),
    );

    if (!sheet) {
      continue;
    }

    const rows = sheet.rows.map((row) =>
      row.lessonEventId === record.lessonEventId
        ? {
            ...row,
            status: record.status,
            absenceReason:
              record.status === "absent" ? record.reason ?? "결석 확인" : undefined,
            markedAt: record.markedAt,
          }
        : row,
    );

    next[sheet.date] = toSheet(academyId, sheet.date, rows);
  }

  return next;
}

function resetAttendanceSheets(
  sheets: Record<string, DailyAcademyAttendanceSheet>,
  academyId: string,
  records: Array<{
    lessonEventId: string;
    studentId: string;
  }>,
) {
  const recordIds = new Set(records.map((record) => record.lessonEventId));
  const next = { ...sheets };

  for (const sheet of Object.values(next)) {
    if (!sheet.rows.some((row) => recordIds.has(row.lessonEventId))) {
      continue;
    }

    const rows = sheet.rows.map((row) =>
      recordIds.has(row.lessonEventId)
        ? {
            ...row,
            status: "pending" as const,
            absenceReason: undefined,
            markedAt: undefined,
          }
        : row,
    );

    next[sheet.date] = toSheet(academyId, sheet.date, rows);
  }

  return next;
}

function appendAcademyAttendanceRow(
  sheets: Record<string, DailyAcademyAttendanceSheet>,
  academyId: string,
  row: DailyAcademyAttendanceRow,
) {
  const existingSheet = sheets[row.date] ?? createEmptySheet(academyId, row.date);
  const rows = [...existingSheet.rows, row].sort(compareAcademyAttendanceRows);

  return {
    ...sheets,
    [row.date]: toSheet(academyId, row.date, rows),
  };
}

function removeAcademyAttendanceRow(
  sheets: Record<string, DailyAcademyAttendanceSheet>,
  academyId: string,
  lessonEventId: string,
) {
  const next = { ...sheets };

  for (const sheet of Object.values(next)) {
    if (!sheet.rows.some((row) => row.lessonEventId === lessonEventId)) {
      continue;
    }

    const rows = sheet.rows.filter((row) => row.lessonEventId !== lessonEventId);
    next[sheet.date] = toSheet(academyId, sheet.date, rows);
  }

  return next;
}

function toMovedAcademyAttendanceRow(
  draft: MoveLessonDraft,
): DailyAcademyAttendanceRow {
  return {
    ...draft.row,
    lessonEventId: `rescheduled-${draft.row.lessonEventId}-${draft.targetDate}-${draft.startTime}`,
    date: draft.targetDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    status: "pending",
    origin: "rescheduled",
    originLabel: formatOriginLabel("rescheduled"),
    absenceReason: undefined,
    markedAt: undefined,
  };
}

function toMakeupAttendanceRow({
  academyId,
  draft,
  sourceRows,
}: {
  academyId: string;
  draft: MakeupDraft;
  sourceRows: DailyAcademyAttendanceRow[];
}): DailyAcademyAttendanceRow {
  const sourceRow = sourceRows.find(
    (row) => row.lessonEventId === draft.lessonEventId,
  );

  return {
    academyId,
    lessonEventId: `makeup-${draft.lessonEventId}-${draft.targetDate}`,
    studentId: draft.studentId,
    studentName: draft.studentName,
    instrumentId: sourceRow?.instrumentId ?? "",
    instrumentName: sourceRow?.instrumentName ?? "",
    teacherId: sourceRow?.teacherId,
    teacherName: sourceRow?.teacherName,
    date: draft.targetDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    status: "pending",
    origin: "makeup",
    originLabel: "보강",
  };
}

function toSheet(
  academyId: string,
  date: string,
  rows: DailyAcademyAttendanceRow[],
): DailyAcademyAttendanceSheet {
  return {
    academyId,
    date,
    rows,
    absenceQueue: rows
      .filter((row) => row.status === "absent")
      .map((row) => ({
        academyId,
        lessonEventId: row.lessonEventId,
        studentId: row.studentId,
        studentName: row.studentName,
        instrumentId: row.instrumentId,
        instrumentName: row.instrumentName,
        originalDate: row.date,
        reason: row.absenceReason ?? "",
        markedAt: row.markedAt ?? "",
      })),
    summary: {
      total: rows.length,
      present: rows.filter((row) => row.status === "present").length,
      absent: rows.filter((row) => row.status === "absent").length,
      pending: rows.filter((row) => row.status === "pending").length,
    },
  };
}

function createEmptySheet(
  academyId: string,
  date: string,
): DailyAcademyAttendanceSheet {
  return toSheet(academyId, date, []);
}

function updateSelectedDate(
  nextDate: string,
  options: {
    selectedMonth: string;
    setSelectedDate: Dispatch<SetStateAction<string>>;
    resetOverrides: () => void;
  },
) {
  if (nextDate.slice(0, 7) !== options.selectedMonth) {
    options.resetOverrides();
  }

  options.setSelectedDate(nextDate);
}

function updateSelectedMonth(
  nextMonth: string,
  options: {
    selectedDate: string;
    setSelectedDate: Dispatch<SetStateAction<string>>;
    resetOverrides: () => void;
  },
) {
  if (!nextMonth) {
    return;
  }

  const selectedDay = Number(options.selectedDate.slice(8, 10));
  const nextDate = `${nextMonth}-${pad2(
    Math.min(selectedDay, getLastDayOfMonth(nextMonth)),
  )}`;

  if (nextMonth !== options.selectedDate.slice(0, 7)) {
    options.resetOverrides();
  }

  options.setSelectedDate(nextDate);
}

function createEmptyWorkspaceData(): LessonWorkspaceDemoData {
  return {
    academySheets: [],
    privateLessons: [],
    ticketBalances: [],
    registrationOptions: {
      students: [],
      teachers: [],
    },
    privateRegistrationOptions: {
      students: [],
      teachers: [],
    },
    calendarMemos: [],
    academyMemo: "",
    privateMemo: "",
  };
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

function toAcademyCalendarEvent(row: DailyAcademyAttendanceRow): CalendarEvent {
  return {
    id: row.lessonEventId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    title: row.studentName,
    subtitle: row.instrumentName,
    status: row.status,
    origin: row.origin,
    originLabel: row.originLabel,
  };
}

function toPrivateCalendarEvent(lesson: PrivateLesson): CalendarEvent {
  return {
    id: lesson.id,
    date: toSeoulDate(lesson.startAt),
    startTime: toSeoulHourMinute(lesson.startAt),
    endTime: toSeoulHourMinute(lesson.endAt),
    title: lesson.studentName,
    subtitle: lesson.teacherName,
    status:
      lesson.status === "present" || lesson.status === "absent"
        ? lesson.status
        : "scheduled",
    origin: lesson.origin,
    originLabel: lesson.originLabel,
  };
}

function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.title, right.title)
  );
}

function compareAcademyAttendanceRows(
  left: DailyAcademyAttendanceRow,
  right: DailyAcademyAttendanceRow,
) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    compareKoreanNames(left.studentName, right.studentName)
  );
}

function comparePrivateLessonsByTime(left: PrivateLesson, right: PrivateLesson) {
  return (
    left.startAt.localeCompare(right.startAt) ||
    compareKoreanNames(left.studentName, right.studentName) ||
    compareKoreanNames(left.id, right.id)
  );
}

/** 시간순처럼 이미 정해진 순서를 바꾸지 않고 현재 페이지만 자른다. 이름순 목록은 buildListView를 쓴다. */
function toRegisteredPrivateLesson(
  input: RegisterPrivateLessonEventInput,
): PrivateLesson {
  return {
    id: `private-lesson-${Date.now()}`,
    academyId: input.academyId,
    studentId: input.studentId,
    studentName: input.studentName,
    instrumentId: input.instrumentId,
    instrumentName: input.instrumentName,
    teacherId: input.teacherId,
    teacherName: input.teacherName,
    startAt: input.startAt,
    endAt: input.endAt,
    status: "scheduled",
    origin: "private",
    originLabel: "개인레슨",
  };
}

function buildCalendarDates(selectedDate: string) {
  const [year, month] = selectedDate.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const dates: string[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    dates.push(toDateInputValue(date));
  }

  return dates;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));

  return `${nextDate.getUTCFullYear()}-${pad2(nextDate.getUTCMonth() + 1)}`;
}

function getLastDayOfMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);

  return `${year}년 ${monthIndex}월`;
}

function getLessonMemosForDate(
  memos: LessonCalendarMemo[],
  lessonKind: LessonMemoKind,
  date: string,
) {
  return memos
    .filter(
      (memo) =>
        memo.lessonKind === lessonKind &&
        memo.date === date &&
        Boolean(memo.content.trim()),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function toMemoCountMap(
  memos: LessonCalendarMemo[],
  lessonKind: LessonMemoKind,
) {
  const countMap = new Map<string, number>();

  for (const memo of memos) {
    if (memo.lessonKind === lessonKind && memo.content.trim()) {
      countMap.set(memo.date, (countMap.get(memo.date) ?? 0) + 1);
    }
  }

  return countMap;
}

function toLocalLessonCalendarMemo(
  input: LessonCalendarMemoPayload,
): LessonCalendarMemo {
  localMemoIdSequence += 1;

  return {
    id: `local-memo-${localMemoIdSequence}`,
    academyId: input.academyId,
    lessonKind: input.lessonKind,
    date: input.date,
    content: input.content,
    unread: false,
    studentId: input.studentId ?? null,
    studentName: input.studentName ?? null,
    teacherId: input.teacherId ?? null,
    teacherName: input.teacherName ?? null,
  };
}

function applyLessonCalendarMemoUpdate(
  memo: LessonCalendarMemo,
  input: UpdateLessonCalendarMemoInput,
): LessonCalendarMemo {
  return {
    ...memo,
    content: input.content,
    unread: false,
    studentId: input.studentId ?? null,
    studentName: input.studentName ?? null,
    teacherId: input.teacherId ?? null,
    teacherName: input.teacherName ?? null,
  };
}

function toAcademyMemoTargetOptions(
  rows: DailyAcademyAttendanceRow[],
): LessonMemoTargetOptions {
  return {
    students: uniqueMemoTargets(
      rows.map((row) => ({ id: row.studentId, name: row.studentName })),
    ),
    teachers: uniqueMemoTargets(
      rows.flatMap((row) =>
        row.teacherId && row.teacherName
          ? [{ id: row.teacherId, name: row.teacherName }]
          : [],
      ),
    ),
  };
}

function toPrivateMemoTargetOptions(
  lessons: PrivateLesson[],
): LessonMemoTargetOptions {
  return {
    students: uniqueMemoTargets(
      lessons.map((lesson) => ({
        id: lesson.studentId,
        name: lesson.studentName,
      })),
    ),
    teachers: uniqueMemoTargets(
      lessons.map((lesson) => ({
        id: lesson.teacherId,
        name: lesson.teacherName,
      })),
    ),
  };
}

function uniqueMemoTargets(targets: LessonMemoTargetOption[]) {
  const targetMap = new Map<string, LessonMemoTargetOption>();

  for (const target of targets) {
    if (!targetMap.has(target.id)) {
      targetMap.set(target.id, target);
    }
  }

  return [...targetMap.values()].sort((left, right) =>
    compareKoreanNames(left.name, right.name),
  );
}

function createEmptyMemoDraft(): LessonMemoDraft {
  return {
    studentId: "",
    teacherId: "",
    content: "",
  };
}

function toLessonMemoDraft(
  memo: LessonCalendarMemo,
): LessonMemoDraft {
  return {
    studentId: memo.studentId ?? "",
    teacherId: memo.teacherId ?? "",
    content: memo.content,
  };
}

function canSubmitLessonMemo(
  draft: LessonMemoDraft,
  targets: LessonMemoTargetOptions,
) {
  return Boolean(draft.content.trim() && resolveLessonMemoTarget(draft, targets));
}

function resolveLessonMemoTarget(
  draft: LessonMemoDraft,
  targets: LessonMemoTargetOptions,
) {
  const student = targets.students.find((target) => target.id === draft.studentId);
  const teacher = targets.teachers.find((target) => target.id === draft.teacherId);

  if (draft.studentId && !student) {
    return null;
  }

  if (draft.teacherId && !teacher) {
    return null;
  }

  return {
    studentId: student?.id ?? null,
    studentName: student?.name ?? null,
    teacherId: teacher?.id ?? null,
    teacherName: teacher?.name ?? null,
  };
}

function toLessonMemoTargetBadges(memo: LessonCalendarMemo) {
  const labels: string[] = [];

  if (memo.studentName) {
    labels.push(memo.studentName);
  }

  if (memo.teacherName) {
    labels.push(memo.teacherName);
  }

  return labels.length > 0 ? labels : ["일반"];
}

function toCalendarAriaLabel(selectedDate: string, label: string) {
  const [year, month] = selectedDate.split("-").map(Number);
  return `${year}년 ${month}월 ${label}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getTodayDate() {
  return toSeoulDate(new Date().toISOString());
}

function toSeoulDate(value: string) {
  return seoulFormatter.format(new Date(value));
}

function toSeoulHourMinute(value: string) {
  return hourMinuteFormatter.format(new Date(value));
}

function getEventTone(
  status: CalendarEvent["status"],
  variant: "academy" | "private",
) {
  if (status === "present") {
    return "bg-accent text-accent-foreground";
  }

  if (status === "absent") {
    return "bg-destructive/10 text-destructive";
  }

  if (variant === "private") {
    return "bg-secondary text-secondary-foreground";
  }

  return "bg-primary/10 text-primary";
}

function formatPrivateLessonStatus(status: PrivateLesson["status"]) {
  const labels: Record<PrivateLesson["status"], string> = {
    scheduled: "예정",
    present: "출석",
    absent: "결석",
    cancelled: "취소",
    makeup: "보강",
  };

  return labels[status];
}

function formatOriginLabel(origin: LessonEventOrigin) {
  const labels: Record<LessonEventOrigin, string> = {
    regular: "정기",
    manual: "비정기",
    makeup: "보강",
    private: "개인레슨",
    special: "특강",
    rescheduled: "이동",
  };

  return labels[origin];
}

function toLessonView(value: string): LessonView {
  return value === "table" ? "table" : "calendar";
}

function toControlId(value: string) {
  return value.replace(/\s+/g, "-");
}

function formatRecentPrivateLesson(
  recentLesson: PrivateLessonStudentSearchResult["recentLesson"],
) {
  if (!recentLesson) {
    return "최근 레슨: 없음";
  }

  return `최근 레슨: ${recentLesson.date} ${recentLesson.instrumentName} ${recentLesson.statusLabel}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toSeoulIsoOffset(value: string) {
  return `${value}:00+09:00`;
}

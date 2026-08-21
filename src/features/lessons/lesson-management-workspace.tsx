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
  Check,
  Clipboard,
  ClipboardCheck,
  FileText,
  Search,
  Send,
  X,
} from "lucide-react";
import { type Dispatch, type ReactNode, type SetStateAction, useMemo, useState } from "react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type {
  DailyAcademyAttendanceRow,
  DailyAcademyAttendanceSheet,
} from "@/domain/academy-lesson-attendance";
import {
  markDailyAcademyLessonAttendance,
  type AcademyLessonAttendanceSupabaseClient,
} from "@/lib/api/academy-lessons";
import {
  buildPrivateLessonStudentSearchResults,
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
  createLessonWorkspaceQueryOptions,
  type LessonWorkspaceSupabaseClient,
} from "@/lib/api/lesson-workspace";
import {
  saveMonthlyMemo,
  type MonthlyMemoSupabaseClient,
} from "@/lib/api/monthly-memos";
import { queryKeys } from "@/lib/api/query-keys";
import type { LessonWorkspaceDemoData } from "@/lib/demo/lesson-demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { PrivateLessonRegistrationScreen } from "../private-lessons/private-lesson-registration-screen";

type LessonManagementWorkspaceProps = {
  academyId: string;
  academyName: string;
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
  MonthlyMemoSupabaseClient;

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
};

type MakeupDraft = {
  lessonEventId: string;
  studentName: string;
  targetDate: string;
  reason: string;
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
  initialDate = toDateInputValue(new Date()),
  demoData,
  onRegisterPrivateLesson,
  onMarkPrivateLessonAttendance,
}: LessonManagementWorkspaceProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(initialDate);
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
  const [academyMemoOverride, setAcademyMemoOverride] = useState<string | null>(
    null,
  );
  const [privateMemoOverride, setPrivateMemoOverride] = useState<string | null>(
    null,
  );
  const academySheets = academySheetsOverride ?? indexedWorkspaceSheets;
  const privateLessons =
    privateLessonsOverride ?? initialWorkspaceData.privateLessons;
  const academyMemo = academyMemoOverride ?? initialWorkspaceData.academyMemo;
  const privateMemo = privateMemoOverride ?? initialWorkspaceData.privateMemo;
  const [academyMemoOpen, setAcademyMemoOpen] = useState(false);
  const [privateMemoOpen, setPrivateMemoOpen] = useState(false);
  const [absentOpen, setAbsentOpen] = useState(false);
  const [academyDayOpen, setAcademyDayOpen] = useState(false);
  const [privateDayOpen, setPrivateDayOpen] = useState(false);
  const [privateStudentSearchOpen, setPrivateStudentSearchOpen] =
    useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [makeupDraft, setMakeupDraft] = useState<MakeupDraft | null>(null);
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
  const selectedAcademySheet =
    academySheets[selectedDate] ?? createEmptySheet(academyId, selectedDate);
  const selectedAcademyEvents = [...selectedAcademySheet.rows].sort(
    (left, right) =>
      left.startTime.localeCompare(right.startTime) ||
      left.studentName.localeCompare(right.studentName, "ko-KR"),
  );
  const selectedPrivateLessons = privateLessons
    .filter((lesson) => toSeoulDate(lesson.startAt) === selectedDate)
    .sort((left, right) => left.startAt.localeCompare(right.startAt));
  const unresolvedAbsences = selectedAcademySheet.rows.filter(
    (row) => row.status === "absent" && !resolvedAbsenceIds.has(row.lessonEventId),
  );
  const registrationOptionsQueryFactory = demoData
    ? (targetAcademyId: string) => ({
        queryKey: [
          "demo",
          "private-registration-options",
          targetAcademyId,
        ] as QueryKey,
        queryFn: async () => demoData.registrationOptions,
      })
    : undefined;
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
    },
    onError: (error) => {
      toast.error("학원 수업 출결 저장에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
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
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-tickets"],
      });
    },
    onError: (error) => {
      toast.error("개인레슨 출결 저장에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const saveMemoMutation = useMutation({
    mutationFn: (input: Parameters<typeof saveMonthlyMemo>[1]) => {
      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      return saveMonthlyMemo(supabaseClientState.client, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lessonWorkspace.month(academyId, selectedMonth),
      });
    },
    onError: (error) => {
      toast.error("메모 저장에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });
  const privateLessonStudentResults = useMemo(
    () =>
      buildPrivateLessonStudentSearchResults(
        initialWorkspaceData.registrationOptions.students.map((student) => ({
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
      initialWorkspaceData.registrationOptions.students,
      initialWorkspaceData.ticketBalances,
      privateLessons,
    ],
  );

  if (!hasInjectedData && supabaseClientState?.error) {
    return (
      <ListStatusAlert
        message="Supabase 환경변수가 설정되면 레슨관리표를 불러올 수 있습니다."
        detail={supabaseClientState.error.message}
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
        detail={workspaceQuery.error.message}
      />
    );
  }

  return (
    <section className="grid gap-4" aria-labelledby="lesson-workspace-heading">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="lesson-workspace-heading" className="text-xl font-semibold">
            레슨관리표
          </h2>
        </div>
        <Label className="grid gap-1 text-sm font-medium md:min-w-48">
          <span>날짜 선택</span>
          <Input
            aria-label="레슨 관리 날짜"
            type="date"
            value={selectedDate}
            onChange={(event) =>
              updateSelectedDate(event.target.value, {
                selectedMonth,
                setSelectedDate,
                resetOverrides: () => {
                  setAcademySheetsOverride(null);
                  setPrivateLessonsOverride(null);
                  setAcademyMemoOverride(null);
                  setPrivateMemoOverride(null);
                },
              })
            }
          />
        </Label>
      </div>

      <Tabs defaultValue="academy" className="gap-4">
        <TabsList className="grid h-auto w-full grid-cols-2 md:w-fit">
          <TabsTrigger value="academy">
            <CalendarDays aria-hidden="true" />
            학원 레슨표
          </TabsTrigger>
          <TabsTrigger value="private">
            <CalendarDays aria-hidden="true" />
            개인레슨표
          </TabsTrigger>
        </TabsList>

        <TabsContent value="academy" className="grid gap-4">
          <LessonToolbar
            ariaLabel="학원레슨 도구"
            memoButtonLabel="메모지"
            onMemoClick={() => setAcademyMemoOpen(true)}
            actions={
              <Button
                type="button"
                variant="destructive"
                onClick={() => setAbsentOpen(true)}
              >
                <X aria-hidden="true" />
                미등원인원
              </Button>
            }
          />

          <div className="grid gap-4">
            <LessonMonthCalendar
              ariaLabel={toCalendarAriaLabel(selectedDate, "학원 레슨 캘린더")}
              selectedDate={selectedDate}
              events={academyEvents}
              variant="academy"
              onSelectDate={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: () => {
                    setAcademySheetsOverride(null);
                    setPrivateLessonsOverride(null);
                    setAcademyMemoOverride(null);
                    setPrivateMemoOverride(null);
                  },
                });
                setAcademyDayOpen(true);
              }}
            />
          </div>

        </TabsContent>

        <TabsContent value="private" className="grid gap-4">
          <LessonToolbar
            ariaLabel="개인레슨 도구"
            memoButtonLabel="메모지"
            onMemoClick={() => setPrivateMemoOpen(true)}
            actions={
              <>
                <PrivateLessonRegistrationScreen
                  academyId={academyId}
                  academyName={academyName}
                  displayMode="button"
                  registrationOptionsQueryFactory={registrationOptionsQueryFactory}
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
            }
          />

          <div className="grid gap-4">
            <LessonMonthCalendar
              ariaLabel={toCalendarAriaLabel(selectedDate, "개인레슨 캘린더")}
              selectedDate={selectedDate}
              events={privateEvents}
              variant="private"
              onSelectDate={(date) => {
                updateSelectedDate(date, {
                  selectedMonth,
                  setSelectedDate,
                  resetOverrides: () => {
                    setAcademySheetsOverride(null);
                    setPrivateLessonsOverride(null);
                    setAcademyMemoOverride(null);
                    setPrivateMemoOverride(null);
                  },
                });
                setPrivateDayOpen(true);
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {academyMemoOpen ? (
        <MemoDialog
          open={academyMemoOpen}
          title="학원레슨 메모 작성"
          label="학원레슨 특이사항 메모"
          value={academyMemo}
          onOpenChange={setAcademyMemoOpen}
          onSave={(value) => {
            setAcademyMemoOverride(value);
            if (!demoData && supabaseClientState?.client) {
              saveMemoMutation.mutate({
                academyId,
                month: selectedMonth,
                content: value,
              });
            }
          }}
        />
      ) : null}

      {privateMemoOpen ? (
        <MemoDialog
          open={privateMemoOpen}
          title="개인레슨 메모 작성"
          label="개인레슨 특이사항 메모"
          value={privateMemo}
          onOpenChange={setPrivateMemoOpen}
          onSave={(value) => {
            setPrivateMemoOverride(value);
            if (!demoData && supabaseClientState?.client) {
              saveMemoMutation.mutate({
                academyId,
                month: selectedMonth,
                content: value,
              });
            }
          }}
        />
      ) : null}

      <AbsentDialog
        open={absentOpen}
        date={selectedDate}
        rows={unresolvedAbsences}
        onOpenChange={setAbsentOpen}
        onMarkPresent={(row) => {
          const markedAt = new Date().toISOString();
          setAcademySheetsOverride((current) =>
            updateAttendanceSheets(current ?? academySheets, academyId, [
              {
                lessonEventId: row.lessonEventId,
                studentId: row.studentId,
                status: "present",
                markedAt,
              },
            ]),
          );
          if (!demoData && supabaseClientState?.client) {
            saveAcademyAttendanceMutation.mutate({
              academyId,
              records: [
                {
                  lessonEventId: row.lessonEventId,
                  studentId: row.studentId,
                  status: "present",
                  markedAt,
                },
              ],
            });
          }
        }}
        onOpenMakeup={(row) =>
          setMakeupDraft({
            lessonEventId: row.lessonEventId,
            studentName: row.studentName,
            targetDate: selectedDate,
            reason: "",
          })
        }
      />

      <AcademyDayAttendanceDialog
        open={academyDayOpen}
        date={selectedDate}
        rows={selectedAcademyEvents}
        onOpenChange={setAcademyDayOpen}
        onMark={(row, status) => {
          const markedAt = new Date().toISOString();
          setAcademySheetsOverride((current) =>
            updateAttendanceSheets(current ?? academySheets, academyId, [
              {
                lessonEventId: row.lessonEventId,
                studentId: row.studentId,
                status,
                reason: status === "absent" ? "결석 확인" : undefined,
                markedAt,
              },
            ]),
          );
          if (!demoData && supabaseClientState?.client) {
            saveAcademyAttendanceMutation.mutate({
              academyId,
              records: [
                {
                  lessonEventId: row.lessonEventId,
                  studentId: row.studentId,
                  status,
                  reason: status === "absent" ? "결석 확인" : undefined,
                  markedAt,
                },
              ],
            });
          }
        }}
      />

      <PrivateDayAttendanceDialog
        open={privateDayOpen}
        date={selectedDate}
        lessons={selectedPrivateLessons}
        onOpenChange={setPrivateDayOpen}
        onMark={(lesson, status) => {
          const markedAt = new Date().toISOString();
          if (onMarkPrivateLessonAttendance) {
            onMarkPrivateLessonAttendance(lesson.id, status);
          } else if (supabaseClientState?.client) {
            savePrivateAttendanceMutation.mutate({
              academyId,
              lessonEventId: lesson.id,
              studentId: lesson.studentId,
              instrumentId: lesson.instrumentId,
              instrumentName: lesson.instrumentName,
              status,
              markedAt,
            });
          }
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
          toast.success(
            status === "present"
              ? "출석 처리하고 회차권을 확인했습니다."
              : "결석 처리했습니다.",
          );
        }}
      />

      <MakeupDialog
        draft={makeupDraft}
        onChange={setMakeupDraft}
        onClose={() => setMakeupDraft(null)}
        onConfirm={(draft) => {
          setResolvedAbsenceIds((current) => new Set(current).add(draft.lessonEventId));
          setAcademyMemoOverride((current) =>
            `${(current ?? academyMemo).trim()}\n[${selectedDate}] ${draft.studentName} 보강 사유: ${draft.reason} (보강 예정일: ${draft.targetDate})`.trim(),
          );
          setMakeupDraft(null);
          setAbsentOpen(false);
          toast.success("보강 일정을 기록했습니다.");
        }}
      />

      <ScheduleDialog
        open={scheduleOpen}
        lessons={privateLessons}
        registrationOptions={initialWorkspaceData.registrationOptions}
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

function LessonToolbar({
  ariaLabel,
  memoButtonLabel,
  actions,
  onMemoClick,
}: {
  ariaLabel: string;
  memoButtonLabel: string;
  actions: ReactNode;
  onMemoClick: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onMemoClick}>
          <FileText aria-hidden="true" />
          {memoButtonLabel}
        </Button>
        {actions}
      </div>
    </div>
  );
}

function LessonMonthCalendar({
  ariaLabel,
  selectedDate,
  events,
  variant,
  onSelectDate,
}: {
  ariaLabel: string;
  selectedDate: string;
  events: CalendarEvent[];
  variant: "academy" | "private";
  onSelectDate: (date: string) => void;
}) {
  const calendarDates = buildCalendarDates(selectedDate);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
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

          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              className="flex min-h-20 min-w-0 flex-col gap-1 rounded-md border border-border bg-background p-1 text-left transition-colors hover:bg-accent/40 aria-selected:border-primary aria-selected:ring-2 aria-selected:ring-ring/25 sm:min-h-32 sm:p-2"
              onClick={() => onSelectDate(date)}
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {Number(date.slice(-2))}
              </span>
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

function MemoDialog({
  open,
  title,
  label,
  value,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  title: string;
  label: string;
  value: string;
  onOpenChange: (open: boolean) => void;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraft(value);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            선택한 레슨표의 운영 메모를 작성하고 저장합니다.
          </DialogDescription>
        </DialogHeader>
        <Label className="grid gap-2 text-sm font-medium">
          <span>{label}</span>
          <Textarea
            aria-label={label}
            className="min-h-40"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </Label>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft);
              onOpenChange(false);
              toast.success("메모를 저장했습니다.");
            }}
          >
            메모 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcademyDayAttendanceDialog({
  open,
  date,
  rows,
  onOpenChange,
  onMark,
}: {
  open: boolean;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  onOpenChange: (open: boolean) => void;
  onMark: (
    row: DailyAcademyAttendanceRow,
    status: "present" | "absent",
  ) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{date} 출석 확인</DialogTitle>
          <DialogDescription>
            선택한 날짜의 학원 수업 출결을 바로 업데이트합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              선택한 날짜에 예정된 학원 레슨이 없습니다.
            </p>
          ) : null}
          {rows.map((row) => (
            <div
              key={row.lessonEventId}
              className="flex flex-col gap-3 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm">{row.studentName}</strong>
                  <AttendanceBadge status={row.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.startTime}-{row.endTime} · {row.instrumentName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  aria-label={`${row.studentName} 출석`}
                  onClick={() => onMark(row, "present")}
                >
                  <Check aria-hidden="true" />
                  출석
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`${row.studentName} 결석`}
                  onClick={() => onMark(row, "absent")}
                >
                  <X aria-hidden="true" />
                  결석
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrivateDayAttendanceDialog({
  open,
  date,
  lessons,
  onOpenChange,
  onMark,
}: {
  open: boolean;
  date: string;
  lessons: PrivateLesson[];
  onOpenChange: (open: boolean) => void;
  onMark: (lesson: PrivateLesson, status: "present" | "absent") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{date} 개인레슨 출석 확인</DialogTitle>
          <DialogDescription>
            출석 처리 시 원생의 동일 악기 회차권을 1회 차감합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
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
                  <Badge variant={lesson.status === "present" ? "default" : "outline"}>
                    {formatPrivateLessonStatus(lesson.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {toSeoulHourMinute(lesson.startAt)}-{toSeoulHourMinute(lesson.endAt)} ·{" "}
                  {lesson.instrumentName} · {lesson.teacherName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  aria-label={`${lesson.studentName} 개인레슨 출석`}
                  onClick={() => onMark(lesson, "present")}
                >
                  <Check aria-hidden="true" />
                  출석
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  aria-label={`${lesson.studentName} 개인레슨 결석`}
                  onClick={() => onMark(lesson, "absent")}
                >
                  <X aria-hidden="true" />
                  결석
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AbsentDialog({
  open,
  date,
  rows,
  onOpenChange,
  onMarkPresent,
  onOpenMakeup,
}: {
  open: boolean;
  date: string;
  rows: DailyAcademyAttendanceRow[];
  onOpenChange: (open: boolean) => void;
  onMarkPresent: (row: DailyAcademyAttendanceRow) => void;
  onOpenMakeup: (row: DailyAcademyAttendanceRow) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{date} 미등원 인원</DialogTitle>
          <DialogDescription>결석 처리된 원생을 보강 또는 출석으로 정리합니다.</DialogDescription>
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
                  {row.startTime}-{row.endTime} · {row.absenceReason ?? "사유 없음"}
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
              <Input
                aria-label="보강일"
                type="date"
                value={draft.targetDate}
                onChange={(event) =>
                  onChange({ ...draft, targetDate: event.target.value })
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
            onClick={() => {
              void navigator.clipboard?.writeText(scheduleText);
              toast.success("시간표 내용을 준비했습니다.");
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

function createEmptyWorkspaceData(): LessonWorkspaceDemoData {
  return {
    academySheets: [],
    privateLessons: [],
    ticketBalances: [],
    registrationOptions: {
      students: [],
      teachers: [],
    },
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
  };
}

function compareCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    left.title.localeCompare(right.title, "ko-KR")
  );
}

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

function toCalendarAriaLabel(selectedDate: string, label: string) {
  const [year, month] = selectedDate.split("-").map(Number);
  return `${year}년 ${month}월 ${label}`;
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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

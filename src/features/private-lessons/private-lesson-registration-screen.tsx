"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
import { DateTimeField } from "@/components/operations/date-time-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  getPrivateLessonRegistrationFlowState,
  pickDefaultTeacherId,
  type PrivateLesson,
  type PrivateLessonTicketSearchBalance,
} from "@/domain/private-lesson";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createPrivateLessonRegistrationOptionsQueryOptions,
  registerPrivateLessonEvent,
  type PrivateLessonRegistrationOptions,
  type PrivateLessonRegistrationOptionsSupabaseClient,
  type PrivateLessonRegistrationSupabaseClient,
  type RegisterPrivateLessonEventInput,
} from "@/lib/api/private-lessons";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PrivateLessonRegistrationOptionsQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<PrivateLessonRegistrationOptions>;
};

export type PrivateLessonRegistrationOptionsQueryFactory = (
  academyId: string,
) => PrivateLessonRegistrationOptionsQueryOptions;

type PrivateLessonRegistrationScreenProps = {
  academyId: string;
  academyName: string;
  registrationOptionsQueryFactory?: PrivateLessonRegistrationOptionsQueryFactory;
  registerPrivateLesson?: (
    input: RegisterPrivateLessonEventInput,
  ) => Promise<PrivateLesson>;
  ticketBalances?: PrivateLessonTicketSearchBalance[];
  onRegistered?: (lesson: PrivateLesson) => void;
  displayMode?: "section" | "button";
};

type PrivateLessonSupabaseClient = PrivateLessonRegistrationOptionsSupabaseClient &
  PrivateLessonRegistrationSupabaseClient;

type SupabaseClientState =
  | {
      client: PrivateLessonSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

export function PrivateLessonRegistrationScreen({
  academyId,
  academyName,
  registrationOptionsQueryFactory,
  registerPrivateLesson,
  ticketBalances,
  onRegistered,
  displayMode = "section",
}: PrivateLessonRegistrationScreenProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const hasInjectedOptions = Boolean(registrationOptionsQueryFactory);
  const hasInjectedMutation = Boolean(registerPrivateLesson);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedOptions && hasInjectedMutation
        ? null
        : createPrivateLessonSupabaseClient(),
    [hasInjectedMutation, hasInjectedOptions],
  );
  const registrationOptionsQueryOptions = registrationOptionsQueryFactory
    ? registrationOptionsQueryFactory(academyId)
    : createDefaultRegistrationOptionsQueryOptions(
        academyId,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const registrationOptionsQuery = useQuery({
    queryKey: registrationOptionsQueryOptions.queryKey,
    queryFn: registrationOptionsQueryOptions.queryFn,
    enabled: open && (hasInjectedOptions || !supabaseClientState?.error),
  });
  const registerMutation = useMutation({
    mutationFn:
      registerPrivateLesson ??
      createDefaultRegisterPrivateLesson(
        supabaseClientState ?? createMissingSupabaseClientState(),
      ),
    onSuccess: (lesson) => {
      if (lesson) {
        onRegistered?.(lesson);
      }
      setOpen(false);
      toast.success("개인레슨을 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "private-lessons"],
      });
    },
    onError: (error) => {
      toast.error("개인레슨 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const registrationDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">
          <CalendarPlus aria-hidden="true" />
          개인레슨 등록
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>개인레슨 등록</DialogTitle>
          <DialogDescription>
            원생, 악기, 선생님, 시간을 순서대로 선택합니다.
          </DialogDescription>
        </DialogHeader>
        <PrivateLessonRegistrationForm
          academyId={academyId}
          options={
            registrationOptionsQuery.data ?? {
              students: [],
              teachers: [],
            }
          }
          ticketBalances={ticketBalances}
          isLoading={registrationOptionsQuery.isLoading}
          error={
            registrationOptionsQuery.isError
              ? registrationOptionsQuery.error
              : null
          }
          isSaving={registerMutation.isPending}
          onSubmit={(input) => registerMutation.mutate(input)}
        />
      </DialogContent>
    </Dialog>
  );

  if (displayMode === "button") {
    return registrationDialog;
  }

  return (
    <section className="grid gap-4" aria-labelledby="private-lesson-heading">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            {academyName}
          </p>
          <h2 id="private-lesson-heading" className="text-2xl font-semibold">
            개인레슨 등록
          </h2>
        </div>
        {registrationDialog}
      </div>

      {!hasInjectedOptions && supabaseClientState?.error ? (
        <ListStatusAlert
          message="개인레슨 등록 선택지를 불러오지 못했습니다."
          detail={toUserMessage(supabaseClientState.error)}
        />
      ) : null}
    </section>
  );
}

function PrivateLessonRegistrationForm({
  academyId,
  options,
  ticketBalances,
  isLoading,
  error,
  isSaving,
  onSubmit,
}: {
  academyId: string;
  options: PrivateLessonRegistrationOptions;
  ticketBalances?: PrivateLessonTicketSearchBalance[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  onSubmit: (input: RegisterPrivateLessonEventInput) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const selectedStudent = options.students.find(
    (student) => student.studentId === studentId,
  );
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const selectedTeacher = options.teachers.find(
    (teacher) => teacher.teacherId === teacherId,
  );
  const selectedTicketBalance =
    selectedStudent && selectedInstrument && ticketBalances
      ? findTicketBalance(ticketBalances, {
          academyId,
          studentId: selectedStudent.studentId,
          instrumentId: selectedInstrument.instrumentId,
        })
      : undefined;
  const flow = getPrivateLessonRegistrationFlowState({
    academyId,
    studentId: studentId || undefined,
    instrumentId: instrumentId || undefined,
    teacherId: teacherId || undefined,
    startAt: startAt || undefined,
    endAt: endAt || undefined,
  });
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    Boolean(selectedTeacher) &&
    Boolean(startAt) &&
    Boolean(endAt) &&
    !isSaving;

  /** 악기를 고르면 그 악기의 담당(또는 같은 파트) 선생님을 기본 선생님으로 채운다. */
  function selectInstrument(
    instrument: PrivateLessonRegistrationOptions["students"][number]["instruments"][number] | undefined,
  ) {
    setInstrumentId(instrument?.instrumentId ?? "");
    setTeacherId(instrument ? pickDefaultTeacherId(instrument, options.teachers) : "");
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!selectedStudent || !selectedInstrument || !selectedTeacher) {
          return;
        }

        onSubmit({
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
        });
      }}
    >
      <ol className="grid gap-2 sm:grid-cols-4" aria-label="개인레슨 등록 단계">
        {flow.steps.map((step) => (
          <li key={step.id}>
            <Badge variant={step.status === "locked" ? "secondary" : "outline"}>
              {step.label}
            </Badge>
          </li>
        ))}
      </ol>

      {error ? (
        <ListStatusAlert
          message="개인레슨 등록 선택지를 불러오지 못했습니다."
          detail={toUserMessage(error)}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          개인레슨 등록 선택지를 불러오는 중입니다.
        </p>
      ) : null}

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

            // 악기가 하나뿐일 때만 자동 선택한다. 여러 개면 직접 고르게 한다.
            const onlyInstrument =
              nextStudent?.instruments.length === 1 ? nextStudent.instruments[0] : undefined;

            setStudentId(nextStudentId);
            selectInstrument(onlyInstrument);
          }}
        >
          <NativeSelectOption value="">원생 선택</NativeSelectOption>
          {options.students.map((student) => (
            <NativeSelectOption key={student.studentId} value={student.studentId}>
              {formatStudentOptionLabel(student, ticketBalances, academyId)}
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
          onChange={(event) =>
            selectInstrument(
              selectedStudent?.instruments.find(
                (instrument) => instrument.instrumentId === event.target.value,
              ),
            )
          }
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
        {ticketBalances && selectedInstrument ? (
          <TicketBalanceNotice remainingCount={selectedTicketBalance?.remainingCount} />
        ) : null}
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>시작 시간</span>
          <DateTimeField
            aria-label="시작 시간"
            value={startAt}
            disabled={!selectedTeacher}
            onValueChange={setStartAt}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종료 시간</span>
          <DateTimeField
            aria-label="종료 시간"
            value={endAt}
            disabled={!selectedTeacher}
            onValueChange={setEndAt}
          />
        </Label>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={!canSubmit}>
          {isSaving ? "저장 중" : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TicketBalanceNotice({ remainingCount }: { remainingCount: number | undefined }) {
  if (!remainingCount) {
    return (
      <p className="text-xs font-medium text-destructive" role="status">
        사용할 수 있는 회차권이 없습니다. 일정은 등록할 수 있지만, 출석 확인 전에 회차권 메뉴에서 먼저
        등록해 주세요.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      선택 악기 잔여 회차권 {remainingCount}회
    </p>
  );
}

function createDefaultRegistrationOptionsQueryOptions(
  academyId: string,
  supabaseClientState: SupabaseClientState,
): PrivateLessonRegistrationOptionsQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.privateLessons.registrationOptions(academyId),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createPrivateLessonRegistrationOptionsQueryOptions(
    supabaseClientState.client,
    academyId,
  );
}

function formatStudentOptionLabel(
  student: PrivateLessonRegistrationOptions["students"][number],
  ticketBalances: PrivateLessonTicketSearchBalance[] | undefined,
  academyId: string,
) {
  if (!ticketBalances) {
    return student.studentName;
  }

  const summaries = student.instruments.flatMap((instrument) => {
    const ticketBalance = findTicketBalance(ticketBalances, {
      academyId,
      studentId: student.studentId,
      instrumentId: instrument.instrumentId,
    });

    return ticketBalance
      ? [`${ticketBalance.instrumentName} ${ticketBalance.remainingCount}회`]
      : [];
  });

  return `${student.studentName} · ${
    summaries.length > 0 ? summaries.join(", ") : "회차권 없음"
  }`;
}

function findTicketBalance(
  ticketBalances: PrivateLessonTicketSearchBalance[],
  input: {
    academyId: string;
    studentId: string;
    instrumentId: string;
  },
) {
  return ticketBalances.find(
    (ticket) =>
      ticket.academyId === input.academyId &&
      ticket.studentId === input.studentId &&
      ticket.instrumentId === input.instrumentId,
  );
}

function createDefaultRegisterPrivateLesson(
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return async () => {
      throw supabaseClientState.error;
    };
  }

  return (input: RegisterPrivateLessonEventInput) =>
    registerPrivateLessonEvent(supabaseClientState.client, input);
}

function createPrivateLessonSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as PrivateLessonSupabaseClient,
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

function toSeoulIsoOffset(value: string) {
  return `${value}:00+09:00`;
}

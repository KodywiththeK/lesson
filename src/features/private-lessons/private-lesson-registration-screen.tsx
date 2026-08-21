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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  getPrivateLessonRegistrationFlowState,
  type PrivateLesson,
} from "@/domain/private-lesson";
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
    onSuccess: () => {
      setOpen(false);
      toast.success("개인레슨을 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "private-lessons"],
      });
    },
    onError: (error) => {
      toast.error("개인레슨 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

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
      </div>

      {!hasInjectedOptions && supabaseClientState?.error ? (
        <ListStatusAlert
          message="Supabase 환경변수가 설정되면 개인레슨 등록 선택지를 불러올 수 있습니다."
          detail={supabaseClientState.error.message}
        />
      ) : null}
    </section>
  );
}

function PrivateLessonRegistrationForm({
  academyId,
  options,
  isLoading,
  error,
  isSaving,
  onSubmit,
}: {
  academyId: string;
  options: PrivateLessonRegistrationOptions;
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
          detail={error.message}
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
            setStudentId(event.target.value);
            setInstrumentId("");
            setTeacherId("");
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

      <div className="grid gap-3 sm:grid-cols-2">
        <Label className="grid gap-1">
          <span>시작 시간</span>
          <Input
            aria-label="시작 시간"
            type="datetime-local"
            value={startAt}
            disabled={!selectedTeacher}
            onChange={(event) => setStartAt(event.target.value)}
          />
        </Label>
        <Label className="grid gap-1">
          <span>종료 시간</span>
          <Input
            aria-label="종료 시간"
            type="datetime-local"
            value={endAt}
            disabled={!selectedTeacher}
            onChange={(event) => setEndAt(event.target.value)}
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

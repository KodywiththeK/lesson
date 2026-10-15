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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
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

import { PrivateLessonRegistrationForm } from "./private-lesson-registration-form";

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
  /** 시간 겹침을 등록 전에 알리는 데 쓰는 이미 등록된 개인레슨(조회된 월의 일정). */
  existingLessons?: PrivateLesson[];
  /** 등록창을 열 때 날짜 칸을 미리 채울 날짜 `YYYY-MM-DD`. */
  initialDate?: string;
  onRegistered?: (lesson: PrivateLesson) => void;
  /** `dialog`는 등록 버튼 없이 바깥이 `open`으로 여닫는 다이얼로그만 그린다. */
  displayMode?: "section" | "button" | "dialog";
  /** 주어지면 바깥이 열림 상태를 제어한다. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  existingLessons,
  initialDate,
  onRegistered,
  displayMode = "section",
  open: controlledOpen,
  onOpenChange,
}: PrivateLessonRegistrationScreenProps) {
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
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
      {displayMode === "dialog" ? null : (
        <DialogTrigger asChild>
          <Button type="button">
            <CalendarPlus aria-hidden="true" />
            개인레슨 등록
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>레슨 일정 등록</DialogTitle>
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
          existingLessons={existingLessons}
          initialDate={initialDate}
          isLoading={registrationOptionsQuery.isLoading}
          error={
            registrationOptionsQuery.isError
              ? registrationOptionsQuery.error
              : null
          }
          isSaving={registerMutation.isPending}
          onSubmit={(input) => registerMutation.mutate(input)}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );

  if (displayMode !== "section") {
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

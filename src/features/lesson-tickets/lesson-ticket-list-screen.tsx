"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RotateCcw, TicketPlus } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
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
  DialogTrigger,
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
import {
  formatLessonTicketStatus,
  type BuildLessonTicketListOptions,
  type LessonTicketListRow,
  type LessonTicketStatus,
} from "@/domain/lesson-ticket";
import {
  createLessonTicketListQueryOptions,
  createLessonTicketRegistrationOptionsQueryOptions,
  registerLessonTicketGrant,
  type LessonTicketGrantRegistrationSupabaseClient,
  type LessonTicketListSupabaseClient,
  type LessonTicketRegistrationOptionsSupabaseClient,
  type LessonTicketRegistrationStudentOption,
  type RegisterLessonTicketGrantInput,
  type RegisterLessonTicketGrantResult,
} from "@/lib/api/lesson-tickets";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LessonTicketListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LessonTicketListRow[]>;
};

export type LessonTicketListQueryOptionsFactory = (
  options: BuildLessonTicketListOptions,
) => LessonTicketListQueryOptions;

type LessonTicketRegistrationOptionsQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<LessonTicketRegistrationStudentOption[]>;
};

export type LessonTicketRegistrationOptionsQueryFactory = (
  academyId: string,
) => LessonTicketRegistrationOptionsQueryOptions;

type LessonTicketListScreenProps = {
  academyId: string;
  academyName: string;
  today: string;
  queryOptionsFactory?: LessonTicketListQueryOptionsFactory;
  registrationOptionsQueryFactory?: LessonTicketRegistrationOptionsQueryFactory;
  registerLessonTicket?: (
    input: RegisterLessonTicketGrantInput,
  ) => Promise<RegisterLessonTicketGrantResult>;
  registerLessonTicketPurchase?: (
    input: RegisterLessonTicketGrantInput & { paidAmount: number },
  ) => Promise<void>;
};

type LessonTicketSupabaseClient = LessonTicketListSupabaseClient &
  LessonTicketRegistrationOptionsSupabaseClient &
  LessonTicketGrantRegistrationSupabaseClient;

type SupabaseClientState =
  | {
      client: LessonTicketSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

const statusFilterOptions: Array<{
  value: LessonTicketStatus;
  label: string;
}> = [
  { value: "low-remaining", label: formatLessonTicketStatus("low-remaining") },
  { value: "expiring-soon", label: formatLessonTicketStatus("expiring-soon") },
  { value: "expired", label: formatLessonTicketStatus("expired") },
  { value: "exhausted", label: formatLessonTicketStatus("exhausted") },
];

const defaultThresholds = {
  lowRemainingThreshold: 2,
  expiringWithinDays: 7,
};

export function LessonTicketListScreen({
  academyId,
  today,
  queryOptionsFactory,
  registrationOptionsQueryFactory,
  registerLessonTicket,
  registerLessonTicketPurchase,
}: LessonTicketListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LessonTicketStatus | "">("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const hasInjectedRegistrationOptions = Boolean(registrationOptionsQueryFactory);
  const hasInjectedRegistrationMutation = Boolean(registerLessonTicket);
  const hasInjectedPurchaseMutation = Boolean(registerLessonTicketPurchase);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedQueryOptions &&
      hasInjectedRegistrationOptions &&
      (hasInjectedRegistrationMutation || hasInjectedPurchaseMutation)
        ? null
        : createLessonTicketSupabaseClient(),
    [
      hasInjectedQueryOptions,
      hasInjectedRegistrationMutation,
      hasInjectedPurchaseMutation,
      hasInjectedRegistrationOptions,
    ],
  );

  const currentOptions: BuildLessonTicketListOptions = {
    academyId,
    today,
    ...defaultThresholds,
    search,
    filters: {
      status: status || undefined,
    },
  };
  const queryOptions = queryOptionsFactory
    ? queryOptionsFactory(currentOptions)
    : createDefaultQueryOptions(
        currentOptions,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const lessonTicketListQuery = useQuery({
    queryKey: queryOptions.queryKey,
    queryFn: queryOptions.queryFn,
    enabled: hasInjectedQueryOptions || !supabaseClientState?.error,
  });
  const tickets = lessonTicketListQuery.data ?? [];
  const registrationOptionsQueryOptions = registrationOptionsQueryFactory
    ? registrationOptionsQueryFactory(academyId)
    : createDefaultRegistrationOptionsQueryOptions(
        academyId,
        supabaseClientState ?? createMissingSupabaseClientState(),
      );
  const registrationOptionsQuery = useQuery({
    queryKey: registrationOptionsQueryOptions.queryKey,
    queryFn: registrationOptionsQueryOptions.queryFn,
    enabled:
      isRegistrationOpen &&
      (hasInjectedRegistrationOptions || !supabaseClientState?.error),
  });
  const registerMutation = useMutation({
    mutationFn: async (input: RegisterLessonTicketGrantInput) => {
      if (registerLessonTicketPurchase) {
        if (!input.paidAmount) {
          throw new Error("회차권 결제 금액이 필요합니다.");
        }

        await registerLessonTicketPurchase({
          ...input,
          paidAmount: input.paidAmount,
        });
        return;
      }

      const mutation =
        registerLessonTicket ??
        createDefaultRegisterLessonTicket(
          supabaseClientState ?? createMissingSupabaseClientState(),
        );

      await mutation(input);
    },
    onSuccess: () => {
      setIsRegistrationOpen(false);
      toast.success("회차권을 등록했습니다.");
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "lesson-tickets"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "finance"],
      });
    },
    onError: (error) => {
      toast.error("회차권 등록에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const registrationAction = useMemo(
    () => (
      <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <TicketPlus aria-hidden="true" />
            회차권 등록
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>회차권 등록</DialogTitle>
            <DialogDescription>
              개인레슨 회차권을 신규 등록하거나 기존 회차권에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <LessonTicketRegistrationForm
            academyId={academyId}
            options={registrationOptionsQuery.data ?? []}
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
    ),
    [
      academyId,
      isRegistrationOpen,
      registerMutation,
      registrationOptionsQuery.data,
      registrationOptionsQuery.error,
      registrationOptionsQuery.isError,
      registrationOptionsQuery.isLoading,
    ],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  return (
    <section className="grid gap-4" aria-label="회차권 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="회차권 검색"
            value={search}
            onChange={setSearch}
            placeholder="원생명, 악기, 유효기간, 상태"
          />
          <ListFilterSelect
            label="회차권 상태 필터"
            value={status}
            options={statusFilterOptions}
            onChange={(nextStatus) =>
              setStatus(nextStatus as LessonTicketStatus | "")
            }
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="Supabase 환경변수가 설정되면 회차권 목록을 불러올 수 있습니다."
            detail={supabaseClientState.error.message}
          />
        ) : null}

        {lessonTicketListQuery.isError ? (
          <ListStatusAlert
            message="회차권 목록을 불러오지 못했습니다."
            detail={lessonTicketListQuery.error.message}
          />
        ) : null}

        {lessonTicketListQuery.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">
            회차권 목록을 불러오는 중입니다.
          </p>
        ) : null}

        {!lessonTicketListQuery.isLoading &&
        !lessonTicketListQuery.isError &&
        (hasInjectedQueryOptions || !supabaseClientState?.error) ? (
          <LessonTicketTable tickets={tickets} />
        ) : null}
      </div>
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildLessonTicketListOptions,
  supabaseClientState: SupabaseClientState,
): LessonTicketListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.lessonTickets.list(options.academyId, {
        q: options.search,
        status: options.filters?.status,
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createLessonTicketListQueryOptions(supabaseClientState.client, options);
}

function createDefaultRegistrationOptionsQueryOptions(
  academyId: string,
  supabaseClientState: SupabaseClientState,
): LessonTicketRegistrationOptionsQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.lessonTickets.registrationOptions(academyId),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createLessonTicketRegistrationOptionsQueryOptions(
    supabaseClientState.client,
    academyId,
  );
}

function createDefaultRegisterLessonTicket(
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return async () => {
      throw supabaseClientState.error;
    };
  }

  return (input: RegisterLessonTicketGrantInput) =>
    registerLessonTicketGrant(supabaseClientState.client, input);
}

function createLessonTicketSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as LessonTicketSupabaseClient,
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

function LessonTicketRegistrationForm({
  academyId,
  options,
  isLoading,
  error,
  isSaving,
  onSubmit,
}: {
  academyId: string;
  options: LessonTicketRegistrationStudentOption[];
  isLoading: boolean;
  error: Error | null;
  isSaving: boolean;
  onSubmit: (input: RegisterLessonTicketGrantInput) => void;
}) {
  const [studentId, setStudentId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [grantedCount, setGrantedCount] = useState(1);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [registeredAt, setRegisteredAt] = useState("");
  const [paidAmount, setPaidAmount] = useState(0);
  const selectedStudent = options.find((option) => option.studentId === studentId);
  const selectedInstrument = selectedStudent?.instruments.find(
    (instrument) => instrument.instrumentId === instrumentId,
  );
  const canSubmit =
    Boolean(selectedStudent) &&
    Boolean(selectedInstrument) &&
    grantedCount > 0 &&
    Boolean(validFrom) &&
    Boolean(validUntil) &&
    Boolean(registeredAt) &&
    paidAmount > 0 &&
    !isSaving;

  return (
    <form
      aria-label="회차권 등록 입력"
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();

        if (!selectedStudent || !selectedInstrument || !canSubmit) {
          return;
        }

        onSubmit({
          academyId,
          studentId: selectedStudent.studentId,
          studentName: selectedStudent.studentName,
          instrumentId: selectedInstrument.instrumentId,
          instrumentName: selectedInstrument.instrumentName,
          grantedCount,
          validFrom,
          validUntil,
          registeredAt,
          paidAmount,
        });
      }}
    >
      {error ? (
        <ListStatusAlert
          message="회차권 등록 선택지를 불러오지 못했습니다."
          detail={error.message}
        />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          회차권 등록 선택지를 불러오는 중입니다.
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
          }}
        >
          <NativeSelectOption value="">원생 선택</NativeSelectOption>
          {options.map((option) => (
            <NativeSelectOption key={option.studentId} value={option.studentId}>
              {option.studentName}
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
        <span>부여 회수</span>
        <Input
          aria-label="부여 회수"
          type="number"
          min={1}
          step={1}
          value={grantedCount}
          onChange={(event) => setGrantedCount(Number(event.target.value))}
        />
      </Label>

      <Label className="grid gap-1">
        <span>결제 금액</span>
        <Input
          aria-label="결제 금액"
          type="number"
          min={1}
          step={1}
          value={paidAmount}
          onChange={(event) => setPaidAmount(Number(event.target.value))}
        />
      </Label>

      <div className="grid gap-3 sm:grid-cols-3">
        <Label className="grid gap-1">
          <span>유효 시작일</span>
          <DateField
            aria-label="유효 시작일"
            value={validFrom}
            onValueChange={setValidFrom}
          />
        </Label>
        <Label className="grid gap-1">
          <span>유효 만료일</span>
          <DateField
            aria-label="유효 만료일"
            value={validUntil}
            onValueChange={setValidUntil}
          />
        </Label>
        <Label className="grid gap-1">
          <span>등록일</span>
          <DateField
            aria-label="등록일"
            value={registeredAt}
            onValueChange={setRegisteredAt}
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

function LessonTicketTable({ tickets }: { tickets: LessonTicketListRow[] }) {
  if (tickets.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        조건에 맞는 회차권이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="회차권 목록" className="min-w-[54rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">원생</TableHead>
            <TableHead className="px-4 py-3">악기</TableHead>
            <TableHead className="px-4 py-3">총 부여</TableHead>
            <TableHead className="px-4 py-3">잔여</TableHead>
            <TableHead className="px-4 py-3">유효기간</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.ticketId}>
              <TableCell className="px-4 py-3 font-medium">
                {ticket.studentName}
              </TableCell>
              <TableCell className="px-4 py-3">
                {ticket.instrumentName}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatCount(ticket.totalGrantedCount)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {formatCount(ticket.remainingCount)}
              </TableCell>
              <TableCell className="px-4 py-3">
                {ticket.validFrom} ~ {ticket.validUntil}
              </TableCell>
              <TableCell className="px-4 py-3">
                <span className="flex flex-wrap gap-1">
                  {ticket.statuses.length > 0 ? (
                    ticket.statuses.map((status) => (
                      <Badge key={status} variant={getStatusVariant(status)}>
                        {formatLessonTicketStatus(status)}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">정상</Badge>
                  )}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function getStatusVariant(status: LessonTicketStatus) {
  return status === "expired" || status === "exhausted"
    ? "destructive"
    : "outline";
}

function formatCount(count: number) {
  return `${count}회`;
}

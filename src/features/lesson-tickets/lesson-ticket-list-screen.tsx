"use client";

import { useMemo, useState, type ComponentProps } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RotateCcw, TicketPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ListFilterSelect,
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { SectionCard } from "@/components/shared/section-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
import {
  PageHeaderActionFallback,
  usePageHeaderActions,
} from "@/components/layout/page-actions";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ListView } from "@/domain/common-list";
import {
  DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS,
  describeLessonTicketRemainingDays,
  formatLessonTicketStatus,
  type BuildLessonTicketListOptions,
  type LessonTicketListRow,
  type LessonTicketStatus,
} from "@/domain/lesson-ticket";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  adjustLessonTicket as adjustLessonTicketRpc,
  createLessonTicketListQueryKey,
  createLessonTicketListQueryOptions,
  createLessonTicketRegistrationOptionsQueryOptions,
  deleteLessonTicket as deleteLessonTicketRpc,
  getLessonTicketRefundPreview as getLessonTicketRefundPreviewRpc,
  registerLessonTicket as registerLessonTicketRpc,
  type AdjustLessonTicketInput,
  type AdjustLessonTicketResult,
  type AdjustLessonTicketSupabaseClient,
  type DeleteLessonTicketInput,
  type DeleteLessonTicketResult,
  type DeleteLessonTicketSupabaseClient,
  type LessonTicketListSupabaseClient,
  type LessonTicketRefundPreview,
  type LessonTicketRefundPreviewSupabaseClient,
  type LessonTicketRegistrationOptionsSupabaseClient,
  type LessonTicketRegistrationStudentOption,
  type RegisterLessonTicketInput,
  type RegisterLessonTicketResult,
  type RegisterLessonTicketSupabaseClient,
} from "@/lib/api/lesson-tickets";
import { queryKeys } from "@/lib/api/query-keys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { LessonTicketAdjustDialog } from "./lesson-ticket-adjust-dialog";
import { LessonTicketDeleteDialog } from "./lesson-ticket-delete-dialog";
import { LessonTicketRegistrationForm } from "./lesson-ticket-registration-form";

type LessonTicketListQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<LessonTicketListRow>>;
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
  today: string;
  canRecordPayment: boolean;
  queryOptionsFactory?: LessonTicketListQueryOptionsFactory;
  registrationOptionsQueryFactory?: LessonTicketRegistrationOptionsQueryFactory;
  registerLessonTicket?: (
    input: RegisterLessonTicketInput,
  ) => Promise<RegisterLessonTicketResult>;
  adjustLessonTicket?: (
    input: AdjustLessonTicketInput,
  ) => Promise<AdjustLessonTicketResult>;
  getLessonTicketRefundPreview?: (ticketId: string) => Promise<LessonTicketRefundPreview>;
  deleteLessonTicket?: (input: DeleteLessonTicketInput) => Promise<DeleteLessonTicketResult>;
};

type LessonTicketSupabaseClient = LessonTicketListSupabaseClient &
  LessonTicketRegistrationOptionsSupabaseClient &
  RegisterLessonTicketSupabaseClient &
  AdjustLessonTicketSupabaseClient &
  LessonTicketRefundPreviewSupabaseClient &
  DeleteLessonTicketSupabaseClient;

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
  { value: "expired", label: formatLessonTicketStatus("expired") },
  { value: "exhausted", label: formatLessonTicketStatus("exhausted") },
];

export function LessonTicketListScreen({
  academyId,
  today,
  canRecordPayment,
  queryOptionsFactory,
  registrationOptionsQueryFactory,
  registerLessonTicket,
  adjustLessonTicket,
  getLessonTicketRefundPreview,
  deleteLessonTicket,
}: LessonTicketListScreenProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LessonTicketStatus | "">("");
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState<LessonTicketListRow | null>(null);
  const { page, pageSize, goToPage, changePageSize, resetPage } = useListPaging();
  const hasInjectedQueryOptions = Boolean(queryOptionsFactory);
  const hasInjectedRegistrationOptions = Boolean(registrationOptionsQueryFactory);
  const hasInjectedRegistrationMutation = Boolean(registerLessonTicket);
  const hasInjectedAdjustMutation = Boolean(adjustLessonTicket);
  const hasInjectedDeleteFlow = Boolean(getLessonTicketRefundPreview && deleteLessonTicket);
  const supabaseClientState = useMemo(
    () =>
      hasInjectedQueryOptions &&
      hasInjectedRegistrationOptions &&
      hasInjectedRegistrationMutation &&
      hasInjectedAdjustMutation &&
      hasInjectedDeleteFlow
        ? null
        : createLessonTicketSupabaseClient(),
    [
      hasInjectedQueryOptions,
      hasInjectedRegistrationOptions,
      hasInjectedRegistrationMutation,
      hasInjectedAdjustMutation,
      hasInjectedDeleteFlow,
    ],
  );

  const currentOptions: BuildLessonTicketListOptions = {
    academyId,
    today,
    ...DEFAULT_LESSON_TICKET_STATUS_THRESHOLDS,
    search,
    filters: {
      status: status || undefined,
    },
    page,
    pageSize,
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
    placeholderData: keepPreviousData,
  });
  const ticketListView = lessonTicketListQuery.data;
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
  function invalidateTicketRelatedQueries() {
    for (const section of ["lesson-tickets", "finance", "lesson-workspace"]) {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), section],
      });
    }
  }

  const registerMutation = useMutation({
    mutationFn: (input: RegisterLessonTicketInput) => {
      const register =
        registerLessonTicket ??
        createDefaultRegisterLessonTicket(
          supabaseClientState ?? createMissingSupabaseClientState(),
        );

      return register(input);
    },
    onSuccess: (result, input) => {
      setIsRegistrationOpen(false);
      toast.success(describeRegistration(result, input));
      invalidateTicketRelatedQueries();
    },
    onError: (error) => {
      toast.error("회차권 등록에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const adjustMutation = useMutation({
    mutationFn: (input: AdjustLessonTicketInput) => {
      const adjust =
        adjustLessonTicket ??
        createDefaultAdjustLessonTicket(
          supabaseClientState ?? createMissingSupabaseClientState(),
        );

      return adjust(input);
    },
    onSuccess: () => {
      toast.success("회차권을 수정했습니다.");
      invalidateTicketRelatedQueries();
    },
    onError: (error) => {
      toast.error("회차권 수정에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (input: DeleteLessonTicketInput) => {
      const remove =
        deleteLessonTicket ??
        createDefaultDeleteLessonTicket(
          supabaseClientState ?? createMissingSupabaseClientState(),
        );

      return remove(input);
    },
    onSuccess: (result) => {
      setDeletingTicket(null);
      toast.success(describeDeletion(result));
      invalidateTicketRelatedQueries();
    },
    onError: (error) => {
      toast.error("회차권 삭제에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });
  const loadRefundPreview =
    getLessonTicketRefundPreview ??
    createDefaultRefundPreviewLoader(
      academyId,
      supabaseClientState ?? createMissingSupabaseClientState(),
    );

  const registrationAction = useMemo(
    () => (
      <Dialog open={isRegistrationOpen} onOpenChange={setIsRegistrationOpen}>
        <DialogTrigger asChild>
          <Button type="button">
            <TicketPlus aria-hidden="true" />
            회차권 등록
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[min(90dvh,42rem)] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>회차권 등록</DialogTitle>
            <DialogDescription>
              개인레슨 회차권을 신규 등록하거나 기존 회차권에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <LessonTicketRegistrationForm
            academyId={academyId}
            today={today}
            options={registrationOptionsQuery.data ?? []}
            isLoading={registrationOptionsQuery.isLoading}
            error={
              registrationOptionsQuery.isError
                ? registrationOptionsQuery.error
                : null
            }
            isSaving={registerMutation.isPending}
            canRecordPayment={canRecordPayment}
            onSubmit={(input) => registerMutation.mutate(input)}
          />
        </DialogContent>
      </Dialog>
    ),
    [
      academyId,
      canRecordPayment,
      isRegistrationOpen,
      registerMutation,
      registrationOptionsQuery.data,
      registrationOptionsQuery.error,
      registrationOptionsQuery.isError,
      registrationOptionsQuery.isLoading,
      today,
    ],
  );
  const isHeaderActionMounted = usePageHeaderActions(registrationAction);

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    resetPage();
  }

  function changeStatus(nextStatus: LessonTicketStatus | "") {
    setStatus(nextStatus);
    resetPage();
  }

  function resetFilters() {
    setSearch("");
    setStatus("");
    resetPage();
  }

  return (
    <section className="grid gap-4" aria-label="회차권 목록">
      <PageHeaderActionFallback isMounted={isHeaderActionMounted}>
        {registrationAction}
      </PageHeaderActionFallback>

      <SectionCard padded={false}>
        <div className="grid gap-3 border-b border-border p-4 lg:grid-cols-[minmax(12rem,1fr)_12rem_auto]">
          <ListSearchField
            label="회차권 검색"
            value={search}
            onChange={changeSearch}
            placeholder="원생명, 악기, 등록일, 만료일, 상태"
          />
          <ListFilterSelect
            label="회차권 상태 필터"
            value={status}
            options={statusFilterOptions}
            onChange={(nextStatus) =>
              changeStatus(nextStatus as LessonTicketStatus | "")
            }
          />
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={resetFilters}
          >
            <RotateCcw aria-hidden="true" />
            초기화
          </Button>
        </div>

        {!hasInjectedQueryOptions && supabaseClientState?.error ? (
          <ListStatusAlert
            message="회차권 목록을 불러오지 못했습니다."
            detail={toUserMessage(supabaseClientState.error)}
          />
        ) : null}

        {lessonTicketListQuery.isError ? (
          <ListStatusAlert
            message="회차권 목록을 불러오지 못했습니다."
            detail={toUserMessage(lessonTicketListQuery.error)}
          />
        ) : null}

        {lessonTicketListQuery.isLoading ? (
          <EmptyState>
            회차권 목록을 불러오는 중입니다.
          </EmptyState>
        ) : null}

        {ticketListView && !lessonTicketListQuery.isError ? (
          <>
            <LessonTicketTable
              tickets={ticketListView.items}
              today={today}
              isAdjusting={adjustMutation.isPending}
              onAdjust={(ticket, input, onSaved) =>
                adjustMutation.mutate(
                  { ...input, academyId, ticketId: ticket.ticketId },
                  { onSuccess: onSaved },
                )
              }
              onDelete={setDeletingTicket}
            />
            <ListPagination
              itemLabel="회차권"
              countUnit="개"
              view={ticketListView}
              onPageChange={goToPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : null}
      </SectionCard>

      <LessonTicketDeleteDialog
        ticket={deletingTicket}
        loadPreview={loadRefundPreview}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingTicket(null)}
        onConfirm={(ticket, mode) =>
          deleteMutation.mutate({ academyId, ticketId: ticket.ticketId, mode })
        }
      />
    </section>
  );
}

function createDefaultQueryOptions(
  options: BuildLessonTicketListOptions,
  supabaseClientState: SupabaseClientState,
): LessonTicketListQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: createLessonTicketListQueryKey(options),
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
    return async (): Promise<RegisterLessonTicketResult> => {
      throw supabaseClientState.error;
    };
  }

  return (input: RegisterLessonTicketInput) =>
    registerLessonTicketRpc(supabaseClientState.client, input);
}

function createDefaultAdjustLessonTicket(
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return async (): Promise<AdjustLessonTicketResult> => {
      throw supabaseClientState.error;
    };
  }

  return (input: AdjustLessonTicketInput) =>
    adjustLessonTicketRpc(supabaseClientState.client, input);
}

function createDefaultDeleteLessonTicket(
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return async (): Promise<DeleteLessonTicketResult> => {
      throw supabaseClientState.error;
    };
  }

  return (input: DeleteLessonTicketInput) =>
    deleteLessonTicketRpc(supabaseClientState.client, input);
}

function createDefaultRefundPreviewLoader(
  academyId: string,
  supabaseClientState: SupabaseClientState,
) {
  if (supabaseClientState.error) {
    return async (): Promise<LessonTicketRefundPreview> => {
      throw supabaseClientState.error;
    };
  }

  return (ticketId: string) =>
    getLessonTicketRefundPreviewRpc(supabaseClientState.client, { academyId, ticketId });
}

function describeDeletion(result: DeleteLessonTicketResult) {
  if (result.mode === "mistake") {
    return "잘못 등록한 회차권과 수입 기록을 삭제했습니다.";
  }

  return result.refunded
    ? `회차권을 삭제하고 ${result.refundAmount.toLocaleString("ko-KR")}원을 환불 처리했습니다.`
    : "회차권을 삭제했습니다. 환불할 금액이 없어 수입 내역은 그대로입니다.";
}

function describeRegistration(
  result: RegisterLessonTicketResult,
  input: RegisterLessonTicketInput,
) {
  return result.merged
    ? `기존 회차권에 ${input.grantedCount}회를 추가하고 만료일을 ${result.validUntil}로 갱신했습니다.`
    : "회차권을 등록했습니다.";
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

function LessonTicketTable({
  tickets,
  today,
  isAdjusting,
  onAdjust,
  onDelete,
}: {
  tickets: LessonTicketListRow[];
  today: string;
  isAdjusting: boolean;
  onAdjust: ComponentProps<typeof LessonTicketAdjustDialog>["onAdjust"];
  onDelete: (ticket: LessonTicketListRow) => void;
}) {
  if (tickets.length === 0) {
    return (
      <EmptyState>
        조건에 맞는 회차권이 없습니다.
      </EmptyState>
    );
  }

  return (
    <Table aria-label="회차권 목록" className="lg:min-w-[60rem]">
      <TableHeader>
        <TableRow>
          <TableHead>원생</TableHead>
          <TableHead>악기</TableHead>
          <TableHead>총 부여</TableHead>
          <TableHead>사용</TableHead>
          <TableHead>잔여</TableHead>
          <TableHead>등록일</TableHead>
          <TableHead>만료일</TableHead>
          <TableHead>남은 일수</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => {
          const needsAttention = hasLowOrNoRemaining(ticket);

          return (
            <TableRow
              key={ticket.ticketId}
              className={needsAttention ? "bg-destructive/5" : undefined}
            >
              <TableCell label="원생" className="font-medium">
                {ticket.studentName}
              </TableCell>
              <TableCell label="악기">
                {ticket.instrumentName}
              </TableCell>
              <TableCell label="총 부여">
                {formatCount(ticket.totalGrantedCount)}
              </TableCell>
              <TableCell label="사용">
                {formatCount(ticket.totalGrantedCount - ticket.remainingCount)}
              </TableCell>
              <TableCell
                label="잔여"
                className={
                  needsAttention
                    ? "font-semibold text-destructive"
                    : undefined
                }
              >
                {formatCount(ticket.remainingCount)}
              </TableCell>
              <TableCell label="등록일">{ticket.registeredAt}</TableCell>
              <TableCell label="만료일">{ticket.validUntil}</TableCell>
              <TableCell label="남은 일수">{describeLessonTicketRemainingDays(ticket.validUntil, today)}</TableCell>
              <TableCell label="상태">
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
              <TableCell label="관리">
                <span className="flex flex-wrap gap-2">
                  <LessonTicketAdjustDialog
                    ticket={ticket}
                    isSaving={isAdjusting}
                    onAdjust={onAdjust}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${ticket.studentName} ${ticket.instrumentName} 회차권 삭제`}
                    onClick={() => onDelete(ticket)}
                  >
                    <Trash2 aria-hidden="true" />
                    삭제
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** 잔여 부족·소진·이미 만료된 회차권만 강조한다. */
function hasLowOrNoRemaining(ticket: LessonTicketListRow) {
  return (
    ticket.statuses.includes("low-remaining") ||
    ticket.statuses.includes("exhausted") ||
    ticket.statuses.includes("expired")
  );
}

function getStatusVariant(status: LessonTicketStatus) {
  return status === "expired" ? "secondary" : "destructive";
}

function formatCount(count: number) {
  return `${count}회`;
}

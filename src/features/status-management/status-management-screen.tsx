"use client";

import { useId, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Eye, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import {
  ListSearchField,
  ListStatusAlert,
} from "@/components/management/list-controls";
import { ListPagination } from "@/components/management/list-pagination";
import { useListPaging } from "@/components/management/use-list-paging";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { ListView, PageSizeOption } from "@/domain/common-list";
import type {
  ManagedStatus,
  StatusManagementEntityType,
  StatusManagementFetchOptions,
  StatusManagementListItem,
} from "@/domain/status-management";
import { invalidateAfterPeopleChange } from "@/lib/api/query-invalidation";
import { toUserMessage } from "@/lib/errors/user-message";
import {
  createStudentStatusManagementQueryOptions,
  updateStudentStatus as updateStudentStatusApi,
  type StudentListSupabaseClient,
  type StudentUpdateSupabaseClient,
} from "@/lib/api/students";
import {
  createTeacherStatusManagementQueryOptions,
  updateTeacherStatus as updateTeacherStatusApi,
  type TeacherListSupabaseClient,
  type TeacherMutationSupabaseClient,
} from "@/lib/api/teachers";
import { queryKeys } from "@/lib/api/query-keys";
import type {
  DemoStudentStatusInput,
  DemoTeacherStatusInput,
} from "@/lib/demo/academy-demo-state";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StatusManagementQueryOptions = {
  queryKey: QueryKey;
  queryFn: () => Promise<ListView<StatusManagementListItem>>;
};

type StudentStatus = "suspended" | "withdrawn";
type TeacherStatus = "on_leave" | "resigned";
type StudentStatusOptions = StatusManagementFetchOptions<StudentStatus>;
type TeacherStatusOptions = StatusManagementFetchOptions<TeacherStatus>;

export type StatusManagementScreenProps = {
  academyId: string;
  academyName: string;
  studentQueryOptionsFactory?: (
    options: StudentStatusOptions,
  ) => StatusManagementQueryOptions;
  teacherQueryOptionsFactory?: (
    options: TeacherStatusOptions,
  ) => StatusManagementQueryOptions;
  updateStudentStatus?: (input: DemoStudentStatusInput) => void | Promise<void>;
  updateTeacherStatus?: (input: DemoTeacherStatusInput) => void | Promise<void>;
};

type StatusManagementSupabaseClient = StudentListSupabaseClient &
  StudentUpdateSupabaseClient &
  TeacherListSupabaseClient &
  TeacherMutationSupabaseClient;

type SupabaseClientState =
  | {
      client: StatusManagementSupabaseClient;
      error: null;
    }
  | {
      client: null;
      error: Error;
    };

type PendingTransition = {
  entityType: StatusManagementEntityType;
  entityId: string;
  name: string;
  fromStatus: ManagedStatus;
  toStatus: "enrolled" | "suspended" | "withdrawn" | "employed" | "on_leave" | "resigned";
  fromLabel: string;
  toLabel: string;
};

const studentStatusTabs = [
  { value: "suspended" as const, label: "휴원" },
  { value: "withdrawn" as const, label: "퇴원" },
];

const teacherStatusTabs = [
  { value: "on_leave" as const, label: "휴직" },
  { value: "resigned" as const, label: "퇴사" },
];

export function StatusManagementScreen({
  academyId,
  studentQueryOptionsFactory,
  teacherQueryOptionsFactory,
  updateStudentStatus,
  updateTeacherStatus,
}: StatusManagementScreenProps) {
  const queryClient = useQueryClient();
  const { page, pageSize, goToPage, changePageSize, resetPage } =
    useListPaging();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] =
    useState<StatusManagementEntityType>("student");
  const [studentStatus, setStudentStatus] =
    useState<StudentStatus>("suspended");
  const [teacherStatus, setTeacherStatus] =
    useState<TeacherStatus>("on_leave");
  const [pendingTransition, setPendingTransition] =
    useState<PendingTransition | null>(null);
  const [reason, setReason] = useState("");
  const hasInjectedFactories = Boolean(
    studentQueryOptionsFactory && teacherQueryOptionsFactory,
  );
  const supabaseClientState = useMemo(
    () =>
      hasInjectedFactories ? null : createStatusManagementSupabaseClient(),
    [hasInjectedFactories],
  );

  const listConditions = { academyId, search, page, pageSize };
  const studentOptions: StudentStatusOptions = {
    ...listConditions,
    status: studentStatus,
  };
  const teacherOptions: TeacherStatusOptions = {
    ...listConditions,
    status: teacherStatus,
  };
  const activeOptions =
    entityType === "student"
      ? studentQueryOptionsFactory?.(studentOptions) ??
        createDefaultStudentQueryOptions(
          studentOptions,
          supabaseClientState ?? createMissingSupabaseClientState(),
        )
      : teacherQueryOptionsFactory?.(teacherOptions) ??
        createDefaultTeacherQueryOptions(
          teacherOptions,
          supabaseClientState ?? createMissingSupabaseClientState(),
        );
  const activeListKind = `${entityType}:${
    entityType === "student" ? studentStatus : teacherStatus
  }`;
  const statusQuery = useQuery({
    queryKey: activeOptions.queryKey,
    queryFn: activeOptions.queryFn,
    enabled: hasInjectedFactories || !supabaseClientState?.error,
    meta: { listKind: activeListKind },
    // 같은 목록의 페이지·검색 이동 중에는 이전 결과를 유지하고, 다른 탭의 목록은 보여주지 않는다.
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.meta?.listKind === activeListKind ? previousData : undefined,
  });

  const statusMutation = useMutation({
    mutationFn: async (transition: PendingTransition & { reason?: string }) => {
      const changedAt = new Date().toISOString();

      if (transition.entityType === "student") {
        const input = {
          academyId,
          studentId: transition.entityId,
          status: transition.toStatus as "enrolled" | "suspended" | "withdrawn",
          changedAt,
          reason: transition.reason,
        };

        if (updateStudentStatus) {
          await updateStudentStatus(input);
          return;
        }

        if (!supabaseClientState?.client) {
          throw new Error("Supabase client 상태를 만들지 못했습니다.");
        }

        await updateStudentStatusApi(supabaseClientState.client, input);
        return;
      }

      const input = {
        academyId,
        teacherId: transition.entityId,
        status: transition.toStatus as "employed" | "on_leave" | "resigned",
        changedAt,
        reason: transition.reason,
      };

      if (updateTeacherStatus) {
        await updateTeacherStatus(input);
        return;
      }

      if (!supabaseClientState?.client) {
        throw new Error("Supabase client 상태를 만들지 못했습니다.");
      }

      await updateTeacherStatusApi(supabaseClientState.client, input);
    },
    onSuccess: () => {
      setPendingTransition(null);
      setReason("");
      toast.success("상태를 변경했습니다.");
      invalidateAfterPeopleChange(queryClient, academyId);
    },
    onError: (error) => {
      toast.error("상태 변경에 실패했습니다.", {
        description: toUserMessage(error),
      });
    },
  });

  const hasSearch = search.trim() !== "";
  const sharedPanelProps = {
    search,
    onSearchChange: (nextSearch: string) => {
      setSearch(nextSearch);
      resetPage();
    },
    view: statusQuery.data,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,
    onPageChange: goToPage,
    onPageSizeChange: changePageSize,
    onTransition: setPendingTransition,
  };

  return (
    <section className="grid gap-4" aria-label="휴원/퇴원 관리">
      <Tabs
        value={entityType}
        onValueChange={(value) => {
          setEntityType(value as StatusManagementEntityType);
          resetPage();
        }}
      >
        <TabsList aria-label="관리 대상">
          <TabsTrigger value="student">원생</TabsTrigger>
          <TabsTrigger value="teacher">선생님</TabsTrigger>
        </TabsList>

        <TabsContent value="student" className="mt-4">
          <ManagedStatusPanel
            {...sharedPanelProps}
            tabs={studentStatusTabs}
            value={studentStatus}
            onValueChange={(nextStatus) => {
              setStudentStatus(nextStatus);
              resetPage();
            }}
            itemLabel="원생"
            emptyMessage={
              hasSearch
                ? "조건에 맞는 원생이 없습니다."
                : "휴원/퇴원 관리 대상 원생이 없습니다."
            }
          />
        </TabsContent>

        <TabsContent value="teacher" className="mt-4">
          <ManagedStatusPanel
            {...sharedPanelProps}
            tabs={teacherStatusTabs}
            value={teacherStatus}
            onValueChange={(nextStatus) => {
              setTeacherStatus(nextStatus);
              resetPage();
            }}
            itemLabel="선생님"
            emptyMessage={
              hasSearch
                ? "조건에 맞는 선생님이 없습니다."
                : "휴직/퇴사 관리 대상 선생님이 없습니다."
            }
          />
        </TabsContent>
      </Tabs>

      <StatusTransitionDialog
        transition={pendingTransition}
        reason={reason}
        isPending={statusMutation.isPending}
        onReasonChange={setReason}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTransition(null);
            setReason("");
          }
        }}
        onConfirm={() => {
          if (!pendingTransition) {
            return;
          }

          statusMutation.mutate({
            ...pendingTransition,
            reason: requiresStatusReason(pendingTransition.toStatus)
              ? reason.trim() || undefined
              : undefined,
          });
        }}
      />

      {!hasInjectedFactories && supabaseClientState?.error ? (
        <ListStatusAlert
          message="휴원/퇴원 목록을 불러오지 못했습니다."
          detail={toUserMessage(supabaseClientState.error)}
        />
      ) : null}
    </section>
  );
}

function ManagedStatusPanel<TStatus extends StudentStatus | TeacherStatus>({
  tabs,
  value,
  onValueChange,
  search,
  onSearchChange,
  view,
  isLoading,
  error,
  itemLabel,
  emptyMessage,
  onPageChange,
  onPageSizeChange,
  onTransition,
}: {
  tabs: Array<{ value: TStatus; label: string }>;
  value: TStatus;
  onValueChange: (value: TStatus) => void;
  search: string;
  onSearchChange: (search: string) => void;
  view: ListView<StatusManagementListItem> | undefined;
  isLoading: boolean;
  error: Error | null;
  itemLabel: string;
  emptyMessage: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSizeOption) => void;
  onTransition: (transition: PendingTransition) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[auto_minmax(12rem,20rem)] md:items-end md:justify-between">
        <Tabs value={value} onValueChange={(next) => onValueChange(next as TStatus)}>
          <TabsList aria-label="상태">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ListSearchField
          label="이름 검색"
          value={search}
          onChange={onSearchChange}
          placeholder="이름, 처리 메모"
        />
      </div>

      {error ? (
        <ListStatusAlert
          message="상태 관리 목록을 불러오지 못했습니다."
          detail={toUserMessage(error)}
        />
      ) : null}
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">
          관리 목록을 불러오는 중입니다.
        </p>
      ) : null}
      {view && !error ? (
        <>
          <StatusManagementTable
            items={view.items}
            emptyMessage={emptyMessage}
            onTransition={onTransition}
          />
          <ListPagination
            itemLabel={itemLabel}
            countUnit="명"
            view={view}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      ) : null}
    </div>
  );
}

function StatusManagementTable({
  items,
  emptyMessage,
  onTransition,
}: {
  items: StatusManagementListItem[];
  emptyMessage: string;
  onTransition: (transition: PendingTransition) => void;
}) {
  const [selectedItem, setSelectedItem] =
    useState<StatusManagementListItem | null>(null);

  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <>
      <Table aria-label="휴원/퇴원 관리 목록" className="lg:table-fixed">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3 lg:w-[28%]">대상</TableHead>
            <TableHead className="px-4 py-3 lg:w-[24%]">처리/보관</TableHead>
            <TableHead className="px-4 py-3 lg:w-[28%]">처리 메모</TableHead>
            <TableHead className="px-4 py-3 text-right lg:w-[20%]">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.entityType}-${item.entityId}`}>
              <TableCell label="대상" className="px-4 py-3 whitespace-normal">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="outline">{item.statusLabel}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{item.primaryInfo || "-"}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.secondaryInfo || "-"}</span>
                  </div>
                  {item.detailSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.detailSummary}
                    </p>
                  ) : null}
                </div>
              </TableCell>
              <TableCell label="처리/보관" className="px-4 py-3 text-sm whitespace-normal">
                <div className="grid gap-1">
                  <span>처리일 {item.changedOn}</span>
                  <span className="text-muted-foreground">
                    {formatRetentionSummary(item)}
                  </span>
                </div>
              </TableCell>
              <TableCell label="처리 메모" className="px-4 py-3 text-sm whitespace-normal">
                <span className="line-clamp-2 text-muted-foreground">
                  {item.statusReason || "-"}
                </span>
              </TableCell>
              <TableCell label="관리" className="px-4 py-3 whitespace-normal">
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${item.name} 자세히보기`}
                    title="자세히보기"
                    onClick={() => setSelectedItem(item)}
                  >
                    <Eye aria-hidden="true" />
                    <span className="sr-only">자세히보기</span>
                  </Button>
                  {getTransitions(item).map((transition) => (
                    <Button
                      key={`${item.entityId}-${transition.toStatus}`}
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`${item.name} ${transition.toLabel} 처리`}
                      onClick={() =>
                        onTransition({
                          entityType: item.entityType,
                          entityId: item.entityId,
                          name: item.name,
                          fromStatus: item.status,
                          toStatus: transition.toStatus,
                          fromLabel: item.statusLabel,
                          toLabel: transition.toLabel,
                        })
                      }
                    >
                      <UserRoundCheck aria-hidden="true" />
                      {transition.toLabel} 처리
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <StatusManagementDetailDialog
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
      />
    </>
  );
}

function StatusManagementDetailDialog({
  item,
  onOpenChange,
}: {
  item: StatusManagementListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteUnavailableNoticeId = useId();
  // 퇴원 원생과 퇴사 선생님은 기록 보존을 위해 삭제하지 않고 보관 상태로 둔다.
  const isDeleteUnavailable = item?.status === "withdrawn" || item?.status === "resigned";

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {item ? `${item.name} 상태 상세` : "상태 상세"}
          </DialogTitle>
          <DialogDescription>
            상태 변경 이력에서 가져온 처리 정보와 메모를 확인합니다.
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border bg-background p-4 sm:grid-cols-2">
              <DetailItem label="이름" value={item.name} />
              <DetailItem label="상태" value={item.statusLabel} />
              <DetailItem label="처리일" value={item.changedOn} />
              <DetailItem label="보관 만료일" value={item.retentionUntil ?? "-"} />
              <DetailItem
                label="남은 일수"
                value={
                  item.daysRemaining === undefined
                    ? "-"
                    : `${item.daysRemaining}일`
                }
              />
              <DetailItem label="자동 보관 상태" value={item.archiveStateLabel} />
              <DetailItem label="주요 정보" value={item.primaryInfo || "-"} />
              <DetailItem label="보조 정보" value={item.secondaryInfo || "-"} />
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">처리 메모</p>
              <p className="min-h-20 rounded-md border border-border bg-muted/30 p-3 text-sm leading-6">
                {item.statusReason || "남긴 메모가 없습니다."}
              </p>
            </div>
            {isDeleteUnavailable ? (
              <p
                id={deleteUnavailableNoticeId}
                className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
              >
                결제·회차권·급여 기록을 보존하기 위해 삭제할 수 없습니다. 보관 상태로 유지됩니다.
              </p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          {isDeleteUnavailable ? (
            <Button
              type="button"
              variant="destructive"
              disabled
              aria-describedby={deleteUnavailableNoticeId}
            >
              삭제
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatRetentionSummary(item: StatusManagementListItem) {
  if (!item.retentionUntil) {
    return item.archiveStateLabel;
  }

  const daysText =
    item.daysRemaining === undefined ? "" : ` · ${item.daysRemaining}일 남음`;

  return `${item.retentionUntil}${daysText} · ${item.archiveStateLabel}`;
}

function StatusTransitionDialog({
  transition,
  reason,
  isPending,
  onReasonChange,
  onOpenChange,
  onConfirm,
}: {
  transition: PendingTransition | null;
  reason: string;
  isPending: boolean;
  onReasonChange: (reason: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const shouldShowReason = transition
    ? requiresStatusReason(transition.toStatus)
    : false;

  return (
    <AlertDialog open={Boolean(transition)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>
            상태 변경은 감사 로그에 남고, 퇴원/퇴사는 30일 보관 후 자동으로
            보관 처리됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {transition ? (
          <div className="grid gap-3">
            <div className="grid gap-1 rounded-md border border-border bg-muted/40 p-3 text-sm">
              <span className="font-semibold">{transition.name}</span>
              <span>
                {transition.fromLabel} -&gt; {transition.toLabel}
              </span>
            </div>
            {shouldShowReason ? (
              <label className="grid gap-1 text-sm font-medium">
                <span>상태 변경 메모</span>
                <Textarea
                  aria-label="상태 변경 메모"
                  value={reason}
                  onChange={(event) => onReasonChange(event.target.value)}
                  placeholder="선택 입력"
                />
              </label>
            ) : null}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            처리
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function requiresStatusReason(
  status: PendingTransition["toStatus"],
) {
  return ["suspended", "withdrawn", "on_leave", "resigned"].includes(status);
}

function getTransitions(item: StatusManagementListItem) {
  if (item.entityType === "student") {
    if (item.status === "suspended") {
      return [
        { toStatus: "enrolled" as const, toLabel: "재원" },
        { toStatus: "withdrawn" as const, toLabel: "퇴원" },
      ];
    }

    return [
      { toStatus: "enrolled" as const, toLabel: "재원" },
      { toStatus: "suspended" as const, toLabel: "휴원" },
    ];
  }

  if (item.status === "on_leave") {
    return [
      { toStatus: "employed" as const, toLabel: "재직" },
      { toStatus: "resigned" as const, toLabel: "퇴사" },
    ];
  }

  return [
    { toStatus: "employed" as const, toLabel: "재직" },
    { toStatus: "on_leave" as const, toLabel: "휴직" },
  ];
}

function createDefaultStudentQueryOptions(
  options: StudentStatusOptions,
  supabaseClientState: SupabaseClientState,
): StatusManagementQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.statusManagement.list(options.academyId, {
        entityType: "student",
        status: options.status,
        q: options.search,
        page: String(options.page ?? 1),
        pageSize: String(options.pageSize ?? ""),
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createStudentStatusManagementQueryOptions(
    supabaseClientState.client,
    options,
  );
}

function createDefaultTeacherQueryOptions(
  options: TeacherStatusOptions,
  supabaseClientState: SupabaseClientState,
): StatusManagementQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.statusManagement.list(options.academyId, {
        entityType: "teacher",
        status: options.status,
        q: options.search,
        page: String(options.page ?? 1),
        pageSize: String(options.pageSize ?? ""),
      }),
      queryFn: async () => {
        throw supabaseClientState.error;
      },
    };
  }

  return createTeacherStatusManagementQueryOptions(
    supabaseClientState.client,
    options,
  );
}

function createStatusManagementSupabaseClient(): SupabaseClientState {
  try {
    const client: unknown = createSupabaseBrowserClient();

    return {
      client: client as StatusManagementSupabaseClient,
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

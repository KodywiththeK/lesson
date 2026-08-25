"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { RotateCcw, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";

import { ListStatusAlert } from "@/components/management/list-controls";
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
import type { ListView } from "@/domain/common-list";
import type {
  ManagedStatus,
  StatusManagementEntityType,
  StatusManagementListItem,
} from "@/domain/status-management";
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

export type StatusManagementScreenProps = {
  academyId: string;
  academyName: string;
  studentQueryOptionsFactory?: (options: {
    academyId: string;
    status: StudentStatus;
    today?: string;
  }) => StatusManagementQueryOptions;
  teacherQueryOptionsFactory?: (options: {
    academyId: string;
    status: TeacherStatus;
    today?: string;
  }) => StatusManagementQueryOptions;
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
  academyName,
  studentQueryOptionsFactory,
  teacherQueryOptionsFactory,
  updateStudentStatus,
  updateTeacherStatus,
}: StatusManagementScreenProps) {
  const queryClient = useQueryClient();
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

  const activeOptions =
    entityType === "student"
      ? studentQueryOptionsFactory?.({
          academyId,
          status: studentStatus,
        }) ??
        createDefaultStudentQueryOptions(
          { academyId, status: studentStatus },
          supabaseClientState ?? createMissingSupabaseClientState(),
        )
      : teacherQueryOptionsFactory?.({
          academyId,
          status: teacherStatus,
        }) ??
        createDefaultTeacherQueryOptions(
          { academyId, status: teacherStatus },
          supabaseClientState ?? createMissingSupabaseClientState(),
        );
  const statusQuery = useQuery({
    queryKey: activeOptions.queryKey,
    queryFn: activeOptions.queryFn,
    enabled: hasInjectedFactories || !supabaseClientState?.error,
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
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "students"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "teachers"],
      });
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.academy(academyId), "status-management"],
      });
    },
    onError: (error) => {
      toast.error("상태 변경에 실패했습니다.", {
        description: error instanceof Error ? error.message : String(error),
      });
    },
  });

  const items = statusQuery.data?.items ?? [];

  return (
    <section className="grid gap-4" aria-labelledby="status-management-heading">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {academyName}
        </p>
        <h2 id="status-management-heading" className="text-2xl font-semibold">
          휴원/퇴원 관리
        </h2>
      </div>

      <Tabs
        value={entityType}
        onValueChange={(value) =>
          setEntityType(value as StatusManagementEntityType)
        }
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList aria-label="관리 대상">
            <TabsTrigger value="student">원생</TabsTrigger>
            <TabsTrigger value="teacher">선생님</TabsTrigger>
          </TabsList>
          <Button
            type="button"
            variant="outline"
            onClick={() => void statusQuery.refetch()}
          >
            <RotateCcw aria-hidden="true" />
            새로고침
          </Button>
        </div>

        <TabsContent value="student" className="mt-4">
          <ManagedStatusPanel
            tabs={studentStatusTabs}
            value={studentStatus}
            onValueChange={setStudentStatus}
            items={items}
            isLoading={statusQuery.isLoading}
            error={statusQuery.error}
            emptyMessage="휴원/퇴원 관리 대상 원생이 없습니다."
            onTransition={setPendingTransition}
          />
        </TabsContent>

        <TabsContent value="teacher" className="mt-4">
          <ManagedStatusPanel
            tabs={teacherStatusTabs}
            value={teacherStatus}
            onValueChange={setTeacherStatus}
            items={items}
            isLoading={statusQuery.isLoading}
            error={statusQuery.error}
            emptyMessage="휴직/퇴사 관리 대상 선생님이 없습니다."
            onTransition={setPendingTransition}
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
            reason: reason.trim() || undefined,
          });
        }}
      />

      {!hasInjectedFactories && supabaseClientState?.error ? (
        <ListStatusAlert
          message="Supabase 환경변수가 설정되면 휴원/퇴원 목록을 불러올 수 있습니다."
          detail={supabaseClientState.error.message}
        />
      ) : null}
    </section>
  );
}

function ManagedStatusPanel<TStatus extends StudentStatus | TeacherStatus>({
  tabs,
  value,
  onValueChange,
  items,
  isLoading,
  error,
  emptyMessage,
  onTransition,
}: {
  tabs: Array<{ value: TStatus; label: string }>;
  value: TStatus;
  onValueChange: (value: TStatus) => void;
  items: StatusManagementListItem[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  onTransition: (transition: PendingTransition) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <Tabs value={value} onValueChange={(next) => onValueChange(next as TStatus)}>
          <TabsList aria-label="상태">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {error ? (
        <ListStatusAlert
          message="상태 관리 목록을 불러오지 못했습니다."
          detail={error.message}
        />
      ) : null}
      {isLoading ? (
        <p className="p-4 text-sm text-muted-foreground">
          관리 목록을 불러오는 중입니다.
        </p>
      ) : null}
      {!isLoading && !error ? (
        <StatusManagementTable
          items={items}
          emptyMessage={emptyMessage}
          onTransition={onTransition}
        />
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
  if (items.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="휴원/퇴원 관리 목록" className="min-w-[58rem]">
        <TableHeader className="bg-muted text-muted-foreground">
          <TableRow>
            <TableHead className="px-4 py-3">이름</TableHead>
            <TableHead className="px-4 py-3">상태</TableHead>
            <TableHead className="px-4 py-3">정보</TableHead>
            <TableHead className="px-4 py-3">처리일</TableHead>
            <TableHead className="px-4 py-3">보관 만료일</TableHead>
            <TableHead className="px-4 py-3">남은 일수</TableHead>
            <TableHead className="px-4 py-3">자동 보관 상태</TableHead>
            <TableHead className="px-4 py-3 text-right">상태 변경</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.entityType}-${item.entityId}`}>
              <TableCell className="px-4 py-3 font-medium">
                {item.name}
              </TableCell>
              <TableCell className="px-4 py-3">
                <Badge variant="outline">{item.statusLabel}</Badge>
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="grid gap-1 text-sm">
                  <span>{item.primaryInfo || "-"}</span>
                  <span className="text-muted-foreground">
                    {item.secondaryInfo || "-"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3">{item.changedOn}</TableCell>
              <TableCell className="px-4 py-3">
                {item.retentionUntil ?? "-"}
              </TableCell>
              <TableCell className="px-4 py-3">
                {item.daysRemaining === undefined
                  ? "-"
                  : `${item.daysRemaining}일`}
              </TableCell>
              <TableCell className="px-4 py-3">
                {item.archiveStateLabel}
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex justify-end gap-2">
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
    </div>
  );
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
  return (
    <AlertDialog open={Boolean(transition)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>상태 변경 확인</AlertDialogTitle>
          <AlertDialogDescription>
            상태 변경은 감사 로그에 남고, 퇴원/퇴사는 30일 보관 후 자동
            archive 처리됩니다.
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
            <label className="grid gap-1 text-sm font-medium">
              <span>상태 변경 메모</span>
              <Textarea
                aria-label="상태 변경 메모"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="선택 입력"
              />
            </label>
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
  options: {
    academyId: string;
    status: StudentStatus;
    today?: string;
  },
  supabaseClientState: SupabaseClientState,
): StatusManagementQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.statusManagement.list(options.academyId, {
        entityType: "student",
        status: options.status,
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
  options: {
    academyId: string;
    status: TeacherStatus;
    today?: string;
  },
  supabaseClientState: SupabaseClientState,
): StatusManagementQueryOptions {
  if (supabaseClientState.error) {
    return {
      queryKey: queryKeys.statusManagement.list(options.academyId, {
        entityType: "teacher",
        status: options.status,
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

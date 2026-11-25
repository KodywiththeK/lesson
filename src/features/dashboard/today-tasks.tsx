"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { StatusTabs } from "@/components/management/status-tabs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  buildDailyTasks,
  splitDailyTasksByState,
  type DailyTaskSource,
  type DailyTaskState,
  type DailyTaskWithState,
} from "@/domain/daily-tasks";
import { getFinanceToday } from "@/domain/finance-date";
import type { PermissionContext } from "@/domain/permissions";
import { formatWon } from "@/domain/money-input";
import {
  fetchDailyTaskSource,
  fetchDailyTaskStates,
  setDailyTaskState,
  type DailyTasksSupabaseClient,
} from "@/lib/api/daily-tasks";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type TodayTasksDataAccess = {
  loadSource: () => Promise<DailyTaskSource>;
  loadStates: () => Promise<DailyTaskState[]>;
  saveState: (input: { taskKey: string; state: DailyTaskState["state"] | null }) => Promise<void>;
};

type TodayTasksProps = {
  academyId: string;
  permissionContext: PermissionContext;
  /** 테스트·데모에서 고정할 오늘(한국 시간). 없으면 지금 날짜. */
  today?: string;
  /** 테스트·데모용 데이터 접근. 없으면 Supabase RPC를 쓴다. */
  dataAccess?: TodayTasksDataAccess;
};

const TAB_OPTIONS = [
  { value: "open", label: "할 일", dotClassName: "bg-primary" },
  { value: "waiting", label: "답변 대기", dotClassName: "bg-warning" },
] as const;

/** 대시보드 맨 위의 '오늘 할 일'. 할 일은 원천 데이터에서 만들고, 답변 대기·완료는 학원 전체가 공유한다. */
export function TodayTasks({ academyId, permissionContext, today, dataAccess }: TodayTasksProps) {
  const role = permissionContext.role;
  const teacherId = permissionContext.teacherId;
  const date = today ?? getFinanceToday();
  const access = useMemo(
    () => dataAccess ?? createSupabaseDataAccess(academyId, date),
    [dataAccess, academyId, date],
  );
  const queryClient = useQueryClient();
  const statesQueryKey = queryKeys.dailyTasks.states(academyId);
  const sourceQuery = useQuery({
    queryKey: queryKeys.dailyTasks.source(academyId, date),
    queryFn: access.loadSource,
  });
  const statesQuery = useQuery({ queryKey: statesQueryKey, queryFn: access.loadStates });
  const stateMutation = useMutation({
    mutationFn: (input: StateChange) => access.saveState(input),
    // 누른 즉시 목록을 옮기고, 실패하면 서버 상태로 되돌린다.
    onMutate: ({ taskKey, state }) => {
      queryClient.setQueryData<DailyTaskState[]>(statesQueryKey, (current = []) => [
        ...current.filter((item) => item.taskKey !== taskKey),
        ...(state ? [{ taskKey, state, updatedByName: null, updatedAt: new Date().toISOString() }] : []),
      ]);
    },
    onError: (error) => toast.error(toUserMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: statesQueryKey }),
  });
  const { open, waitingReply } = useMemo(() => {
    const tasks =
      sourceQuery.data && role !== "anonymous"
        ? buildDailyTasks(sourceQuery.data, { role, today: date, teacherId })
        : [];
    return splitDailyTasksByState(tasks, statesQuery.data ?? []);
  }, [sourceQuery.data, statesQuery.data, role, date, teacherId]);

  if (role === "anonymous") {
    return null;
  }

  const isLoading = sourceQuery.isPending || statesQuery.isPending;
  const loadError = sourceQuery.error ?? statesQuery.error;
  // 학부모 연락은 원장·데스크가 맡아 선생님은 보기만 한다(서버도 같은 규칙).
  const onChangeState = role === "teacher" ? null : (change: StateChange) => stateMutation.mutate(change);
  const listProps = { isLoading, error: loadError, isSaving: stateMutation.isPending, onChangeState };

  return (
    <SectionCard role="region" aria-labelledby="today-tasks-heading" className="gap-3">
      <SectionHeader
        headingId="today-tasks-heading"
        title="오늘 할 일"
        description={onChangeState ? "처리하면 목록에서 저절로 빠집니다." : "상태는 원장·데스크가 바꿉니다."}
      />
      <Tabs defaultValue="open">
        <StatusTabs
          label="오늘 할 일 구분"
          options={TAB_OPTIONS.map((option) => ({
            ...option,
            label: `${option.label} ${option.value === "open" ? open.length : waitingReply.length}`,
          }))}
        />
        <TabsContent value="open" className="mt-3">
          <TaskList
            {...listProps}
            label="할 일 목록"
            tasks={open}
            emptyMessage="오늘 챙길 일이 없습니다."
            primaryAction={{ label: "답변 대기로", state: "waiting_reply" }}
          />
        </TabsContent>
        <TabsContent value="waiting" className="mt-3">
          <TaskList
            {...listProps}
            label="답변 대기 목록"
            tasks={waitingReply}
            emptyMessage="답변을 기다리는 일이 없습니다."
            primaryAction={{ label: "할 일로 되돌리기", state: null }}
          />
        </TabsContent>
      </Tabs>
    </SectionCard>
  );
}

type StateChange = { taskKey: string; state: DailyTaskState["state"] | null };

function TaskList({
  label,
  tasks,
  isLoading,
  error,
  emptyMessage,
  isSaving,
  onChangeState,
  primaryAction,
}: {
  label: string;
  tasks: DailyTaskWithState[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  isSaving: boolean;
  /** null이면 보기만 한다(선생님). */
  onChangeState: ((change: StateChange) => void) | null;
  primaryAction: { label: string; state: DailyTaskState["state"] | null };
}) {
  if (error) {
    return <EmptyState role="alert">{toUserMessage(error)}</EmptyState>;
  }

  if (isLoading) {
    return <EmptyState role="status">오늘 할 일을 불러오는 중입니다.</EmptyState>;
  }

  if (tasks.length === 0) {
    return <EmptyState>{emptyMessage}</EmptyState>;
  }

  return (
    <ul aria-label={label} aria-busy={isSaving} className="divide-y divide-border">
      {tasks.map((task) => (
        <li key={task.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {task.href ? (
              <Link href={task.href} className="text-sm font-medium hover:underline">
                {task.title}
              </Link>
            ) : (
              <span className="text-sm font-medium">{task.title}</span>
            )}
            <p className="mt-0.5 text-sm text-muted-foreground">
              {[task.detail, task.amount === undefined ? null : formatWon(task.amount), describeState(task)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {onChangeState ? (
            <div className="flex flex-none gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onChangeState({ taskKey: task.key, state: primaryAction.state })}
              >
                {primaryAction.label}
              </Button>
              {task.completion === "manual" ? (
                <Button size="sm" variant="secondary" onClick={() => onChangeState({ taskKey: task.key, state: "done" })}>
                  완료
                </Button>
              ) : null}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function describeState(task: DailyTaskWithState) {
  if (!task.stateUpdatedAt) {
    return null;
  }

  const time = new Date(task.stateUpdatedAt).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${task.stateUpdatedByName ?? "알 수 없음"} · ${time}`;
}

function createSupabaseDataAccess(academyId: string, date: string): TodayTasksDataAccess {
  const client = () => createSupabaseBrowserClient() as unknown as DailyTasksSupabaseClient;

  return {
    loadSource: () => fetchDailyTaskSource(client(), { academyId, date }),
    loadStates: () => fetchDailyTaskStates(client(), { academyId }),
    saveState: (input) => setDailyTaskState(client(), { academyId, ...input }),
  };
}

"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import {
  buildDailyTasks,
  groupDailyTasks,
  splitDailyTasksByState,
  type DailyTaskGroupKey,
  type DailyTaskSource,
  type DailyTaskState,
  type DailyTaskStateChange,
} from "@/domain/daily-tasks";
import { getFinanceToday } from "@/domain/finance-date";
import type { PermissionContext } from "@/domain/permissions";
import {
  fetchDailyTaskSource,
  fetchDailyTaskStates,
  setDailyTaskState,
  type DailyTasksSupabaseClient,
} from "@/lib/api/daily-tasks";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { TodayTaskGroupDialog } from "./today-task-group-dialog";
import { createSupabaseTaskProcessing, type TodayTaskProcessing } from "./today-task-processing";

export type TodayTasksDataAccess = {
  loadSource: () => Promise<DailyTaskSource>;
  loadStates: () => Promise<DailyTaskState[]>;
  saveState: (input: DailyTaskStateChange) => Promise<void>;
};

type TodayTasksProps = {
  academyId: string;
  permissionContext: PermissionContext;
  /** 테스트·데모에서 고정할 오늘(한국 시간). 없으면 지금 날짜. */
  today?: string;
  /** 테스트·데모용 데이터 접근. 없으면 Supabase RPC를 쓴다. */
  dataAccess?: TodayTasksDataAccess;
  /** 테스트·데모용 모달 처리. 없으면 각 화면의 Supabase API를 쓴다. */
  processing?: TodayTaskProcessing;
};

/**
 * 대시보드 맨 위의 '오늘 할 일'. 업무별 칸에 건수만 보여 주고, 칸을 누르면 모달에서 확인·처리한다.
 * 할 일은 원천 데이터에서 만들고, 답변 대기·완료는 학원 전체가 공유한다.
 */
export function TodayTasks({ academyId, permissionContext, today, dataAccess, processing }: TodayTasksProps) {
  const role = permissionContext.role;
  const teacherId = permissionContext.teacherId;
  const date = today ?? getFinanceToday();
  const access = useMemo(
    () => dataAccess ?? createSupabaseDataAccess(academyId, date),
    [dataAccess, academyId, date],
  );
  const taskProcessing = useMemo(
    () => processing ?? createSupabaseTaskProcessing(academyId),
    [processing, academyId],
  );
  const [openGroupKey, setOpenGroupKey] = useState<DailyTaskGroupKey | null>(null);
  const queryClient = useQueryClient();
  const statesQueryKey = queryKeys.dailyTasks.states(academyId);
  const sourceQuery = useQuery({
    queryKey: queryKeys.dailyTasks.source(academyId, date),
    queryFn: access.loadSource,
  });
  const statesQuery = useQuery({ queryKey: statesQueryKey, queryFn: access.loadStates });
  const stateMutation = useMutation({
    mutationFn: (input: DailyTaskStateChange) => access.saveState(input),
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
  const groups = useMemo(() => {
    if (role === "anonymous") {
      return [];
    }
    const tasks = sourceQuery.data ? buildDailyTasks(sourceQuery.data, { role, today: date, teacherId }) : [];
    return groupDailyTasks(splitDailyTasksByState(tasks, statesQuery.data ?? []), role);
  }, [sourceQuery.data, statesQuery.data, role, date, teacherId]);

  if (role === "anonymous") {
    return null;
  }

  const isLoading = sourceQuery.isPending || statesQuery.isPending;
  const loadError = sourceQuery.error ?? statesQuery.error;
  // 학부모 연락은 원장·데스크가 맡아 선생님은 보기만 한다(서버도 같은 규칙).
  const onChangeState = role === "teacher" ? null : (change: DailyTaskStateChange) => stateMutation.mutate(change);
  const openGroup = groups.find((group) => group.key === openGroupKey) ?? null;

  return (
    <SectionCard role="region" aria-labelledby="today-tasks-heading" className="gap-3">
      <SectionHeader
        headingId="today-tasks-heading"
        title="오늘 할 일"
        description={onChangeState ? "칸을 누르면 한 건씩 확인하고 처리합니다." : "칸을 누르면 담당 학생 일을 확인합니다."}
      />
      {loadError ? (
        <EmptyState role="alert">{toUserMessage(loadError)}</EmptyState>
      ) : isLoading ? (
        <EmptyState role="status">오늘 할 일을 불러오는 중입니다.</EmptyState>
      ) : (
        <ul aria-label="오늘 할 일 칸" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {groups.map((group) => (
            <li key={group.key}>
              <Button
                type="button"
                variant="outline"
                disabled={group.tasks.length === 0}
                aria-label={`${group.title} ${group.tasks.length}건`}
                className="h-auto w-full flex-col items-start gap-1 rounded-xl p-3 text-left"
                onClick={() => setOpenGroupKey(group.key)}
              >
                <span className="text-sm font-medium text-muted-foreground">{group.title}</span>
                <span className="text-2xl font-semibold tabular-nums">{group.tasks.length}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      <TodayTaskGroupDialog
        group={openGroup}
        academyId={academyId}
        today={date}
        processing={taskProcessing}
        isSaving={stateMutation.isPending}
        onChangeState={onChangeState}
        onClose={() => setOpenGroupKey(null)}
        onProcessed={async () => {
          // 처리하면 다른 화면 캐시도 낡으므로 학원 범위를 낡음으로만 표시하고(그 화면을 열 때 다시 읽는다), 할 일 원천만 바로 다시 읽는다.
          await queryClient.invalidateQueries({ queryKey: queryKeys.academy(academyId), refetchType: "none" });
          await queryClient.refetchQueries({ queryKey: queryKeys.dailyTasks.source(academyId, date) });
        }}
      />
    </SectionCard>
  );
}

function createSupabaseDataAccess(academyId: string, date: string): TodayTasksDataAccess {
  const client = () => createSupabaseBrowserClient() as unknown as DailyTasksSupabaseClient;

  return {
    loadSource: () => fetchDailyTaskSource(client(), { academyId, date }),
    loadStates: () => fetchDailyTaskStates(client(), { academyId }),
    saveState: (input) => setDailyTaskState(client(), { academyId, ...input }),
  };
}

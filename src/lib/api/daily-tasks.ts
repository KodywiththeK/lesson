import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type DailyTaskStateRow = {
  task_key: string;
  state: DailyTaskState["state"];
  updated_by_name: string | null;
  updated_at: string;
};

type DailyTaskRpcArgs = {
  get_daily_task_source: { p_academy_id: string; p_date: string };
  list_daily_task_states: { p_academy_id: string };
  set_daily_task_state: { p_academy_id: string; p_task_key: string; p_state: DailyTaskState["state"] | null };
};

type DailyTaskRpcResult = {
  get_daily_task_source: Partial<DailyTaskSource>;
  list_daily_task_states: DailyTaskStateRow[];
  set_daily_task_state: unknown;
};

export type DailyTasksSupabaseClient = {
  rpc<TName extends keyof DailyTaskRpcArgs>(
    name: TName,
    args: DailyTaskRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<DailyTaskRpcResult[TName]>>;
};

const EMPTY_SOURCE: DailyTaskSource = {
  unresolvedAbsences: [],
  tuitions: [],
  lessonTickets: [],
  unpaidBookReleases: [],
  lessonChanges: [],
  consultations: [],
  pendingBookOrders: [],
};

/** 오늘 할 일 원천. 금액·범위는 서버가 로그인한 사람의 역할로 정한다. */
export async function fetchDailyTaskSource(
  supabase: DailyTasksSupabaseClient,
  input: { academyId: string; date: string },
): Promise<DailyTaskSource> {
  const { data, error } = await supabase.rpc("get_daily_task_source", {
    p_academy_id: input.academyId,
    p_date: input.date,
  });

  if (error) {
    throw new Error(`오늘 할 일을 불러오지 못했습니다: ${error.message}`);
  }

  return { ...EMPTY_SOURCE, ...data };
}

export async function fetchDailyTaskStates(
  supabase: DailyTasksSupabaseClient,
  input: { academyId: string },
): Promise<DailyTaskState[]> {
  const { data, error } = await supabase.rpc("list_daily_task_states", { p_academy_id: input.academyId });

  if (error) {
    throw new Error(`오늘 할 일 상태를 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    taskKey: row.task_key,
    state: row.state,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
  }));
}

/** state가 null이면 상태를 지워 '할 일'로 되돌린다. */
export async function setDailyTaskState(
  supabase: DailyTasksSupabaseClient,
  input: { academyId: string; taskKey: string; state: DailyTaskState["state"] | null },
): Promise<void> {
  const { error } = await supabase.rpc("set_daily_task_state", {
    p_academy_id: input.academyId,
    p_task_key: input.taskKey,
    p_state: input.state,
  });

  if (error) {
    throw new Error(`할 일 상태를 바꾸지 못했습니다: ${error.message}`);
  }
}

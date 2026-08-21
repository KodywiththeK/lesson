type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type MonthlyMemoUpsertBuilder = {
  select(select: "id"): PromiseLike<SupabaseResult<Array<{ id: string }>>>;
};

type MonthlyMemoFromBuilder = {
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): MonthlyMemoUpsertBuilder;
};

export type MonthlyMemoSupabaseClient = {
  from(table: "monthly_memos"): MonthlyMemoFromBuilder;
};

export type SaveMonthlyMemoInput = {
  academyId: string;
  month: string;
  content: string;
};

export async function saveMonthlyMemo(
  supabase: MonthlyMemoSupabaseClient,
  input: SaveMonthlyMemoInput,
) {
  const { error } = await supabase
    .from("monthly_memos")
    .upsert(
      {
        academy_id: input.academyId,
        month: input.month,
        content: input.content,
        unread: false,
      },
      {
        onConflict: "academy_id,month",
      },
    )
    .select("id");

  if (error) {
    throw new Error(`메모를 저장하지 못했습니다: ${error.message}`);
  }
}

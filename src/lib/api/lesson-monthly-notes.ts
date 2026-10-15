import type { MonthlyMemoLessonKind } from "@/domain/monthly-memo";

type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

type LessonMonthlyNoteRow = {
  content: string | null;
  unread: boolean | null;
  updated_at: string;
};

type LessonMonthlyNoteFilterBuilder = {
  eq(
    column: "academy_id" | "lesson_kind" | "month",
    value: string,
  ): LessonMonthlyNoteFilterBuilder;
  select(select: typeof LESSON_MONTHLY_NOTE_SELECT): LessonMonthlyNoteFilterBuilder;
  single(): PromiseLike<SupabaseResult<LessonMonthlyNoteRow>>;
  maybeSingle(): PromiseLike<SupabaseResult<LessonMonthlyNoteRow>>;
};

type LessonMonthlyNoteFromBuilder = {
  select(select: typeof LESSON_MONTHLY_NOTE_SELECT): LessonMonthlyNoteFilterBuilder;
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): LessonMonthlyNoteFilterBuilder;
  update(values: Record<string, unknown>): LessonMonthlyNoteFilterBuilder;
};

export type LessonMonthlyNoteSupabaseClient = {
  from(table: "monthly_memos"): LessonMonthlyNoteFromBuilder;
};

export type LessonMonthlyNote = {
  content: string;
  unread: boolean;
  updatedAt: string;
};

export type LessonMonthlyNoteKey = {
  academyId: string;
  lessonKind: MonthlyMemoLessonKind;
  month: string;
};

export type SaveLessonMonthlyNoteInput = LessonMonthlyNoteKey & {
  content: string;
};

const LESSON_MONTHLY_NOTE_SELECT = "content, unread, updated_at";
const LESSON_MONTHLY_NOTE_CONFLICT_TARGET = "academy_id,lesson_kind,month";

/** 그 달의 메모지를 불러온다. 아직 적은 적이 없으면 null이다. */
export async function fetchLessonMonthlyNote(
  supabase: LessonMonthlyNoteSupabaseClient,
  key: LessonMonthlyNoteKey,
): Promise<LessonMonthlyNote | null> {
  const { data, error } = await filterByKey(
    supabase.from("monthly_memos").select(LESSON_MONTHLY_NOTE_SELECT),
    key,
  ).maybeSingle();

  if (error) {
    throw new Error(`월별 메모를 불러오지 못했습니다: ${error.message}`);
  }

  return data ? toLessonMonthlyNote(data) : null;
}

/** 새 내용은 항상 미확인으로 저장한다. 확인은 markLessonMonthlyNoteRead로만 해제한다. */
export async function saveLessonMonthlyNote(
  supabase: LessonMonthlyNoteSupabaseClient,
  input: SaveLessonMonthlyNoteInput,
): Promise<LessonMonthlyNote> {
  const { data, error } = await supabase
    .from("monthly_memos")
    .upsert(
      {
        academy_id: input.academyId,
        lesson_kind: input.lessonKind,
        month: input.month,
        content: input.content,
        unread: true,
      },
      { onConflict: LESSON_MONTHLY_NOTE_CONFLICT_TARGET },
    )
    .select(LESSON_MONTHLY_NOTE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `월별 메모를 저장하지 못했습니다: ${error?.message ?? "응답이 비어 있습니다."}`,
    );
  }

  return toLessonMonthlyNote(data);
}

export async function markLessonMonthlyNoteRead(
  supabase: LessonMonthlyNoteSupabaseClient,
  key: LessonMonthlyNoteKey,
): Promise<LessonMonthlyNote> {
  const { data, error } = await filterByKey(
    supabase.from("monthly_memos").update({ unread: false }),
    key,
  )
    .select(LESSON_MONTHLY_NOTE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `월별 메모를 확인 처리하지 못했습니다: ${error?.message ?? "응답이 비어 있습니다."}`,
    );
  }

  return toLessonMonthlyNote(data);
}

function filterByKey(
  builder: LessonMonthlyNoteFilterBuilder,
  key: LessonMonthlyNoteKey,
) {
  return builder
    .eq("academy_id", key.academyId)
    .eq("lesson_kind", key.lessonKind)
    .eq("month", key.month);
}

function toLessonMonthlyNote(row: LessonMonthlyNoteRow): LessonMonthlyNote {
  return {
    content: row.content ?? "",
    unread: row.unread ?? false,
    updatedAt: row.updated_at,
  };
}

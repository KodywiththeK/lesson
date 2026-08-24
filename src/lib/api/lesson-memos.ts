type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type LessonMemoKind = "academy" | "private";
export type EntityMemoTargetType = "student" | "teacher";

type LessonMemoSelectBuilder = {
  select(select: "id"): PromiseLike<SupabaseResult<Array<{ id: string }>>>;
};

type LessonCalendarMemoFromBuilder = {
  upsert(
    values: Record<string, unknown>,
    options: { onConflict: string },
  ): LessonMemoSelectBuilder;
};

type EntityMemoFromBuilder = {
  insert(values: Record<string, unknown>): LessonMemoSelectBuilder;
};

export type LessonMemoSupabaseClient = {
  from(table: "lesson_calendar_memos"): LessonCalendarMemoFromBuilder;
  from(table: "entity_memos"): EntityMemoFromBuilder;
};

export type LessonCalendarMemo = {
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  content: string;
  unread: boolean;
};

export type SaveLessonCalendarMemoInput = {
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  content: string;
};

export type SaveEntityMemoInput = {
  academyId: string;
  targetType: EntityMemoTargetType;
  targetId: string;
  targetName: string;
  content: string;
  memoDate: string;
};

export async function saveLessonCalendarMemo(
  supabase: LessonMemoSupabaseClient,
  input: SaveLessonCalendarMemoInput,
) {
  const { error } = await supabase
    .from("lesson_calendar_memos")
    .upsert(
      {
        academy_id: input.academyId,
        lesson_kind: input.lessonKind,
        memo_date: input.date,
        content: input.content,
        unread: false,
      },
      {
        onConflict: "academy_id,lesson_kind,memo_date",
      },
    )
    .select("id");

  if (error) {
    throw new Error(`일자 메모를 저장하지 못했습니다: ${error.message}`);
  }
}

export async function saveEntityMemo(
  supabase: LessonMemoSupabaseClient,
  input: SaveEntityMemoInput,
) {
  const { error } = await supabase
    .from("entity_memos")
    .insert({
      academy_id: input.academyId,
      target_type: input.targetType,
      student_id: input.targetType === "student" ? input.targetId : null,
      teacher_id: input.targetType === "teacher" ? input.targetId : null,
      target_name: input.targetName,
      content: input.content,
      memo_date: input.memoDate,
    })
    .select("id");

  if (error) {
    throw new Error(`대상 메모를 저장하지 못했습니다: ${error.message}`);
  }
}

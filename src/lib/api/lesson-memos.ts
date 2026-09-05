type SupabaseResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type LessonMemoKind = "academy" | "private";

export type LessonCalendarMemoRow = {
  id: string;
  academy_id: string;
  lesson_kind: string;
  memo_date: string;
  content: string | null;
  unread: boolean | null;
  student_id: string | null;
  student_name: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
};

type LessonCalendarMemoSelectBuilder = {
  single(): PromiseLike<SupabaseResult<LessonCalendarMemoRow>>;
};

type LessonCalendarMemoFilterBuilder = {
  eq(column: "academy_id" | "id", value: string): LessonCalendarMemoFilterBuilder;
  select(select: "id"): PromiseLike<SupabaseResult<Array<{ id: string }>>>;
  select(select: typeof LESSON_CALENDAR_MEMO_SELECT): LessonCalendarMemoSelectBuilder;
};

type LessonCalendarMemoFromBuilder = {
  insert(values: Record<string, unknown>): {
    select(select: typeof LESSON_CALENDAR_MEMO_SELECT): LessonCalendarMemoSelectBuilder;
  };
  update(values: Record<string, unknown>): LessonCalendarMemoFilterBuilder;
  delete(): LessonCalendarMemoFilterBuilder;
};

export type LessonMemoSupabaseClient = {
  from(table: "lesson_calendar_memos"): LessonCalendarMemoFromBuilder;
};

export type LessonCalendarMemo = {
  id: string;
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  content: string;
  unread: boolean;
  studentId: string | null;
  studentName: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

export type LessonCalendarMemoPayload = {
  academyId: string;
  lessonKind: LessonMemoKind;
  date: string;
  content: string;
  studentId?: string | null;
  studentName?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
};

export type UpdateLessonCalendarMemoInput = {
  academyId: string;
  memoId: string;
  content: string;
  studentId?: string | null;
  studentName?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
};

export type DeleteLessonCalendarMemoInput = {
  academyId: string;
  memoId: string;
};

export const LESSON_CALENDAR_MEMO_SELECT =
  "id, academy_id, lesson_kind, memo_date, content, unread, student_id, student_name, teacher_id, teacher_name";

export async function createLessonCalendarMemo(
  supabase: LessonMemoSupabaseClient,
  input: LessonCalendarMemoPayload,
) {
  const { data, error } = await supabase
    .from("lesson_calendar_memos")
    .insert(toLessonCalendarMemoValues(input))
    .select(LESSON_CALENDAR_MEMO_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `일자 메모를 추가하지 못했습니다: ${error?.message ?? "응답이 비어 있습니다."}`,
    );
  }

  return toLessonCalendarMemo(data);
}

export async function updateLessonCalendarMemo(
  supabase: LessonMemoSupabaseClient,
  input: UpdateLessonCalendarMemoInput,
) {
  const { data, error } = await supabase
    .from("lesson_calendar_memos")
    .update(toLessonCalendarMemoPatch(input))
    .eq("academy_id", input.academyId)
    .eq("id", input.memoId)
    .select(LESSON_CALENDAR_MEMO_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `일자 메모를 수정하지 못했습니다: ${error?.message ?? "응답이 비어 있습니다."}`,
    );
  }

  return toLessonCalendarMemo(data);
}

export async function deleteLessonCalendarMemo(
  supabase: LessonMemoSupabaseClient,
  input: DeleteLessonCalendarMemoInput,
) {
  const { error } = await supabase
    .from("lesson_calendar_memos")
    .delete()
    .eq("academy_id", input.academyId)
    .eq("id", input.memoId)
    .select("id");

  if (error) {
    throw new Error(`일자 메모를 삭제하지 못했습니다: ${error.message}`);
  }
}

export function toLessonCalendarMemo(row: LessonCalendarMemoRow): LessonCalendarMemo {
  return {
    id: row.id,
    academyId: row.academy_id,
    lessonKind: row.lesson_kind as LessonMemoKind,
    date: row.memo_date,
    content: row.content ?? "",
    unread: row.unread ?? false,
    studentId: row.student_id,
    studentName: row.student_name,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
  };
}

function toLessonCalendarMemoValues(input: LessonCalendarMemoPayload) {
  return {
    academy_id: input.academyId,
    lesson_kind: input.lessonKind,
    memo_date: input.date,
    content: input.content,
    student_id: input.studentId ?? null,
    student_name: input.studentName ?? null,
    teacher_id: input.teacherId ?? null,
    teacher_name: input.teacherName ?? null,
    unread: false,
  };
}

function toLessonCalendarMemoPatch(input: UpdateLessonCalendarMemoInput) {
  return {
    content: input.content,
    student_id: input.studentId ?? null,
    student_name: input.studentName ?? null,
    teacher_id: input.teacherId ?? null,
    teacher_name: input.teacherName ?? null,
    unread: false,
  };
}

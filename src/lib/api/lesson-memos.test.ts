import { describe, expect, it } from "vitest";

import {
  saveEntityMemo,
  saveLessonCalendarMemo,
  type LessonMemoSupabaseClient,
} from "./lesson-memos";

describe("saveLessonCalendarMemo", () => {
  it("레슨표 종류와 일자를 기준으로 날짜별 메모를 upsert한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await saveLessonCalendarMemo(client, {
      academyId: "academy-1",
      lessonKind: "academy",
      date: "2026-08-21",
      content: "박지호 보강 일정 확인",
    });

    expect(calls).toEqual([
      {
        table: "lesson_calendar_memos",
        upsert: {
          academy_id: "academy-1",
          lesson_kind: "academy",
          memo_date: "2026-08-21",
          content: "박지호 보강 일정 확인",
          unread: false,
        },
        options: {
          onConflict: "academy_id,lesson_kind,memo_date",
        },
        select: "id",
      },
    ]);
  });
});

describe("saveEntityMemo", () => {
  it("원생 메모는 student_id에 연결해 저장한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await saveEntityMemo(client, {
      academyId: "academy-1",
      targetType: "student",
      targetId: "student-1",
      targetName: "김민지",
      content: "콩쿠르 전까지 스케일 확인",
      memoDate: "2026-08-21",
    });

    expect(calls[0]).toMatchObject({
      table: "entity_memos",
      insert: {
        academy_id: "academy-1",
        target_type: "student",
        student_id: "student-1",
        teacher_id: null,
        target_name: "김민지",
        content: "콩쿠르 전까지 스케일 확인",
        memo_date: "2026-08-21",
      },
      select: "id",
    });
  });

  it("선생님 메모는 teacher_id에 연결해 저장한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await saveEntityMemo(client, {
      academyId: "academy-1",
      targetType: "teacher",
      targetId: "teacher-1",
      targetName: "박선생",
      content: "다음 달 시간표 조정",
      memoDate: "2026-08-21",
    });

    expect(calls[0]).toMatchObject({
      table: "entity_memos",
      insert: {
        academy_id: "academy-1",
        target_type: "teacher",
        student_id: null,
        teacher_id: "teacher-1",
        target_name: "박선생",
        content: "다음 달 시간표 조정",
        memo_date: "2026-08-21",
      },
      select: "id",
    });
  });
});

function createLessonMemoClient(
  calls: Array<Record<string, unknown>>,
): LessonMemoSupabaseClient {
  return {
    from(table) {
      calls.push({ table });

      return {
        upsert(values: Record<string, unknown>, options: Record<string, unknown>) {
          calls[calls.length - 1].upsert = values;
          calls[calls.length - 1].options = options;

          return {
            async select(select: string) {
              calls[calls.length - 1].select = select;

              return {
                data: [{ id: "memo-1" }],
                error: null,
              };
            },
          };
        },
        insert(values: Record<string, unknown>) {
          calls[calls.length - 1].insert = values;

          return {
            async select(select: string) {
              calls[calls.length - 1].select = select;

              return {
                data: [{ id: "memo-1" }],
                error: null,
              };
            },
          };
        },
      };
    },
  } as LessonMemoSupabaseClient;
}

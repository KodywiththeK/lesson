import { describe, expect, it } from "vitest";

import {
  createLessonCalendarMemo,
  deleteLessonCalendarMemo,
  updateLessonCalendarMemo,
  type LessonMemoSupabaseClient,
} from "./lesson-memos";

describe("lesson calendar memo api", () => {
  it("관련 원생과 선생님을 선택적으로 포함해 날짜 메모를 추가한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    const result = await createLessonCalendarMemo(client, {
      academyId: "academy-1",
      lessonKind: "academy",
      date: "2026-08-21",
      content: "콩쿠르 전 스케일 확인",
      studentId: "student-1",
      studentName: "김민지",
      teacherId: "teacher-1",
      teacherName: "김하늘",
    });

    expect(result).toMatchObject({
      id: "memo-1",
      academyId: "academy-1",
      lessonKind: "academy",
      date: "2026-08-21",
      content: "콩쿠르 전 스케일 확인",
      studentId: "student-1",
      studentName: "김민지",
      teacherId: "teacher-1",
      teacherName: "김하늘",
      unread: false,
    });
    expect(calls).toEqual([
      {
        table: "lesson_calendar_memos",
        insert: {
          academy_id: "academy-1",
          lesson_kind: "academy",
          memo_date: "2026-08-21",
          content: "콩쿠르 전 스케일 확인",
          student_id: "student-1",
          student_name: "김민지",
          teacher_id: "teacher-1",
          teacher_name: "김하늘",
          unread: false,
        },
        select:
          "id, academy_id, lesson_kind, memo_date, content, unread, student_id, student_name, teacher_id, teacher_name",
        single: true,
      },
    ]);
  });

  it("일반 날짜 메모는 관련 대상을 비워 추가한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await createLessonCalendarMemo(client, {
      academyId: "academy-1",
      lessonKind: "private",
      date: "2026-08-21",
      content: "리허설 일정 재공지",
    });

    expect(calls[0]).toMatchObject({
      insert: {
        student_id: null,
        student_name: null,
        teacher_id: null,
        teacher_name: null,
      },
    });
  });

  it("메모 id와 학원 id 기준으로 날짜 메모를 수정한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await updateLessonCalendarMemo(client, {
      academyId: "academy-1",
      memoId: "memo-1",
      content: "수정된 메모",
      studentId: "student-2",
      studentName: "이서윤",
    });

    expect(calls).toEqual([
      {
        table: "lesson_calendar_memos",
        update: {
          content: "수정된 메모",
          student_id: "student-2",
          student_name: "이서윤",
          teacher_id: null,
          teacher_name: null,
          unread: false,
        },
        eq: [
          ["academy_id", "academy-1"],
          ["id", "memo-1"],
        ],
        select:
          "id, academy_id, lesson_kind, memo_date, content, unread, student_id, student_name, teacher_id, teacher_name",
        single: true,
      },
    ]);
  });

  it("메모 id와 학원 id 기준으로 날짜 메모를 삭제한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createLessonMemoClient(calls);

    await deleteLessonCalendarMemo(client, {
      academyId: "academy-1",
      memoId: "memo-1",
    });

    expect(calls).toEqual([
      {
        table: "lesson_calendar_memos",
        delete: true,
        eq: [
          ["academy_id", "academy-1"],
          ["id", "memo-1"],
        ],
        select: "id",
      },
    ]);
  });
});

function createLessonMemoClient(
  calls: Array<Record<string, unknown>>,
): LessonMemoSupabaseClient {
  return {
    from(table: "lesson_calendar_memos") {
      calls.push({ table });

      return createBuilder(calls);
    },
  } as unknown as LessonMemoSupabaseClient;
}

function createBuilder(calls: Array<Record<string, unknown>>) {
  const builder = {
    insert(values: Record<string, unknown>) {
      calls[calls.length - 1].insert = values;

      return builder;
    },
    update(values: Record<string, unknown>) {
      calls[calls.length - 1].update = values;

      return builder;
    },
    delete() {
      calls[calls.length - 1].delete = true;

      return builder;
    },
    eq(column: string, value: string) {
      const currentCall = calls[calls.length - 1];
      currentCall.eq = [...((currentCall.eq as unknown[]) ?? []), [column, value]];

      return builder;
    },
    select(select: string) {
      calls[calls.length - 1].select = select;

      return {
        async single() {
          calls[calls.length - 1].single = true;

          return {
            data: {
              id: "memo-1",
              academy_id: "academy-1",
              lesson_kind: "academy",
              memo_date: "2026-08-21",
              content: "콩쿠르 전 스케일 확인",
              unread: false,
              student_id: "student-1",
              student_name: "김민지",
              teacher_id: "teacher-1",
              teacher_name: "김하늘",
            },
            error: null,
          };
        },
        then(resolve: (value: unknown) => void) {
          resolve({
            data: [{ id: "memo-1" }],
            error: null,
          });
        },
      };
    },
  };

  return builder;
}

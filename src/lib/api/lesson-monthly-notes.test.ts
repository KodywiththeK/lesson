import { describe, expect, it } from "vitest";

import {
  fetchLessonMonthlyNote,
  markLessonMonthlyNoteRead,
  saveLessonMonthlyNote,
  type LessonMonthlyNoteSupabaseClient,
} from "./lesson-monthly-notes";

const NOTE_ROW = {
  content: "김하늘 학부모님 전화 옴",
  unread: true,
  updated_at: "2026-08-20T09:00:00+00:00",
};

describe("lesson monthly note api", () => {
  it("학원, 레슨 종류, 월 기준으로 월별 메모지를 조회한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createClient(calls, { data: NOTE_ROW, error: null });

    const note = await fetchLessonMonthlyNote(client, {
      academyId: "academy-1",
      lessonKind: "private",
      month: "2026-08",
    });

    expect(note).toEqual({
      content: "김하늘 학부모님 전화 옴",
      unread: true,
      updatedAt: "2026-08-20T09:00:00+00:00",
    });
    expect(calls).toEqual([
      {
        table: "monthly_memos",
        select: "content, unread, updated_at",
        eq: [
          ["academy_id", "academy-1"],
          ["lesson_kind", "private"],
          ["month", "2026-08"],
        ],
        terminal: "maybeSingle",
      },
    ]);
  });

  it("그 달의 메모지가 없으면 null을 돌려준다", async () => {
    const client = createClient([], { data: null, error: null });

    await expect(
      fetchLessonMonthlyNote(client, {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-09",
      }),
    ).resolves.toBeNull();
  });

  it("조회에 실패하면 한국어 문구로 감싸 던진다", async () => {
    const client = createClient([], { data: null, error: new Error("boom") });

    await expect(
      fetchLessonMonthlyNote(client, {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
      }),
    ).rejects.toThrow("월별 메모를 불러오지 못했습니다: boom");
  });

  it("저장하면 학원·레슨 종류·월 기준으로 upsert하고 미확인으로 표시한다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createClient(calls, { data: NOTE_ROW, error: null });

    const note = await saveLessonMonthlyNote(client, {
      academyId: "academy-1",
      lessonKind: "academy",
      month: "2026-08",
      content: "김하늘 학부모님 전화 옴",
    });

    expect(note.unread).toBe(true);
    expect(calls).toEqual([
      {
        table: "monthly_memos",
        upsert: {
          academy_id: "academy-1",
          lesson_kind: "academy",
          month: "2026-08",
          content: "김하늘 학부모님 전화 옴",
          unread: true,
        },
        onConflict: "academy_id,lesson_kind,month",
        select: "content, unread, updated_at",
        terminal: "single",
      },
    ]);
  });

  it("저장에 실패하면 한국어 문구로 감싸 던진다", async () => {
    const client = createClient([], { data: null, error: new Error("denied") });

    await expect(
      saveLessonMonthlyNote(client, {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
        content: "메모",
      }),
    ).rejects.toThrow("월별 메모를 저장하지 못했습니다: denied");
  });

  it("확인하면 같은 학원·레슨 종류·월의 메모지만 읽음으로 바꾼다", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const client = createClient(calls, {
      data: { ...NOTE_ROW, unread: false },
      error: null,
    });

    const note = await markLessonMonthlyNoteRead(client, {
      academyId: "academy-1",
      lessonKind: "private",
      month: "2026-08",
    });

    expect(note.unread).toBe(false);
    expect(calls).toEqual([
      {
        table: "monthly_memos",
        update: { unread: false },
        eq: [
          ["academy_id", "academy-1"],
          ["lesson_kind", "private"],
          ["month", "2026-08"],
        ],
        select: "content, unread, updated_at",
        terminal: "single",
      },
    ]);
  });

  it("확인할 메모지가 없으면 한국어 문구로 던진다", async () => {
    const client = createClient([], { data: null, error: null });

    await expect(
      markLessonMonthlyNoteRead(client, {
        academyId: "academy-1",
        lessonKind: "academy",
        month: "2026-08",
      }),
    ).rejects.toThrow("월별 메모를 확인 처리하지 못했습니다: 응답이 비어 있습니다.");
  });
});

function createClient(
  calls: Array<Record<string, unknown>>,
  result: { data: unknown; error: Error | null },
): LessonMonthlyNoteSupabaseClient {
  const current = () => calls[calls.length - 1];
  const builder = {
    select(select: string) {
      current().select = select;

      return builder;
    },
    upsert(values: Record<string, unknown>, options: { onConflict: string }) {
      current().upsert = values;
      current().onConflict = options.onConflict;

      return builder;
    },
    update(values: Record<string, unknown>) {
      current().update = values;

      return builder;
    },
    eq(column: string, value: string) {
      current().eq = [...((current().eq as unknown[]) ?? []), [column, value]];

      return builder;
    },
    async maybeSingle() {
      current().terminal = "maybeSingle";

      return result;
    },
    async single() {
      current().terminal = "single";

      return result;
    },
  };

  return {
    from(table: string) {
      calls.push({ table });

      return builder;
    },
  } as unknown as LessonMonthlyNoteSupabaseClient;
}

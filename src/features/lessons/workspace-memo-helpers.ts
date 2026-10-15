import type { DailyAcademyAttendanceRow } from "@/domain/academy-lesson-attendance";
import { compareKoreanNames } from "@/domain/common-list";
import { type PrivateLesson } from "@/domain/private-lesson";
import {
  type LessonCalendarMemo,
  type LessonMemoKind,
  type LessonCalendarMemoPayload,
  type UpdateLessonCalendarMemoInput,
} from "@/lib/api/lesson-memos";
import type {
  LessonMemoTargetOption,
  LessonMemoTargetOptions,
  LessonMemoDraft,
} from "@/features/lessons/workspace-types";

let localMemoIdSequence = 0;

export function getLessonMemosForDate(
  memos: LessonCalendarMemo[],
  lessonKind: LessonMemoKind,
  date: string,
) {
  return memos
    .filter(
      (memo) =>
        memo.lessonKind === lessonKind &&
        memo.date === date &&
        Boolean(memo.content.trim()),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function toMemoCountMap(
  memos: LessonCalendarMemo[],
  lessonKind: LessonMemoKind,
) {
  const countMap = new Map<string, number>();

  for (const memo of memos) {
    if (memo.lessonKind === lessonKind && memo.content.trim()) {
      countMap.set(memo.date, (countMap.get(memo.date) ?? 0) + 1);
    }
  }

  return countMap;
}

export function toLocalLessonCalendarMemo(
  input: LessonCalendarMemoPayload,
): LessonCalendarMemo {
  localMemoIdSequence += 1;

  return {
    id: `local-memo-${localMemoIdSequence}`,
    academyId: input.academyId,
    lessonKind: input.lessonKind,
    date: input.date,
    content: input.content,
    unread: false,
    studentId: input.studentId ?? null,
    studentName: input.studentName ?? null,
    teacherId: input.teacherId ?? null,
    teacherName: input.teacherName ?? null,
  };
}

export function applyLessonCalendarMemoUpdate(
  memo: LessonCalendarMemo,
  input: UpdateLessonCalendarMemoInput,
): LessonCalendarMemo {
  return {
    ...memo,
    content: input.content,
    unread: false,
    studentId: input.studentId ?? null,
    studentName: input.studentName ?? null,
    teacherId: input.teacherId ?? null,
    teacherName: input.teacherName ?? null,
  };
}

export function toAcademyMemoTargetOptions(
  rows: DailyAcademyAttendanceRow[],
): LessonMemoTargetOptions {
  return {
    students: uniqueMemoTargets(
      rows.map((row) => ({ id: row.studentId, name: row.studentName })),
    ),
    teachers: uniqueMemoTargets(
      rows.flatMap((row) =>
        row.teacherId && row.teacherName
          ? [{ id: row.teacherId, name: row.teacherName }]
          : [],
      ),
    ),
  };
}

export function toPrivateMemoTargetOptions(
  lessons: PrivateLesson[],
): LessonMemoTargetOptions {
  return {
    students: uniqueMemoTargets(
      lessons.map((lesson) => ({
        id: lesson.studentId,
        name: lesson.studentName,
      })),
    ),
    teachers: uniqueMemoTargets(
      lessons.map((lesson) => ({
        id: lesson.teacherId,
        name: lesson.teacherName,
      })),
    ),
  };
}

function uniqueMemoTargets(targets: LessonMemoTargetOption[]) {
  const targetMap = new Map<string, LessonMemoTargetOption>();

  for (const target of targets) {
    if (!targetMap.has(target.id)) {
      targetMap.set(target.id, target);
    }
  }

  return [...targetMap.values()].sort((left, right) =>
    compareKoreanNames(left.name, right.name),
  );
}

export function createEmptyMemoDraft(): LessonMemoDraft {
  return {
    studentId: "",
    teacherId: "",
    content: "",
  };
}

export function toLessonMemoDraft(
  memo: LessonCalendarMemo,
): LessonMemoDraft {
  return {
    studentId: memo.studentId ?? "",
    teacherId: memo.teacherId ?? "",
    content: memo.content,
  };
}

export function canSubmitLessonMemo(
  draft: LessonMemoDraft,
  targets: LessonMemoTargetOptions,
) {
  return Boolean(draft.content.trim() && resolveLessonMemoTarget(draft, targets));
}

export function resolveLessonMemoTarget(
  draft: LessonMemoDraft,
  targets: LessonMemoTargetOptions,
) {
  const student = targets.students.find((target) => target.id === draft.studentId);
  const teacher = targets.teachers.find((target) => target.id === draft.teacherId);

  if (draft.studentId && !student) {
    return null;
  }

  if (draft.teacherId && !teacher) {
    return null;
  }

  return {
    studentId: student?.id ?? null,
    studentName: student?.name ?? null,
    teacherId: teacher?.id ?? null,
    teacherName: teacher?.name ?? null,
  };
}

export function toLessonMemoTargetBadges(memo: LessonCalendarMemo) {
  const labels: string[] = [];

  if (memo.studentName) {
    labels.push(memo.studentName);
  }

  if (memo.teacherName) {
    labels.push(memo.teacherName);
  }

  return labels.length > 0 ? labels : ["일반"];
}

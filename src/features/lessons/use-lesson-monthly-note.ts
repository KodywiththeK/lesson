"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  markMonthlyMemoRead,
  saveMonthlyMemo,
  type MonthlyMemo,
  type MonthlyMemoLessonKind,
} from "@/domain/monthly-memo";
import {
  fetchLessonMonthlyNote,
  markLessonMonthlyNoteRead,
  saveLessonMonthlyNote,
  type LessonMonthlyNote,
  type LessonMonthlyNoteSupabaseClient,
} from "@/lib/api/lesson-monthly-notes";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

type UseLessonMonthlyNoteInput = {
  academyId: string;
  lessonKind: MonthlyMemoLessonKind;
  /** YYYY-MM */
  month: string;
  /** null이면 저장소 없이 이 화면 안에서만 유지하는 데모 상태로 동작한다. */
  client: LessonMonthlyNoteSupabaseClient | null;
  enabled: boolean;
};

/** 월별 메모지 조회 key. 사유서 자동 기록처럼 밖에서 바꾸는 쪽은 이 prefix를 invalidate한다. */
export function lessonMonthlyNoteQueryKey(
  academyId: string,
  lessonKind: MonthlyMemoLessonKind,
  month: string,
) {
  return [...queryKeys.academy(academyId), "lesson-monthly-note", lessonKind, month] as const;
}

/** 데모와 실서비스가 같은 모양(note, save, markRead)으로 월별 메모지를 다루게 한다. */
export function useLessonMonthlyNote(input: UseLessonMonthlyNoteInput) {
  const remote = useRemoteLessonMonthlyNote(input);
  const local = useLocalLessonMonthlyNote(input);

  return input.client ? remote : local;
}

function useRemoteLessonMonthlyNote({
  academyId,
  lessonKind,
  month,
  client,
  enabled,
}: UseLessonMonthlyNoteInput) {
  const queryClient = useQueryClient();
  const queryKey = lessonMonthlyNoteQueryKey(academyId, lessonKind, month);
  const key = { academyId, lessonKind, month };
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!client) {
        throw new Error("월별 메모 저장소를 사용할 수 없습니다.");
      }

      return fetchLessonMonthlyNote(client, key);
    },
    enabled: enabled && client !== null,
  });
  const keepSavedNote = (note: LessonMonthlyNote) => queryClient.setQueryData(queryKey, note);
  const saveMutation = useMutation({
    mutationFn: (content: string) => {
      if (!client) {
        throw new Error("월별 메모 저장소를 사용할 수 없습니다.");
      }

      return saveLessonMonthlyNote(client, { ...key, content });
    },
    onSuccess: (note) => {
      keepSavedNote(note);
      toast.success("메모를 저장했습니다.");
    },
    onError: (error) => {
      toast.error("메모 저장에 실패했습니다.", { description: toUserMessage(error) });
    },
  });
  const markReadMutation = useMutation({
    mutationFn: () => {
      if (!client) {
        throw new Error("월별 메모 저장소를 사용할 수 없습니다.");
      }

      return markLessonMonthlyNoteRead(client, key);
    },
    onSuccess: keepSavedNote,
    onError: (error) => {
      toast.error("메모 확인 처리에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  return {
    note: query.data ?? null,
    isLoading: query.isLoading,
    loadErrorMessage: query.isError ? toUserMessage(query.error) : undefined,
    isSaving: saveMutation.isPending,
    isMarkingRead: markReadMutation.isPending,
    save: (content: string) => saveMutation.mutate(content),
    markRead: () => markReadMutation.mutate(),
  };
}

function useLocalLessonMonthlyNote({
  academyId,
  lessonKind,
  month,
}: UseLessonMonthlyNoteInput) {
  const [memos, setMemos] = useState<MonthlyMemo[]>([]);
  const key = { academyId, lessonKind, month };
  const memo = memos.find(
    (candidate) =>
      candidate.academyId === academyId &&
      candidate.lessonKind === lessonKind &&
      candidate.month === month,
  );

  return {
    note: memo
      ? { content: memo.content, unread: memo.unread, updatedAt: memo.updatedAt }
      : null,
    isLoading: false,
    loadErrorMessage: undefined,
    isSaving: false,
    isMarkingRead: false,
    save: (content: string) => {
      setMemos((current) =>
        saveMonthlyMemo(current, { ...key, content, updatedAt: new Date().toISOString() }),
      );
      toast.success("메모를 저장했습니다.");
    },
    markRead: () => setMemos((current) => markMonthlyMemoRead(current, key)),
  };
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import {
  applyPresenceAction,
  type PresenceAction,
  type StudentPresenceRecord,
} from "@/domain/student-presence";
import { queryKeys } from "@/lib/api/query-keys";
import {
  fetchDailyStudentPresence,
  recordStudentPresence,
  type StudentPresenceSupabaseClient,
} from "@/lib/api/student-presence";
import { toUserMessage } from "@/lib/errors/user-message";

type UseStudentPresenceInput = {
  academyId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 실서비스 저장소. 연결하지 못했으면 null이며 오류를 알린다. */
  client: StudentPresenceSupabaseClient | null;
  /** 데모일 때만 넘긴다. 저장소 없이 이 목록을 화면 안에서만 유지한다. */
  localRoster?: StudentPresenceRecord[];
};

/** 등하원 현황 조회 key. 기록한 뒤 이 prefix를 invalidate해 다시 불러온다. */
export function studentPresenceQueryKey(academyId: string, date: string) {
  return [...queryKeys.academy(academyId), "student-presence", date] as const;
}

/** 데모와 실서비스가 같은 모양(records, isLoading, record)으로 등하원 현황을 다루게 한다. */
export function useStudentPresence(input: UseStudentPresenceInput) {
  const remote = useRemoteStudentPresence(input);
  const local = useLocalStudentPresence(input);

  return input.localRoster ? local : remote;
}

function useRemoteStudentPresence({ academyId, date, client }: UseStudentPresenceInput) {
  const queryClient = useQueryClient();
  const queryKey = studentPresenceQueryKey(academyId, date);
  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!client) {
        throw new Error("등하원 저장소를 사용할 수 없습니다.");
      }

      return fetchDailyStudentPresence(client, { academyId, date });
    },
    enabled: client !== null,
  });
  const recordMutation = useMutation({
    mutationFn: (input: { studentId: string; action: PresenceAction }) => {
      if (!client) {
        throw new Error("등하원 저장소를 사용할 수 없습니다.");
      }

      return recordStudentPresence(client, { academyId, date, ...input });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      toast.error("등하원 기록에 실패했습니다.", { description: toUserMessage(error) });
    },
  });

  return {
    records: query.data ?? [],
    isLoading: query.isLoading,
    loadErrorMessage: !client
      ? "등하원 저장소에 연결하지 못했습니다. 새로고침 후 다시 시도해 주세요."
      : query.isError
        ? `등하원 현황을 불러오지 못했습니다. ${toUserMessage(query.error)}`
        : undefined,
    isBusy: recordMutation.isPending,
    record: (studentId: string, action: PresenceAction) => recordMutation.mutate({ studentId, action }),
  };
}

type LocalPresence = Pick<StudentPresenceRecord, "arrivedAt" | "leftAt">;

const NO_RECORDS: StudentPresenceRecord[] = [];

function useLocalStudentPresence({ date, localRoster = NO_RECORDS }: UseStudentPresenceInput) {
  // 날짜가 바뀌어도 기록이 섞이지 않게 날짜와 학생으로 나눠 들고 있다.
  const [overrides, setOverrides] = useState<Record<string, LocalPresence>>({});
  const keyOf = (studentId: string) => `${date}:${studentId}`;
  const records = localRoster.map((record) => ({ ...record, ...overrides[keyOf(record.studentId)] }));

  return {
    records,
    isLoading: false,
    loadErrorMessage: undefined,
    isBusy: false,
    record: (studentId: string, action: PresenceAction) => {
      const current = records.find((record) => record.studentId === studentId);

      if (!current) {
        return;
      }

      try {
        const next = applyPresenceAction(current, action, new Date().toISOString());
        setOverrides((existing) => ({
          ...existing,
          [keyOf(studentId)]: { arrivedAt: next.arrivedAt, leftAt: next.leftAt },
        }));
      } catch (error) {
        toast.error("등하원 기록에 실패했습니다.", { description: toUserMessage(error) });
      }
    },
  };
}

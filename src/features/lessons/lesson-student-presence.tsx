"use client";

import { canRecordPresence, type StudentPresenceRecord } from "@/domain/student-presence";
import { getFinanceToday } from "@/domain/finance-date";
import type { StudentPresenceSupabaseClient } from "@/lib/api/student-presence";

import { StudentPresencePanel } from "./student-presence-panel";
import { useStudentPresence } from "./use-student-presence";

/** 일별 화면에 붙는 등하원 현황. 데모(`localRoster`가 있을 때)는 화면 안에서만, 그 밖에는 서버 값을 쓴다. */
export function LessonStudentPresence({
  academyId,
  date,
  canManage,
  client,
  localRoster,
}: {
  academyId: string;
  /** YYYY-MM-DD */
  date: string;
  /** 원장·데스크만 기록할 수 있다. 선생님은 읽기 전용이다. */
  canManage: boolean;
  client: StudentPresenceSupabaseClient | null;
  localRoster?: StudentPresenceRecord[];
}) {
  const presence = useStudentPresence({ academyId, date, client, localRoster });

  return (
    <StudentPresencePanel
      records={presence.records}
      canManage={canManage}
      canRecord={canRecordPresence(date, getFinanceToday())}
      isLoading={presence.isLoading}
      isBusy={presence.isBusy}
      loadErrorMessage={presence.loadErrorMessage}
      onAction={presence.record}
    />
  );
}

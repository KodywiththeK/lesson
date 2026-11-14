"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import {
  getPresenceActions,
  getPresenceState,
  PRESENCE_ACTION_LABELS,
  PRESENCE_MESSAGES,
  PRESENCE_STATE_LABELS,
  summarizePresence,
  type PresenceAction,
  type PresenceLessonKind,
  type PresenceState,
  type StudentPresenceRecord,
} from "@/domain/student-presence";
import { toSeoulHourMinute } from "@/features/lessons/workspace-helpers";

const LESSON_KIND_LABELS: Record<PresenceLessonKind, string> = {
  academy: "학원레슨",
  private: "개인레슨",
};

const STATE_BADGE_VARIANTS: Record<PresenceState, "secondary" | "success" | "outline"> = {
  expected: "secondary",
  present: "success",
  left: "outline",
};

type StudentPresencePanelProps = {
  records: StudentPresenceRecord[];
  /** 원장·데스크만 기록할 수 있다. 선생님은 읽기 전용으로 본다. */
  canManage: boolean;
  /** 지금 학원에 있는지를 표시하는 기능이라 오늘 날짜에만 기록할 수 있다. */
  canRecord: boolean;
  isLoading: boolean;
  isBusy: boolean;
  loadErrorMessage?: string;
  onAction: (studentId: string, action: PresenceAction) => void;
};

/** 일별 화면의 등하원 현황. 일정별 출결과 별개로 오늘 오기로 한 학생이 지금 학원에 있는지 표시한다. */
export function StudentPresencePanel({
  records,
  canManage,
  canRecord,
  isLoading,
  isBusy,
  loadErrorMessage,
  onAction,
}: StudentPresencePanelProps) {
  const summary = summarizePresence(records);
  const showActions = canManage && canRecord;

  return (
    <SectionCard className="grid gap-3">
      <SectionHeader
        title="등하원 현황"
        description="일정별 출결과 별개로, 오기로 한 학생이 지금 학원에 있는지 표시합니다."
      />
      {canManage && !canRecord ? (
        <p className="text-sm text-muted-foreground">{PRESENCE_MESSAGES.todayOnly}</p>
      ) : null}
      {loadErrorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{loadErrorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? <EmptyState>등하원 현황을 불러오는 중입니다.</EmptyState> : null}
      {!isLoading && !loadErrorMessage && records.length === 0 ? (
        <EmptyState>이 날짜에 오기로 한 학생이 없습니다.</EmptyState>
      ) : null}
      {records.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{`${PRESENCE_STATE_LABELS.expected} ${summary.expected}명`}</Badge>
            <Badge variant="success">{`${PRESENCE_STATE_LABELS.present} ${summary.present}명`}</Badge>
            <Badge variant="outline">{`${PRESENCE_STATE_LABELS.left} ${summary.left}명`}</Badge>
          </div>
          <ul className="grid gap-2">
            {records.map((record) => (
              <PresenceRow
                key={record.studentId}
                record={record}
                showActions={showActions}
                isBusy={isBusy}
                onAction={onAction}
              />
            ))}
          </ul>
        </>
      ) : null}
    </SectionCard>
  );
}

function PresenceRow({
  record,
  showActions,
  isBusy,
  onAction,
}: {
  record: StudentPresenceRecord;
  showActions: boolean;
  isBusy: boolean;
  onAction: (studentId: string, action: PresenceAction) => void;
}) {
  const state = getPresenceState(record);

  return (
    <li
      aria-label={`${record.studentName} ${PRESENCE_STATE_LABELS[state]}`}
      className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm">{record.studentName}</strong>
          {record.lessonKinds.map((kind) => (
            <Badge key={kind} variant="outline">
              {LESSON_KIND_LABELS[kind]}
            </Badge>
          ))}
          <Badge variant={STATE_BADGE_VARIANTS[state]}>{PRESENCE_STATE_LABELS[state]}</Badge>
        </div>
        {record.arrivedAt ? (
          <p className="text-sm text-muted-foreground">{formatPresenceTimes(record)}</p>
        ) : null}
      </div>
      {showActions ? (
        <div className="flex flex-wrap gap-2">
          {getPresenceActions(state).map((action) => (
            <Button
              key={action}
              type="button"
              size="sm"
              variant={action === "arrive" || action === "leave" ? "default" : "outline"}
              disabled={isBusy}
              aria-label={`${record.studentName} ${PRESENCE_ACTION_LABELS[action]}`}
              onClick={() => onAction(record.studentId, action)}
            >
              {PRESENCE_ACTION_LABELS[action]}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function formatPresenceTimes(record: StudentPresenceRecord) {
  const arrived = `등원 ${toSeoulHourMinute(record.arrivedAt!)}`;

  return record.leftAt ? `${arrived} · 하원 ${toSeoulHourMinute(record.leftAt)}` : arrived;
}

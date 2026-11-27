"use client";

import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ResponsiveDialog } from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  dailyTaskLinkLabel,
  type DailyTaskGroup,
  type DailyTaskStateChange,
  type DailyTaskWithState,
} from "@/domain/daily-tasks";
import { formatSeoulDateTime } from "@/domain/finance-date";
import { formatWon } from "@/domain/money-input";

import { TodayTaskActionControl } from "./today-task-actions";
import type { TodayTaskProcessing } from "./today-task-processing";

type TodayTaskGroupDialogProps = {
  group: DailyTaskGroup | null;
  academyId: string;
  today: string;
  processing: TodayTaskProcessing;
  isSaving: boolean;
  /** null이면 상태 버튼을 두지 않는다(선생님). */
  onChangeState: ((change: DailyTaskStateChange) => void) | null;
  onClose: () => void;
  /** 처리가 끝나면 부른다. 할 일 원천을 다시 읽어 칸 건수와 목록을 줄인다. */
  onProcessed: () => Promise<void>;
};

/** 대시보드 칸을 누르면 뜨는 목록. 칸의 할 일을 훑으며 이동·연락·처리·상태 변경을 한다. */
export function TodayTaskGroupDialog({
  group,
  isSaving,
  onChangeState,
  onClose,
  ...actionContext
}: TodayTaskGroupDialogProps) {
  const isWaitingGroup = group?.key === "waiting-reply";

  return (
    <ResponsiveDialog
      open={Boolean(group)}
      onOpenChange={(open) => !open && onClose()}
      title={group?.title ?? ""}
      description={group ? `${group.tasks.length}건` : undefined}
    >
      {group && group.tasks.length === 0 ? <EmptyState>{group.emptyMessage}</EmptyState> : null}
      {group && group.tasks.length > 0 ? (
        <ul aria-label={`${group.title} 목록`} aria-busy={isSaving} className="grid gap-3">
          {group.tasks.map((task) => (
            <li key={task.key} className="rounded-xl border bg-card p-3">
              <TaskSummary task={task} />
              <div className="mt-3 flex flex-wrap gap-2">
                {task.action ? <TodayTaskActionControl action={task.action} {...actionContext} /> : null}
                {task.contact ? <ContactButtons title={task.title} phone={task.contact.phone} /> : null}
                {task.href ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={task.href}>{dailyTaskLinkLabel(task.href)}</Link>
                  </Button>
                ) : null}
                {onChangeState ? (
                  <StateButtons task={task} isWaitingGroup={isWaitingGroup} onChangeState={onChangeState} />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </ResponsiveDialog>
  );
}

function TaskSummary({ task }: { task: DailyTaskWithState }) {
  const details = [
    task.detail,
    task.amount === undefined ? null : formatWon(task.amount),
    task.contact?.label,
    describeState(task),
  ].filter(Boolean);

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium">{task.title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{details.join(" · ")}</p>
    </div>
  );
}

function ContactButtons({ title, phone }: { title: string; phone: string }) {
  const digits = phone.replace(/[^\d+]/g, "");

  return (
    <>
      <Button asChild size="sm" variant="outline">
        <a href={`tel:${digits}`} aria-label={`${title} 전화`}>
          <Phone aria-hidden="true" />
          전화
        </a>
      </Button>
      <Button asChild size="sm" variant="outline">
        <a href={`sms:${digits}`} aria-label={`${title} 문자`}>
          <MessageSquare aria-hidden="true" />
          문자
        </a>
      </Button>
    </>
  );
}

function StateButtons({
  task,
  isWaitingGroup,
  onChangeState,
}: {
  task: DailyTaskWithState;
  isWaitingGroup: boolean;
  onChangeState: (change: DailyTaskStateChange) => void;
}) {
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChangeState({ taskKey: task.key, state: isWaitingGroup ? null : "waiting_reply" })}
      >
        {isWaitingGroup ? "할 일로 되돌리기" : "답변 대기로"}
      </Button>
      {task.completion === "manual" ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChangeState({ taskKey: task.key, state: "done" })}
        >
          완료
        </Button>
      ) : null}
    </>
  );
}

function describeState(task: DailyTaskWithState) {
  return task.stateUpdatedAt
    ? `${task.stateUpdatedByName ?? "알 수 없음"} · ${formatSeoulDateTime(task.stateUpdatedAt)}`
    : null;
}

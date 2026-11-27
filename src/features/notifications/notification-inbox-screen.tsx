"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionCard, SectionHeader } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatSeoulDateTime } from "@/domain/finance-date";
import type { InboxNotification } from "@/lib/api/notification-inbox";
import { queryKeys } from "@/lib/api/query-keys";
import { toUserMessage } from "@/lib/errors/user-message";

export type NotificationInboxDataAccess = {
  load: () => Promise<InboxNotification[]>;
  markRead: () => Promise<void>;
};

/**
 * 알림함. 최근 30일 받은 알림(푸시를 켜지 않았거나 방해 금지로 미룬 것 포함)을 보여 준다.
 * 열면 모두 읽음으로 바꾸되, 이번에 연 화면에서는 새로 온 알림 표시를 그대로 둔다.
 */
export function NotificationInboxScreen({
  academyId,
  dataAccess,
}: {
  academyId: string;
  dataAccess: NotificationInboxDataAccess;
}) {
  const queryClient = useQueryClient();
  const inboxQuery = useQuery({ queryKey: queryKeys.notifications.inbox(academyId), queryFn: dataAccess.load });
  const { mutate: markRead } = useMutation({
    mutationFn: () => dataAccess.markRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount(academyId) }),
  });
  // 개발 모드의 effect 두 번 실행에도 한 번만 읽음 처리한다.
  const markedRef = useRef(false);
  const hasUnread = Boolean(inboxQuery.data?.some((item) => item.readAt === null));

  useEffect(() => {
    if (hasUnread && !markedRef.current) {
      markedRef.current = true;
      markRead();
    }
  }, [hasUnread, markRead]);

  return (
    <SectionCard role="region" aria-labelledby="inbox-heading" className="gap-3">
      <SectionHeader
        headingId="inbox-heading"
        title="알림함"
        description="최근 30일 동안 받은 알림입니다."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/me/notifications">알림 설정</Link>
          </Button>
        }
      />
      {inboxQuery.error ? (
        <EmptyState role="alert">{toUserMessage(inboxQuery.error)}</EmptyState>
      ) : !inboxQuery.data ? (
        <EmptyState role="status">알림함을 불러오는 중입니다.</EmptyState>
      ) : inboxQuery.data.length === 0 ? (
        <EmptyState>최근 30일 동안 받은 알림이 없습니다.</EmptyState>
      ) : (
        <ul aria-label="받은 알림" className="divide-y divide-border">
          {inboxQuery.data.map((item) => (
            <li key={item.id} className="py-3">
              <Link href={item.url} className="grid gap-0.5 rounded-md hover:bg-muted/60">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.title}
                  {item.readAt === null ? <Badge variant="info">새 알림</Badge> : null}
                </span>
                <span className="text-sm text-muted-foreground">{item.body}</span>
                <span className="text-xs text-muted-foreground">{formatSeoulDateTime(item.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

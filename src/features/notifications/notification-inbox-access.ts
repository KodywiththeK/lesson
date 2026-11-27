import {
  fetchMyNotifications,
  markMyNotificationsRead,
  type InboxNotification,
  type NotificationInboxSupabaseClient,
} from "@/lib/api/notification-inbox";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import type { NotificationInboxDataAccess } from "./notification-inbox-screen";

export function createSupabaseNotificationInboxAccess(academyId: string): NotificationInboxDataAccess {
  const client = () => createSupabaseBrowserClient() as unknown as NotificationInboxSupabaseClient;

  return {
    load: () => fetchMyNotifications(client(), { academyId }),
    markRead: () => markMyNotificationsRead(client(), { academyId }),
  };
}

/** 데모·E2E용 알림함. 서버 없이 몇 건을 보여 준다. */
export function createDemoNotificationInboxAccess(now = new Date()): NotificationInboxDataAccess {
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  let items: InboxNotification[] = [
    {
      id: "demo-inbox-1",
      kind: "lesson_change",
      title: "내일 레슨 변경",
      body: "한서아 14:00 → 15:30",
      url: "/lessons/academy",
      createdAt: minutesAgo(30),
      readAt: null,
    },
    {
      id: "demo-inbox-2",
      kind: "consultation",
      title: "신규 상담 접수",
      body: "정다은 상담이 등록되었습니다.",
      url: "/management/consultations",
      createdAt: minutesAgo(60 * 20),
      readAt: minutesAgo(60 * 19),
    },
  ];

  return {
    load: async () => items,
    markRead: async () => {
      items = items.map((item) => ({ ...item, readAt: item.readAt ?? now.toISOString() }));
    },
  };
}

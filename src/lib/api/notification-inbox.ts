import type { NotificationKind } from "@/domain/notification-quiet-hours";

type SupabaseQueryResult<TData> = { data: TData | null; error: Error | null };

/** 알림함 한 줄. 받은 알림 기록(`notification_receipts`)에서 본인 것만 RPC로 읽는다. */
export type InboxNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  readAt: string | null;
};

type InboxRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  created_at: string;
  read_at: string | null;
};

type InboxRpcArgs = {
  list_my_notifications: { p_academy_id: string };
  mark_my_notifications_read: { p_academy_id: string };
  count_my_unread_notifications: { p_academy_id: string };
};

type InboxRpcResult = {
  list_my_notifications: InboxRow[];
  mark_my_notifications_read: unknown;
  count_my_unread_notifications: number;
};

export type NotificationInboxSupabaseClient = {
  rpc<TName extends keyof InboxRpcArgs>(
    name: TName,
    args: InboxRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<InboxRpcResult[TName]>>;
};

export async function fetchMyNotifications(
  supabase: NotificationInboxSupabaseClient,
  input: { academyId: string },
): Promise<InboxNotification[]> {
  const { data, error } = await supabase.rpc("list_my_notifications", { p_academy_id: input.academyId });
  if (error) {
    throw new Error(`알림함을 불러오지 못했습니다: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function markMyNotificationsRead(supabase: NotificationInboxSupabaseClient, input: { academyId: string }) {
  const { error } = await supabase.rpc("mark_my_notifications_read", { p_academy_id: input.academyId });
  if (error) {
    throw new Error(`알림을 읽음으로 바꾸지 못했습니다: ${error.message}`);
  }
}

export async function countMyUnreadNotifications(
  supabase: NotificationInboxSupabaseClient,
  input: { academyId: string },
): Promise<number> {
  const { data, error } = await supabase.rpc("count_my_unread_notifications", { p_academy_id: input.academyId });
  if (error) {
    throw new Error(`안 읽은 알림 수를 불러오지 못했습니다: ${error.message}`);
  }

  return data ?? 0;
}

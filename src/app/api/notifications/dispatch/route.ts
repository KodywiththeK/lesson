import type { NotificationOutboxEvent } from "@/domain/notification-dispatch";
import { createPushSubscriptionStore, deliverPush } from "@/lib/notifications/deliver-push";
import { isAuthorizedCronRequest } from "@/lib/notifications/cron-auth";
import { dispatchNotificationOutbox } from "@/lib/notifications/dispatch-outbox";
import { fetchNotificationRecipients } from "@/lib/notifications/recipients";
import { createWebPushSender } from "@/lib/notifications/web-push-sender";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type OutboxRow = {
  id: string;
  academy_id: string;
  kind: NotificationOutboxEvent["kind"];
  payload: NotificationOutboxEvent["payload"];
};

/** pg_cron이 1분마다(대기열이 있을 때만) 부른다. 즉시 알림 대기열을 푸시로 보낸다. */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const client = createSupabaseServiceRoleClient();
  const sender = createWebPushSender();
  if (!client || !sender) {
    return Response.json({ error: "알림 발송 설정이 없습니다." }, { status: 503 });
  }

  const store = createPushSubscriptionStore(client);
  const result = await dispatchNotificationOutbox({
    claim: async () => {
      const { data, error } = await client.rpc("claim_notification_outbox", { p_limit: 50 });
      if (error) {
        throw new Error(`알림 대기열을 가져오지 못했습니다: ${error.message}`);
      }
      return ((data ?? []) as OutboxRow[]).map((row) => ({
        id: row.id,
        academyId: row.academy_id,
        event: { id: row.id, kind: row.kind, payload: row.payload } as NotificationOutboxEvent,
      }));
    },
    listRecipients: (academyId) => fetchNotificationRecipients(client, academyId),
    deliver: (input) => deliverPush({ ...input, store, sender }),
    complete: async (id, error) => {
      await client.rpc("complete_notification_outbox", { p_id: id, p_error: error });
    },
  });

  return Response.json(result);
}

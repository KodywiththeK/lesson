import { getFinanceToday } from "@/domain/finance-date";
import type { NotificationOutboxEvent } from "@/domain/notification-dispatch";
import { createPushSubscriptionStore, deliverPush, skipPush, type DeliverPush } from "@/lib/notifications/deliver-push";
import { isAuthorizedCronRequest } from "@/lib/notifications/cron-auth";
import { dispatchNotificationOutbox } from "@/lib/notifications/dispatch-outbox";
import { createNotify, createReceiptStore, flushDeferredReceipts } from "@/lib/notifications/notify";
import { fetchNotificationRecipients } from "@/lib/notifications/recipients";
import { createWebPushSender } from "@/lib/notifications/web-push-sender";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

type OutboxRow = {
  id: string;
  academy_id: string;
  kind: NotificationOutboxEvent["kind"];
  payload: NotificationOutboxEvent["payload"];
};

/**
 * pg_cron이 1분마다(대기열이나 때가 된 미룬 알림이 있을 때만) 부른다.
 * 즉시 알림 대기열을 보내고(알림함 기록 + 방해 금지가 아니면 푸시), 방해 금지가 끝난 사람에게 미룬 알림을 묶어 보낸다.
 */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const client = createSupabaseServiceRoleClient();
  const sender = createWebPushSender();
  if (!client) {
    return Response.json({ error: "알림 발송 설정이 없습니다." }, { status: 503 });
  }

  const subscriptions = createPushSubscriptionStore(client);
  const receipts = createReceiptStore(client);
  // 푸시 발송 설정(VAPID)이 없어도 알림함에는 남긴다(아침 브리핑과 같은 규칙).
  const deliver: DeliverPush = sender ? (input) => deliverPush({ ...input, store: subscriptions, sender }) : skipPush;
  const outbox = await dispatchNotificationOutbox({
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
    notify: createNotify({ store: receipts, deliver }),
    today: getFinanceToday,
    complete: async (id, error) => {
      await client.rpc("complete_notification_outbox", { p_id: id, p_error: error });
    },
  });

  const deferred = await flushDeferredReceipts({ store: receipts, deliver });

  return Response.json({ ...outbox, deferred });
}

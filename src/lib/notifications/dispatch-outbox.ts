import {
  buildPushPayload,
  resolvePushRecipients,
  type NotificationOutboxEvent,
} from "@/domain/notification-dispatch";

import type { DeliverPush } from "./deliver-push";
import type { NotificationRecipient } from "./recipients";

export type ClaimedOutboxRow = {
  id: string;
  academyId: string;
  event: NotificationOutboxEvent;
};

export type DispatchDependencies = {
  claim: () => Promise<ClaimedOutboxRow[]>;
  listRecipients: (academyId: string) => Promise<NotificationRecipient[]>;
  deliver: DeliverPush;
  complete: (id: string, error: string | null) => Promise<void>;
};

/** 대기열의 사건을 받을 사람에게 푸시로 보낸다. 실패한 사건은 오류를 남겨 다음 호출이 다시 시도한다. */
export async function dispatchNotificationOutbox(dependencies: DispatchDependencies) {
  const rows = await dependencies.claim();
  const recipientsByAcademy = new Map<string, Promise<NotificationRecipient[]>>();
  let failed = 0;

  // 사건끼리는 서로 기다릴 필요가 없어 함께 보낸다(학원별 받는 사람은 한 번만 조회).
  await Promise.all(
    rows.map(async (row) => {
      try {
        if (!recipientsByAcademy.has(row.academyId)) {
          recipientsByAcademy.set(row.academyId, dependencies.listRecipients(row.academyId));
        }
        const recipients = await (recipientsByAcademy.get(row.academyId) as Promise<NotificationRecipient[]>);
        await dependencies.deliver({
          academyId: row.academyId,
          userIds: resolvePushRecipients(row.event, recipients),
          payload: buildPushPayload(row.event),
        });
        await dependencies.complete(row.id, null);
      } catch (error) {
        failed += 1;
        await dependencies.complete(row.id, error instanceof Error ? error.message : String(error));
      }
    }),
  );

  return { processed: rows.length, failed };
}

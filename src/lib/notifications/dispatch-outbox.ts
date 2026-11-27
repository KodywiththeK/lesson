import {
  buildPushPayload,
  resolvePushRecipients,
  type NotificationOutboxEvent,
} from "@/domain/notification-dispatch";

import type { Notify } from "./notify";
import type { NotificationRecipient } from "./recipients";

export type ClaimedOutboxRow = {
  id: string;
  academyId: string;
  event: NotificationOutboxEvent;
};

export type DispatchDependencies = {
  claim: () => Promise<ClaimedOutboxRow[]>;
  listRecipients: (academyId: string) => Promise<NotificationRecipient[]>;
  notify: Notify;
  complete: (id: string, error: string | null) => Promise<void>;
  /** 발송 시점의 한국 날짜. 레슨 변경이 오늘인지 내일인지 가른다. */
  today: () => string;
};

/** 대기열의 사건을 받을 사람에게 보낸다(알림함 기록 + 방해 금지가 아니면 푸시). 실패한 사건은 오류를 남겨 다음 호출이 다시 시도한다. */
export async function dispatchNotificationOutbox(dependencies: DispatchDependencies) {
  const rows = await dependencies.claim();
  const recipientsByAcademy = new Map<string, Promise<NotificationRecipient[]>>();
  const today = dependencies.today();
  let failed = 0;

  // 사건끼리는 서로 기다릴 필요가 없어 함께 보낸다(학원별 받는 사람은 한 번만 조회).
  await Promise.all(
    rows.map(async (row) => {
      try {
        if (!recipientsByAcademy.has(row.academyId)) {
          recipientsByAcademy.set(row.academyId, dependencies.listRecipients(row.academyId));
        }
        const recipients = await (recipientsByAcademy.get(row.academyId) as Promise<NotificationRecipient[]>);
        await dependencies.notify({
          academyId: row.academyId,
          kind: row.event.kind,
          sourceKey: `outbox:${row.id}`,
          recipients: resolvePushRecipients(row.event, recipients),
          message: buildPushPayload(row.event, today),
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

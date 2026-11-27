import type { SupabaseClient } from "@supabase/supabase-js";

import type { PushMessage } from "@/domain/notification-dispatch";
import {
  buildDeferredSummary,
  isInQuietHours,
  resolveDeliverAfter,
  type NotificationKind,
  type QuietHours,
} from "@/domain/notification-quiet-hours";

import { EMPTY_SUMMARY, type DeliverPush, type PushDeliverySummary } from "./deliver-push";

type ReceiptContent = { kind: NotificationKind; title: string; body: string; url: string };

type ReceiptInsert = ReceiptContent & {
  academyId: string;
  userId: string;
  /** 같은 사건은 한 번만 기록한다(푸시 tag). */
  sourceKey: string;
  deliverAfter: Date;
  /** 지금 보내면 지금 시각, 방해 금지로 미루면 null. */
  pushedAt: Date | null;
};

type DueReceipt = ReceiptContent & { academyId: string; userId: string };

/** 받은 알림 기록(`notification_receipts`) 저장소. 서버(service_role)에서만 쓴다. */
export type ReceiptStore = {
  record: (rows: ReceiptInsert[]) => Promise<void>;
  /** 때가 된 미룬 알림을 가져가며 보낸 것으로 표시한다. */
  claimDue: () => Promise<DueReceipt[]>;
};

type NotifyInput = {
  academyId: string;
  kind: NotificationKind;
  /** 같은 사건은 알림함에 한 번만 남기는 키(대기열 사건 id, 아침 브리핑 날짜). 푸시 tag와 따로 둔다. */
  sourceKey: string;
  message: PushMessage;
  recipients: Array<{ userId: string; quietHours: QuietHours }>;
};

export type Notify = (input: NotifyInput) => Promise<PushDeliverySummary>;

/**
 * 모든 푸시가 지나는 한 길. 받는 사람마다 알림함 기록을 남기고, 방해 금지가 아닌 사람에게만 지금 보낸다.
 * 방해 금지인 사람은 끝나는 시각에 `flushDeferredReceipts`가 묶어 보낸다.
 */
export function createNotify({
  store,
  deliver,
  now = () => new Date(),
}: {
  store: ReceiptStore;
  deliver: DeliverPush;
  now?: () => Date;
}): Notify {
  return async ({ academyId, kind, sourceKey, message, recipients }) => {
    if (recipients.length === 0) {
      return EMPTY_SUMMARY;
    }

    const at = now();
    const rows: ReceiptInsert[] = recipients.map((recipient) => ({
      academyId,
      userId: recipient.userId,
      kind,
      title: message.title,
      body: message.body,
      url: message.url,
      sourceKey,
      deliverAfter: resolveDeliverAfter(recipient.quietHours, at),
      pushedAt: isInQuietHours(recipient.quietHours, at) ? null : at,
    }));
    await store.record(rows);

    return deliver({
      academyId,
      userIds: rows.filter((row) => row.pushedAt !== null).map((row) => row.userId),
      payload: message,
    });
  };
}

/** 방해 금지가 끝난 사람에게 미룬 알림을 사람별로 묶어 보낸다(1건이면 그대로). */
export async function flushDeferredReceipts({ store, deliver }: { store: ReceiptStore; deliver: DeliverPush }) {
  const groups = new Map<string, DueReceipt[]>();
  for (const receipt of await store.claimDue()) {
    const key = `${receipt.academyId}:${receipt.userId}`;
    groups.set(key, [...(groups.get(key) ?? []), receipt]);
  }

  let failed = 0;
  await Promise.all(
    [...groups.values()].map(async (items) => {
      const [{ academyId, userId }] = items;
      try {
        await deliver({ academyId, userIds: [userId], payload: buildDeferredSummary(items) });
      } catch {
        // 알림함에는 이미 남아 있어 다시 보내지 않는다.
        failed += 1;
      }
    }),
  );

  return { people: groups.size, failed };
}

type ReceiptRow = {
  academy_id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
};

export function createReceiptStore(client: SupabaseClient): ReceiptStore {
  return {
    record: async (rows) => {
      // 대기열 재시도로 같은 사건이 다시 와도 알림함에는 한 번만 남긴다.
      const { error } = await client.from("notification_receipts").upsert(
        rows.map((row) => ({
          academy_id: row.academyId,
          user_id: row.userId,
          kind: row.kind,
          title: row.title,
          body: row.body,
          url: row.url,
          deliver_after: row.deliverAfter.toISOString(),
          source_key: row.sourceKey,
          pushed_at: row.pushedAt?.toISOString() ?? null,
        })),
        { onConflict: "academy_id,user_id,source_key", ignoreDuplicates: true },
      );
      if (error) {
        throw new Error(`알림함 기록을 남기지 못했습니다: ${error.message}`);
      }
    },
    claimDue: async () => {
      const { data, error } = await client.rpc("claim_due_deferred_receipts", { p_limit: 200 });
      if (error) {
        throw new Error(`미룬 알림을 가져오지 못했습니다: ${error.message}`);
      }
      return ((data ?? []) as ReceiptRow[]).map((row) => ({
        academyId: row.academy_id,
        userId: row.user_id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        url: row.url,
      }));
    },
  };
}

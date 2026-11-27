import type { SupabaseClient } from "@supabase/supabase-js";

import type { PushMessage } from "@/domain/notification-dispatch";

import type { StoredPushSubscription, WebPushSender } from "./web-push-sender";

export type PushSubscriptionStore = {
  listForUsers: (academyId: string, userIds: string[]) => Promise<Array<StoredPushSubscription & { userId: string }>>;
  removeSubscriptions: (ids: string[]) => Promise<void>;
  markDelivered: (ids: string[]) => Promise<void>;
};

export type PushDeliverySummary = {
  devices: number;
  sent: number;
  expired: number;
  failed: number;
};

export const EMPTY_SUMMARY: PushDeliverySummary = { devices: 0, sent: 0, expired: 0, failed: 0 };

/** 받는 사람들에게 푸시를 보내는 함수. route가 저장소·발송기를 묶어 넘긴다. */
export type DeliverPush = (input: {
  academyId: string;
  userIds: string[];
  payload: PushMessage;
}) => Promise<PushDeliverySummary>;

/** 발송 설정(VAPID)이 없을 때 쓰는 아무것도 보내지 않는 발송. */
export const skipPush: DeliverPush = async () => EMPTY_SUMMARY;

/** 받는 사람들의 모든 기기에 보낸다. 사라진 구독은 지우고, 성공한 구독은 마지막 성공 시각을 남긴다. */
export async function deliverPush(input: {
  store: PushSubscriptionStore;
  sender: WebPushSender;
  academyId: string;
  userIds: string[];
  payload: PushMessage;
}): Promise<PushDeliverySummary> {
  if (input.userIds.length === 0) {
    return EMPTY_SUMMARY;
  }

  const subscriptions = await input.store.listForUsers(input.academyId, input.userIds);
  if (subscriptions.length === 0) {
    return EMPTY_SUMMARY;
  }

  const results = await input.sender.send(subscriptions, input.payload);
  const expiredIds = results.filter((result) => result.expired).map((result) => result.subscriptionId);
  const sentIds = results.filter((result) => result.ok).map((result) => result.subscriptionId);

  if (expiredIds.length > 0) {
    await input.store.removeSubscriptions(expiredIds);
  }
  if (sentIds.length > 0) {
    await input.store.markDelivered(sentIds);
  }

  return {
    devices: subscriptions.length,
    sent: sentIds.length,
    expired: expiredIds.length,
    failed: results.length - sentIds.length - expiredIds.length,
  };
}

/** service_role 클라이언트로 push_subscriptions를 다루는 저장소. 서버 route에서만 쓴다. */
export function createPushSubscriptionStore(client: SupabaseClient): PushSubscriptionStore {
  return {
    async listForUsers(academyId, userIds) {
      const { data, error } = await client
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth")
        .eq("academy_id", academyId)
        .in("user_id", userIds);

      if (error) {
        throw new Error(`알림 받을 기기를 불러오지 못했습니다: ${error.message}`);
      }

      return (data ?? []).map((row) => ({
        id: row.id as string,
        userId: row.user_id as string,
        endpoint: row.endpoint as string,
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      }));
    },
    async removeSubscriptions(ids) {
      const { error } = await client.from("push_subscriptions").delete().in("id", ids);
      if (error) {
        throw new Error(`만료된 알림 기기를 지우지 못했습니다: ${error.message}`);
      }
    },
    async markDelivered(ids) {
      const { error } = await client
        .from("push_subscriptions")
        .update({ last_success_at: new Date().toISOString() })
        .in("id", ids);
      if (error) {
        throw new Error(`알림 발송 기록을 남기지 못했습니다: ${error.message}`);
      }
    },
  };
}

import type { PushMessage } from "@/domain/notification-dispatch";
import webPush from "web-push";

/** 기기 알림 한 건. 같은 tag의 알림은 기기에서 하나로 겹친다. */
export type PushPayload = PushMessage;

export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushSendResult = {
  subscriptionId: string;
  ok: boolean;
  /** 기기에서 구독이 사라짐(404·410). 저장된 구독을 지워야 한다. */
  expired: boolean;
  error?: string;
};

export type WebPushModule = Pick<typeof webPush, "setVapidDetails" | "sendNotification">;

type ServerEnv = Record<string, string | undefined>;

/** 12시간 안에 전달되지 않은 알림은 버린다(지난 레슨 변경을 다음 날 받지 않게). */
const PUSH_TTL_SECONDS = 60 * 60 * 12;

/** 서버 전용 Web Push 발송기. VAPID 키가 없으면 null(발송 기능 꺼짐)이다. */
export function createWebPushSender(env: ServerEnv = process.env, module: WebPushModule = webPush) {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.APP_BASE_URL;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  module.setVapidDetails(subject, publicKey, privateKey);

  return {
    async send(subscriptions: StoredPushSubscription[], payload: PushPayload): Promise<PushSendResult[]> {
      const body = JSON.stringify(payload);

      return Promise.all(
        subscriptions.map(async (subscription) => {
          try {
            await module.sendNotification(
              { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
              body,
              { TTL: PUSH_TTL_SECONDS, urgency: "high" },
            );

            return { subscriptionId: subscription.id, ok: true, expired: false };
          } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode;

            return {
              subscriptionId: subscription.id,
              ok: false,
              expired: statusCode === 404 || statusCode === 410,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );
    },
  };
}

export type WebPushSender = NonNullable<ReturnType<typeof createWebPushSender>>;

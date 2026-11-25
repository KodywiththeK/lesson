import { describe, expect, it, vi } from "vitest";

import { createWebPushSender, type WebPushModule } from "./web-push-sender";

const env = {
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
  VAPID_PRIVATE_KEY: "private-key",
  APP_BASE_URL: "https://madimadi.example",
};

function createModule(sendNotification: WebPushModule["sendNotification"]): WebPushModule {
  return { setVapidDetails: vi.fn(), sendNotification };
}

const subscriptions = [
  { id: "sub-ok", endpoint: "https://push.example/ok", p256dh: "p1", auth: "a1" },
  { id: "sub-gone", endpoint: "https://push.example/gone", p256dh: "p2", auth: "a2" },
  { id: "sub-error", endpoint: "https://push.example/error", p256dh: "p3", auth: "a3" },
];

describe("createWebPushSender", () => {
  it("VAPID 키가 없으면 발송기를 만들지 않는다", () => {
    expect(createWebPushSender({}, createModule(vi.fn()))).toBeNull();
  });

  it("앱 주소를 발신자로 VAPID를 설정하고, 기기마다 결과를 돌려준다(404·410은 만료)", async () => {
    const sendNotification = vi.fn(async (subscription: { endpoint: string }) => {
      if (subscription.endpoint.endsWith("gone")) {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
      if (subscription.endpoint.endsWith("error")) {
        throw Object.assign(new Error("server"), { statusCode: 500 });
      }
      return { statusCode: 201 };
    });
    const webPush = createModule(sendNotification as unknown as WebPushModule["sendNotification"]);
    const sender = createWebPushSender(env, webPush);

    const results = await sender!.send(subscriptions, { title: "제목", body: "본문", url: "/", tag: "test" });

    expect(webPush.setVapidDetails).toHaveBeenCalledWith("https://madimadi.example", "public-key", "private-key");
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push.example/ok", keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify({ title: "제목", body: "본문", url: "/", tag: "test" }),
      { TTL: 60 * 60 * 12, urgency: "high" },
    );
    expect(results).toEqual([
      { subscriptionId: "sub-ok", ok: true, expired: false },
      { subscriptionId: "sub-gone", ok: false, expired: true, error: "gone" },
      { subscriptionId: "sub-error", ok: false, expired: false, error: "server" },
    ]);
  });
});

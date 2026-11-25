import { describe, expect, it, vi } from "vitest";

import { deliverPush, type PushSubscriptionStore } from "./deliver-push";
import type { WebPushSender } from "./web-push-sender";

function createStore(): PushSubscriptionStore {
  return {
    listForUsers: vi.fn(async () => [
      { id: "sub-1", userId: "user-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" },
      { id: "sub-2", userId: "user-1", endpoint: "https://push.example/2", p256dh: "p", auth: "a" },
    ]),
    removeSubscriptions: vi.fn(async () => undefined),
    markDelivered: vi.fn(async () => undefined),
  };
}

describe("deliverPush", () => {
  it("받는 사람들의 모든 기기에 보내고, 만료된 구독은 지우고 성공한 구독은 기록한다", async () => {
    const store = createStore();
    const sender: WebPushSender = {
      send: vi.fn(async () => [
        { subscriptionId: "sub-1", ok: true, expired: false },
        { subscriptionId: "sub-2", ok: false, expired: true, error: "gone" },
      ]),
    };

    const result = await deliverPush({
      store,
      sender,
      academyId: "academy-1",
      userIds: ["user-1"],
      payload: { title: "제목", body: "본문", url: "/", tag: "t" },
    });

    expect(store.listForUsers).toHaveBeenCalledWith("academy-1", ["user-1"]);
    expect(store.removeSubscriptions).toHaveBeenCalledWith(["sub-2"]);
    expect(store.markDelivered).toHaveBeenCalledWith(["sub-1"]);
    expect(result).toEqual({ devices: 2, sent: 1, expired: 1, failed: 0 });
  });

  it("받는 사람이 없으면 아무것도 조회·발송하지 않는다", async () => {
    const store = createStore();
    const sender: WebPushSender = { send: vi.fn() };

    await expect(
      deliverPush({ store, sender, academyId: "academy-1", userIds: [], payload: { title: "t", body: "b", url: "/", tag: "t" } }),
    ).resolves.toEqual({ devices: 0, sent: 0, expired: 0, failed: 0 });
    expect(store.listForUsers).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });
});

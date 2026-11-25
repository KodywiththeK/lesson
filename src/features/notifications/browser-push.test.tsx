import { describe, expect, it } from "vitest";

import { isIosDevice, toPushSubscriptionKeys, urlBase64ToUint8Array } from "./browser-push";

describe("browser-push", () => {
  it("VAPID 공개 키(base64url)를 브라우저가 받는 바이트 배열로 바꾼다", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID-_8"))).toEqual([1, 2, 3, 251, 255]);
  });

  it("아이폰·아이패드(데스크톱 모드 포함)를 iOS로 본다", () => {
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Linux; Android 15)", maxTouchPoints: 5 })).toBe(false);
  });

  it("브라우저 구독을 저장할 endpoint와 키로 바꾸고 키가 없으면 오류를 낸다", () => {
    expect(
      toPushSubscriptionKeys({ endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } }),
    ).toEqual({ endpoint: "https://push.example/1", p256dh: "p", auth: "a" });
    expect(() => toPushSubscriptionKeys({ endpoint: "https://push.example/1", keys: {} })).toThrow(
      "이 브라우저의 알림 정보를 읽지 못했습니다.",
    );
  });
});

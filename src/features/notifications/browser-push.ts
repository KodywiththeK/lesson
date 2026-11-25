import type { PushEnvironment } from "@/domain/notification-settings";
import { registerAppServiceWorker } from "@/features/pwa/register-service-worker";
import type { PushSubscriptionKeys } from "@/lib/api/notification-settings";

/** VAPID 공개 키(base64url)를 `applicationServerKey`로 쓸 바이트 배열로 바꾼다. */
export function urlBase64ToUint8Array(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);

  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

/** 아이패드는 데스크톱 모드에서 맥처럼 보이므로 터치 여부로 함께 판단한다. */
export function isIosDevice(input: { userAgent: string; maxTouchPoints: number }) {
  return /iPhone|iPad|iPod/.test(input.userAgent) || (/Macintosh/.test(input.userAgent) && input.maxTouchPoints > 1);
}

export function toPushSubscriptionKeys(json: PushSubscriptionJSON): PushSubscriptionKeys {
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("이 브라우저의 알림 정보를 읽지 못했습니다.");
  }

  return { endpoint: json.endpoint, p256dh, auth };
}

export function isStandaloneDisplay() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function readPushEnvironment(): PushEnvironment {
  return {
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : "denied",
    isIos: isIosDevice({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 }),
    isStandalone: isStandaloneDisplay(),
  };
}

async function getRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");

  return existing ?? registerAppServiceWorker();
}

/** 사용자가 버튼을 누른 흐름 안에서만 부른다(iOS는 사용자 동작 없이 권한을 물을 수 없다). */
export async function subscribeThisDevice(vapidPublicKey: string): Promise<PushSubscriptionKeys> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.");
  }

  const registration = await getRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  return toPushSubscriptionKeys(subscription.toJSON());
}

export async function getThisDeviceEndpoint() {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();

  return subscription?.endpoint ?? null;
}

/** 이 기기 구독을 해제하고 서버에서 지울 endpoint를 돌려준다. */
export async function unsubscribeThisDevice() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();

  if (!subscription) {
    return null;
  }

  await subscription.unsubscribe();

  return subscription.endpoint;
}

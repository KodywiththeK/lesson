// 마디마디 서비스 워커.
// - 학생 개인정보가 기기에 남지 않도록 데이터 응답은 저장하지 않는다. 오프라인 안내 화면 한 장만 저장한다.
// - 푸시를 받으면 알림을 띄우고, 알림을 누르면 앱 안의 해당 화면으로 이동한다.
// 테스트: src/lib/pwa/service-worker.test.ts

const OFFLINE_CACHE = "madimadi-offline-v1";
const OFFLINE_URL = "/offline";
const APP_NAME = "마디마디";
const NOTIFICATION_ICON = "/android-chrome-192x192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("madimadi-") && key !== OFFLINE_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") {
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: NOTIFICATION_ICON,
        badge: NOTIFICATION_ICON,
        tag: payload.tag,
        data: { url: payload.url },
      }),
      updateAppBadge(payload.badgeCount),
    ]),
  );
});

/** 할 일 수가 담긴 푸시(아침 브리핑)면 앱 아이콘 배지를 맞춘다. 지원하지 않거나 실패해도 알림은 띄운다. */
function updateAppBadge(count) {
  if (typeof count !== "number") {
    return Promise.resolve();
  }

  const update = count > 0 ? self.navigator.setAppBadge?.(count) : self.navigator.clearAppBadge?.();

  return Promise.resolve(update).catch(() => undefined);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = toSameOriginUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const appWindow = windowClients.find((client) => new URL(client.url).origin === self.location.origin);

      if (appWindow) {
        return appWindow.navigate(targetUrl).then((client) => (client || appWindow).focus());
      }

      return self.clients.openWindow(targetUrl);
    }),
  );
});

function readPushPayload(data) {
  let payload = {};

  try {
    payload = (data && data.json()) || {};
  } catch {
    payload = {};
  }

  return {
    title: typeof payload.title === "string" && payload.title ? payload.title : APP_NAME,
    body: typeof payload.body === "string" ? payload.body : "",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    url: typeof payload.url === "string" ? payload.url : "/",
    badgeCount: typeof payload.badgeCount === "number" ? payload.badgeCount : undefined,
  };
}

/** 앱 밖 주소로 보내지 않도록 같은 사이트 주소만 허용한다. */
function toSameOriginUrl(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);

    return url.origin === self.location.origin ? url.href : new URL("/", self.location.origin).href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}

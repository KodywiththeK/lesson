import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://madimadi.example";

type Handler = (event: Record<string, unknown>) => void;

function loadServiceWorker() {
  const handlers = new Map<string, Handler>();
  const cache = { add: vi.fn(async () => undefined) };
  const windowClient = {
    url: `${ORIGIN}/finance/lesson-income`,
    navigate: vi.fn(async () => windowClient),
    focus: vi.fn(async () => windowClient),
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: vi.fn(async () => undefined),
    registration: { showNotification: vi.fn(async () => undefined) },
    navigator: { setAppBadge: vi.fn(async () => undefined), clearAppBadge: vi.fn(async () => undefined) },
    clients: {
      claim: vi.fn(async () => undefined),
      matchAll: vi.fn(async () => [] as unknown[]),
      openWindow: vi.fn(async () => null),
    },
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ["madimadi-offline-v0", "madimadi-offline-v1"]),
    delete: vi.fn(async () => true),
    match: vi.fn(async () => "offline-response"),
  };
  const fetchMock = vi.fn(async () => {
    throw new TypeError("offline");
  });

    // 브라우저의 Request는 상대 주소를 받지만 Node는 받지 않아 주소만 담는 가짜를 쓴다.
  class FakeRequest {
    constructor(
      readonly url: string,
      readonly init?: RequestInit,
    ) {}
  }

  vm.runInNewContext(source, { self, caches, fetch: fetchMock, URL, Request: FakeRequest, Promise });

  async function dispatch(type: string, event: Record<string, unknown>) {
    let pending: Promise<unknown> | undefined;
    let response: Promise<unknown> | undefined;
    handlers.get(type)?.({
      ...event,
      waitUntil: (promise: Promise<unknown>) => {
        pending = promise;
      },
      respondWith: (promise: Promise<unknown>) => {
        response = promise;
      },
    });
    await pending;

    return response;
  }

  return { self, caches, cache, windowClient, fetchMock, dispatch, handlers };
}

describe("서비스 워커", () => {
  it("설치할 때 오프라인 안내 화면 한 장만 저장하고 옛 캐시는 지운다", async () => {
    const sw = loadServiceWorker();

    await sw.dispatch("install", {});
    expect(sw.cache.add).toHaveBeenCalledTimes(1);
    expect(sw.cache.add).toHaveBeenCalledWith(expect.objectContaining({ url: "/offline" }));
    expect(sw.self.skipWaiting).toHaveBeenCalled();

    await sw.dispatch("activate", {});
    expect(sw.caches.delete).toHaveBeenCalledWith("madimadi-offline-v0");
    expect(sw.caches.delete).not.toHaveBeenCalledWith("madimadi-offline-v1");
  });

  it("화면 이동이 네트워크 오류로 실패할 때만 오프라인 안내를 보여 주고 데이터 요청은 건드리지 않는다", async () => {
    const sw = loadServiceWorker();

    const navigation = await sw.dispatch("fetch", { request: { mode: "navigate", url: `${ORIGIN}/` } });
    expect(navigation).toBe("offline-response");
    expect(sw.caches.match).toHaveBeenCalledWith("/offline");

    const api = await sw.dispatch("fetch", { request: { mode: "cors", url: `${ORIGIN}/rest/v1/students` } });
    expect(api).toBeUndefined();
  });

  it("푸시를 받으면 제목·본문·이동 주소로 알림을 띄운다", async () => {
    const sw = loadServiceWorker();

    await sw.dispatch("push", {
      data: { json: () => ({ title: "오늘 레슨 변경", body: "유나 14:00 → 15:30", url: "/lessons/academy", tag: "lesson-change" }) },
    });

    expect(sw.self.registration.showNotification).toHaveBeenCalledWith(
      "오늘 레슨 변경",
      expect.objectContaining({ body: "유나 14:00 → 15:30", tag: "lesson-change", data: { url: "/lessons/academy" } }),
    );
  });

  it("아침 브리핑처럼 할 일 수가 담긴 푸시는 앱 아이콘 배지를 바꾸고, 0이면 지운다", async () => {
    const sw = loadServiceWorker();

    await sw.dispatch("push", { data: { json: () => ({ title: "오늘 브리핑", body: "할 일 3건", badgeCount: 3 }) } });
    expect(sw.self.navigator.setAppBadge).toHaveBeenCalledWith(3);

    await sw.dispatch("push", { data: { json: () => ({ title: "오늘 브리핑", body: "할 일 0건", badgeCount: 0 }) } });
    expect(sw.self.navigator.clearAppBadge).toHaveBeenCalled();

    sw.self.navigator.setAppBadge.mockClear();
    await sw.dispatch("push", { data: { json: () => ({ title: "신규 상담 접수", body: "새봄" }) } });
    expect(sw.self.navigator.setAppBadge).not.toHaveBeenCalled();
  });

  it("내용이 깨진 푸시도 앱 이름으로 알림을 띄운다", async () => {
    const sw = loadServiceWorker();

    await sw.dispatch("push", {
      data: {
        json: () => {
          throw new SyntaxError("bad");
        },
      },
    });

    expect(sw.self.registration.showNotification).toHaveBeenCalledWith(
      "마디마디",
      expect.objectContaining({ data: { url: "/" } }),
    );
  });

  it("알림을 누르면 열린 앱 창을 그 주소로 옮기고, 창이 없으면 새로 연다", async () => {
    const sw = loadServiceWorker();
    const close = vi.fn();

    sw.self.clients.matchAll.mockResolvedValueOnce([sw.windowClient]);
    await sw.dispatch("notificationclick", { notification: { close, data: { url: "/lessons/academy" } } });
    expect(close).toHaveBeenCalled();
    expect(sw.windowClient.navigate).toHaveBeenCalledWith(`${ORIGIN}/lessons/academy`);
    expect(sw.windowClient.focus).toHaveBeenCalled();

    await sw.dispatch("notificationclick", { notification: { close, data: { url: "/" } } });
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("다른 사이트 주소가 담긴 알림은 앱 첫 화면으로 연다", async () => {
    const sw = loadServiceWorker();

    await sw.dispatch("notificationclick", {
      notification: { close: vi.fn(), data: { url: "https://evil.example/phish" } },
    });

    expect(sw.self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});

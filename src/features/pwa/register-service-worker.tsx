"use client";

import { useEffect } from "react";

/** 앱 전체 범위 서비스 워커(`public/sw.js`) 등록. 알림 켜기도 같은 등록을 쓴다. */
export function registerAppServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * 앱 전체 범위로 서비스 워커(`public/sw.js`)를 등록한다.
 * 개발 서버에서는 캐시가 화면 갱신을 가리지 않도록 배포 빌드에서만 켠다.
 */
export function RegisterServiceWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || !("serviceWorker" in navigator)) {
      return;
    }

    registerAppServiceWorker().catch(() => {
      // 등록 실패는 앱 사용을 막지 않는다. 알림 설정 화면이 상태를 다시 확인해 안내한다.
    });
  }, [enabled]);

  return null;
}

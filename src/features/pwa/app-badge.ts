/** 앱 아이콘 배지를 지원하는 대상(브라우저 navigator 또는 서비스 워커의 navigator). */
export type AppBadgeTarget = {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * 설치한 앱 아이콘에 오늘 할 일 수를 띄운다. 0이면 지운다.
 * 지원하지 않는 기기(설치하지 않은 브라우저 등)나 권한 거부는 조용히 건너뛴다.
 */
export async function updateAppBadge(count: number, target: AppBadgeTarget = globalThis.navigator ?? {}) {
  try {
    if (count > 0) {
      await target.setAppBadge?.(count);
    } else {
      await target.clearAppBadge?.();
    }
  } catch {
    // 배지는 보조 표시라 실패해도 화면 동작에 영향을 주지 않는다.
  }
}

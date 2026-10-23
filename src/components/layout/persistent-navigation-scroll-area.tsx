"use client";

import {
  type ReactNode,
  type UIEvent,
  useLayoutEffect,
  useRef,
} from "react";

export const NAVIGATION_SCROLL_STORAGE_KEYS = {
  desktop: "madimadi.navigation.desktop.scroll-top",
  mobile: "madimadi.navigation.mobile.scroll-top",
} as const;

export function PersistentNavigationScrollArea({
  ariaLabel,
  children,
  className,
  restoreSignal,
  storageKey,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  /** drawer가 다시 열릴 때처럼 같은 요소에서 복원이 다시 필요한 경우 사용한다. */
  restoreSignal?: boolean;
  storageKey: string;
}) {
  const areaRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (restoreSignal === false) {
      return;
    }

    const savedScrollTop = readSavedScrollTop(storageKey);
    if (areaRef.current && savedScrollTop !== null) {
      areaRef.current.scrollTop = savedScrollTop;
    }
  }, [restoreSignal, storageKey]);

  const saveScrollPosition = (event: UIEvent<HTMLDivElement>) => {
    try {
      window.sessionStorage.setItem(storageKey, String(event.currentTarget.scrollTop));
    } catch {
      // 저장소가 차단된 환경에서도 메뉴 탐색 자체는 계속 동작해야 한다.
    }
  };

  return (
    <div
      ref={areaRef}
      role="region"
      aria-label={ariaLabel}
      className={className}
      onScroll={saveScrollPosition}
    >
      {children}
    </div>
  );
}

function readSavedScrollTop(storageKey: string) {
  try {
    const savedValue = window.sessionStorage.getItem(storageKey);
    if (savedValue === null) {
      return null;
    }

    const scrollTop = Number(savedValue);
    return Number.isFinite(scrollTop) && scrollTop >= 0 ? scrollTop : null;
  } catch {
    return null;
  }
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

export const nextRouterReplaceMock = vi.fn((href: string) => {
  window.history.pushState(null, "", href);
});
export const nextRedirectMock = vi.fn((href: string) => {
  throw new Error(`NEXT_REDIRECT:${href}`);
});

vi.mock("next/navigation", () => ({
  redirect: nextRedirectMock,
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    replace: nextRouterReplaceMock,
  }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Node 25+는 전역 `localStorage`를 직접 제공하는데, `--localstorage-file` 없이 실행하면 비어 있는 값이
// jsdom의 저장소를 가린다. 테스트는 항상 jsdom 저장소를 쓰도록 다시 연결한다.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;

for (const key of ["localStorage", "sessionStorage"] as const) {
  if (jsdomWindow && !globalThis[key]) {
    Object.defineProperty(globalThis, key, { configurable: true, value: jsdomWindow[key] });
  }
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}

if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => undefined;
}

if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => undefined;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  };
}

afterEach(() => {
  nextRedirectMock.mockClear();
  nextRouterReplaceMock.mockClear();
  cleanup();
});

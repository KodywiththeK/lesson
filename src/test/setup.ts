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

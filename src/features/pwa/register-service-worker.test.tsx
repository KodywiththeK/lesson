import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RegisterServiceWorker } from "./register-service-worker";

const register = vi.fn(async () => ({}));

afterEach(() => {
  register.mockClear();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

function stubServiceWorker() {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register } });
}

describe("RegisterServiceWorker", () => {
  it("배포 환경에서는 앱 전체 범위로 서비스 워커를 등록한다", async () => {
    stubServiceWorker();
    render(<RegisterServiceWorker enabled />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" }),
    );
  });

  it("개발 환경이거나 브라우저가 지원하지 않으면 등록하지 않는다", async () => {
    stubServiceWorker();
    render(<RegisterServiceWorker enabled={false} />);
    Reflect.deleteProperty(navigator, "serviceWorker");
    render(<RegisterServiceWorker enabled />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(register).not.toHaveBeenCalled();
  });
});

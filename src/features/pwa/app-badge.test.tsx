import { describe, expect, it, vi } from "vitest";

import { updateAppBadge } from "./app-badge";

describe("updateAppBadge", () => {
  it("건수가 있으면 배지를 달고 0이면 지우며, 지원하지 않는 기기는 건너뛴다", async () => {
    const target = { setAppBadge: vi.fn(async () => undefined), clearAppBadge: vi.fn(async () => undefined) };

    await updateAppBadge(4, target);
    expect(target.setAppBadge).toHaveBeenCalledWith(4);

    await updateAppBadge(0, target);
    expect(target.clearAppBadge).toHaveBeenCalled();

    await expect(updateAppBadge(2, {})).resolves.toBeUndefined();
  });

  it("배지 API가 실패해도 화면을 멈추지 않는다", async () => {
    await expect(
      updateAppBadge(1, { setAppBadge: vi.fn(async () => Promise.reject(new Error("denied"))) }),
    ).resolves.toBeUndefined();
  });
});

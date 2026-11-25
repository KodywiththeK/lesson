import { describe, expect, it, vi } from "vitest";

import { handleTestPush, type TestPushDependencies } from "./test-push-handler";

function request(body: unknown) {
  return new Request("https://madimadi.example/api/notifications/test-push", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<TestPushDependencies> = {}): TestPushDependencies {
  return {
    getUserId: async () => "user-1",
    isActiveMember: async () => true,
    deliver: vi.fn(async () => ({ devices: 1, sent: 1, expired: 0, failed: 0 })),
    ...overrides,
  };
}

describe("handleTestPush", () => {
  it("로그인하지 않았으면 401", async () => {
    const response = await handleTestPush(request({ academyId: "academy-1" }), dependencies({ getUserId: async () => null }));

    expect(response.status).toBe(401);
  });

  it("학원 구성원이 아니면 403", async () => {
    const response = await handleTestPush(
      request({ academyId: "academy-1" }),
      dependencies({ isActiveMember: async () => false }),
    );

    expect(response.status).toBe(403);
  });

  it("발송 설정(VAPID)이 없으면 503", async () => {
    const response = await handleTestPush(request({ academyId: "academy-1" }), dependencies({ deliver: null }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "알림 발송 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요." });
  });

  it("본인 기기에만 테스트 알림을 보낸다", async () => {
    const deps = dependencies();
    const response = await handleTestPush(request({ academyId: "academy-1" }), deps);

    expect(response.status).toBe(200);
    expect(deps.deliver).toHaveBeenCalledWith({
      academyId: "academy-1",
      userIds: ["user-1"],
      payload: { title: "마디마디 테스트 알림", body: "이 기기에서 알림을 받을 수 있습니다.", url: "/me/notifications", tag: "test" },
    });
    await expect(response.json()).resolves.toEqual({ sent: 1 });
  });

  it("켜 둔 기기가 없거나 모두 실패하면 이 기기에서 다시 켜 달라고 안내한다", async () => {
    const response = await handleTestPush(
      request({ academyId: "academy-1" }),
      dependencies({ deliver: vi.fn(async () => ({ devices: 0, sent: 0, expired: 0, failed: 0 })) }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "알림을 받을 기기가 없습니다. 이 기기에서 알림을 다시 켜 주세요." });
  });

  it("학원 id가 없으면 400", async () => {
    const response = await handleTestPush(request({}), dependencies());

    expect(response.status).toBe(400);
  });
});

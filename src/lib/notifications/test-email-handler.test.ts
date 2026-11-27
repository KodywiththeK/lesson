import { describe, expect, it, vi } from "vitest";

import { handleTestEmail, type TestEmailDependencies } from "./test-email-handler";

function request(body: unknown) {
  return new Request("https://madimadi.example/api/notifications/test-email", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<TestEmailDependencies> = {}): TestEmailDependencies {
  return {
    getUser: async () => ({ id: "user-1", email: "owner@example.com" }),
    isActiveMember: async () => true,
    sendEmail: vi.fn(async () => ({ id: "email-1" })),
    ...overrides,
  };
}

describe("handleTestEmail", () => {
  it("로그인하지 않았으면 401, 학원 구성원이 아니면 403", async () => {
    expect((await handleTestEmail(request({ academyId: "a1" }), dependencies({ getUser: async () => null }))).status).toBe(401);
    expect(
      (await handleTestEmail(request({ academyId: "a1" }), dependencies({ isActiveMember: async () => false }))).status,
    ).toBe(403);
  });

  it("메일 발송 설정이 없으면 503, 계정에 이메일이 없으면 409", async () => {
    expect((await handleTestEmail(request({ academyId: "a1" }), dependencies({ sendEmail: null }))).status).toBe(503);
    expect(
      (await handleTestEmail(request({ academyId: "a1" }), dependencies({ getUser: async () => ({ id: "u", email: null }) })))
        .status,
    ).toBe(409);
  });

  it("로그인한 본인 메일로만 테스트 메일을 보낸다", async () => {
    const deps = dependencies();

    const response = await handleTestEmail(request({ academyId: "a1" }), deps);

    expect(response.status).toBe(200);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com", subject: "[마디마디] 테스트 메일" }),
    );
  });
});

import { describe, expect, it, vi } from "vitest";

import { DEFAULT_QUIET_HOURS } from "@/domain/notification-quiet-hours";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/domain/notification-settings";

import { isAuthorizedCronRequest } from "./cron-auth";
import { dispatchNotificationOutbox, type DispatchDependencies } from "./dispatch-outbox";

const consultationRow = {
  id: "outbox-1",
  academyId: "academy-1",
  event: { id: "outbox-1", kind: "consultation" as const, payload: { name: "정다은" } },
};
const joinRow = {
  id: "outbox-2",
  academyId: "academy-1",
  event: { id: "outbox-2", kind: "join_request" as const, payload: { applicantName: "홍길동" } },
};

function dependencies(overrides: Partial<DispatchDependencies> = {}): DispatchDependencies {
  return {
    claim: vi.fn(async () => [consultationRow, joinRow]),
    listRecipients: vi.fn(async () => [
      { userId: "owner", role: "owner" as const, teacherId: null, email: "o@example.com", preferences: DEFAULT_NOTIFICATION_PREFERENCES, quietHours: DEFAULT_QUIET_HOURS },
      { userId: "desk", role: "desk" as const, teacherId: null, email: "d@example.com", preferences: DEFAULT_NOTIFICATION_PREFERENCES, quietHours: DEFAULT_QUIET_HOURS },
    ]),
    notify: vi.fn(async () => ({ devices: 1, sent: 1, expired: 0, failed: 0 })),
    today: () => "2026-11-19",
    complete: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("dispatchNotificationOutbox", () => {
  it("가져온 사건마다 받을 사람에게 보내고 완료를 기록한다(학원별 받는 사람은 한 번만 조회)", async () => {
    const deps = dependencies();

    await expect(dispatchNotificationOutbox(deps)).resolves.toEqual({ processed: 2, failed: 0 });

    expect(deps.listRecipients).toHaveBeenCalledTimes(1);
    expect(deps.notify).toHaveBeenNthCalledWith(1, {
      academyId: "academy-1",
      kind: "consultation",
      sourceKey: "outbox:outbox-1",
      recipients: [
        expect.objectContaining({ userId: "owner", quietHours: DEFAULT_QUIET_HOURS }),
        expect.objectContaining({ userId: "desk", quietHours: DEFAULT_QUIET_HOURS }),
      ],
      message: expect.objectContaining({ title: "신규 상담 접수" }),
    });
    expect(deps.notify).toHaveBeenNthCalledWith(2, {
      academyId: "academy-1",
      kind: "join_request",
      sourceKey: "outbox:outbox-2",
      recipients: [expect.objectContaining({ userId: "owner", quietHours: DEFAULT_QUIET_HOURS })],
      message: expect.objectContaining({ title: "직원 가입 요청" }),
    });
    expect(deps.complete).toHaveBeenCalledWith("outbox-1", null);
    expect(deps.complete).toHaveBeenCalledWith("outbox-2", null);
  });

  it("보내다 실패한 사건은 오류를 남겨 다음 호출에서 다시 시도하고, 나머지는 계속 보낸다", async () => {
    const deps = dependencies({
      notify: vi
        .fn()
        .mockRejectedValueOnce(new Error("push service down"))
        .mockResolvedValueOnce({ devices: 1, sent: 1, expired: 0, failed: 0 }),
    });

    await expect(dispatchNotificationOutbox(deps)).resolves.toEqual({ processed: 2, failed: 1 });
    expect(deps.complete).toHaveBeenCalledWith("outbox-1", "push service down");
    expect(deps.complete).toHaveBeenCalledWith("outbox-2", null);
  });
});

describe("isAuthorizedCronRequest", () => {
  it("Bearer 비밀값이 같을 때만 허용하고, 서버에 비밀값이 없으면 항상 거절한다", () => {
    const request = (value?: string) =>
      new Request("https://madimadi.example/api", { headers: value ? { Authorization: value } : {} });

    expect(isAuthorizedCronRequest(request("Bearer secret"), "secret")).toBe(true);
    expect(isAuthorizedCronRequest(request("Bearer wrong"), "secret")).toBe(false);
    expect(isAuthorizedCronRequest(request(), "secret")).toBe(false);
    expect(isAuthorizedCronRequest(request("Bearer "), undefined)).toBe(false);
  });
});

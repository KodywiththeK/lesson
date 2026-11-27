import { describe, expect, it, vi } from "vitest";

import { DEFAULT_QUIET_HOURS } from "@/domain/notification-quiet-hours";

import type { DeliverPush } from "./deliver-push";
import { createNotify, flushDeferredReceipts, type ReceiptStore } from "./notify";

const message = { title: "신규 상담 접수", body: "새봄 상담이 등록되었습니다.", url: "/management/consultations", tag: "c1" };

function setup(now: Date) {
  const store: ReceiptStore = { record: vi.fn(async () => undefined), claimDue: vi.fn(async () => []) };
  const deliver = vi.fn<DeliverPush>(async () => ({ devices: 1, sent: 1, expired: 0, failed: 0 }));
  return { store, deliver, notify: createNotify({ store, deliver, now: () => now }) };
}

describe("createNotify", () => {
  it("모두의 알림함에 기록하고, 방해 금지가 아닌 사람에게만 지금 푸시한다", async () => {
    const now = new Date("2026-11-27T14:00:00.000Z"); // 한국 23:00
    const { store, deliver, notify } = setup(now);

    await notify({
      academyId: "a1",
      kind: "consultation",
      sourceKey: "outbox:o1",
      message,
      recipients: [
        { userId: "owner", quietHours: { ...DEFAULT_QUIET_HOURS, enabled: false } },
        { userId: "desk", quietHours: DEFAULT_QUIET_HOURS },
      ],
    });

    expect(store.record).toHaveBeenCalledWith([
      expect.objectContaining({ userId: "owner", deliverAfter: now, pushedAt: now, kind: "consultation", sourceKey: "outbox:o1" }),
      expect.objectContaining({ userId: "desk", deliverAfter: new Date("2026-11-27T23:00:00.000Z"), pushedAt: null }),
    ]);
    expect(deliver).toHaveBeenCalledWith({ academyId: "a1", userIds: ["owner"], payload: message });
  });

  it("받는 사람이 없으면 기록도 발송도 하지 않는다", async () => {
    const { store, deliver, notify } = setup(new Date());

    await notify({ academyId: "a1", kind: "consultation", sourceKey: "outbox:o1", message, recipients: [] });

    expect(store.record).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("flushDeferredReceipts", () => {
  it("때가 된 미룬 알림을 사람별로 묶어 보낸다", async () => {
    const { store, deliver } = setup(new Date());
    const lesson = { kind: "lesson_change" as const, title: "내일 레슨 변경", body: "유나", url: "/lessons/academy" };
    vi.mocked(store.claimDue).mockResolvedValue([
      { academyId: "a1", userId: "desk", ...lesson },
      { academyId: "a1", userId: "desk", kind: "consultation", title: "신규 상담 접수", body: "새봄", url: "/management/consultations" },
      { academyId: "a1", userId: "owner", ...lesson },
    ]);

    const result = await flushDeferredReceipts({ store, deliver });

    expect(deliver).toHaveBeenCalledWith({
      academyId: "a1",
      userIds: ["desk"],
      payload: expect.objectContaining({ title: "밤사이 알림 2건", url: "/me/inbox" }),
    });
    expect(deliver).toHaveBeenCalledWith({
      academyId: "a1",
      userIds: ["owner"],
      payload: expect.objectContaining({ title: "내일 레슨 변경", url: "/lessons/academy" }),
    });
    expect(result).toEqual({ people: 2, failed: 0 });
  });
});

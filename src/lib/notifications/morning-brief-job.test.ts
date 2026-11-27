import { describe, expect, it, vi } from "vitest";

import type { DailyTaskSource } from "@/domain/daily-tasks";
import { DEFAULT_QUIET_HOURS } from "@/domain/notification-quiet-hours";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/domain/notification-settings";

import { runMorningBrief, type MorningBriefJobDependencies } from "./morning-brief-job";

const emptyTasks: DailyTaskSource = {
  unresolvedAbsences: [],
  tuitions: [
    {
      snapshotId: "tui-1",
      studentName: "단율",
      instrumentName: "피아노",
      month: "2026-11",
      dueOn: "2026-11-10",
      status: "unpaid",
      amount: 150000,
      contact: null,
    },
  ],
  lessonTickets: [],
  unpaidBookReleases: [],
  lessonChanges: [],
  consultations: [],
  pendingBookOrders: [],
};

function dependencies(overrides: Partial<MorningBriefJobDependencies> = {}): MorningBriefJobDependencies {
  return {
    listAcademies: vi.fn(async () => ["academy-1"]),
    loadBriefSource: vi.fn(async () => ({
      briefSource: { academyName: "더 클래식", lessons: [], closures: [], unreadMemoCount: 0 },
      taskStates: [],
    })),
    // 서버는 데스크 범위에서 금액을 비워 보낸다.
    loadTaskSource: vi.fn(async (_academyId: string, _date: string, scope: "owner" | "desk") =>
      scope === "owner"
        ? emptyTasks
        : { ...emptyTasks, tuitions: emptyTasks.tuitions.map((tuition) => ({ ...tuition, amount: null })) },
    ),
    listRecipients: vi.fn(async () => [
      { userId: "owner", role: "owner" as const, teacherId: null, email: "o@example.com", preferences: DEFAULT_NOTIFICATION_PREFERENCES, quietHours: DEFAULT_QUIET_HOURS },
      { userId: "desk", role: "desk" as const, teacherId: null, email: "d@example.com", preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, pushMorningBrief: false }, quietHours: DEFAULT_QUIET_HOURS },
      { userId: "kim", role: "teacher" as const, teacherId: "teacher-kim", email: "k@example.com", preferences: DEFAULT_NOTIFICATION_PREFERENCES, quietHours: DEFAULT_QUIET_HOURS },
      { userId: "noemail", role: "desk" as const, teacherId: null, email: null, preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES, pushMorningBrief: false }, quietHours: DEFAULT_QUIET_HOURS },
    ]),
    claim: vi.fn(async () => true),
    finish: vi.fn(async () => undefined),
    renderEmail: vi.fn(async (brief) => ({ html: `<p>${brief.subject}</p>`, text: brief.subject })),
    sendEmail: vi.fn(async () => ({ id: "email-id" })),
    notify: vi.fn(async () => ({ devices: 1, sent: 1, expired: 0, failed: 0 })),
    ...overrides,
  };
}

describe("runMorningBrief", () => {
  it("원장·데스크에게 역할별 메일을, 아침 푸시를 켠 사람에게 한 줄 푸시를 보낸다(선생님은 메일 없음)", async () => {
    const deps = dependencies();

    const result = await runMorningBrief(deps, "2026-11-19");

    expect(result).toEqual({ academies: 1, emails: 2, pushes: 2, skipped: 0, failures: [] });
    expect(deps.loadTaskSource).toHaveBeenCalledTimes(2);
    expect(deps.sendEmail).toHaveBeenCalledTimes(2);
    expect(deps.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "o@example.com", subject: "[더 클래식] 11월 19일(목) 레슨 0건 · 할 일 1건" }),
    );
    const ownerBrief = vi.mocked(deps.renderEmail).mock.calls[0]?.[0];
    const deskBrief = vi.mocked(deps.renderEmail).mock.calls[1]?.[0];
    expect(ownerBrief?.taskSections[0]?.items[0]?.detail).toContain("150,000원");
    expect(deskBrief?.taskSections[0]?.items[0]?.detail).not.toContain("150,000원");
    expect(deps.notify).toHaveBeenCalledWith({
      academyId: "academy-1",
      kind: "morning_brief",
      sourceKey: "morning-brief:2026-11-19",
      recipients: [expect.objectContaining({ userId: "kim", quietHours: DEFAULT_QUIET_HOURS })],
      message: expect.objectContaining({ body: "오늘 내 레슨 0건 · 할 일 0건" }),
    });
    expect(deps.finish).toHaveBeenCalledWith("academy-1", "2026-11-19", "owner", "email", "email-id", null);
  });

  it("같은 날 이미 보낸 사람·채널은 건너뛴다", async () => {
    const deps = dependencies({ claim: vi.fn(async () => false) });

    const result = await runMorningBrief(deps, "2026-11-19");

    expect(result).toMatchObject({ emails: 0, pushes: 0, skipped: 4 });
    expect(deps.sendEmail).not.toHaveBeenCalled();
  });

  it("메일 발송이 실패하면 자리를 비우고(다시 실행 가능) 나머지는 계속 보낸다", async () => {
    const deps = dependencies({
      sendEmail: vi.fn().mockRejectedValueOnce(new Error("resend down")).mockResolvedValueOnce({ id: "email-2" }),
    });

    const result = await runMorningBrief(deps, "2026-11-19");

    expect(result.emails).toBe(1);
    expect(result.failures).toEqual([{ academyId: "academy-1", userId: "owner", channel: "email", error: "resend down" }]);
    expect(deps.finish).toHaveBeenCalledWith("academy-1", "2026-11-19", "owner", "email", null, "resend down");
  });

  it("메일 발송 설정이 없으면 메일은 건너뛰고 푸시만 보낸다", async () => {
    const deps = dependencies({ sendEmail: null });

    const result = await runMorningBrief(deps, "2026-11-19");

    expect(result).toMatchObject({ emails: 0, pushes: 2 });
  });
});

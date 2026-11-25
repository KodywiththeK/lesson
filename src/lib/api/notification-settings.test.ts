import { describe, expect, it } from "vitest";

import {
  deletePushSubscription,
  fetchMyNotificationSettings,
  saveMyNotificationPreferences,
  savePushSubscription,
  type NotificationSettingsSupabaseClient,
} from "./notification-settings";

function createClient(data: unknown, error: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });

      return { data: error ? null : data, error };
    },
  } as unknown as NotificationSettingsSupabaseClient;

  return { client, calls };
}

describe("알림 설정 API", () => {
  it("내 설정과 받는 메일 주소를 읽는다", async () => {
    const { client, calls } = createClient([
      {
        email: "owner@example.com",
        morning_email: true,
        push_lesson_change: false,
        push_consultation: true,
        push_join_request: true,
        push_morning_brief: false,
      },
    ]);

    await expect(fetchMyNotificationSettings(client, { academyId: "academy-1" })).resolves.toEqual({
      email: "owner@example.com",
      preferences: {
        morningEmail: true,
        pushLessonChange: false,
        pushConsultation: true,
        pushJoinRequest: true,
        pushMorningBrief: false,
      },
    });
    expect(calls[0]).toEqual({ name: "get_my_notification_preferences", args: { p_academy_id: "academy-1" } });
  });

  it("설정 저장은 다섯 항목을 모두 보낸다", async () => {
    const { client, calls } = createClient(null);

    await saveMyNotificationPreferences(client, {
      academyId: "academy-1",
      preferences: {
        morningEmail: false,
        pushLessonChange: true,
        pushConsultation: true,
        pushJoinRequest: false,
        pushMorningBrief: true,
      },
    });

    expect(calls[0]).toEqual({
      name: "set_my_notification_preferences",
      args: {
        p_academy_id: "academy-1",
        p_morning_email: false,
        p_push_lesson_change: true,
        p_push_consultation: true,
        p_push_join_request: false,
        p_push_morning_brief: true,
      },
    });
  });

  it("기기 구독 저장·삭제는 endpoint와 키를 그대로 보내고 실패하면 한국어 오류를 던진다", async () => {
    const ok = createClient(null);
    await savePushSubscription(ok.client, {
      academyId: "academy-1",
      subscription: { endpoint: "https://push.example/1", p256dh: "key", auth: "secret" },
      userAgent: "test-agent",
    });
    await deletePushSubscription(ok.client, { endpoint: "https://push.example/1" });

    expect(ok.calls).toEqual([
      {
        name: "save_push_subscription",
        args: {
          p_academy_id: "academy-1",
          p_endpoint: "https://push.example/1",
          p_p256dh: "key",
          p_auth: "secret",
          p_user_agent: "test-agent",
        },
      },
      { name: "delete_push_subscription", args: { p_endpoint: "https://push.example/1" } },
    ]);

    const failed = createClient(null, new Error("denied"));
    await expect(
      deletePushSubscription(failed.client, { endpoint: "https://push.example/1" }),
    ).rejects.toThrow("이 기기 알림을 끄지 못했습니다: denied");
  });
});

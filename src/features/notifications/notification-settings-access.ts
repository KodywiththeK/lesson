import { DEFAULT_QUIET_HOURS } from "@/domain/notification-quiet-hours";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/domain/notification-settings";
import {
  deletePushSubscription,
  fetchMyNotificationSettings,
  saveMyNotificationPreferences,
  savePushSubscription,
  type NotificationSettingsSupabaseClient,
} from "@/lib/api/notification-settings";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  getThisDeviceEndpoint,
  readPushEnvironment,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from "./browser-push";
import type { NotificationDevice, NotificationSettingsDataAccess } from "./notification-settings-screen";

export function createSupabaseNotificationSettingsAccess(academyId: string): NotificationSettingsDataAccess {
  const client = () => createSupabaseBrowserClient() as unknown as NotificationSettingsSupabaseClient;

  return {
    loadSettings: () => fetchMyNotificationSettings(client(), { academyId }),
    saveSettings: (settings) => saveMyNotificationPreferences(client(), { academyId, ...settings }),
    saveSubscription: (subscription) =>
      savePushSubscription(client(), { academyId, subscription, userAgent: navigator.userAgent }),
    deleteSubscription: (endpoint) => deletePushSubscription(client(), { endpoint }),
    sendTest: () => postAction("/api/notifications/test-push", academyId, "테스트 알림을 보내지 못했습니다."),
    sendTestEmail: () => postAction("/api/notifications/test-email", academyId, "테스트 메일을 보내지 못했습니다."),
  };
}

/** 본인 확인 후 서버가 보내는 테스트 발송(푸시·메일). 실패하면 서버 문구를 그대로 보여 준다. */
async function postAction(url: string, academyId: string, fallbackMessage: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ academyId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? fallbackMessage);
  }
}

/** 데모·E2E용. 서버 없이 화면 안에서만 설정을 기억한다. */
export function createDemoNotificationSettingsAccess(): NotificationSettingsDataAccess {
  let settings = { preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES }, quietHours: { ...DEFAULT_QUIET_HOURS } };

  return {
    loadSettings: async () => ({ email: "owner@example.com", lastMorningEmailAt: null, ...settings }),
    saveSettings: async (next) => {
      settings = next;
    },
    saveSubscription: async () => undefined,
    deleteSubscription: async () => undefined,
    sendTest: async () => {
      throw new Error("데모 화면에서는 테스트 알림을 보낼 수 없습니다.");
    },
    sendTestEmail: async () => {
      throw new Error("데모 화면에서는 테스트 메일을 보낼 수 없습니다.");
    },
  };
}

export const browserNotificationDevice: NotificationDevice = {
  readEnvironment: readPushEnvironment,
  getEndpoint: getThisDeviceEndpoint,
  subscribe: () => {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      return Promise.reject(new Error("알림 발송 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요."));
    }
    return subscribeThisDevice(vapidPublicKey);
  },
  unsubscribe: unsubscribeThisDevice,
};

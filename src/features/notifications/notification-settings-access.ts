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
    savePreferences: (preferences) => saveMyNotificationPreferences(client(), { academyId, preferences }),
    saveSubscription: (subscription) =>
      savePushSubscription(client(), { academyId, subscription, userAgent: navigator.userAgent }),
    deleteSubscription: (endpoint) => deletePushSubscription(client(), { endpoint }),
    sendTest: async () => {
      const response = await fetch("/api/notifications/test-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academyId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "테스트 알림을 보내지 못했습니다.");
      }
    },
  };
}

/** 데모·E2E용. 서버 없이 화면 안에서만 설정을 기억한다. */
export function createDemoNotificationSettingsAccess(): NotificationSettingsDataAccess {
  let preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };

  return {
    loadSettings: async () => ({ email: "owner@example.com", preferences }),
    savePreferences: async (next) => {
      preferences = next;
    },
    saveSubscription: async () => undefined,
    deleteSubscription: async () => undefined,
    sendTest: async () => {
      throw new Error("데모 화면에서는 테스트 알림을 보낼 수 없습니다.");
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

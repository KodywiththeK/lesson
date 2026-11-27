import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationRecipientCandidate } from "@/domain/notification-dispatch";
import type { QuietHours } from "@/domain/notification-quiet-hours";
import {
  toNotificationPreferences,
  toQuietHours,
  type NotificationPreferenceColumns,
} from "@/lib/api/notification-settings";

export type NotificationRecipient = NotificationRecipientCandidate & { email: string | null; quietHours: QuietHours };

type RecipientRow = NotificationPreferenceColumns & {
  user_id: string;
  role: NotificationRecipient["role"];
  teacher_id: string | null;
  email: string | null;
};

/** service_role 전용 RPC로 학원의 활성 구성원·연결 선생님·알림 설정·이메일을 읽는다. */
export async function fetchNotificationRecipients(client: SupabaseClient, academyId: string): Promise<NotificationRecipient[]> {
  const { data, error } = await client.rpc("list_notification_recipients", { p_academy_id: academyId });

  if (error) {
    throw new Error(`알림 받을 사람을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as RecipientRow[]).map((row) => ({
    userId: row.user_id,
    role: row.role,
    teacherId: row.teacher_id,
    email: row.email,
    preferences: toNotificationPreferences(row),
    quietHours: toQuietHours(row),
  }));
}

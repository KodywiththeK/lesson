import type { NotificationPreferences } from "@/domain/notification-settings";

type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

/** DB 알림 설정 열. 내 설정 조회와 서버의 받는 사람 조회가 같은 열을 돌려준다. */
export type NotificationPreferenceColumns = {
  morning_email: boolean;
  push_lesson_change: boolean;
  push_consultation: boolean;
  push_join_request: boolean;
  push_morning_brief: boolean;
};

type NotificationPreferenceRow = NotificationPreferenceColumns & { email: string | null };

export function toNotificationPreferences(row: NotificationPreferenceColumns): NotificationPreferences {
  return {
    morningEmail: row.morning_email,
    pushLessonChange: row.push_lesson_change,
    pushConsultation: row.push_consultation,
    pushJoinRequest: row.push_join_request,
    pushMorningBrief: row.push_morning_brief,
  };
}

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationRpcArgs = {
  get_my_notification_preferences: { p_academy_id: string };
  set_my_notification_preferences: {
    p_academy_id: string;
    p_morning_email: boolean;
    p_push_lesson_change: boolean;
    p_push_consultation: boolean;
    p_push_join_request: boolean;
    p_push_morning_brief: boolean;
  };
  save_push_subscription: {
    p_academy_id: string;
    p_endpoint: string;
    p_p256dh: string;
    p_auth: string;
    p_user_agent: string | null;
  };
  delete_push_subscription: { p_endpoint: string };
};

type NotificationRpcResult = {
  get_my_notification_preferences: NotificationPreferenceRow[];
  set_my_notification_preferences: unknown;
  save_push_subscription: unknown;
  delete_push_subscription: unknown;
};

export type NotificationSettingsSupabaseClient = {
  rpc<TName extends keyof NotificationRpcArgs>(
    name: TName,
    args: NotificationRpcArgs[TName],
  ): PromiseLike<SupabaseQueryResult<NotificationRpcResult[TName]>>;
};

export type MyNotificationSettings = {
  email: string | null;
  preferences: NotificationPreferences;
};

export async function fetchMyNotificationSettings(
  supabase: NotificationSettingsSupabaseClient,
  input: { academyId: string },
): Promise<MyNotificationSettings> {
  const { data, error } = await supabase.rpc("get_my_notification_preferences", { p_academy_id: input.academyId });

  if (error) {
    throw new Error(`알림 설정을 불러오지 못했습니다: ${error.message}`);
  }

  const row = data?.[0];
  if (!row) {
    throw new Error("알림 설정을 불러오지 못했습니다.");
  }

  return { email: row.email, preferences: toNotificationPreferences(row) };
}

export async function saveMyNotificationPreferences(
  supabase: NotificationSettingsSupabaseClient,
  input: { academyId: string; preferences: NotificationPreferences },
): Promise<void> {
  const { preferences } = input;
  const { error } = await supabase.rpc("set_my_notification_preferences", {
    p_academy_id: input.academyId,
    p_morning_email: preferences.morningEmail,
    p_push_lesson_change: preferences.pushLessonChange,
    p_push_consultation: preferences.pushConsultation,
    p_push_join_request: preferences.pushJoinRequest,
    p_push_morning_brief: preferences.pushMorningBrief,
  });

  if (error) {
    throw new Error(`알림 설정을 저장하지 못했습니다: ${error.message}`);
  }
}

export async function savePushSubscription(
  supabase: NotificationSettingsSupabaseClient,
  input: { academyId: string; subscription: PushSubscriptionKeys; userAgent: string | null },
): Promise<void> {
  const { error } = await supabase.rpc("save_push_subscription", {
    p_academy_id: input.academyId,
    p_endpoint: input.subscription.endpoint,
    p_p256dh: input.subscription.p256dh,
    p_auth: input.subscription.auth,
    p_user_agent: input.userAgent,
  });

  if (error) {
    throw new Error(`이 기기 알림을 켜지 못했습니다: ${error.message}`);
  }
}

export async function deletePushSubscription(
  supabase: NotificationSettingsSupabaseClient,
  input: { endpoint: string },
): Promise<void> {
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: input.endpoint });

  if (error) {
    throw new Error(`이 기기 알림을 끄지 못했습니다: ${error.message}`);
  }
}

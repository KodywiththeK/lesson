import { createPushSubscriptionStore, deliverPush } from "@/lib/notifications/deliver-push";
import { handleTestPush } from "@/lib/notifications/test-push-handler";
import { createWebPushSender } from "@/lib/notifications/web-push-sender";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/** 내 알림 설정의 '테스트 알림 보내기'. 로그인한 본인 기기에만 보낸다. */
export async function POST(request: Request) {
  const session = await createSupabaseServerClient();
  const { data } = await session.auth.getUser();
  const userId = data.user?.id ?? null;
  const serviceClient = createSupabaseServiceRoleClient();
  const sender = createWebPushSender();

  return handleTestPush(request, {
    getUserId: async () => userId,
    isActiveMember: async (academyId) => {
      const { data: membership } = await session
        .from("academy_members")
        .select("academy_id")
        .eq("academy_id", academyId)
        .eq("user_id", userId ?? "")
        .eq("status", "active")
        .maybeSingle();

      return membership !== null;
    },
    deliver:
      serviceClient && sender
        ? (input) => deliverPush({ ...input, store: createPushSubscriptionStore(serviceClient), sender })
        : null,
  });
}

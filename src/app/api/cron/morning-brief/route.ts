import type { DailyTaskSource, DailyTaskState } from "@/domain/daily-tasks";
import { getFinanceToday } from "@/domain/finance-date";
import type { MorningBriefSource } from "@/domain/morning-brief";
import { renderMorningBriefEmail } from "@/emails/morning-brief-email";
import { createPushSubscriptionStore, deliverPush, skipPush } from "@/lib/notifications/deliver-push";
import { isAuthorizedCronRequest } from "@/lib/notifications/cron-auth";
import { runMorningBrief } from "@/lib/notifications/morning-brief-job";
import { createNotify, createReceiptStore } from "@/lib/notifications/notify";
import { fetchNotificationRecipients } from "@/lib/notifications/recipients";
import { createResendMailer } from "@/lib/notifications/resend-mailer";
import { createWebPushSender } from "@/lib/notifications/web-push-sender";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/** 학원이 여러 곳이어도 한 번에 끝나도록 여유를 둔다. */
export const maxDuration = 60;

/** pg_cron이 매일 23:00 UTC(한국 08:00)에 부른다. */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  }

  const client = createSupabaseServiceRoleClient();
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!client || !appBaseUrl) {
    return Response.json({ error: "아침 브리핑 설정이 없습니다." }, { status: 503 });
  }

  const sender = createWebPushSender();
  const store = createPushSubscriptionStore(client);
  const rpc = async <T,>(name: string, args: Record<string, unknown>, label: string): Promise<T> => {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }
    return data as T;
  };

  const result = await runMorningBrief(
    {
      listAcademies: async () =>
        (await rpc<Array<{ academy_id: string }>>("list_academies_for_morning_brief", {}, "학원 목록을 불러오지 못했습니다")).map(
          (row) => row.academy_id,
        ),
      loadBriefSource: async (academyId, date) => {
        const { taskStates, ...briefSource } = await rpc<MorningBriefSource & { taskStates: DailyTaskState[] }>(
          "get_morning_brief_source_for_service",
          { p_academy_id: academyId, p_date: date },
          "아침 브리핑 자료를 불러오지 못했습니다",
        );
        return { briefSource, taskStates };
      },
      loadTaskSource: (academyId, date, scope) =>
        rpc<DailyTaskSource>(
          "get_daily_task_source_for_service",
          { p_academy_id: academyId, p_date: date, p_scope: scope },
          "오늘 할 일을 불러오지 못했습니다",
        ),
      listRecipients: (academyId) => fetchNotificationRecipients(client, academyId),
      claim: (academyId, date, userId, channel) =>
        rpc<boolean>(
          "claim_morning_brief_delivery",
          { p_academy_id: academyId, p_date: date, p_user_id: userId, p_channel: channel },
          "발송 기록을 남기지 못했습니다",
        ),
      finish: async (academyId, date, userId, channel, providerId, error) => {
        await rpc(
          "finish_morning_brief_delivery",
          {
            p_academy_id: academyId,
            p_date: date,
            p_user_id: userId,
            p_channel: channel,
            p_provider_id: providerId,
            p_error: error,
          },
          "발송 결과를 남기지 못했습니다",
        );
      },
      renderEmail: (brief) => renderMorningBriefEmail(brief, appBaseUrl),
      sendEmail: createResendMailer(),
      // 발송 설정(VAPID)이 없어도 알림함에는 남긴다.
      notify: createNotify({
        store: createReceiptStore(client),
        deliver: sender ? (input) => deliverPush({ ...input, store, sender }) : skipPush,
      }),
    },
    getFinanceToday(),
  );

  return Response.json(result);
}

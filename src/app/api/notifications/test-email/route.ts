import { isActiveAcademyMember } from "@/lib/notifications/academy-member-request";
import { createResendMailer } from "@/lib/notifications/resend-mailer";
import { handleTestEmail } from "@/lib/notifications/test-email-handler";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** 내 알림 설정의 '테스트 메일 보내기'. 로그인한 본인 메일로만 보낸다. */
export async function POST(request: Request) {
  const session = await createSupabaseServerClient();
  const { data } = await session.auth.getUser();
  const user = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;

  return handleTestEmail(request, {
    getUser: async () => user,
    isActiveMember: (academyId) => isActiveAcademyMember(session, user?.id ?? "", academyId),
    sendEmail: createResendMailer(),
  });
}

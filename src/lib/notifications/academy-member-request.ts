import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSession = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * 본인 확인이 필요한 학원 요청(테스트 알림·테스트 메일)의 공통 검사.
 * 로그인 → 학원 id → 활성 구성원 순서로 확인하고, 통과하면 학원 id를, 아니면 오류 응답을 돌려준다.
 */
export async function authorizeAcademyMemberRequest(
  request: Request,
  {
    isSignedIn,
    isActiveMember,
    deniedMessage,
  }: { isSignedIn: boolean; isActiveMember: (academyId: string) => Promise<boolean>; deniedMessage: string },
): Promise<{ academyId: string } | Response> {
  if (!isSignedIn) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { academyId?: unknown };
  if (typeof body.academyId !== "string" || body.academyId.length === 0) {
    return Response.json({ error: "학원을 확인해 주세요." }, { status: 400 });
  }

  if (!(await isActiveMember(body.academyId))) {
    return Response.json({ error: deniedMessage }, { status: 403 });
  }

  return { academyId: body.academyId };
}

/** 서버 route에서 로그인 사용자가 이 학원의 활성 구성원인지 확인한다. */
export async function isActiveAcademyMember(session: ServerSession, userId: string, academyId: string) {
  const { data } = await session
    .from("academy_members")
    .select("academy_id")
    .eq("academy_id", academyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data !== null;
}

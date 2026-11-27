import type { PushMessage } from "@/domain/notification-dispatch";

import { authorizeAcademyMemberRequest } from "./academy-member-request";
import type { DeliverPush } from "./deliver-push";

export type TestPushDependencies = {
  getUserId: () => Promise<string | null>;
  isActiveMember: (academyId: string) => Promise<boolean>;
  /** 발송 설정이 없으면 null. */
  deliver: DeliverPush | null;
};

const TEST_PAYLOAD: PushMessage = {
  title: "마디마디 테스트 알림",
  body: "이 기기에서 알림을 받을 수 있습니다.",
  url: "/me/notifications",
  tag: "test",
};

/** 로그인한 본인의 기기에만 테스트 알림을 보낸다. */
export async function handleTestPush(request: Request, dependencies: TestPushDependencies) {
  const userId = await dependencies.getUserId();
  const authorized = await authorizeAcademyMemberRequest(request, {
    isSignedIn: userId !== null,
    isActiveMember: dependencies.isActiveMember,
    deniedMessage: "이 학원의 구성원만 알림을 받을 수 있습니다.",
  });
  if (authorized instanceof Response || userId === null) {
    return authorized as Response;
  }

  if (!dependencies.deliver) {
    return Response.json(
      { error: "알림 발송 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요." },
      { status: 503 },
    );
  }

  const summary = await dependencies.deliver({ academyId: authorized.academyId, userIds: [userId], payload: TEST_PAYLOAD });
  if (summary.sent === 0) {
    return Response.json({ error: "알림을 받을 기기가 없습니다. 이 기기에서 알림을 다시 켜 주세요." }, { status: 409 });
  }

  return Response.json({ sent: summary.sent });
}

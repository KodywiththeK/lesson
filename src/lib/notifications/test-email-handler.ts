import { authorizeAcademyMemberRequest } from "./academy-member-request";

export type TestEmailDependencies = {
  getUser: () => Promise<{ id: string; email: string | null } | null>;
  isActiveMember: (academyId: string) => Promise<boolean>;
  /** 메일 발송 설정이 없으면 null. */
  sendEmail: ((message: { to: string; subject: string; html: string; text: string }) => Promise<{ id: string | null }>) | null;
};

const TEST_TEXT = "마디마디 테스트 메일입니다. 이 메일이 보이면 아침 브리핑 메일도 이 주소로 받을 수 있습니다.";

/** 내 알림 설정의 '테스트 메일 보내기'. 로그인한 본인 메일로만 보낸다(다른 주소를 받지 않는다). */
export async function handleTestEmail(request: Request, dependencies: TestEmailDependencies) {
  const user = await dependencies.getUser();
  const authorized = await authorizeAcademyMemberRequest(request, {
    isSignedIn: user !== null,
    isActiveMember: dependencies.isActiveMember,
    deniedMessage: "이 학원의 구성원만 메일을 받을 수 있습니다.",
  });
  if (authorized instanceof Response || user === null) {
    return authorized as Response;
  }

  if (!dependencies.sendEmail) {
    return Response.json(
      { error: "메일 발송 설정이 아직 준비되지 않았습니다. 관리자에게 문의해 주세요." },
      { status: 503 },
    );
  }

  if (!user.email) {
    return Response.json({ error: "로그인 계정에 이메일이 없어 메일을 받을 수 없습니다." }, { status: 409 });
  }

  const { id } = await dependencies.sendEmail({
    to: user.email,
    subject: "[마디마디] 테스트 메일",
    html: `<p>${TEST_TEXT}</p>`,
    text: TEST_TEXT,
  });

  return Response.json({ id });
}

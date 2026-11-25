import { Resend } from "resend";

export type ResendEmailClient = Pick<Resend, "emails">;

type ServerEnv = Record<string, string | undefined>;

/** 서버 전용 Resend 메일 발송. 키·보내는 주소가 없으면 null(메일 끔)이다. */
export function createResendMailer(
  env: ServerEnv = process.env,
  createClient: (apiKey: string) => ResendEmailClient = (apiKey) => new Resend(apiKey),
) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.MAIL_FROM;

  if (!apiKey || !from) {
    return null;
  }

  const client = createClient(apiKey);

  return async (message: { to: string; subject: string; html: string; text: string }) => {
    const { data, error } = await client.emails.send({ from, ...message });

    if (error) {
      throw new Error(`메일을 보내지 못했습니다: ${error.message}`);
    }

    return { id: data?.id ?? null };
  };
}

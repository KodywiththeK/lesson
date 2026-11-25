import { describe, expect, it, vi } from "vitest";

import { createResendMailer, type ResendEmailClient } from "./resend-mailer";

const message = { to: "owner@example.com", subject: "제목", html: "<p>본문</p>", text: "본문" };

describe("createResendMailer", () => {
  it("API 키나 보내는 주소가 없으면 메일 발송을 끈다(null)", () => {
    expect(createResendMailer({ MAIL_FROM: "마디마디 <noreply@example.com>" })).toBeNull();
    expect(createResendMailer({ RESEND_API_KEY: "key" })).toBeNull();
  });

  it("보내는 주소로 메일을 보내고 Resend id를 돌려준다", async () => {
    const send = vi.fn(async () => ({ data: { id: "email-1" }, error: null }));
    const mailer = createResendMailer(
      { RESEND_API_KEY: "key", MAIL_FROM: "마디마디 <noreply@example.com>" },
      () => ({ emails: { send } }) as unknown as ResendEmailClient,
    );

    await expect(mailer!(message)).resolves.toEqual({ id: "email-1" });
    expect(send).toHaveBeenCalledWith({ from: "마디마디 <noreply@example.com>", ...message });
  });

  it("Resend가 오류를 돌려주면 한국어 오류를 던진다", async () => {
    const send = vi.fn(async () => ({ data: null, error: { message: "domain not verified" } }));
    const mailer = createResendMailer(
      { RESEND_API_KEY: "key", MAIL_FROM: "noreply@example.com" },
      () => ({ emails: { send } }) as unknown as ResendEmailClient,
    );

    await expect(mailer!(message)).rejects.toThrow("메일을 보내지 못했습니다: domain not verified");
  });
});

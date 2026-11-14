import { toUserMessage } from "@/lib/errors/user-message";

export function toMfaMessage(error: unknown) {
  if (error instanceof Error && "code" in error && error.code === "mfa_verification_failed") {
    return "인증 코드를 확인하고 다시 시도해 주세요.";
  }
  return toUserMessage(error);
}

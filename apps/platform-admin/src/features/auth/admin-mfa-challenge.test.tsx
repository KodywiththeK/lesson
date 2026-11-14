import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listFactors, challengeAndVerify } = vi.hoisted(() => ({ listFactors: vi.fn(), challengeAndVerify: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { mfa: { listFactors, challengeAndVerify } } }),
}));

import { AdminMfaChallenge } from "./admin-mfa-challenge";

describe("관리자 TOTP 확인", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1", friendly_name: "내 인증 앱", status: "verified" }] }, error: null });
    challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  });

  it("등록된 인증 앱의 코드를 검증한 후에만 인증 완료를 알린다", async () => {
    const onVerified = vi.fn();
    render(<AdminMfaChallenge onVerified={onVerified} />);

    const code = await screen.findByRole("textbox", { name: "인증 코드" });
    await userEvent.type(code, "123456");
    await userEvent.click(screen.getByRole("button", { name: "인증하기" }));

    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it("잘못된 코드는 인증 완료로 처리하지 않고 다시 입력하도록 안내한다", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: Object.assign(new Error("invalid code"), { code: "mfa_verification_failed" }) });
    const onVerified = vi.fn();
    render(<AdminMfaChallenge onVerified={onVerified} />);

    await userEvent.type(await screen.findByRole("textbox", { name: "인증 코드" }), "123456");
    await userEvent.click(screen.getByRole("button", { name: "인증하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("인증 코드");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("등록된 인증 앱이 없으면 인증을 진행하지 않는다", async () => {
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    render(<AdminMfaChallenge onVerified={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("등록된 인증 앱이 없습니다");
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });
});

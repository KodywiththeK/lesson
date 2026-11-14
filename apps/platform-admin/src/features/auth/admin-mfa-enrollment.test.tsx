import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enroll, challengeAndVerify, unenroll } = vi.hoisted(() => ({ enroll: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { mfa: { enroll, challengeAndVerify, unenroll } } }),
}));

import { AdminMfaEnrollment } from "./admin-mfa-enrollment";

describe("관리자 인증 앱 등록", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    enroll.mockResolvedValue({ data: { id: "new-factor", totp: { qr_code: "data:image/svg+xml,qr" } }, error: null });
    challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    unenroll.mockResolvedValue({ data: {}, error: null });
  });

  it("인증 앱 등록을 시작하고 코드를 검증한 뒤 완료한다", async () => {
    const onEnrolled = vi.fn();
    render(<AdminMfaEnrollment onEnrolled={onEnrolled} />);

    await userEvent.click(screen.getByRole("button", { name: "인증 앱 등록 시작" }));
    expect(enroll).toHaveBeenCalledWith({ factorType: "totp" });
    expect(await screen.findByRole("img", { name: "인증 앱 등록 QR 코드" })).toHaveAttribute("src", "data:image/svg+xml,qr");
    await userEvent.type(screen.getByRole("textbox", { name: "인증 코드" }), "123456");
    await userEvent.click(screen.getByRole("button", { name: "등록 확인" }));

    expect(challengeAndVerify).toHaveBeenCalledWith({ factorId: "new-factor", code: "123456" });
    expect(onEnrolled).toHaveBeenCalledOnce();
  });

  it("인증에 실패하면 등록 완료로 처리하지 않는다", async () => {
    challengeAndVerify.mockResolvedValue({ data: null, error: Object.assign(new Error("invalid code"), { code: "mfa_verification_failed" }) });
    const onEnrolled = vi.fn();
    render(<AdminMfaEnrollment onEnrolled={onEnrolled} />);

    await userEvent.click(screen.getByRole("button", { name: "인증 앱 등록 시작" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "인증 코드" }), "123456");
    await userEvent.click(screen.getByRole("button", { name: "등록 확인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("인증 코드");
    expect(onEnrolled).not.toHaveBeenCalled();
  });

  it("등록을 취소하면 이번에 만든 미확인 인증 앱만 제거한다", async () => {
    render(<AdminMfaEnrollment onEnrolled={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "인증 앱 등록 시작" }));
    await userEvent.click(await screen.findByRole("button", { name: "등록 취소" }));

    expect(unenroll).toHaveBeenCalledWith({ factorId: "new-factor" });
    expect(screen.queryByRole("img", { name: "인증 앱 등록 QR 코드" })).not.toBeInTheDocument();
  });
});

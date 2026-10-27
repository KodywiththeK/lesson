import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, signInWithPassword, getUser, signOut, membershipResult, update, profileEq, profileResult } = vi.hoisted(() => ({
  replace: vi.fn(),
  signInWithPassword: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  membershipResult: vi.fn(),
  update: vi.fn(),
  profileEq: vi.fn(),
  profileResult: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword, getUser, signOut },
    from: (table: string) => table === "profiles"
      ? { update }
      : { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: membershipResult }) }) }) }) },
  }),
}));

import { LegacyOwnerSignIn } from "./legacy-owner-sign-in";

describe("기존 원장 카카오 연결 준비", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    signInWithPassword.mockResolvedValue({ error: null });
    getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null });
    membershipResult.mockResolvedValue({ data: [{ id: "member-id" }], error: null });
    profileResult.mockResolvedValue({ data: { id: "owner-id" }, error: null });
    profileEq.mockReturnValue({ select: () => ({ single: profileResult }) });
    update.mockReturnValue({ eq: profileEq });
  });

  async function fillForm(phone: string) {
    const user = userEvent.setup();
    render(<LegacyOwnerSignIn />);
    await user.type(screen.getByRole("textbox", { name: "이메일" }), "owner@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "password");
    await user.type(screen.getByRole("textbox", { name: "휴대폰 번호" }), phone);
    await user.click(screen.getByRole("button", { name: "원장 계정 확인" }));
  }

  it("원장 확인 뒤 국내 휴대폰 번호를 프로필에 저장하고 연결 화면으로 이동한다", async () => {
    await fillForm("010-1234-5678");

    expect(update).toHaveBeenCalledWith({ phone: "01012345678" });
    expect(profileEq).toHaveBeenCalledWith("id", "owner-id");
    expect(window.sessionStorage.getItem("owner-link-user-id")).toBe("owner-id");
    expect(replace).toHaveBeenCalledWith("/auth/link-kakao");
  });

  it("프로필 저장에 실패하면 카카오 연결 단계로 이동하지 않는다", async () => {
    profileResult.mockResolvedValue({ data: null, error: new Error("저장 실패") });
    await fillForm("010-1234-5678");

    expect(replace).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("owner-link-user-id")).toBeNull();
  });

  it("국내 휴대폰 형식이 아니면 로그인 요청을 시작하지 않는다", async () => {
    await fillForm("12345678");

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithOAuth } = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
}));

import { AdminSignIn } from "./admin-sign-in";

describe("플랫폼 관리자 로그인", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("관리자 카카오 로그인을 시작하고 이 앱의 인증 완료 주소로 돌아온다", async () => {
    render(<AdminSignIn />);
    await userEvent.click(screen.getByRole("button", { name: "카카오로 로그인" }));

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    expect(screen.queryByLabelText("비밀번호")).not.toBeInTheDocument();
  });

  it("인증 요청에 실패하면 한국어로 알리고 다시 시도할 수 있다", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("Failed to fetch") });
    render(<AdminSignIn />);
    await userEvent.click(screen.getByRole("button", { name: "카카오로 로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("네트워크 연결을 확인");
    expect(screen.getByRole("button", { name: "카카오로 로그인" })).toBeEnabled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, selectAcademy } = vi.hoisted(() => ({ push: vi.fn(), selectAcademy: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/auth/academy-session-gate", () => ({
  AcademySessionGate: ({ children }: { children: () => React.ReactNode }) => children(),
  useAcademySessionControls: () => ({ selectAcademy, signOut: vi.fn() }),
}));
vi.mock("@/features/auth/onboarding-screen", () => ({
  OnboardingScreen: ({ onComplete }: { onComplete: (academyId?: string) => void }) => <>
    <button onClick={() => onComplete()}>신청 상태 확인</button>
    <button onClick={() => onComplete("academy-2")}>학원 생성 완료</button>
  </>,
}));

import OnboardingPage from "./page";

describe("기존 학원이 있는 사용자의 다른 학원 가입", () => {
  beforeEach(() => vi.clearAllMocks());

  it("신청 상태를 확인할 때 화면에 남고, 새 학원 생성 뒤에는 학원으로 이동한다", async () => {
    render(<OnboardingPage />);
    await userEvent.click(screen.getByRole("button", { name: "신청 상태 확인" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "현재 학원으로 돌아가기" })).toHaveAttribute("href", "/");

    await userEvent.click(screen.getByRole("button", { name: "학원 생성 완료" }));
    expect(selectAcademy).toHaveBeenCalledWith("academy-2");
    expect(push).toHaveBeenCalledWith("/");
  });
});

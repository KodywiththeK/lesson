import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listMyJoinRequests } = vi.hoisted(() => ({ listMyJoinRequests: vi.fn() }));
vi.mock("@/lib/api/academy-onboarding", () => ({ listMyJoinRequests }));

import { OnboardingScreen } from "./onboarding-screen";

describe("가입 신청 상태 새로고침", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMyJoinRequests
      .mockResolvedValueOnce([{
        id: "request-1", academy_id: "academy-1", academy_name: "가 학원",
        status: "pending", membership_status: null, created_at: "2026-10-27",
      }])
      .mockResolvedValue([{
        id: "request-1", academy_id: "academy-1", academy_name: "가 학원",
        status: "rejected", membership_status: null, created_at: "2026-10-27",
      }]);
  });

  it("반려된 신청의 표시 상태를 다시 조회한다", async () => {
    const onComplete = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}>
      <OnboardingScreen onComplete={onComplete} onSignOut={vi.fn()} />
    </QueryClientProvider>);

    expect(await screen.findByText("가 학원 · 대기")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "승인 상태 새로고침" }));

    expect(await screen.findByText("가 학원 · 반려")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const reviewJoinRequest = vi.fn();
const rotateJoinCode = vi.fn();
vi.mock("@/lib/api/academy-onboarding", () => ({
  listOwnerJoinRequests: async () => [{ id: "request-1", applicant_name: "김선생", applicant_phone: "01012345678", source: "code", status: "pending", created_at: "2026-10-26" }],
  listStaff: async () => [],
  listInvites: async () => [],
  listAvailableTeacherRecords: async () => [],
  reviewJoinRequest: (...args: unknown[]) => reviewJoinRequest(...args),
  createInvite: vi.fn(), revokeInvite: vi.fn(), rotateJoinCode: (...args: unknown[]) => rotateJoinCode(...args),
  setStaffActive: vi.fn(), setStaffRole: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }) }),
}));

import { OwnerMembersScreen } from "./owner-members-screen";

describe("원장 직원 관리", () => {
  it("가입 신청은 역할을 지정해 승인할 때만 권한을 준다", async () => {
    reviewJoinRequest.mockResolvedValue("member-1");
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OwnerMembersScreen academyId="academy-1" /></QueryClientProvider>);
    expect(await screen.findByText("김선생")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "김선생 승인" }));
    expect(reviewJoinRequest).toHaveBeenCalledWith({ requestId: "request-1", approve: true, role: "desk", teacherId: undefined });
  });

  it("학원 코드는 확인한 뒤 재발급한다", async () => {
    rotateJoinCode.mockResolvedValue("NEW-CODE");
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><OwnerMembersScreen academyId="academy-1" /></QueryClientProvider>);
    await userEvent.click(screen.getByRole("button", { name: "학원 코드 재발급" }));
    expect(rotateJoinCode).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "재발급 확인" }));
    expect(rotateJoinCode).toHaveBeenCalledWith("academy-1");
  });
});

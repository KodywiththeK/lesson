import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getUserIdentities, rpc, unlinkIdentity, from, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserIdentities: vi.fn(),
  rpc: vi.fn(),
  unlinkIdentity: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getUser, getUserIdentities, unlinkIdentity },
    from,
    rpc,
  }),
}));

import { getLegacyOwnerRetirementStatus, retireLegacyOwnerEmail } from "./legacy-owner-retirement";

const ownerId = "11111111-1111-1111-1111-111111111111";
const emailIdentity = { id: "email-id", provider: "email" };
const kakaoIdentity = { id: "kakao-id", provider: "kakao" };

describe("기존 원장 이메일 로그인 폐기", () => {
  let passwordRemoved: boolean;
  beforeEach(() => {
    vi.clearAllMocks();
    passwordRemoved = false;
    getUser.mockResolvedValue({ data: { user: { id: ownerId, email: "kakao@example.com" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "membership-id", academies: { name: "더 클래식 음악학원" } }, error: null });
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle };
    from.mockReturnValue(query);
    getUserIdentities.mockResolvedValue({ data: { identities: [emailIdentity, kakaoIdentity] }, error: null });
    rpc.mockImplementation(async (name: string) => {
      if (name === "retire_legacy_owner_password") { passwordRemoved = true; return { data: true, error: null }; }
      return { data: passwordRemoved, error: null };
    });
    unlinkIdentity.mockResolvedValue({ error: null });
  });

  it("다른 사용자에게는 정리 작업을 제공하지 않는다", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "other-user" } }, error: null });
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "ineligible" });
    expect(from).not.toHaveBeenCalled();
  });

  it("원장 멤버십과 카카오 identity가 모두 있어야 준비 상태가 된다", async () => {
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "ready", academyName: "더 클래식 음악학원" });
    getUserIdentities.mockResolvedValue({ data: { identities: [emailIdentity] }, error: null });
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "needs-kakao" });
    expect(rpc).not.toHaveBeenCalledWith("retire_legacy_owner_password");
  });

  it("활성 원장 멤버십이 없으면 카카오 identity가 있어도 정리를 막는다", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "ineligible" });
    await expect(retireLegacyOwnerEmail()).rejects.toThrow("기존 원장과 카카오 계정 연결");
    expect(rpc).not.toHaveBeenCalledWith("retire_legacy_owner_password");
  });

  it("비밀번호 해시를 먼저 제거한 뒤 이메일 identity만 해제하고 같은 계정을 재확인한다", async () => {
    const order: string[] = [];
    rpc.mockImplementation(async (name: string) => {
      if (name === "retire_legacy_owner_password") { order.push("password"); return { data: true, error: null }; }
      return { data: order.includes("password"), error: null };
    });
    unlinkIdentity.mockImplementation(async () => { order.push("email"); return { error: null }; });
    getUserIdentities
      .mockResolvedValueOnce({ data: { identities: [emailIdentity, kakaoIdentity] }, error: null })
      .mockResolvedValueOnce({ data: { identities: [kakaoIdentity] }, error: null });

    await expect(retireLegacyOwnerEmail()).resolves.toEqual({ state: "complete", academyName: "더 클래식 음악학원" });
    expect(order).toEqual(["password", "email"]);
    expect(rpc).toHaveBeenCalledWith("retire_legacy_owner_password");
    expect(unlinkIdentity).toHaveBeenCalledWith(emailIdentity);
  });

  it("해시 제거가 실패하면 이메일 identity를 건드리지 않는다", async () => {
    rpc.mockImplementation(async (name: string) => name === "retire_legacy_owner_password"
      ? { data: null, error: new Error("RPC 실패") }
      : { data: false, error: null });
    await expect(retireLegacyOwnerEmail()).rejects.toThrow("RPC 실패");
    expect(unlinkIdentity).not.toHaveBeenCalled();
  });

  it("이메일 identity 해제에 실패하면 완료로 표시하지 않는다", async () => {
    unlinkIdentity.mockResolvedValue({ error: new Error("해제 실패") });
    await expect(retireLegacyOwnerEmail()).rejects.toThrow("해제 실패");
  });

  it("해시만 제거된 부분 완료 상태에서는 다시 실행해 이메일 identity를 해제한다", async () => {
    passwordRemoved = true;
    getUserIdentities
      .mockResolvedValueOnce({ data: { identities: [emailIdentity, kakaoIdentity] }, error: null })
      .mockResolvedValueOnce({ data: { identities: [kakaoIdentity] }, error: null });
    expect(await retireLegacyOwnerEmail()).toEqual({ state: "complete", academyName: "더 클래식 음악학원" });
    expect(unlinkIdentity).toHaveBeenCalledWith(emailIdentity);
  });

  it("해시와 이메일 identity가 모두 없을 때에만 완료로 표시한다", async () => {
    getUserIdentities.mockResolvedValue({ data: { identities: [kakaoIdentity] }, error: null });
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "ready", academyName: "더 클래식 음악학원" });
    passwordRemoved = true;
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "complete", academyName: "더 클래식 음악학원" });
  });

  it("옛 이메일이 사용자 기본 이메일에 남아 있으면 완료로 표시하지 않는다", async () => {
    passwordRemoved = true;
    getUser.mockResolvedValue({ data: { user: { id: ownerId, email: "owner@lesson.local" } }, error: null });
    getUserIdentities.mockResolvedValue({ data: { identities: [kakaoIdentity] }, error: null });
    expect(await getLegacyOwnerRetirementStatus()).toEqual({ state: "needs-review" });
  });
});

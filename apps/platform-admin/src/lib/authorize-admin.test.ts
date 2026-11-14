import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizePlatformAdmin } from "./authorize-admin";

const getUser = vi.fn();
const getClaims = vi.fn();
const rpc = vi.fn();

describe("플랫폼 관리자 서버 권한 검사", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1", aal: "aal2", session_id: "session-1" } }, error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  const client = { auth: { getUser, getClaims }, rpc };

  it("검증된 사용자와 2단계 인증, DB의 관리자 권한이 모두 맞아야 허용한다", async () => {
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: true, userId: "admin-1" });
    expect(rpc).toHaveBeenCalledWith("platform_admin_is_authorized");
  });

  it("로그인하지 않은 사용자는 DB 관리자 검사를 호출하지 않는다", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "sign-in-required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("TOTP를 통과하지 않은 세션은 관리자 권한이 있어도 거부한다", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "admin-1", aal: "aal1", session_id: "session-1" } }, error: null });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "mfa-required" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("사용자 ID가 일치하지 않거나 세션 ID가 없으면 거부한다", async () => {
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "someone-else", aal: "aal2", session_id: "session-1" } }, error: null });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "forbidden" });
    getClaims.mockResolvedValueOnce({ data: { claims: { sub: "admin-1", aal: "aal2" } }, error: null });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "forbidden" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("DB가 권한을 거부하거나 확인에 실패하면 접근을 허용하지 않는다", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "forbidden" });
    rpc.mockResolvedValueOnce({ data: null, error: new Error("network") });
    expect(await authorizePlatformAdmin(client)).toEqual({ ok: false, reason: "unavailable" });
  });
});

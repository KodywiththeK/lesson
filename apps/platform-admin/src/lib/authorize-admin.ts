type AdminClient = {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null }; error: { name?: string } | null }>;
    getClaims(): Promise<{
      data: { claims: { sub?: unknown; aal?: unknown; session_id?: unknown } } | null;
      error: unknown | null;
    }>;
  };
  rpc(name: "platform_admin_is_authorized"): PromiseLike<{ data: boolean | null; error: unknown | null }>;
};

type AdminAuthorization =
  | { ok: true; userId: string }
  | { ok: false; reason: "sign-in-required" | "mfa-required" | "forbidden" | "unavailable" };

/** 서버 작업마다 호출한다. DB RPC도 관리자·MFA·세션을 다시 검증해야 한다. */
export async function authorizePlatformAdmin(client: AdminClient): Promise<AdminAuthorization> {
  try {
    const userResult = await client.auth.getUser();
    if (userResult.error) {
      return { ok: false, reason: userResult.error.name === "AuthSessionMissingError" ? "sign-in-required" : "unavailable" };
    }
    if (!userResult.data.user) return { ok: false, reason: "sign-in-required" };

    const claimsResult = await client.auth.getClaims();
    if (claimsResult.error) return { ok: false, reason: "unavailable" };
    const claims = claimsResult.data?.claims;
    if (claims?.sub !== userResult.data.user.id || typeof claims.session_id !== "string" || !claims.session_id) {
      return { ok: false, reason: "forbidden" };
    }
    if (claims.aal !== "aal2") return { ok: false, reason: "mfa-required" };

    const result = await client.rpc("platform_admin_is_authorized");
    if (result.error) return { ok: false, reason: "unavailable" };
    if (result.data !== true) return { ok: false, reason: "forbidden" };
    return { ok: true, userId: userResult.data.user.id };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

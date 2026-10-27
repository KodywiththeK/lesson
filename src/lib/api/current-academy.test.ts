import { describe, expect, it } from "vitest";

import {
  AcademySelectionRequiredError,
  AuthRequiredError,
  fetchCurrentAcademyContext,
  NoMembershipError,
  type CurrentAcademySupabaseClient,
} from "./current-academy";

function clientWithUser(result: Awaited<ReturnType<CurrentAcademySupabaseClient["auth"]["getUser"]>>) {
  return {
    auth: { getUser: async () => result },
    from() {
      throw new Error("로그인하지 않았으면 학원 멤버십을 조회하면 안 된다.");
    },
  } as unknown as CurrentAcademySupabaseClient;
}

function namedError(name: string, message: string) {
  return Object.assign(new Error(message), { name });
}

describe("fetchCurrentAcademyContext 로그인 확인", () => {
  it("사용자가 없으면 로그인이 필요하다고 알린다", async () => {
    await expect(
      fetchCurrentAcademyContext(clientWithUser({ data: { user: null }, error: null })),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("Supabase가 세션 없음 오류를 돌려줘도(로그인하지 않은 방문) 로그인이 필요한 상태로 본다", async () => {
    await expect(
      fetchCurrentAcademyContext(
        clientWithUser({
          data: { user: null },
          error: namedError("AuthSessionMissingError", "Auth session missing!"),
        }),
      ),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it.each([
    ["Invalid Refresh Token: Refresh Token Not Found", "AuthApiError"],
    ["Invalid Refresh Token: Already Used", "AuthApiError"],
    ["JWT expired", "AuthApiError"],
    ["invalid JWT: unable to parse or verify signature", "AuthApiError"],
    ["User from sub claim in JWT does not exist", "AuthApiError"],
  ])("만료·잘못된 세션(%s)도 오류 화면이 아니라 로그인 화면으로 보낸다", async (message, name) => {
    await expect(
      fetchCurrentAcademyContext(clientWithUser({ data: { user: null }, error: namedError(name, message) })),
    ).rejects.toBeInstanceOf(AuthRequiredError);
  });

  it("네트워크 오류처럼 로그인 문제가 아닌 오류는 로그인 폼으로 숨기지 않고 그대로 알린다", async () => {
    const result = fetchCurrentAcademyContext(
      clientWithUser({ data: { user: null }, error: namedError("AuthRetryableFetchError", "Failed to fetch") }),
    );

    await expect(result).rejects.not.toBeInstanceOf(AuthRequiredError);
    await expect(result).rejects.toThrow("사용자 세션을 확인하지 못했습니다: Failed to fetch");
  });
});

function clientWithMemberships(rows: Array<{ academy_id: string; role: "owner" | "desk" | "teacher"; academies: { id: string; name: string } }>) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }) }) }),
  } as unknown as CurrentAcademySupabaseClient;
}

describe("학원 선택", () => {
  it("마지막 사용 학원의 멤버십을 검증해 선택한다", async () => {
    const client = clientWithMemberships([
      { academy_id: "a", role: "owner", academies: { id: "a", name: "가 학원" } },
      { academy_id: "b", role: "teacher", academies: { id: "b", name: "나 학원" } },
    ]);
    expect((await fetchCurrentAcademyContext(client, "b")).academyName).toBe("나 학원");
    await expect(fetchCurrentAcademyContext(client, "missing")).rejects.toBeInstanceOf(AcademySelectionRequiredError);
  });

  it("활성 학원이 없으면 가입 화면으로 보낼 상태를 알린다", async () => {
    await expect(fetchCurrentAcademyContext(clientWithMemberships([]))).rejects.toBeInstanceOf(NoMembershipError);
  });
});

import { describe, expect, it } from "vitest";

import { createSupabaseServiceRoleClient } from "./service-role";

describe("createSupabaseServiceRoleClient", () => {
  it("서버 비밀 키가 없으면 null을 돌려 호출한 쪽이 503으로 답하게 한다", () => {
    expect(createSupabaseServiceRoleClient({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toBeNull();
    expect(createSupabaseServiceRoleClient({ SUPABASE_SERVICE_ROLE_KEY: "secret" })).toBeNull();
  });

  it("주소와 비밀 키가 있으면 세션을 저장하지 않는 클라이언트를 만든다", () => {
    const client = createSupabaseServiceRoleClient({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    });

    expect(client).not.toBeNull();
    expect(typeof client?.rpc).toBe("function");
  });
});

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "./proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const createServerClientMock = vi.mocked(createServerClient);

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://academy.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("request마다 Supabase server client를 만들고 getClaims로 세션을 갱신한다", async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: { claims: null } });
    createServerClientMock.mockReturnValue({
      auth: {
        getClaims,
      },
    } as never);

    const request = new NextRequest("https://app.test/students");

    await updateSession(request);

    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://academy.supabase.co",
      "publishable-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
    expect(getClaims).toHaveBeenCalledTimes(1);
  });

  it("Supabase가 갱신한 쿠키와 헤더를 응답에 보존한다", async () => {
    createServerClientMock.mockImplementation((url, key, options) => {
      return {
        auth: {
          async getClaims() {
            const setAll = options.cookies.setAll;

            if (!setAll) {
              throw new Error("setAll cookie handler가 필요합니다.");
            }

            setAll(
              [
                {
                  name: "sb-session",
                  value: "refreshed",
                  options: {
                    path: "/",
                    httpOnly: true,
                  },
                },
              ],
              {
                "x-supabase-auth": "refreshed",
              },
            );

            return { data: { claims: { sub: "user-1" } } };
          },
        },
      } as never;
    });

    const request = new NextRequest("https://app.test/students");
    const response = await updateSession(request);

    expect(response.cookies.get("sb-session")?.value).toBe("refreshed");
    expect(response.headers.get("x-supabase-auth")).toBe("refreshed");
  });
});

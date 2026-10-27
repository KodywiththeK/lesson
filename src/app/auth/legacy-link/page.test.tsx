import { afterEach, describe, expect, it, vi } from "vitest";

const { connection, notFound } = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  notFound: vi.fn(() => { throw new Error("404"); }),
}));

vi.mock("next/server", () => ({ connection }));
vi.mock("next/navigation", () => ({ notFound }));

import LegacyLinkPage from "./page";
import LinkKakaoPage from "../link-kakao/page";
import RetireEmailPage from "../retire-email/page";

describe("기존 원장 연결 경로", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    connection.mockClear();
    notFound.mockClear();
  });

  it.each([LegacyLinkPage, LinkKakaoPage, RetireEmailPage])("전환 플래그가 꺼진 요청은 404로 막는다", async (page) => {
    vi.stubEnv("LEGACY_OWNER_LINK_ENABLED", "0");
    await expect(page()).rejects.toThrow("404");
    expect(connection).toHaveBeenCalledOnce();
    expect(notFound).toHaveBeenCalledOnce();
  });

  it.each([LegacyLinkPage, LinkKakaoPage, RetireEmailPage])("전환 플래그가 켜진 요청은 페이지를 연다", async (page) => {
    vi.stubEnv("LEGACY_OWNER_LINK_ENABLED", "1");
    await expect(page()).resolves.toBeTruthy();
    expect(connection).toHaveBeenCalledOnce();
    expect(notFound).not.toHaveBeenCalled();
  });
});

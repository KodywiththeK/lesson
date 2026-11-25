import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("마디마디 앱 설치 정보", () => {
  it("홈 화면에 설치하면 주소창 없는 앱으로 열리고 대시보드에서 시작한다", () => {
    expect(manifest()).toMatchObject({
      name: "마디마디",
      start_url: "/",
      scope: "/",
      display: "standalone",
      theme_color: "#0572fc",
      background_color: "#ffffff",
      lang: "ko",
    });
  });

  it("Android 아이콘과 잘라 쓰는(maskable) 아이콘을 함께 연결한다", () => {
    expect(manifest().icons).toEqual([
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});

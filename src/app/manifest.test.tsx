import { describe, expect, it } from "vitest";

import manifest from "./manifest";

describe("마디마디 앱 아이콘", () => {
  it("제공된 Android 아이콘을 설치 정보에 연결한다", () => {
    expect(manifest()).toMatchObject({
      name: "마디마디",
      start_url: "/",
      display: "browser",
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
    });
  });
});

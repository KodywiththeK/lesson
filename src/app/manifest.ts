import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "./seo";

/** 아이콘 배경과 같은 파란색. 설치한 앱의 상단 표시줄 색이 된다. */
export const APP_THEME_COLOR = "#0572fc";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: APP_THEME_COLOR,
    background_color: "#ffffff",
    icons: [
      { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { NextConfig } from "next";

const privateRouteSources = [
  "/auth/:path*",
  "/books/:path*",
  "/finance/:path*",
  "/lessons/:path*",
  "/management/:path*",
  "/join",
  "/onboarding",
  "/passes",
  "/settings/:path*",
  "/status-management",
  "/students",
  "/teachers",
  "/vendors",
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      ...privateRouteSources.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        // 서비스 워커는 매번 새로 받아 수정이 바로 반영되게 한다(Next PWA 가이드 기준).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;

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
    return privateRouteSources.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;

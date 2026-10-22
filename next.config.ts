import type { NextConfig } from "next";

const privateRouteSources = [
  "/books/:path*",
  "/finance/:path*",
  "/lessons/:path*",
  "/management/:path*",
  "/passes",
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

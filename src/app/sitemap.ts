import type { MetadataRoute } from "next";

import { siteUrl } from "./seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl.href },
    { url: new URL("/terms", siteUrl).href },
    { url: new URL("/privacy", siteUrl).href },
  ];
}

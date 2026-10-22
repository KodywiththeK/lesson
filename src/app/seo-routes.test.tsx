import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { mainNavigation } from "@/domain/navigation";
import robots from "./robots";
import sitemap from "./sitemap";

describe("검색 노출 경계", () => {
  it("홈만 사이트맵에 넣는다", () => {
    expect(sitemap()).toEqual([{ url: "https://lesson-pi-ten.vercel.app/" }]);
    expect(robots()).toMatchObject({
      sitemap: "https://lesson-pi-ten.vercel.app/sitemap.xml",
    });
  });

  it("운영 경로에만 검색 제외 헤더를 설정한다", async () => {
    const rules = await nextConfig.headers?.();

    expect(rules).toContainEqual({
      source: "/finance/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    });
    expect(rules?.some((rule) => rule.source === "/")).toBe(false);

    const privateHrefs = mainNavigation
      .flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])])
      .filter((href) => href !== "/");
    for (const href of privateHrefs) {
      expect(
        rules?.some((rule) => {
          const prefix = rule.source.replace("/:path*", "");
          return href === prefix || href.startsWith(`${prefix}/`);
        }),
        `${href}의 검색 제외 설정`,
      ).toBe(true);
    }
  });
});

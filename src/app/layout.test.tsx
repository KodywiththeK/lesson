import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/local", () => ({ default: () => ({ variable: "test-font" }) }));

import { metadata } from "./layout";

describe("마디마디 메타데이터", () => {
  it("마디마디 브랜드와 핵심 문구를 검색 및 공유 정보에 사용한다", () => {
    expect(metadata.metadataBase?.toString()).toBe("https://lesson-pi-ten.vercel.app/");
    expect(metadata.title).toBe("마디마디 | 모든 수업의 마디마다, 더 편리한 음악학원 관리");
    expect(metadata.description).toContain("모든 수업의 마디마다, 더 편리한 음악학원 관리");
    expect(metadata.alternates).toMatchObject({ canonical: "/" });
    expect(metadata.icons).toMatchObject({
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-16x16.png", sizes: "16x16" },
        { url: "/favicon-32x32.png", sizes: "32x32" },
      ],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    });
    expect(metadata.openGraph).toMatchObject({
      siteName: "마디마디",
      title: metadata.title,
      description: metadata.description,
      locale: "ko_KR",
      type: "website",
      url: "/",
      images: [{ url: "/brand/madimadi-thumbnail.webp", width: 1672, height: 941 }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      images: ["/brand/madimadi-thumbnail.webp"],
    });
  });
});

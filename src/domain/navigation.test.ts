import { describe, expect, it } from "vitest";

import { mainNavigation } from "./navigation";

describe("mainNavigation", () => {
  it("PDF 1차 범위의 핵심 운영 메뉴를 포함한다", () => {
    expect(mainNavigation.map((item) => item.label)).toEqual([
      "대시보드",
      "레슨 시간표",
      "회차권",
      "인원·거래처",
      "교재",
      "수입",
    ]);
  });

  it("각 최상위 메뉴는 접근 가능한 경로와 설명을 가진다", () => {
    for (const item of mainNavigation) {
      expect(item.href).toMatch(/^\//);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("인원·거래처 메뉴는 원생, 선생님, 휴원/퇴원, 거래처 하위 메뉴를 가진다", () => {
    const managementNavigation = mainNavigation.find(
      (item) => item.label === "인원·거래처",
    );

    expect(managementNavigation?.href).toBe("/management/students");
    expect(managementNavigation?.children?.map((item) => item.label)).toEqual([
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
    ]);
    expect(managementNavigation?.children?.map((item) => item.href)).toEqual([
      "/management/students",
      "/management/teachers",
      "/management/status",
      "/management/vendors",
    ]);
  });

  it("레슨 시간표 메뉴는 학원레슨표와 개인레슨표 하위 메뉴를 가진다", () => {
    const lessonNavigation = mainNavigation.find(
      (item) => item.label === "레슨 시간표",
    );

    expect(lessonNavigation?.href).toBe("/lessons/academy");
    expect(lessonNavigation?.children?.map((item) => item.label)).toEqual([
      "학원레슨표",
      "개인레슨표",
    ]);
    expect(lessonNavigation?.children?.map((item) => item.href)).toEqual([
      "/lessons/academy",
      "/lessons/private",
    ]);
  });
});

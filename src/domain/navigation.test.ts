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
      "수입 관리",
      "설정",
    ]);
  });

  it("각 최상위 메뉴는 접근 가능한 경로와 설명을 가진다", () => {
    for (const item of mainNavigation) {
      expect(item.href).toMatch(/^\//);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("인원·거래처 메뉴는 원생, 선생님, 휴원/퇴원, 거래처, 상담 하위 메뉴를 가진다", () => {
    const managementNavigation = mainNavigation.find(
      (item) => item.label === "인원·거래처",
    );

    expect(managementNavigation?.href).toBe("/management/students");
    expect(managementNavigation?.children?.map((item) => item.label)).toEqual([
      "원생",
      "선생님",
      "휴원/퇴원",
      "거래처",
      "상담",
    ]);
    expect(managementNavigation?.children?.map((item) => item.href)).toEqual([
      "/management/students",
      "/management/teachers",
      "/management/status",
      "/management/vendors",
      "/management/consultations",
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

  it("교재 메뉴는 재고, 출고, 결제 완료, 발주·입고 하위 메뉴를 가진다", () => {
    const bookNavigation = mainNavigation.find((item) => item.label === "교재");

    expect(bookNavigation?.href).toBe("/books");
    expect(bookNavigation?.children?.map((item) => item.label)).toEqual(["재고", "출고", "결제 완료", "발주·입고"]);
    expect(bookNavigation?.children?.map((item) => item.href)).toEqual([
      "/books",
      "/books/shipments",
      "/books/paid",
      "/books/orders",
    ]);
  });

  it("수입 관리 메뉴는 학원 고정 수입, 입출입내역, 교재 내역, 선생님 월급, 전체 수입 순서의 하위 메뉴를 가진다", () => {
    const financeNavigation = mainNavigation.find(
      (item) => item.label === "수입 관리",
    );

    expect(financeNavigation?.href).toBe("/finance/lesson-income");
    expect(financeNavigation?.children?.map((item) => item.label)).toEqual([
      "학원 고정 수입",
      "입출입내역",
      "교재 내역",
      "선생님 월급",
      "전체 수입",
    ]);
    expect(financeNavigation?.children?.map((item) => item.href)).toEqual([
      "/finance/lesson-income",
      "/finance/ledger",
      "/finance/books",
      "/finance/payroll",
      "/finance/overview",
    ]);
  });

  it("설정 메뉴는 레슨시간표와 기존 설정 하위 메뉴를 가진다", () => {
    const settingsNavigation = mainNavigation.find((item) => item.label === "설정");

    expect(settingsNavigation?.href).toBe("/settings/lesson-schedule");
    expect(settingsNavigation?.children?.map((item) => item.label)).toEqual(["레슨시간표", "회차권 설정", "선생님", "직원 및 가입 신청"]);
    expect(settingsNavigation?.children?.map((item) => item.href)).toEqual(["/settings/lesson-schedule", "/settings/lesson-tickets", "/settings/teachers", "/settings/members"]);
    expect(settingsNavigation?.children?.map((item) => item.feature)).toEqual(["lesson-calendar-settings", "settings", "settings", "settings"]);
  });
});

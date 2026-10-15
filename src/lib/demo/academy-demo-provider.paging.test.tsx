import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { DemoAcademyProvider, useDemoAcademy } from "./academy-demo-provider";

function renderDemoAcademy() {
  return renderHook(() => useDemoAcademy(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DemoAcademyProvider>{children}</DemoAcademyProvider>
    ),
  }).result.current;
}

describe("데모 학원 provider의 목록 queryKey", () => {
  it("회차권 목록은 페이지나 페이지당 개수가 바뀌면 다른 queryKey를 쓴다", () => {
    const demo = renderDemoAcademy();
    const options = {
      academyId: "academy-1",
      today: "2026-08-21",
      lowRemainingThreshold: 2,
    };

    const firstPage = demo.createLessonTicketListQueryOptions({ ...options, page: 1, pageSize: 10 });
    const secondPage = demo.createLessonTicketListQueryOptions({ ...options, page: 2, pageSize: 10 });
    const largerPageSize = demo.createLessonTicketListQueryOptions({ ...options, page: 1, pageSize: 20 });

    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(largerPageSize.queryKey).not.toEqual(firstPage.queryKey);
  });

  it("교재 구매 목록은 페이지나 페이지당 개수가 바뀌면 다른 queryKey를 쓴다", () => {
    const demo = renderDemoAcademy();
    const options = { academyId: "academy-1" };

    const firstPage = demo.createBookPurchaseListQueryOptions({ ...options, page: 1, pageSize: 10 });
    const secondPage = demo.createBookPurchaseListQueryOptions({ ...options, page: 2, pageSize: 10 });
    const largerPageSize = demo.createBookPurchaseListQueryOptions({ ...options, page: 1, pageSize: 20 });

    expect(secondPage.queryKey).not.toEqual(firstPage.queryKey);
    expect(largerPageSize.queryKey).not.toEqual(firstPage.queryKey);
  });
});

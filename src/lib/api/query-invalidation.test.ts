import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateAfterBookChange, invalidateAfterPeopleChange } from "./query-invalidation";

describe("invalidateAfterPeopleChange", () => {
  it("원생·선생님 변경은 목록뿐 아니라 급여·레슨·회차권 화면의 캐시도 함께 무효화한다", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAfterPeopleChange(queryClient, "academy-1");

    const sections = invalidate.mock.calls.map(([filters]) => (filters?.queryKey as string[])[2]);
    expect(sections).toEqual(
      expect.arrayContaining([
        "students",
        "teachers",
        "status-management",
        "lesson-workspace",
        "private-lessons",
        "lesson-tickets",
        "finance",
      ]),
    );
    for (const [filters] of invalidate.mock.calls) {
      expect((filters?.queryKey as string[]).slice(0, 2)).toEqual(["academy", "academy-1"]);
    }
  });
});

describe("invalidateAfterBookChange", () => {
  it("교재·출고·결제 변경은 교재 탭 전체와 수입 관리(교재 내역·입출입내역) 캐시를 함께 무효화한다", () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateAfterBookChange(queryClient, "academy-1");

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["academy", "academy-1", "books"],
      ["academy", "academy-1", "finance"],
    ]);
  });
});

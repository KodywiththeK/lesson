import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateAfterPeopleChange } from "./query-invalidation";

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

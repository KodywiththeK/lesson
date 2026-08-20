import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

describe("queryKeys", () => {
  it("학원별 원생 목록 key에 academyId와 필터를 포함한다", () => {
    expect(
      queryKeys.students.list("academy-1", {
        status: "active",
        q: "민",
        teacherName: "박선생",
        instrumentName: "피아노",
        weekdayLabel: "월",
      }),
    ).toEqual([
      "academy",
      "academy-1",
      "students",
      "list",
      "active",
      "민",
      "박선생",
      "피아노",
      "월",
    ]);
  });

  it("같은 기능이라도 academyId가 다르면 다른 cache key를 만든다", () => {
    expect(queryKeys.lessonTickets.summary("academy-1")).not.toEqual(
      queryKeys.lessonTickets.summary("academy-2"),
    );
  });
});

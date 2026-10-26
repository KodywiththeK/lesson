import { describe, expect, it } from "vitest";

import { getPrivateLessonAvailability } from "./private-lesson-reservation";

describe("개인레슨 예약 가능 회차", () => {
  const ticket = { remainingCount: 4, validFrom: "2026-10-01", validUntil: "2026-10-31" };

  it("예정 일정만 예약하며 등원과 결석은 중복 계산하지 않는다", () => {
    expect(getPrivateLessonAvailability(ticket, 2, "2026-10-20")).toEqual({
      remainingCount: 4,
      reservedCount: 2,
      availableCount: 2,
      isValidOnDate: true,
    });
  });

  it("예약이 잔여보다 많은 기존 데이터는 0회로 보이고 새 등록을 막는다", () => {
    expect(getPrivateLessonAvailability(ticket, 5, "2026-10-20").availableCount).toBe(0);
  });

  it("레슨 날짜가 회차권 유효 구간 밖이면 등록할 수 없다", () => {
    expect(getPrivateLessonAvailability(ticket, 0, "2026-11-01").isValidOnDate).toBe(false);
    expect(getPrivateLessonAvailability(ticket, 0, "2026-11-01").availableCount).toBe(0);
  });
});

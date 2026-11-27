import { describe, expect, it } from "vitest";

import {
  buildDeferredSummary,
  DEFAULT_QUIET_HOURS,
  isInQuietHours,
  resolveDeliverAfter,
} from "./notification-quiet-hours";

/** 한국 시간으로 시각을 만든다. */
function kst(dateTime: string) {
  return new Date(`${dateTime}:00+09:00`);
}

describe("isInQuietHours", () => {
  it("기본 22:00~08:00은 밤을 넘기며, 시작은 포함하고 끝은 포함하지 않는다", () => {
    expect(isInQuietHours(DEFAULT_QUIET_HOURS, kst("2026-11-27T21:59"))).toBe(false);
    expect(isInQuietHours(DEFAULT_QUIET_HOURS, kst("2026-11-27T22:00"))).toBe(true);
    expect(isInQuietHours(DEFAULT_QUIET_HOURS, kst("2026-11-28T07:59"))).toBe(true);
    expect(isInQuietHours(DEFAULT_QUIET_HOURS, kst("2026-11-28T08:00"))).toBe(false);
  });

  it("같은 날 안의 구간과 꺼짐을 다룬다", () => {
    const lunch = { enabled: true, start: "12:00", end: "13:00" };

    expect(isInQuietHours(lunch, kst("2026-11-27T12:30"))).toBe(true);
    expect(isInQuietHours(lunch, kst("2026-11-27T13:00"))).toBe(false);
    expect(isInQuietHours({ ...DEFAULT_QUIET_HOURS, enabled: false }, kst("2026-11-27T23:00"))).toBe(false);
  });
});

describe("resolveDeliverAfter", () => {
  it("방해 금지가 아니면 지금, 밤 11시면 다음 날 8시, 새벽 3시면 그날 8시에 보낸다", () => {
    const now = kst("2026-11-27T15:00");

    expect(resolveDeliverAfter(DEFAULT_QUIET_HOURS, now)).toEqual(now);
    expect(resolveDeliverAfter(DEFAULT_QUIET_HOURS, kst("2026-11-27T23:00"))).toEqual(kst("2026-11-28T08:00"));
    expect(resolveDeliverAfter(DEFAULT_QUIET_HOURS, kst("2026-11-28T03:00"))).toEqual(kst("2026-11-28T08:00"));
  });
});

describe("buildDeferredSummary", () => {
  const lesson = { kind: "lesson_change" as const, title: "내일 레슨 변경", body: "유나 15:00 → 16:00", url: "/lessons/academy" };
  const consultation = {
    kind: "consultation" as const,
    title: "신규 상담 접수",
    body: "새봄 상담이 등록되었습니다.",
    url: "/management/consultations",
  };

  it("한 건이면 원래 알림을 그대로 보낸다", () => {
    expect(buildDeferredSummary([lesson])).toEqual({ title: lesson.title, body: lesson.body, url: lesson.url, tag: "deferred" });
  });

  it("여러 건이면 종류별 건수로 묶고 알림함을 연다", () => {
    expect(buildDeferredSummary([lesson, consultation, lesson])).toEqual({
      title: "밤사이 알림 3건",
      body: "레슨 변경 2 · 신규 상담 1",
      url: "/me/inbox",
      tag: "deferred",
    });
  });
});

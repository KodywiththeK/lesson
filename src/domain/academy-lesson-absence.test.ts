import { describe, expect, it } from "vitest";

import { resolveAcademyLessonAbsence } from "./academy-lesson-absence";

describe("resolveAcademyLessonAbsence", () => {
  const absence = {
    academyId: "academy-1",
    lessonEventId: "academy-lesson-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    originalDate: "2026-08-20",
  };

  it("보강으로 확정하면 보강 일정과 월별 메모를 만든다", () => {
    const result = resolveAcademyLessonAbsence(absence, {
      type: "makeup",
      reason: "병원 진료",
      makeupDate: "2026-08-27",
      makeupTime: "16:00",
      confirmedAt: "2026-08-20T18:00:00+09:00",
    });

    expect(result.resolvedAbsence).toMatchObject({
      status: "resolved",
      resolvedAs: "makeup",
      reason: "병원 진료",
    });
    expect(result.makeupLesson).toEqual({
      academyId: "academy-1",
      sourceAbsenceLessonEventId: "academy-lesson-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      date: "2026-08-27",
      time: "16:00",
      title: "[보강 수업] 김민지 피아노",
    });
    expect(result.monthlyMemo).toEqual({
      academyId: "academy-1",
      month: "2026-08",
      content: "김민지 보강 2026-08-27 16:00 / 원래 결석일 2026-08-20 / 사유: 병원 진료",
      unread: true,
    });
    expect(result.ticketUsage).toBeUndefined();
  });

  it("보강 날짜가 없으면 보강 확정을 막는다", () => {
    expect(() =>
      resolveAcademyLessonAbsence(absence, {
        type: "makeup",
        reason: "개인 사정",
        makeupDate: "",
        confirmedAt: "2026-08-20T18:00:00+09:00",
      }),
    ).toThrow("보강 날짜는 필수입니다.");
  });

  it("패스로 확정하면 보강 일정 없이 패스 메모만 만든다", () => {
    const result = resolveAcademyLessonAbsence(absence, {
      type: "pass",
      reason: "보호자 요청",
      confirmedAt: "2026-08-20T18:00:00+09:00",
    });

    expect(result.resolvedAbsence).toMatchObject({
      status: "resolved",
      resolvedAs: "pass",
      reason: "보호자 요청",
    });
    expect(result.makeupLesson).toBeUndefined();
    expect(result.monthlyMemo).toEqual({
      academyId: "academy-1",
      month: "2026-08",
      content: "김민지 패스 / 원래 결석일 2026-08-20 / 사유: 보호자 요청",
      unread: true,
    });
    expect(result.ticketUsage).toBeUndefined();
  });
});

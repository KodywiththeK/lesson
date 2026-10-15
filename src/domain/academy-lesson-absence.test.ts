import { describe, expect, it } from "vitest";

import {
  buildMakeupLessonTimes,
  checkAbsenceResolutionInput,
  resolveAcademyLessonAbsence,
} from "./academy-lesson-absence";

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
      content: "김민지, 8/27 [목요일] 16:00 보강 - 8/20 [목요일] 병원 진료",
      unread: true,
    });
    expect(result.ticketUsage).toBeUndefined();
  });

  it("사유와 보강 시간은 선택이라 비워도 확정되고 월별 메모에는 입력한 것만 남긴다", () => {
    const makeup = resolveAcademyLessonAbsence(absence, {
      type: "makeup",
      makeupDate: "2026-08-27",
      confirmedAt: "2026-08-20T18:00:00+09:00",
    });
    const pass = resolveAcademyLessonAbsence(absence, {
      type: "pass",
      confirmedAt: "2026-08-20T18:00:00+09:00",
    });

    expect(makeup.makeupLesson?.time).toBeUndefined();
    expect(makeup.monthlyMemo.content).toBe("김민지, 8/27 [목요일] 보강 - 8/20 [목요일]");
    expect(pass.monthlyMemo.content).toBe("김민지, 8/20 [목요일] 사유없음");
    expect(pass.resolvedAbsence.reason).toBe("");
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
      content: "김민지, 8/20 [목요일] 보호자 요청",
      unread: true,
    });
    expect(result.ticketUsage).toBeUndefined();
  });
});

describe("buildMakeupLessonTimes", () => {
  const source = { startTime: "16:00", endTime: "16:50" };

  it("보강 시간을 입력하지 않으면 원본 시간을 임시로 쓰고 시간 표시를 숨긴다", () => {
    expect(buildMakeupLessonTimes(source, undefined)).toEqual({
      ok: true,
      startTime: "16:00",
      endTime: "16:50",
      timeUnspecified: true,
    });
    expect(buildMakeupLessonTimes(source, "")).toMatchObject({ timeUnspecified: true });
  });

  it("보강 시작 시간을 입력하면 원본 수업 길이만큼 종료 시간을 정한다", () => {
    expect(buildMakeupLessonTimes(source, "18:30")).toEqual({
      ok: true,
      startTime: "18:30",
      endTime: "19:20",
      timeUnspecified: false,
    });
  });

  it("수업이 자정을 넘기는 보강 시간은 받지 않는다", () => {
    expect(buildMakeupLessonTimes(source, "23:30")).toEqual({
      ok: false,
      reason: "보강 시간이 너무 늦어 수업이 하루를 넘깁니다. 더 이른 시간을 선택해 주세요.",
    });
  });
});

describe("checkAbsenceResolutionInput", () => {
  const source = { startTime: "16:00", endTime: "16:50" };

  it("사유를 고르기 전에는 확정할 수 없다", () => {
    expect(
      checkAbsenceResolutionInput({ resolution: "", targetDate: "", startTime: "" }, source),
    ).toEqual({ ok: false, reason: "사유(보강 또는 패스)를 선택해 주세요." });
  });

  it("보강은 날짜가 필수이고 시간은 선택이다", () => {
    expect(
      checkAbsenceResolutionInput({ resolution: "makeup", targetDate: "", startTime: "" }, source),
    ).toEqual({ ok: false, reason: "보강 날짜를 선택해 주세요." });
    expect(
      checkAbsenceResolutionInput(
        { resolution: "makeup", targetDate: "2026-08-24", startTime: "" },
        source,
      ),
    ).toEqual({ ok: true, resolution: "makeup" });
  });

  it("보강 시간이 수업을 자정 너머로 밀어내면 확정할 수 없다", () => {
    expect(
      checkAbsenceResolutionInput(
        { resolution: "makeup", targetDate: "2026-08-24", startTime: "23:40" },
        source,
      ),
    ).toMatchObject({ ok: false });
  });

  it("패스는 날짜와 시간 없이 확정할 수 있다", () => {
    expect(
      checkAbsenceResolutionInput({ resolution: "pass", targetDate: "", startTime: "" }, source),
    ).toEqual({ ok: true, resolution: "pass" });
  });
});

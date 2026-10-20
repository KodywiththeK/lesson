import { describe, expect, it } from "vitest";

import {
  deleteAcademyLessonWithReason,
  generateAcademyLessonEvents,
  moveAcademyLessonWithinMonth,
} from "./academy-lesson-schedule";

describe("generateAcademyLessonEvents", () => {
  it("시간 미정 수업도 날짜에 표시하고 시간 미정 표식을 남긴다", () => {
    const events = generateAcademyLessonEvents([{
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      lessonType: "academy",
      active: true,
      weekdays: ["monday"],
      startTime: "",
      endTime: "",
    }], { academyId: "academy-1", month: "2026-08" });

    expect(events).toHaveLength(5);
    expect(events[0]).toMatchObject({ date: "2026-08-03", timeUnspecified: true });
  });

  it("원생의 학원 수업 요일을 기준으로 해당 월 반복 일정을 만든다", () => {
    const events = generateAcademyLessonEvents(
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          lessonType: "academy",
          active: true,
          weekdays: ["monday", "wednesday"],
          startTime: "15:00",
          endTime: "15:50",
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(events.map((event) => event.date)).toEqual([
      "2026-08-03",
      "2026-08-05",
      "2026-08-10",
      "2026-08-12",
      "2026-08-17",
      "2026-08-19",
      "2026-08-24",
      "2026-08-26",
      "2026-08-31",
    ]);
    expect(events[0]).toMatchObject({
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      startTime: "15:00",
      endTime: "15:50",
      generatedFromEnrollment: true,
    });
  });

  it("다른 학원, 비활성 수강, 개인레슨 수강은 학원 수업 일정에서 제외한다", () => {
    const events = generateAcademyLessonEvents(
      [
        {
          academyId: "academy-2",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          lessonType: "academy",
          active: true,
          weekdays: ["monday"],
          startTime: "15:00",
          endTime: "15:50",
        },
        {
          academyId: "academy-1",
          studentId: "student-2",
          studentName: "이서윤",
          instrumentId: "cello",
          instrumentName: "첼로",
          lessonType: "academy",
          active: false,
          weekdays: ["monday"],
          startTime: "16:00",
          endTime: "16:50",
        },
        {
          academyId: "academy-1",
          studentId: "student-3",
          studentName: "박하준",
          instrumentId: "violin",
          instrumentName: "바이올린",
          lessonType: "private",
          active: true,
          weekdays: ["monday"],
          startTime: "17:00",
          endTime: "17:50",
        },
      ],
      {
        academyId: "academy-1",
        month: "2026-08",
      },
    );

    expect(events).toEqual([]);
  });
});

describe("moveAcademyLessonWithinMonth", () => {
  const event = {
    id: "event-1",
    academyId: "academy-1",
    enrollmentId: "enrollment-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-10",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  };

  it("같은 월 안에서는 일정 날짜와 시간만 이동하고 원생 기본 요일은 바꾸지 않는다", () => {
    const result = moveAcademyLessonWithinMonth(event, {
      targetDate: "2026-08-12",
      targetStartTime: "16:00",
      targetEndTime: "16:50",
    });

    expect(result.movedEvent).toMatchObject({
      date: "2026-08-12",
      startTime: "16:00",
      endTime: "16:50",
    });
    expect(result.enrollmentScheduleChanged).toBe(false);
  });

  it("다른 월로는 드래그 이동할 수 없다", () => {
    expect(() =>
      moveAcademyLessonWithinMonth(event, {
        targetDate: "2026-09-01",
        targetStartTime: "16:00",
        targetEndTime: "16:50",
      }),
    ).toThrow("일정 이동은 같은 월 안에서만 가능합니다.");
  });
});

describe("deleteAcademyLessonWithReason", () => {
  const event = {
    id: "event-1",
    academyId: "academy-1",
    enrollmentId: "enrollment-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-10",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  };

  it("학원 수업 일정 삭제는 사유와 처리 정보를 남긴다", () => {
    const result = deleteAcademyLessonWithReason(event, {
      reason: "학원 행사로 휴강",
      deletedAt: "2026-08-09T18:00:00+09:00",
      deletedBy: "user-owner",
    });

    expect(result.deletedEvent).toMatchObject({
      id: "event-1",
      status: "deleted",
      deletionReason: "학원 행사로 휴강",
      deletedAt: "2026-08-09T18:00:00+09:00",
      deletedBy: "user-owner",
      generatedFromEnrollment: false,
    });
    expect(result.enrollmentScheduleChanged).toBe(false);
  });

  it("삭제 사유가 없으면 삭제를 막는다", () => {
    expect(() =>
      deleteAcademyLessonWithReason(event, {
        reason: " ",
        deletedAt: "2026-08-09T18:00:00+09:00",
        deletedBy: "user-owner",
      }),
    ).toThrow("일정 삭제 사유는 필수입니다.");
  });
});

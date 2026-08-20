import { describe, expect, it } from "vitest";

import {
  findPrivateLessonRegistrationBlocker,
  formatPrivateLessonScheduleMessage,
  getSelectablePrivateLessonInstruments,
} from "./private-lesson";

describe("findPrivateLessonRegistrationBlocker", () => {
  const existingLessons = [
    {
      id: "lesson-1",
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      teacherId: "teacher-1",
      teacherName: "박선생",
      startAt: "2026-08-21T15:00:00+09:00",
      endAt: "2026-08-21T15:50:00+09:00",
      status: "scheduled" as const,
    },
  ];

  it("같은 학원, 같은 선생님의 시간이 겹치면 등록을 막는다", () => {
    const blocker = findPrivateLessonRegistrationBlocker(existingLessons, {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      teacherId: "teacher-1",
      startAt: "2026-08-21T15:30:00+09:00",
      endAt: "2026-08-21T16:20:00+09:00",
    });

    expect(blocker).toEqual({
      type: "teacher-time-overlap",
      lessonId: "lesson-1",
      message: "선택한 선생님의 해당 시간에 이미 개인레슨이 있습니다.",
    });
  });

  it("다른 학원의 같은 선생님 식별자 일정은 등록을 막지 않는다", () => {
    const blocker = findPrivateLessonRegistrationBlocker(existingLessons, {
      academyId: "academy-2",
      studentId: "student-2",
      instrumentId: "violin",
      teacherId: "teacher-1",
      startAt: "2026-08-21T15:30:00+09:00",
      endAt: "2026-08-21T16:20:00+09:00",
    });

    expect(blocker).toBeUndefined();
  });

  it("취소된 개인레슨은 시간 충돌 대상으로 보지 않는다", () => {
    const blocker = findPrivateLessonRegistrationBlocker(
      [
        {
          ...existingLessons[0],
          status: "cancelled" as const,
        },
      ],
      {
        academyId: "academy-1",
        studentId: "student-2",
        instrumentId: "violin",
        teacherId: "teacher-1",
        startAt: "2026-08-21T15:30:00+09:00",
        endAt: "2026-08-21T16:20:00+09:00",
      },
    );

    expect(blocker).toBeUndefined();
  });

  it("종료 시간이 시작 시간보다 빠르면 등록을 막는다", () => {
    const blocker = findPrivateLessonRegistrationBlocker([], {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "violin",
      teacherId: "teacher-1",
      startAt: "2026-08-21T16:20:00+09:00",
      endAt: "2026-08-21T15:30:00+09:00",
    });

    expect(blocker?.type).toBe("invalid-time-range");
  });
});

describe("getSelectablePrivateLessonInstruments", () => {
  it("원생이 같은 학원에서 활성 수강 중인 개인레슨 악기만 선택지로 돌려준다", () => {
    const instruments = getSelectablePrivateLessonInstruments(
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          lessonType: "private" as const,
          active: true,
        },
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "cello",
          instrumentName: "첼로",
          lessonType: "academy" as const,
          active: true,
        },
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "violin",
          instrumentName: "바이올린",
          lessonType: "private" as const,
          active: false,
        },
        {
          academyId: "academy-2",
          studentId: "student-1",
          instrumentId: "flute",
          instrumentName: "플루트",
          lessonType: "private" as const,
          active: true,
        },
      ],
      {
        academyId: "academy-1",
        studentId: "student-1",
      },
    );

    expect(instruments).toEqual([
      {
        instrumentId: "piano",
        instrumentName: "피아노",
      },
    ]);
  });
});

describe("formatPrivateLessonScheduleMessage", () => {
  it("원생에게 보낼 수 있는 개인레슨 시간표 텍스트를 날짜와 시간순으로 만든다", () => {
    const message = formatPrivateLessonScheduleMessage({
      targetName: "김민지",
      targetRole: "student",
      lessons: [
        {
          id: "lesson-2",
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "violin",
          instrumentName: "바이올린",
          teacherId: "teacher-2",
          teacherName: "이선생",
          startAt: "2026-08-22T14:00:00+09:00",
          endAt: "2026-08-22T14:50:00+09:00",
          status: "scheduled",
        },
        {
          id: "lesson-1",
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          startAt: "2026-08-21T15:00:00+09:00",
          endAt: "2026-08-21T15:50:00+09:00",
          status: "scheduled",
        },
      ],
    });

    expect(message).toBe(
      [
        "김민지 원생 개인레슨 시간표",
        "- 8월 21일(금) 15:00-15:50 피아노 / 박선생",
        "- 8월 22일(토) 14:00-14:50 바이올린 / 이선생",
      ].join("\n"),
    );
  });

  it("선생님에게 보낼 수 있는 개인레슨 시간표 텍스트에는 원생명을 포함한다", () => {
    const message = formatPrivateLessonScheduleMessage({
      targetName: "박선생",
      targetRole: "teacher",
      lessons: [
        {
          id: "lesson-1",
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          startAt: "2026-08-21T15:00:00+09:00",
          endAt: "2026-08-21T15:50:00+09:00",
          status: "scheduled",
        },
      ],
    });

    expect(message).toBe(
      [
        "박선생 선생님 개인레슨 시간표",
        "- 8월 21일(금) 15:00-15:50 김민지 / 피아노",
      ].join("\n"),
    );
  });
});

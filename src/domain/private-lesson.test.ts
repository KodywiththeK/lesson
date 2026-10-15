import { describe, expect, it } from "vitest";

import {
  PRIVATE_LESSON_REGISTRATION_STEPS,
  addMinutesToDateTime,
  buildPrivateLessonSessionLabels,
  buildPrivateLessonStudentSearchResults,
  deriveLessonMinutes,
  describePrivateAttendanceCancellation,
  describePrivateAttendanceChange,
  filterTeachersForInstrument,
  findPrivateLessonConflictNotice,
  formatKoreanTimeLabel,
  formatPrivateLessonScheduleCopyText,
  pickDefaultTeacherId,
  findPrivateLessonRegistrationBlocker,
  formatPrivateLessonScheduleMessage,
  getPrivateLessonRegistrationFlowState,
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

describe("getPrivateLessonRegistrationFlowState", () => {
  it("개인레슨 등록은 원생, 악기, 선생님, 시간 순서로 진행한다", () => {
    expect(PRIVATE_LESSON_REGISTRATION_STEPS.map((step) => step.id)).toEqual([
      "student",
      "instrument",
      "teacher",
      "time",
    ]);

    const flow = getPrivateLessonRegistrationFlowState({
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
    });

    expect(flow.currentStepId).toBe("teacher");
    expect(flow.steps).toEqual([
      { id: "student", label: "원생", status: "complete" },
      { id: "instrument", label: "악기", status: "complete" },
      { id: "teacher", label: "선생님", status: "current" },
      { id: "time", label: "시간", status: "locked" },
    ]);
  });
});

describe("buildPrivateLessonStudentSearchResults", () => {
  it("원생 검색 결과에 잔여 회차와 최근 레슨 상태를 함께 표시한다", () => {
    const results = buildPrivateLessonStudentSearchResults(
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
        },
        {
          academyId: "academy-1",
          studentId: "student-2",
          studentName: "이서윤",
        },
        {
          academyId: "academy-2",
          studentId: "student-1",
          studentName: "김민지",
        },
      ],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 3,
        },
      ],
      [
        {
          id: "older-lesson",
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          startAt: "2026-08-17T15:00:00+09:00",
          endAt: "2026-08-17T15:50:00+09:00",
          status: "present",
        },
        {
          id: "recent-lesson",
          academyId: "academy-1",
          studentId: "student-1",
          studentName: "김민지",
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          startAt: "2026-08-19T15:00:00+09:00",
          endAt: "2026-08-19T15:50:00+09:00",
          status: "absent",
        },
      ],
      {
        academyId: "academy-1",
        search: "김",
      },
    );

    expect(results).toEqual([
      {
        studentId: "student-1",
        studentName: "김민지",
        remainingTickets: [
          {
            instrumentId: "piano",
            instrumentName: "피아노",
            remainingCount: 3,
          },
        ],
        recentLesson: {
          lessonId: "recent-lesson",
          date: "2026-08-19",
          instrumentName: "피아노",
          status: "absent",
          statusLabel: "결석",
        },
        schedule: [
          { lessonId: "older-lesson", date: "2026-08-17", weekdayLabel: "월", sessionLabel: "1회차" },
          { lessonId: "recent-lesson", date: "2026-08-19", weekdayLabel: "수", sessionLabel: "2회차" },
        ],
      },
    ]);
  });

  it("회차권도 레슨도 없는 원생까지 검색 대상에 포함한다", () => {
    const results = buildPrivateLessonStudentSearchResults(
      [{ academyId: "academy-1", studentId: "student-9", studentName: "새원생" }],
      [],
      [],
      { academyId: "academy-1" },
    );

    expect(results).toEqual([
      {
        studentId: "student-9",
        studentName: "새원생",
        remainingTickets: [],
        recentLesson: undefined,
        schedule: [],
      },
    ]);
  });

  it("총 회차를 아는 원생의 일정은 현재/총 회차로 표시하고 취소된 레슨은 목록에서 뺀다", () => {
    const lesson = (id: string, startAt: string, status: "scheduled" | "cancelled") => ({
      id,
      academyId: "academy-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      teacherId: "teacher-1",
      teacherName: "박선생",
      startAt,
      endAt: startAt,
      status,
    });

    const [result] = buildPrivateLessonStudentSearchResults(
      [{ academyId: "academy-1", studentId: "student-1", studentName: "김민지" }],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 2,
          totalGrantedCount: 4,
        },
      ],
      [
        lesson("l-2", "2026-08-11T15:00:00+09:00", "scheduled"),
        lesson("l-cancelled", "2026-08-08T15:00:00+09:00", "cancelled"),
        lesson("l-1", "2026-08-04T15:00:00+09:00", "scheduled"),
      ],
      { academyId: "academy-1" },
    );

    expect(
      result.schedule.map((item) => [item.lessonId, item.date, item.weekdayLabel, item.sessionLabel]),
    ).toEqual([
      ["l-1", "2026-08-04", "화", "1/4"],
      ["l-2", "2026-08-11", "화", "2/4"],
    ]);
  });
});

describe("formatPrivateLessonScheduleCopyText", () => {
  it("날짜 오름차순으로 줄마다 `8/4 (화) - 1/4` 형태를 만든다", () => {
    expect(
      formatPrivateLessonScheduleCopyText([
        { lessonId: "l-2", date: "2026-08-11", weekdayLabel: "화", sessionLabel: "2/4" },
        { lessonId: "l-1", date: "2026-08-04", weekdayLabel: "화", sessionLabel: "1/4" },
      ]),
    ).toBe("8/4 (화) - 1/4\n8/11 (화) - 2/4");
  });
});

describe("buildPrivateLessonSessionLabels", () => {
  const base = {
    academyId: "academy-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    teacherId: "teacher-1",
    teacherName: "박선생",
    endAt: "2026-08-31T10:00:00+09:00",
    status: "scheduled" as const,
  };

  it("같은 원생·악기의 일정을 시간순으로 세어 현재/총 회차를 만든다", () => {
    const labels = buildPrivateLessonSessionLabels(
      [
        { ...base, id: "late", startAt: "2026-08-18T10:00:00+09:00" },
        { ...base, id: "early", startAt: "2026-08-04T10:00:00+09:00" },
        { ...base, id: "other-instrument", instrumentId: "violin", startAt: "2026-08-05T10:00:00+09:00" },
      ],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 2,
          totalGrantedCount: 4,
        },
      ],
    );

    expect(labels.get("early")).toBe("1/4");
    expect(labels.get("late")).toBe("2/4");
    expect(labels.get("other-instrument")).toBe("1회차");
  });

  it("월 단위 순번이 총 회차를 넘어도 총으로 자르지 않는다", () => {
    const labels = buildPrivateLessonSessionLabels(
      [
        { ...base, id: "a", startAt: "2026-08-04T10:00:00+09:00" },
        { ...base, id: "b", startAt: "2026-08-11T10:00:00+09:00" },
      ],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 0,
          totalGrantedCount: 1,
        },
      ],
    );

    expect(labels.get("b")).toBe("2/1");
  });

  it("회차권 유효 기간 안에서 이번 달 이전에 잡힌 레슨 수를 이어서 센다", () => {
    const labels = buildPrivateLessonSessionLabels(
      [
        { ...base, id: "oct-first", startAt: "2026-10-06T10:00:00+09:00" },
        { ...base, id: "oct-second", startAt: "2026-10-13T10:00:00+09:00" },
      ],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 4,
          totalGrantedCount: 8,
          priorLessonCount: 4,
        },
      ],
    );

    expect(labels.get("oct-first")).toBe("5/8");
    expect(labels.get("oct-second")).toBe("6/8");
  });

  it("이전 회차 수를 모르면 이번 달 순번만 센다", () => {
    const labels = buildPrivateLessonSessionLabels(
      [{ ...base, id: "a", startAt: "2026-10-06T10:00:00+09:00" }],
      [
        {
          academyId: "academy-1",
          studentId: "student-1",
          instrumentId: "piano",
          instrumentName: "피아노",
          remainingCount: 4,
          totalGrantedCount: 8,
        },
      ],
    );

    expect(labels.get("a")).toBe("1/8");
  });
});

describe("deriveLessonMinutes", () => {
  it("종료 시간에서 시작 시간을 뺀 분을 레슨 길이로 쓴다", () => {
    expect(deriveLessonMinutes("14:00:00", "14:40:00")).toBe(40);
    expect(deriveLessonMinutes("09:30", "10:30")).toBe(60);
  });

  it("값이 없거나 종료가 시작보다 늦지 않거나 형식이 이상하면 기본 30분을 쓴다", () => {
    expect(deriveLessonMinutes(null, null)).toBe(30);
    expect(deriveLessonMinutes("14:00:00", "14:00:00")).toBe(30);
    expect(deriveLessonMinutes("15:00:00", "14:00:00")).toBe(30);
    expect(deriveLessonMinutes("abc", "14:00")).toBe(30);
    expect(deriveLessonMinutes("14:00", "15:00", 45)).toBe(60);
    expect(deriveLessonMinutes(undefined, "15:00", 45)).toBe(45);
  });
});

describe("addMinutesToDateTime", () => {
  it("시작 일시에 분을 더해 같은 형식의 종료 일시를 만든다", () => {
    expect(addMinutesToDateTime("2026-08-21T15:00", 40)).toBe("2026-08-21T15:40");
    expect(addMinutesToDateTime("2026-08-21T23:50", 30)).toBe("2026-08-22T00:20");
  });
});

describe("filterTeachersForInstrument", () => {
  const teachers = [
    { teacherId: "teacher-piano", part: "피아노" },
    { teacherId: "teacher-violin", part: "바이올린" },
    { teacherId: "teacher-nopart", part: "" },
  ];

  it("파트가 악기와 같은 선생님만 돌려준다", () => {
    expect(filterTeachersForInstrument("바이올린", teachers)).toEqual({
      teachers: [teachers[1]],
      isFallback: false,
    });
  });

  it("원생의 담당 선생님은 파트가 달라도 함께 돌려준다", () => {
    expect(filterTeachersForInstrument("바이올린", teachers, "teacher-piano")).toEqual({
      teachers: [teachers[0], teachers[1]],
      isFallback: false,
    });
  });

  it("해당 악기 담당이 한 명도 없으면 전체 선생님을 돌려주고 대체 목록임을 알린다", () => {
    expect(filterTeachersForInstrument("첼로", teachers)).toEqual({
      teachers,
      isFallback: true,
    });
  });
});

describe("findPrivateLessonConflictNotice", () => {
  const existing = [
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
      endAt: "2026-08-21T15:40:00+09:00",
      status: "scheduled" as const,
    },
  ];

  it("같은 선생님의 시간대가 겹치면 겹치는 원생 이름을 넣어 안내한다", () => {
    expect(
      findPrivateLessonConflictNotice(existing, {
        academyId: "academy-1",
        studentId: "student-2",
        instrumentId: "piano",
        teacherId: "teacher-1",
        startAt: "2026-08-21T15:30:00+09:00",
        endAt: "2026-08-21T16:00:00+09:00",
      }),
    ).toBe("이미 같은 시간대에 김민지 원생 레슨이 있습니다.");
  });

  it("겹치지 않거나 시간 범위가 아직 올바르지 않으면 안내하지 않는다", () => {
    const draft = {
      academyId: "academy-1",
      studentId: "student-2",
      instrumentId: "piano",
      teacherId: "teacher-1",
    };

    expect(
      findPrivateLessonConflictNotice(existing, {
        ...draft,
        startAt: "2026-08-21T15:40:00+09:00",
        endAt: "2026-08-21T16:10:00+09:00",
      }),
    ).toBeUndefined();
    expect(
      findPrivateLessonConflictNotice(existing, {
        ...draft,
        startAt: "2026-08-21T16:00:00+09:00",
        endAt: "2026-08-21T15:00:00+09:00",
      }),
    ).toBeUndefined();
  });
});

describe("formatKoreanTimeLabel", () => {
  it.each([
    ["14:00", "오후 2시"],
    ["14:30", "오후 2:30"],
    ["09:05", "오전 9:05"],
    ["00:00", "오전 12시"],
    ["12:00", "오후 12시"],
  ])("%s를 %s로 보여 준다", (time, expected) => {
    expect(formatKoreanTimeLabel(time)).toBe(expected);
  });
});

describe("describePrivateAttendanceCancellation", () => {
  it("등원 확인을 취소하고 회차권 1회를 복구했다고 안내한다", () => {
    expect(describePrivateAttendanceCancellation()).toBe(
      "등원 확인을 취소하고 회차권 1회를 복구했습니다.",
    );
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

describe("describePrivateAttendanceChange", () => {
  it.each([
    ["scheduled", "present", "출석 처리하고 회차권 1회를 차감했습니다."],
    ["absent", "present", "출석 처리하고 회차권 1회를 차감했습니다."],
    ["present", "absent", "결석으로 바꾸고 회차권 1회를 복구했습니다."],
    ["scheduled", "absent", "결석 처리했습니다. 회차권은 차감되지 않습니다."],
  ] as const)("%s에서 %s로 바꾸면 실제 회차권 변화를 안내한다", (previous, next, expected) => {
    expect(describePrivateAttendanceChange(previous, next)).toBe(expected);
  });

  it("이미 같은 상태이면 변경이 없다고 안내한다", () => {
    expect(describePrivateAttendanceChange("present", "present")).toBe("이미 출석 처리된 수업입니다.");
    expect(describePrivateAttendanceChange("absent", "absent")).toBe("이미 결석 처리된 수업입니다.");
  });
});

describe("pickDefaultTeacherId", () => {
  const teachers = [
    { teacherId: "teacher-piano-1", part: "피아노" },
    { teacherId: "teacher-violin", part: "바이올린" },
    { teacherId: "teacher-flute", part: "플루트" },
  ];

  it("원생의 악기별 담당 선생님이 재직 중이면 그 선생님을 기본값으로 쓴다", () => {
    expect(
      pickDefaultTeacherId({ instrumentName: "피아노", teacherId: "teacher-violin" }, teachers),
    ).toBe("teacher-violin");
  });

  it("담당 선생님이 없으면 악기와 파트가 같은 선생님이 한 명일 때 그 선생님을 쓴다", () => {
    expect(pickDefaultTeacherId({ instrumentName: "피아노" }, teachers)).toBe("teacher-piano-1");
    expect(pickDefaultTeacherId({ instrumentName: "학원 바이올린" }, teachers)).toBe("teacher-violin");
  });

  it("담당 선생님이 재직 목록에 없으면 파트 기준으로 찾는다", () => {
    expect(
      pickDefaultTeacherId({ instrumentName: "플루트", teacherId: "teacher-resigned" }, teachers),
    ).toBe("teacher-flute");
  });

  it("파트가 같은 선생님이 여럿이거나 없으면 임의로 고르지 않고 비워 둔다", () => {
    const manyPiano = [...teachers, { teacherId: "teacher-piano-2", part: "피아노" }];

    expect(pickDefaultTeacherId({ instrumentName: "피아노" }, manyPiano)).toBe("");
    expect(pickDefaultTeacherId({ instrumentName: "첼로" }, teachers)).toBe("");
  });
});

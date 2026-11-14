import { describe, expect, it } from "vitest";

import type { DailyAcademyAttendanceRow } from "./academy-lesson-attendance";
import type { PrivateLesson } from "./private-lesson";
import {
  applyPresenceAction,
  buildPresenceRoster,
  canRecordPresence,
  getPresenceActions,
  getPresenceState,
  summarizePresence,
  type StudentPresenceRecord,
} from "./student-presence";

function record(overrides: Partial<StudentPresenceRecord> = {}): StudentPresenceRecord {
  return {
    studentId: "student-1",
    studentName: "김민지",
    lessonKinds: ["academy"],
    firstStartAt: "2026-11-14T15:00:00+09:00",
    arrivedAt: null,
    leftAt: null,
    ...overrides,
  };
}

describe("등하원 상태", () => {
  it("등원 기록이 없으면 등원 전, 등원만 있으면 학원에 있음, 하원까지 있으면 하원이다", () => {
    expect(getPresenceState(record())).toBe("expected");
    expect(getPresenceState(record({ arrivedAt: "2026-11-14T06:00:00Z" }))).toBe("present");
    expect(
      getPresenceState(record({ arrivedAt: "2026-11-14T06:00:00Z", leftAt: "2026-11-14T07:00:00Z" })),
    ).toBe("left");
  });

  it("상태마다 누를 수 있는 동작이 정해져 있다", () => {
    expect(getPresenceActions("expected")).toEqual(["arrive"]);
    expect(getPresenceActions("present")).toEqual(["leave", "cancel-arrive"]);
    expect(getPresenceActions("left")).toEqual(["cancel-leave"]);
  });

  it("상태별 인원을 센다", () => {
    const records = [
      record({ studentId: "a" }),
      record({ studentId: "b", arrivedAt: "2026-11-14T06:00:00Z" }),
      record({ studentId: "c", arrivedAt: "2026-11-14T06:00:00Z" }),
      record({ studentId: "d", arrivedAt: "2026-11-14T06:00:00Z", leftAt: "2026-11-14T07:00:00Z" }),
    ];

    expect(summarizePresence(records)).toEqual({ total: 4, expected: 1, present: 2, left: 1 });
  });

  it("등하원은 오늘 날짜에만 기록할 수 있다(지금 학원에 있는지를 표시하는 기능)", () => {
    expect(canRecordPresence("2026-11-14", "2026-11-14")).toBe(true);
    expect(canRecordPresence("2026-11-13", "2026-11-14")).toBe(false);
    expect(canRecordPresence("2026-11-15", "2026-11-14")).toBe(false);
  });
});

describe("applyPresenceAction", () => {
  const now = "2026-11-14T07:30:00.000Z";

  it("등원은 지금 시각을 기록하고 이미 등원했으면 처음 시각을 유지한다", () => {
    const arrived = applyPresenceAction(record(), "arrive", now);

    expect(arrived.arrivedAt).toBe(now);
    expect(applyPresenceAction(arrived, "arrive", "2026-11-14T09:00:00.000Z").arrivedAt).toBe(now);
  });

  it("하원은 등원한 학생만 기록하고 등원 전이면 거부한다", () => {
    expect(() => applyPresenceAction(record(), "leave", now)).toThrow("등원을 먼저 기록해 주세요.");
    expect(applyPresenceAction(record({ arrivedAt: "2026-11-14T06:00:00Z" }), "leave", now).leftAt).toBe(now);
  });

  it("등원 취소는 하원 기록이 없을 때만, 하원 취소는 하원 시각만 지운다", () => {
    const present = record({ arrivedAt: "2026-11-14T06:00:00Z" });
    const left = { ...present, leftAt: "2026-11-14T07:00:00Z" };

    expect(applyPresenceAction(present, "cancel-arrive", now).arrivedAt).toBeNull();
    expect(() => applyPresenceAction(left, "cancel-arrive", now)).toThrow("하원 기록을 먼저 취소해 주세요.");
    expect(applyPresenceAction(left, "cancel-leave", now)).toMatchObject({
      arrivedAt: "2026-11-14T06:00:00Z",
      leftAt: null,
    });
  });
});

describe("buildPresenceRoster (데모·로컬 상태용)", () => {
  function academyRow(overrides: Partial<DailyAcademyAttendanceRow>): DailyAcademyAttendanceRow {
    return {
      academyId: "academy-1",
      lessonEventId: "event-1",
      studentId: "student-1",
      studentName: "김민지",
      instrumentId: "piano",
      instrumentName: "피아노",
      date: "2026-11-14",
      startTime: "15:00",
      endTime: "15:50",
      status: "pending",
      ...overrides,
    };
  }

  function privateLesson(overrides: Partial<PrivateLesson>): PrivateLesson {
    return {
      id: "private-1",
      academyId: "academy-1",
      studentId: "student-2",
      studentName: "이서윤",
      instrumentId: "violin",
      instrumentName: "바이올린",
      teacherId: "teacher-1",
      teacherName: "박선생",
      startAt: "2026-11-14T14:00:00+09:00",
      endAt: "2026-11-14T14:40:00+09:00",
      status: "scheduled",
      ...overrides,
    };
  }

  it("그날 학원레슨과 개인레슨의 학생을 합치고 첫 수업 시각 순으로 정렬한다", () => {
    const roster = buildPresenceRoster({
      date: "2026-11-14",
      academyRows: [academyRow({})],
      privateLessons: [privateLesson({})],
    });

    expect(roster.map((item) => [item.studentName, item.lessonKinds, item.firstStartAt])).toEqual([
      ["이서윤", ["private"], "2026-11-14T14:00:00+09:00"],
      ["김민지", ["academy"], "2026-11-14T15:00:00+09:00"],
    ]);
  });

  it("한 학생이 여러 수업이 있어도 한 줄이고 수업 종류를 모두 보여 준다", () => {
    const roster = buildPresenceRoster({
      date: "2026-11-14",
      academyRows: [academyRow({ studentId: "student-2", studentName: "이서윤" })],
      privateLessons: [privateLesson({})],
    });

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ studentId: "student-2", lessonKinds: ["academy", "private"] });
    expect(roster[0].firstStartAt).toBe("2026-11-14T14:00:00+09:00");
  });

  it("다른 날짜와 취소된 개인레슨은 뺀다", () => {
    const roster = buildPresenceRoster({
      date: "2026-11-14",
      academyRows: [academyRow({ date: "2026-11-13" })],
      privateLessons: [
        privateLesson({ status: "cancelled" }),
        privateLesson({ id: "other-day", startAt: "2026-11-15T14:00:00+09:00", endAt: "2026-11-15T14:40:00+09:00" }),
      ],
    });

    expect(roster).toEqual([]);
  });
});

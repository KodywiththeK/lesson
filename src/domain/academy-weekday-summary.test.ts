import { describe, expect, it } from "vitest";

import { buildWeekdayAttendanceSummary } from "./academy-weekday-summary";

type Row = Parameters<typeof buildWeekdayAttendanceSummary>[0][number];

function row(studentId: string, studentName: string, date: string, origin?: Row["origin"]): Row {
  return { studentId, studentName, date, origin };
}

describe("buildWeekdayAttendanceSummary", () => {
  it("월~금을 항상 순서대로 돌려주고 등원이 없는 요일은 0명이다", () => {
    const summary = buildWeekdayAttendanceSummary([], "2026-08");

    expect(summary.weekdays.map((day) => [day.label, day.count])).toEqual([
      ["월", 0],
      ["화", 0],
      ["수", 0],
      ["목", 0],
      ["금", 0],
    ]);
    expect(summary.totalCount).toBe(0);
  });

  it("같은 원생의 매주 반복 일정은 요일마다 한 명으로 센다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [
        row("s1", "김민지", "2026-08-03", "regular"),
        row("s1", "김민지", "2026-08-10", "regular"),
        row("s1", "김민지", "2026-08-17", "regular"),
        row("s2", "이서윤", "2026-08-10", "regular"),
      ],
      "2026-08",
    );

    const monday = summary.weekdays[0];
    expect(monday.count).toBe(2);
    expect(monday.students.map((student) => student.studentName)).toEqual(["김민지", "이서윤"]);
  });

  it("전체 인원은 여러 요일에 다니는 원생을 한 번만 센다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [
        row("s1", "김민지", "2026-08-03", "regular"),
        row("s1", "김민지", "2026-08-05", "regular"),
        row("s2", "이서윤", "2026-08-05", "regular"),
      ],
      "2026-08",
    );

    expect(summary.weekdays.map((day) => day.count)).toEqual([1, 0, 2, 0, 0]);
    expect(summary.totalCount).toBe(2);
  });

  it("이름은 가나다 순으로 보여 주고 동명이인은 별도 인원으로 센다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [
        row("s3", "하늘", "2026-08-04", "regular"),
        row("s2", "가온", "2026-08-04", "regular"),
        row("s1", "가온", "2026-08-04", "regular"),
      ],
      "2026-08",
    );

    expect(summary.weekdays[1].students.map((student) => student.studentId)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
    expect(summary.totalCount).toBe(3);
  });

  it("선택한 달의 정규 일정만 센다. 보강·이동·비정기 일정과 다른 달 일정은 제외한다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [
        row("s1", "김민지", "2026-08-03", "regular"),
        row("s2", "이서윤", "2026-08-04", "makeup"),
        row("s3", "박지호", "2026-08-05", "rescheduled"),
        row("s4", "강도현", "2026-08-06", "manual"),
        row("s5", "정하린", "2026-08-07", "special"),
        row("s6", "한서아", "2026-09-07", "regular"),
      ],
      "2026-08",
    );

    expect(summary.weekdays.map((day) => day.count)).toEqual([1, 0, 0, 0, 0]);
    expect(summary.totalCount).toBe(1);
  });

  it("주말 정규 일정은 요일별 인원확인에 넣지 않는다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [
        row("s1", "김민지", "2026-08-08", "regular"),
        row("s1", "김민지", "2026-08-09", "regular"),
      ],
      "2026-08",
    );

    expect(summary.totalCount).toBe(0);
  });

  it("출처가 비어 있는 일정은 정규 일정으로 본다", () => {
    const summary = buildWeekdayAttendanceSummary(
      [row("s1", "김민지", "2026-08-03")],
      "2026-08",
    );

    expect(summary.weekdays[0].count).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import {
  TEACHER_PARTS,
  buildTeacherList,
  buildTeacherPartFormOptions,
  formatTeacherContractPeriod,
  formatTeacherPayType,
  formatTeacherWorkScheduleSummary,
} from "./teacher-list";

const teachers = [
  {
    academyId: "academy-1",
    teacherId: "teacher-1",
    name: "박선생",
    part: "피아노",
    contact: "010-1111-1111",
    registeredAt: "2026-08-01",
    payType: "ratio" as const,
    status: "employed" as const,
    contractStartOn: "2026-08-01",
    contractEndOn: "2027-07-31",
    salarySummary: "비율제 60%",
    workScheduleSummary: "월 14:00-20:00",
  },
  {
    academyId: "academy-1",
    teacherId: "teacher-2",
    name: "최선생",
    part: "바이올린",
    contact: "010-2222-2222",
    registeredAt: "2026-08-02",
    payType: "monthly" as const,
    status: "on_leave" as const,
    contractStartOn: "2026-08-01",
    contractEndOn: "2027-07-31",
    salarySummary: "월급제 2,500,000원",
    workScheduleSummary: "-",
  },
  {
    academyId: "academy-2",
    teacherId: "teacher-3",
    name: "한다른",
    part: "피아노",
    contact: "010-3333-3333",
    registeredAt: "2026-08-03",
    payType: "hourly" as const,
    status: "resigned" as const,
    contractStartOn: "2026-08-01",
    contractEndOn: "2027-07-31",
    salarySummary: "시급제 35,000원",
    workScheduleSummary: "토",
  },
];

describe("buildTeacherList", () => {
  it("학원 범위 안에서 선생님 목록을 가나다순으로 만든다", () => {
    const result = buildTeacherList(teachers, {
      academyId: "academy-1",
    });

    expect(result.items.map((teacher) => teacher.name)).toEqual([
      "박선생",
      "최선생",
    ]);
    expect(result.totalItems).toBe(2);
  });

  it("이름, 담당 파트, 연락처, 급여 형태 기준 검색을 지원한다", () => {
    const result = buildTeacherList(teachers, {
      academyId: "academy-1",
      search: "월급제",
    });

    expect(result.items.map((teacher) => teacher.name)).toEqual(["최선생"]);
  });

  it("담당 파트, 급여 형태, 상태 필터를 함께 적용한다", () => {
    const result = buildTeacherList(teachers, {
      academyId: "academy-1",
      filters: {
        part: "피아노",
        payType: "ratio",
        status: "employed",
      },
    });

    expect(result.items.map((teacher) => teacher.name)).toEqual(["박선생"]);
  });

  it("동명이인은 teacherId 순으로 고정해 입력 순서가 달라도 같은 목록을 만든다", () => {
    const [firstTeacher] = teachers;
    const sameNameTeachers = [
      { ...firstTeacher, teacherId: "teacher-b", contact: "010-0000-0002" },
      { ...firstTeacher, teacherId: "teacher-a", contact: "010-0000-0001" },
    ];

    const result = buildTeacherList(sameNameTeachers, { academyId: "academy-1" });
    const reversedResult = buildTeacherList([...sameNameTeachers].reverse(), {
      academyId: "academy-1",
    });

    expect(result.items.map((teacher) => teacher.teacherId)).toEqual([
      "teacher-a",
      "teacher-b",
    ]);
    expect(reversedResult.items.map((teacher) => teacher.teacherId)).toEqual([
      "teacher-a",
      "teacher-b",
    ]);
  });

  it("동명이인이 페이지 경계에 걸려도 중복이나 누락 없이 나눈다", () => {
    const [firstTeacher] = teachers;
    const sameNameTeachers = Array.from({ length: 11 }, (_, index) => ({
      ...firstTeacher,
      teacherId: `teacher-${String(index).padStart(2, "0")}`,
    })).reverse();

    const firstPage = buildTeacherList(sameNameTeachers, {
      academyId: "academy-1",
      page: 1,
      pageSize: 10,
    });
    const secondPage = buildTeacherList(sameNameTeachers, {
      academyId: "academy-1",
      page: 2,
      pageSize: 10,
    });

    expect(firstPage.totalItems).toBe(11);
    expect(secondPage.items.map((teacher) => teacher.teacherId)).toEqual([
      "teacher-10",
    ]);
    expect(firstPage.items.at(-1)?.teacherId).toBe("teacher-09");
  });
});

describe("formatTeacherPayType", () => {
  it("급여 형태를 운영 화면 표시명으로 바꾼다", () => {
    expect(formatTeacherPayType("monthly")).toBe("월급제");
    expect(formatTeacherPayType("hourly")).toBe("시급제");
    expect(formatTeacherPayType("ratio")).toBe("비율제");
  });
});

describe("선생님 목록 표시", () => {
  it("근무시간을 월요일부터 일요일 순으로 정렬한다", () => {
    expect(formatTeacherWorkScheduleSummary([
      { weekday: "friday", weekdayLabel: "금", startTime: "14:00", endTime: "18:00" },
      { weekday: "monday", weekdayLabel: "월", startTime: "10:00", endTime: "12:00" },
      { weekday: "sunday", weekdayLabel: "일" },
      { weekday: "wednesday", weekdayLabel: "수", startTime: "13:00", endTime: "17:00" },
    ])).toBe("월 10:00-12:00, 수 13:00-17:00, 금 14:00-18:00, 일");
  });

  it.each([
    ["2026-01-01", "2026-12-31", "2026-01-01~2026-12-31"],
    ["2026-01-01", undefined, "2026-01-01~"],
    [undefined, "2026-12-31", "~2026-12-31"],
    [undefined, undefined, "-"],
  ])("계약 시작일 %s, 종료일 %s를 %s로 표시한다", (startOn, endOn, expected) => {
    expect(formatTeacherContractPeriod(startOn, endOn)).toBe(expected);
  });
});

describe("formatTeacherStatus", () => {
  it("선생님 상태를 운영 화면 표시명으로 바꾼다", async () => {
    const { formatTeacherStatus } = await import("./teacher-list");

    expect(formatTeacherStatus("employed")).toBe("재직");
    expect(formatTeacherStatus("on_leave")).toBe("휴직");
    expect(formatTeacherStatus("resigned")).toBe("퇴사");
  });
});

describe("buildTeacherPartFormOptions", () => {
  it("담당 파트는 피아노·바이올린·첼로·플루트·원장 순서의 고정 목록이다", () => {
    expect(TEACHER_PARTS).toEqual(["피아노", "바이올린", "첼로", "플루트", "원장"]);
    expect(buildTeacherPartFormOptions(undefined)).toEqual(TEACHER_PARTS);
    expect(buildTeacherPartFormOptions("첼로")).toEqual(TEACHER_PARTS);
  });

  it("기존 데이터에 목록 밖 값이 있으면 그 값을 마지막 선택지로 더해 유지한다", () => {
    expect(buildTeacherPartFormOptions("오보에")).toEqual([...TEACHER_PARTS, "오보에"]);
    expect(buildTeacherPartFormOptions("  ")).toEqual(TEACHER_PARTS);
  });
});

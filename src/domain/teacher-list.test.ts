import { describe, expect, it } from "vitest";

import { buildTeacherList, formatTeacherPayType } from "./teacher-list";

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
});

describe("formatTeacherPayType", () => {
  it("급여 형태를 운영 화면 표시명으로 바꾼다", () => {
    expect(formatTeacherPayType("monthly")).toBe("월급제");
    expect(formatTeacherPayType("hourly")).toBe("시급제");
    expect(formatTeacherPayType("ratio")).toBe("비율제");
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

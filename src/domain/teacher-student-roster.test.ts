import { describe, expect, it } from "vitest";

import {
  buildTeacherStudentRoster,
  type TeacherStudentRosterRow,
} from "./teacher-student-roster";

const rows: TeacherStudentRosterRow[] = [
  { academyId: "academy-1", studentId: "s-2", name: "이서윤", instrumentNames: ["바이올린"], weekdayLabels: ["화"] },
  { academyId: "academy-1", studentId: "s-1", name: "김민지", instrumentNames: ["피아노"], weekdayLabels: ["월", "수"] },
  { academyId: "academy-2", studentId: "s-9", name: "다른학원", instrumentNames: ["피아노"], weekdayLabels: ["월"] },
];

describe("buildTeacherStudentRoster", () => {
  it("해당 학원의 담당 원생만 가나다순으로 보여 준다", () => {
    const view = buildTeacherStudentRoster(rows, { academyId: "academy-1" });

    expect(view.items.map((row) => row.name)).toEqual(["김민지", "이서윤"]);
    expect(view.totalItems).toBe(2);
  });

  it("이름, 악기, 요일로 검색한다", () => {
    expect(
      buildTeacherStudentRoster(rows, { academyId: "academy-1", search: "바이올린" }).items.map(
        (row) => row.name,
      ),
    ).toEqual(["이서윤"]);
    expect(
      buildTeacherStudentRoster(rows, { academyId: "academy-1", search: "수" }).items.map(
        (row) => row.name,
      ),
    ).toEqual(["김민지"]);
  });

  it("이름이 같으면 id 순서로 고정해 페이지 경계에서 중복이나 누락이 없다", () => {
    const sameName: TeacherStudentRosterRow[] = [
      { academyId: "academy-1", studentId: "b", name: "홍길동", instrumentNames: [], weekdayLabels: [] },
      { academyId: "academy-1", studentId: "a", name: "홍길동", instrumentNames: [], weekdayLabels: [] },
    ];

    expect(
      buildTeacherStudentRoster(sameName, { academyId: "academy-1" }).items.map((row) => row.studentId),
    ).toEqual(["a", "b"]);
  });

  it("페이지 크기를 넘으면 나눠서 보여 준다", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      academyId: "academy-1",
      studentId: `s-${index}`,
      name: `원생${String(index).padStart(2, "0")}`,
      instrumentNames: ["피아노"],
      weekdayLabels: ["월"],
    }));
    const view = buildTeacherStudentRoster(many, { academyId: "academy-1", page: 2, pageSize: 10 });

    expect(view.items).toHaveLength(2);
    expect(view.totalPages).toBe(2);
  });
});

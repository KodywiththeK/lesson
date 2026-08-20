import { describe, expect, it } from "vitest";

import { buildStudentList } from "./student-list";

const students = [
  {
    academyId: "academy-1",
    studentId: "student-2",
    name: "이서윤",
    teacherNames: ["박선생"],
    instrumentNames: ["바이올린"],
    weekdayLabels: ["화"],
  },
  {
    academyId: "academy-1",
    studentId: "student-1",
    name: "김민지",
    teacherNames: ["최선생"],
    instrumentNames: ["피아노", "첼로"],
    weekdayLabels: ["월", "수"],
  },
  {
    academyId: "academy-2",
    studentId: "student-3",
    name: "강하은",
    teacherNames: ["최선생"],
    instrumentNames: ["피아노"],
    weekdayLabels: ["월"],
  },
];

describe("buildStudentList", () => {
  it("원생 목록은 현재 학원 원생만 이름 가나다순으로 보여준다", () => {
    const list = buildStudentList(students, {
      academyId: "academy-1",
    });

    expect(list.items.map((student) => student.name)).toEqual(["김민지", "이서윤"]);
    expect(list.totalItems).toBe(2);
  });

  it("이름, 선생님, 악기, 정기 요일로 검색한다", () => {
    expect(
      buildStudentList(students, {
        academyId: "academy-1",
        search: "최선생",
      }).items.map((student) => student.name),
    ).toEqual(["김민지"]);

    expect(
      buildStudentList(students, {
        academyId: "academy-1",
        search: "첼로",
      }).items.map((student) => student.name),
    ).toEqual(["김민지"]);

    expect(
      buildStudentList(students, {
        academyId: "academy-1",
        search: "화",
      }).items.map((student) => student.name),
    ).toEqual(["이서윤"]);
  });

  it("선생님, 악기, 정기 요일 필터를 함께 적용한다", () => {
    const list = buildStudentList(students, {
      academyId: "academy-1",
      filters: {
        teacherName: "최선생",
        instrumentName: "피아노",
        weekdayLabel: "월",
      },
    });

    expect(list.items.map((student) => student.name)).toEqual(["김민지"]);
  });
});

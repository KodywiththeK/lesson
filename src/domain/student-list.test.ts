import { describe, expect, it } from "vitest";

import { buildStudentFilterOptions, buildStudentList } from "./student-list";

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

  it("이름이 같은 원생은 입력 순서와 상관없이 id 순서로 고정한다", () => {
    const sameNameStudents = ["student-c", "student-a", "student-b"].map(
      (studentId) => ({
        academyId: "academy-1",
        studentId,
        name: "김민지",
        teacherNames: ["최선생"],
        instrumentNames: ["피아노"],
        weekdayLabels: ["월"],
      }),
    );

    const shuffledInput = [...sameNameStudents].reverse();
    const orderedIds = (input: typeof sameNameStudents) =>
      buildStudentList(input, { academyId: "academy-1" }).items.map(
        (student) => student.studentId,
      );

    expect(orderedIds(sameNameStudents)).toEqual(["student-a", "student-b", "student-c"]);
    expect(orderedIds(shuffledInput)).toEqual(["student-a", "student-b", "student-c"]);
  });
});

describe("buildStudentFilterOptions", () => {
  it("전체 원생의 선생님·악기를 중복 없이 가나다순으로 모은다", () => {
    const options = buildStudentFilterOptions(students);

    expect(options.teacherNames).toEqual(["박선생", "최선생"]);
    expect(options.instrumentNames).toEqual(["바이올린", "첼로", "피아노"]);
  });

  it("원생이 없어도 알려진 선생님·악기를 선택지로 보여준다", () => {
    const options = buildStudentFilterOptions([students[0]], {
      teacherNames: ["최선생", "박선생"],
      instrumentNames: ["피아노", "바이올린"],
    });

    expect(options.teacherNames).toEqual(["박선생", "최선생"]);
    expect(options.instrumentNames).toEqual(["바이올린", "피아노"]);
  });

  it("요일은 원생 데이터와 상관없이 월요일부터 일요일 순서로 항상 보여준다", () => {
    expect(buildStudentFilterOptions([]).weekdayLabels).toEqual([
      "월",
      "화",
      "수",
      "목",
      "금",
      "토",
      "일",
    ]);
  });
});

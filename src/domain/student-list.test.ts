import { describe, expect, it } from "vitest";

import {
  buildStudentFilterOptions,
  buildStudentList,
  getStudentDisplayAge,
  mergeStudentUpdate,
  STUDENT_SORT_OPTIONS,
  type StudentListRow,
} from "./student-list";

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

describe("getStudentDisplayAge", () => {
  it("나이는 입력한 해가 지난 만큼 매년 1월 1일 기준으로 1살씩 늘어난다", () => {
    expect(getStudentDisplayAge({ age: 9, ageAsOfYear: 2025 }, "2026-01-01")).toBe(10);
    expect(getStudentDisplayAge({ age: 9, ageAsOfYear: 2025 }, "2025-12-31")).toBe(9);
    expect(getStudentDisplayAge({ age: 9, ageAsOfYear: 2023 }, "2026-10-16")).toBe(12);
  });

  it("입력한 해와 올해가 같거나 기준 연도가 미래여도 나이를 줄이지 않는다", () => {
    expect(getStudentDisplayAge({ age: 9, ageAsOfYear: 2026 }, "2026-10-16")).toBe(9);
    expect(getStudentDisplayAge({ age: 9, ageAsOfYear: 2027 }, "2026-10-16")).toBe(9);
  });

  it("기준 연도가 없으면 저장된 나이를 그대로 보여주고, 나이가 없으면 없음으로 둔다", () => {
    expect(getStudentDisplayAge({ age: 9 }, "2026-10-16")).toBe(9);
    expect(getStudentDisplayAge({ ageAsOfYear: 2025 }, "2026-10-16")).toBeUndefined();
  });

  it("나이 0살도 나이가 있는 값으로 취급한다", () => {
    expect(getStudentDisplayAge({ age: 0, ageAsOfYear: 2025 }, "2026-10-16")).toBe(1);
  });
});

describe("buildStudentList 정렬", () => {
  const row = (
    studentId: string,
    name: string,
    teacherNames: string[],
    instrumentNames: string[],
    weekdayLabels: string[],
  ): StudentListRow => ({
    academyId: "academy-1",
    studentId,
    name,
    teacherNames,
    instrumentNames,
    weekdayLabels,
  });
  const sortable = [
    row("s1", "가은", ["최선생"], ["피아노"], ["수", "금"]),
    row("s2", "나은", ["박선생"], ["바이올린"], ["월", "수"]),
    row("s3", "다은", [], ["첼로"], []),
    row("s4", "라은", ["박선생"], ["피아노"], ["월"]),
  ];
  const sortedNames = (sort: Parameters<typeof buildStudentList>[1]["sort"]) =>
    buildStudentList(sortable, { academyId: "academy-1", sort }).items.map((student) => student.name);

  it("정렬 기준을 주지 않으면 이름 가나다순이다", () => {
    expect(sortedNames(undefined)).toEqual(["가은", "나은", "다은", "라은"]);
  });

  it("정렬 기준 선택지는 이름, 담당 선생님, 악기, 정기 요일이다", () => {
    expect(STUDENT_SORT_OPTIONS.map((option) => option.label)).toEqual([
      "이름",
      "담당 선생님",
      "악기",
      "정기 요일",
    ]);
  });

  it("담당 선생님순은 같은 선생님 안에서 이름순이고 선생님이 없는 원생은 맨 뒤다", () => {
    expect(sortedNames({ key: "teacher", direction: "asc" })).toEqual(["나은", "라은", "가은", "다은"]);
    expect(sortedNames({ key: "teacher", direction: "desc" })).toEqual(["가은", "나은", "라은", "다은"]);
  });

  it("악기순은 악기 이름 가나다순이다", () => {
    expect(sortedNames({ key: "instrument", direction: "asc" })).toEqual(["나은", "다은", "가은", "라은"]);
  });

  it("정기 요일순은 가장 이른 요일이 앞서고 요일이 없는 원생은 맨 뒤다", () => {
    expect(sortedNames({ key: "weekday", direction: "asc" })).toEqual(["라은", "나은", "가은", "다은"]);
    expect(sortedNames({ key: "weekday", direction: "desc" })).toEqual(["가은", "나은", "라은", "다은"]);
  });

  it("이름 내림차순에서도 동명이인은 원생 ID 오름차순으로 고정된다", () => {
    const sameNames = [
      row("s2", "홍길동", [], [], []),
      row("s1", "홍길동", [], [], []),
      row("s3", "김하늘", [], [], []),
    ];

    expect(
      buildStudentList(sameNames, {
        academyId: "academy-1",
        sort: { key: "name", direction: "desc" },
      }).items.map((student) => student.studentId),
    ).toEqual(["s1", "s2", "s3"]);
  });
});

describe("mergeStudentUpdate", () => {
  const instrument = (
    id: string,
    instrumentName: string,
    teacherName: string,
    weekdayLabels: string[],
  ) => ({
    studentInstrumentId: id,
    teacherId: `${id}-teacher`,
    teacherName,
    instrumentId: instrumentName,
    instrumentName,
    lessonType: "private",
    weekdayLabels,
    startTime: "",
    endTime: "",
    progress: "",
    lessonFee: 0,
    discountTotal: 0,
    finalMonthlyFee: 0,
    active: true,
  });
  const current: StudentListRow = {
    academyId: "academy-1",
    studentId: "s1",
    name: "한소희",
    status: "enrolled",
    teacherNames: ["박선생", "최선생"],
    instrumentNames: ["피아노", "바이올린"],
    weekdayLabels: ["월", "화"],
    instruments: [
      instrument("si-piano", "피아노", "박선생", ["월"]),
      instrument("si-violin", "바이올린", "최선생", ["화"]),
    ],
  };

  it("한 악기만 수정한 결과를 합쳐도 다른 악기와 선생님·요일 요약을 잃지 않는다", () => {
    const merged = mergeStudentUpdate(current, {
      academyId: "academy-1",
      studentId: "s1",
      name: "한소희",
      teacherNames: ["윤선생"],
      instrumentNames: ["바이올린"],
      weekdayLabels: ["목"],
      instruments: [instrument("si-violin", "바이올린", "윤선생", ["목"])],
    });

    expect(merged.instruments?.map((item) => item.studentInstrumentId)).toEqual([
      "si-piano",
      "si-violin",
    ]);
    expect(merged.teacherNames).toEqual(["박선생", "윤선생"]);
    expect(merged.instrumentNames).toEqual(["피아노", "바이올린"]);
    expect(merged.weekdayLabels).toEqual(["월", "목"]);
    expect(merged.status).toBe("enrolled");
  });

  it("수정 결과를 차례로 합치면 두 악기의 변경이 모두 남는다", () => {
    const results = [
      {
        ...current,
        teacherNames: ["김선생"],
        instrumentNames: ["피아노"],
        weekdayLabels: ["수"],
        instruments: [instrument("si-piano", "피아노", "김선생", ["수"])],
      },
      {
        ...current,
        teacherNames: ["윤선생"],
        instrumentNames: ["바이올린"],
        weekdayLabels: ["목"],
        instruments: [instrument("si-violin", "바이올린", "윤선생", ["목"])],
      },
    ];

    const merged = results.reduce(mergeStudentUpdate, current);

    expect(merged.teacherNames).toEqual(["김선생", "윤선생"]);
    expect(merged.weekdayLabels).toEqual(["수", "목"]);
  });

  it("악기 없이 이름·기본 정보만 수정한 결과는 기존 악기와 요약을 그대로 둔다", () => {
    const merged = mergeStudentUpdate(current, {
      academyId: "academy-1",
      studentId: "s1",
      name: "한소희B",
      grade: "중1",
      teacherNames: [],
      instrumentNames: [],
      weekdayLabels: [],
      instruments: [],
    });

    expect(merged.name).toBe("한소희B");
    expect(merged.grade).toBe("중1");
    expect(merged.teacherNames).toEqual(["박선생", "최선생"]);
    expect(merged.instrumentNames).toEqual(["피아노", "바이올린"]);
    expect(merged.weekdayLabels).toEqual(["월", "화"]);
    expect(merged.instruments).toHaveLength(2);
  });
});

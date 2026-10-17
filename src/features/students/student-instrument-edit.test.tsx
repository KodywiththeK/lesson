import { describe, expect, it } from "vitest";

import type { StudentListInstrument } from "@/domain/student-list";

import { getEditableInstruments, getInstrumentSectionLabels } from "./student-instrument-edit";

function instrument(
  id: string,
  instrumentName: string,
  options: Partial<StudentListInstrument> = {},
): StudentListInstrument {
  return {
    studentInstrumentId: id,
    teacherId: null,
    teacherName: "",
    instrumentId: instrumentName,
    instrumentName,
    lessonType: "academy",
    weekdayLabels: [],
    startTime: "",
    endTime: "",
    progress: "",
    lessonFee: 0,
    discountTotal: 0,
    finalMonthlyFee: 0,
    active: true,
    ...options,
  };
}

const studentWith = (instruments: StudentListInstrument[] | undefined) => ({
  academyId: "academy-1",
  studentId: "s1",
  name: "한소희",
  teacherNames: [],
  instrumentNames: [],
  weekdayLabels: [],
  instruments,
});

describe("getEditableInstruments", () => {
  it("활성 악기를 모두 돌려주고 수강을 끝낸 악기는 뺀다", () => {
    const editable = getEditableInstruments(
      studentWith([
        instrument("a", "피아노"),
        instrument("b", "첼로", { active: false }),
        instrument("c", "바이올린"),
      ]),
    );

    expect(editable.map((item) => item.studentInstrumentId)).toEqual(["a", "c"]);
  });

  it("활성 악기가 없으면 첫 악기를 대신 보여 주고, 악기가 없으면 빈 목록이다", () => {
    expect(
      getEditableInstruments(
        studentWith([instrument("a", "피아노", { active: false }), instrument("b", "첼로", { active: false })]),
      ).map((item) => item.studentInstrumentId),
    ).toEqual(["a"]);
    expect(getEditableInstruments(studentWith(undefined))).toEqual([]);
  });
});

describe("getInstrumentSectionLabels", () => {
  it("악기 이름이 서로 다르면 악기 이름을 그대로 쓴다", () => {
    expect(
      getInstrumentSectionLabels([instrument("a", "피아노"), instrument("b", "바이올린")]),
    ).toEqual(["피아노", "바이올린"]);
  });

  it("같은 악기를 학원·개인으로 함께 수강하면 수업 형태를 덧붙여 구분한다", () => {
    expect(
      getInstrumentSectionLabels([
        instrument("a", "피아노", { lessonType: "academy" }),
        instrument("b", "피아노", { lessonType: "private" }),
      ]),
    ).toEqual(["피아노(학원레슨)", "피아노(개인레슨)"]);
  });
});

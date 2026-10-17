import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentEnrollmentFields } from "@/domain/student-enrollment-edit";

import {
  createInitialDemoAcademyState,
  registerDemoAcademyStudent,
  type DemoAcademyState,
} from "./academy-demo-state";
import { updateDemoStudentEnrollments } from "./academy-demo-student-edit";

const pianoFields: StudentEnrollmentFields = {
  lessonType: "academy",
  teacherId: "teacher-1",
  teacherName: "김하늘",
  instrumentId: "piano",
  instrumentName: "피아노",
  weeklySchedules: [{ weekdayLabel: "금", startTime: "14:00", endTime: "14:50" }],
  progress: "바이엘 상",
  lessonFee: 150000,
  discountTotal: 0,
  finalMonthlyFee: 150000,
};

const celloFields: StudentEnrollmentFields = {
  lessonType: "academy",
  teacherId: "teacher-3",
  teacherName: "문서준",
  instrumentId: "cello",
  instrumentName: "첼로",
  weeklySchedules: [{ weekdayLabel: "금", startTime: "17:00", endTime: "17:50" }],
  progress: "",
  lessonFee: 180000,
  discountTotal: 0,
  finalMonthlyFee: 180000,
};

function registerStudentWithPianoAndViolin(): { state: DemoAcademyState; studentId: string } {
  const state = registerDemoAcademyStudent(createInitialDemoAcademyState(), {
    name: "윤라온",
    registeredAt: "2026-08-21",
    contact: { relationship: "모", phone: "010-9999-1234" },
    instruments: [
      {
        instrumentId: "piano",
        instrumentName: "피아노",
        teacherId: "teacher-1",
        teacherName: "김하늘",
        lessonType: "academy",
        weeklySchedules: [{ weekday: "friday", startTime: "14:00", endTime: "14:50" }],
        progress: "바이엘 상",
        lessonFee: 150000,
        discountTotal: 0,
        finalMonthlyFee: 150000,
      },
      {
        instrumentId: "violin",
        instrumentName: "바이올린",
        teacherId: "teacher-2",
        teacherName: "오유진",
        lessonType: "private",
        weeklySchedules: [{ weekday: "monday" }],
        progress: "스즈키 1권",
        lessonFee: 140000,
        discountTotal: 0,
        finalMonthlyFee: 140000,
      },
    ],
  });
  const student = state.students.find((candidate) => candidate.name === "윤라온");

  return { state, studentId: student?.studentId ?? "" };
}

function instrumentIdOf(state: DemoAcademyState, studentId: string, instrumentId: string) {
  return state.students
    .find((student) => student.studentId === studentId)
    ?.instruments?.find((instrument) => instrument.instrumentId === instrumentId)?.studentInstrumentId;
}

describe("updateDemoStudentEnrollments", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-24T03:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("악기를 추가하면 원생 악기·수강 정보·학원레슨표에 반영한다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();

    const { state: next, result } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId,
      name: "윤라온",
      changes: [{ ...celloFields, action: "add", startedOn: "2026-08-24" }],
    });

    const student = next.students.find((candidate) => candidate.studentId === studentId);

    expect(result.addedStudentInstrumentIds).toHaveLength(1);
    expect(student?.instruments?.map((instrument) => instrument.instrumentName).sort()).toEqual([
      "바이올린",
      "첼로",
      "피아노",
    ]);
    expect(student?.instrumentNames).toContain("첼로");
    expect(next.enrollments.some((enrollment) => enrollment.studentId === studentId && enrollment.instrumentId === "cello")).toBe(true);
    expect(
      next.academySheets["2026-08-28"]?.rows.some(
        (row) => row.studentId === studentId && row.instrumentId === "cello" && row.startTime === "17:00",
      ),
    ).toBe(true);
  });

  it("악기를 종료하면 원생 악기와 수강 정보에서 빼고 오늘 이후 학원 정기 일정도 뺀다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const pianoId = instrumentIdOf(state, studentId, "piano") ?? "";

    const { state: next, result } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId,
      name: "윤라온",
      changes: [{ action: "end", studentInstrumentId: pianoId }],
    });

    const student = next.students.find((candidate) => candidate.studentId === studentId);

    expect(result.ended).toEqual([{ studentInstrumentId: pianoId, remainingEventCount: 0 }]);
    expect(student?.instruments?.map((instrument) => instrument.instrumentId)).toEqual(["violin"]);
    expect(student?.instrumentNames).toEqual(["바이올린"]);
    expect(next.enrollments.some((enrollment) => enrollment.studentId === studentId && enrollment.instrumentId === "piano")).toBe(false);
    expect(
      Object.values(next.academySheets).some((sheet) =>
        sheet.rows.some((row) => row.studentId === studentId && row.instrumentId === "piano" && sheet.date >= "2026-08-24"),
      ),
    ).toBe(false);
  });

  it("종료한 수강에 남은 예정 개인레슨 건수를 알려 준다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const violinId = instrumentIdOf(state, studentId, "violin") ?? "";
    const withLessons: DemoAcademyState = {
      ...state,
      privateLessons: [
        ...state.privateLessons,
        ...["2026-08-25", "2026-09-01", "2026-08-10"].map((date, index) => ({
          id: `private-demo-${index}`,
          academyId: state.academyId,
          studentId,
          studentName: "윤라온",
          instrumentId: "violin",
          instrumentName: "바이올린",
          teacherId: "teacher-2",
          teacherName: "오유진",
          startAt: `${date}T18:00:00+09:00`,
          endAt: `${date}T18:50:00+09:00`,
          status: "scheduled" as const,
        })),
      ],
    };

    const { result } = updateDemoStudentEnrollments(withLessons, {
      academyId: state.academyId,
      studentId,
      name: "윤라온",
      changes: [{ action: "end", studentInstrumentId: violinId }],
    });

    expect(result.ended).toEqual([{ studentInstrumentId: violinId, remainingEventCount: 2 }]);
  });

  it("마지막 활성 악기는 종료할 수 없다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();

    expect(() =>
      updateDemoStudentEnrollments(state, {
        academyId: state.academyId,
        studentId,
        name: "윤라온",
        changes: [
          { action: "end", studentInstrumentId: instrumentIdOf(state, studentId, "piano") ?? "" },
          { action: "end", studentInstrumentId: instrumentIdOf(state, studentId, "violin") ?? "" },
        ],
      }),
    ).toThrow("수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.");
  });

  it("악기를 제자리에서 바꾸거나 같은 악기·수업 형태를 또 추가하면 거부한다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const pianoId = instrumentIdOf(state, studentId, "piano") ?? "";

    expect(() =>
      updateDemoStudentEnrollments(state, {
        academyId: state.academyId,
        studentId,
        name: "윤라온",
        changes: [{ ...celloFields, action: "update", studentInstrumentId: pianoId }],
      }),
    ).toThrow("악기는 바꿀 수 없습니다. 기존 악기를 종료하고 새 악기를 추가해 주세요.");
    expect(() =>
      updateDemoStudentEnrollments(state, {
        academyId: state.academyId,
        studentId,
        name: "윤라온",
        changes: [{ ...pianoFields, action: "add", startedOn: "2026-08-24" }],
      }),
    ).toThrow("이미 수강 중인 악기와 수업 형태입니다.");
  });

  it("종료한 악기·수업 형태를 같은 저장에서 다시 추가하면 다른 id의 새 수강이 되고 종료한 수강은 남지 않는다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const pianoId = instrumentIdOf(state, studentId, "piano") ?? "";

    const { state: next, result } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId,
      name: "윤라온",
      changes: [
        { action: "end", studentInstrumentId: pianoId },
        { ...pianoFields, action: "add", startedOn: "2026-08-24", progress: "바이엘 하" },
      ],
    });

    const piano = next.students
      .find((candidate) => candidate.studentId === studentId)
      ?.instruments?.filter((instrument) => instrument.instrumentId === "piano");

    expect(piano).toHaveLength(1);
    expect(piano?.[0].studentInstrumentId).not.toBe(pianoId);
    expect(piano?.[0]).toMatchObject({ progress: "바이엘 하", active: true });
    expect(result.addedStudentInstrumentIds).toEqual([piano?.[0].studentInstrumentId]);
    expect(result.ended.map((ended) => ended.studentInstrumentId)).toEqual([pianoId]);
  });

  it("수업 형태를 바꾼 뒤의 모습 기준으로 추가·변경 충돌을 검사한다(서버처럼 종료 → 수정 → 추가 순서)", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const pianoId = instrumentIdOf(state, studentId, "piano") ?? "";
    const toPrivate: StudentEnrollmentFields = { ...pianoFields, lessonType: "private", weeklySchedules: [] };

    // 피아노 학원 → 개인으로 바꾸면 같은 저장에서 피아노 학원을 새로 추가할 수 있다.
    const { state: next } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId,
      name: "윤라온",
      changes: [
        { ...toPrivate, action: "update", studentInstrumentId: pianoId },
        { ...pianoFields, action: "add", startedOn: "2026-08-24" },
      ],
    });
    const types = next.students
      .find((candidate) => candidate.studentId === studentId)
      ?.instruments?.filter((instrument) => instrument.instrumentId === "piano")
      .map((instrument) => instrument.lessonType)
      .sort();

    expect(types).toEqual(["academy", "private"]);

    // 바꾼 뒤 모습이 개인인데 개인 피아노를 또 추가하면 거부한다.
    expect(() =>
      updateDemoStudentEnrollments(state, {
        academyId: state.academyId,
        studentId,
        name: "윤라온",
        changes: [
          { ...toPrivate, action: "update", studentInstrumentId: pianoId },
          { ...toPrivate, action: "add", startedOn: "2026-08-24" },
        ],
      }),
    ).toThrow("이미 수강 중인 악기와 수업 형태입니다.");
  });

  it("수정 중 하나라도 규칙에 어긋나면 던지고 원래 상태는 바뀌지 않는다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const before = JSON.stringify(state);

    expect(() =>
      updateDemoStudentEnrollments(state, {
        academyId: state.academyId,
        studentId,
        name: "바뀐이름",
        changes: [
          { ...celloFields, action: "add", startedOn: "2026-08-24" },
          { ...pianoFields, action: "add", startedOn: "2026-08-24" },
        ],
      }),
    ).toThrow("이미 수강 중인 악기와 수업 형태입니다.");
    expect(JSON.stringify(state)).toBe(before);
  });

  it("이름과 기본 정보는 원생과 수강 정보에 함께 반영하고 다른 악기는 유지한다", () => {
    const { state, studentId } = registerStudentWithPianoAndViolin();
    const pianoId = instrumentIdOf(state, studentId, "piano") ?? "";

    const { state: next } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId,
      name: "윤라온B",
      basicInfo: { registeredOn: "2026-08-21", grade: "초5", contactRelationship: "부", contactPhone: "010-1111-2222" },
      changes: [{ ...pianoFields, action: "update", studentInstrumentId: pianoId, progress: "체르니 100" }],
    });

    const student = next.students.find((candidate) => candidate.studentId === studentId);

    expect(student).toMatchObject({ name: "윤라온B", grade: "초5" });
    expect(student?.instruments?.map((instrument) => instrument.instrumentId).sort()).toEqual(["piano", "violin"]);
    expect(student?.instruments?.find((instrument) => instrument.instrumentId === "piano")?.progress).toBe("체르니 100");
    expect(next.enrollments.filter((enrollment) => enrollment.studentId === studentId).every((enrollment) => enrollment.studentName === "윤라온B")).toBe(true);
  });

  it("악기 정보가 없는 기본 데모 원생도 이름만 수정할 수 있다", () => {
    const state = createInitialDemoAcademyState();
    const student = state.students[0];

    const { state: next } = updateDemoStudentEnrollments(state, {
      academyId: state.academyId,
      studentId: student.studentId,
      name: "새이름",
      changes: [],
    });

    expect(next.students[0]).toMatchObject({ name: "새이름", instrumentNames: student.instrumentNames });
  });

  it("없는 원생이면 새로고침을 안내한다", () => {
    const state = createInitialDemoAcademyState();

    expect(() =>
      updateDemoStudentEnrollments(state, { academyId: state.academyId, studentId: "nope", name: "x", changes: [] }),
    ).toThrow("원생을 찾지 못했습니다. 목록을 새로고침해 주세요.");
  });
});

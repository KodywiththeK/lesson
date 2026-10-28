import { describe, expect, it, vi } from "vitest";

import {
  applyStudentEnrollmentSave,
  buildStudentEnrollmentPatch,
  canEndStudentInstrument,
  findActiveEnrollmentConflict,
  getRemainingEventNotice,
  getStudentEnrollmentValidationError,
  LAST_INSTRUMENT_END_MESSAGE,
  type StudentEnrollmentFields,
  type UpdateStudentEnrollmentsInput,
} from "./student-enrollment-edit";
import type { StudentListInstrument, StudentListRow } from "./student-list";

const piano: StudentListInstrument = {
  studentInstrumentId: "si-piano",
  teacherId: "teacher-1",
  teacherName: "김하늘",
  instrumentId: "piano",
  instrumentName: "피아노",
  lessonType: "academy",
  weekdayLabels: ["월"],
  startTime: "15:00",
  endTime: "15:50",
  progress: "체르니 30",
  lessonFee: 200000,
  discountTotal: 0,
  finalMonthlyFee: 200000,
  active: true,
  weeklySchedules: [
    { weekday: "monday", weekdayLabel: "월", startTime: "15:00", endTime: "15:50" },
  ],
};

const violin: StudentListInstrument = {
  ...piano,
  studentInstrumentId: "si-violin",
  teacherId: "teacher-2",
  teacherName: "박서연",
  instrumentId: "violin",
  instrumentName: "바이올린",
  weekdayLabels: ["수"],
  weeklySchedules: [
    { weekday: "wednesday", weekdayLabel: "수", startTime: "16:00", endTime: "16:50" },
  ],
};

const student: StudentListRow = {
  academyId: "academy-1",
  studentId: "student-1",
  name: "김민지",
  registeredOn: "2026-03-01",
  teacherNames: ["김하늘", "박서연"],
  instrumentNames: ["피아노", "바이올린"],
  weekdayLabels: ["월", "수"],
  instruments: [piano, violin],
};

const cello: StudentEnrollmentFields = {
  lessonType: "academy",
  teacherId: "teacher-3",
  teacherName: "이도윤",
  instrumentId: "cello",
  instrumentName: "첼로",
  weeklySchedules: [{ weekdayLabel: "금", startTime: "17:00", endTime: "17:50" }],
  progress: "",
  lessonFee: 180000,
  discountTotal: 0,
  finalMonthlyFee: 180000,
};

const pianoFields: StudentEnrollmentFields = {
  lessonType: "academy",
  teacherId: "teacher-1",
  teacherName: "김하늘",
  instrumentId: "piano",
  instrumentName: "피아노",
  weeklySchedules: [{ weekdayLabel: "월", startTime: "15:00", endTime: "15:50" }],
  progress: "체르니 30",
  lessonFee: 200000,
  discountTotal: 0,
  finalMonthlyFee: 200000,
};

function buildInput(changes: UpdateStudentEnrollmentsInput["changes"]): UpdateStudentEnrollmentsInput {
  return { academyId: "academy-1", studentId: "student-1", name: "김민지", changes };
}

describe("buildStudentEnrollmentPatch", () => {
  it("수정한 악기와 추가한 악기를 담고 종료한 악기는 담지 않는다", () => {
    const patch = buildStudentEnrollmentPatch(
      buildInput([
        { ...pianoFields, action: "update", studentInstrumentId: "si-piano", progress: "체르니 40" },
        { ...cello, action: "add", startedOn: "2026-10-20" },
        { action: "end", studentInstrumentId: "si-violin" },
      ]),
      { addedStudentInstrumentIds: ["si-cello"], ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 0 }] },
    );

    expect(patch.instruments?.map((instrument) => instrument.studentInstrumentId)).toEqual([
      "si-piano",
      "si-cello",
    ]);
    expect(patch.instruments?.[0]).toMatchObject({ progress: "체르니 40", active: true });
    expect(patch.instruments?.[1]).toMatchObject({
      instrumentName: "첼로",
      weekdayLabels: ["금"],
      startTime: "17:00",
      finalMonthlyFee: 180000,
      weeklySchedules: [{ weekday: "friday", weekdayLabel: "금", startTime: "17:00", endTime: "17:50" }],
    });
  });

  it("서버가 새 id를 알려 주지 않았으면 악기·수업 형태로 임시 id를 만든다", () => {
    const patch = buildStudentEnrollmentPatch(buildInput([{ ...cello, action: "add", startedOn: "2026-10-20" }]));

    expect(patch.instruments?.[0].studentInstrumentId).toBe("new:cello:academy");
  });

  it("기본 정보를 함께 담는다", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-17T03:00:00Z"));

    const patch = buildStudentEnrollmentPatch({
      ...buildInput([]),
      basicInfo: {
        registeredOn: "2026-03-02",
        age: 9,
        grade: " 초3 ",
        contactRelationship: "어머니",
        contactPhone: "010-1234-5678",
      },
    });

    expect(patch).toMatchObject({
      registeredOn: "2026-03-02",
      age: 9,
      ageAsOfYear: 2026,
      grade: "초3",
      contacts: [{ relationship: "어머니", phone: "010-1234-5678", phoneLast4: "5678" }],
    });

    vi.useRealTimers();
  });
});

describe("applyStudentEnrollmentSave", () => {
  it("한 악기를 종료하고 한 악기를 추가해도 나머지 악기와 요약을 유지한다", () => {
    const merged = applyStudentEnrollmentSave(
      student,
      buildInput([
        { ...pianoFields, action: "update", studentInstrumentId: "si-piano", progress: "체르니 40" },
        { ...cello, action: "add", startedOn: "2026-10-20" },
        { action: "end", studentInstrumentId: "si-violin" },
      ]),
      { addedStudentInstrumentIds: ["si-cello"], ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 2 }] },
    );

    expect(merged.instruments?.map((instrument) => instrument.studentInstrumentId)).toEqual([
      "si-piano",
      "si-cello",
    ]);
    expect(merged.instruments?.[0].progress).toBe("체르니 40");
    expect(merged.instrumentNames).toEqual(["피아노", "첼로"]);
    expect(merged.teacherNames).toEqual(["김하늘", "이도윤"]);
    expect(merged.weekdayLabels).toEqual(["월", "금"]);
  });

  it("종료만 해도 종료한 악기를 목록과 요약에서 뺀다", () => {
    const merged = applyStudentEnrollmentSave(
      student,
      buildInput([{ action: "end", studentInstrumentId: "si-violin" }]),
      { addedStudentInstrumentIds: [], ended: [{ studentInstrumentId: "si-violin", remainingEventCount: 0 }] },
    );

    expect(merged.instruments?.map((instrument) => instrument.studentInstrumentId)).toEqual(["si-piano"]);
    expect(merged.instrumentNames).toEqual(["피아노"]);
    expect(merged.weekdayLabels).toEqual(["월"]);
  });

  it("종료한 악기·수업 형태를 같은 저장에서 다시 추가하면 서버가 준 새 수강으로 바꿔 넣고 종료한 수강은 뺀다", () => {
    const merged = applyStudentEnrollmentSave(
      student,
      buildInput([
        { action: "end", studentInstrumentId: "si-piano" },
        { ...pianoFields, action: "add", startedOn: "2026-10-20", progress: "체르니 50" },
      ]),
      { addedStudentInstrumentIds: ["si-piano-2"], ended: [{ studentInstrumentId: "si-piano", remainingEventCount: 0 }] },
    );

    expect(merged.instruments?.map((instrument) => instrument.studentInstrumentId)).toEqual(["si-violin", "si-piano-2"]);
    expect(merged.instruments?.find((instrument) => instrument.studentInstrumentId === "si-piano-2")?.progress).toBe("체르니 50");
  });

  it("기본 정보의 연락처는 첫 연락처만 바꾸고 id와 다른 연락처는 그대로 둔다", () => {
    const withContacts: StudentListRow = {
      ...student,
      contacts: [
        { contactId: "c-1", relationship: "어머니", phone: "010-1111-2222", phoneLast4: "2222" },
        { contactId: "c-2", relationship: "아버지", phone: "010-3333-4444", phoneLast4: "4444" },
      ],
    };

    const merged = applyStudentEnrollmentSave(withContacts, {
      ...buildInput([]),
      basicInfo: { registeredOn: "2026-03-01", contactRelationship: "할머니", contactPhone: "010-9999-8888" },
    });

    expect(merged.contacts).toEqual([
      { contactId: "c-1", relationship: "할머니", phone: "010-9999-8888", phoneLast4: "8888" },
      { contactId: "c-2", relationship: "아버지", phone: "010-3333-4444", phoneLast4: "4444" },
    ]);
  });

  it("두 번째 연락처를 모두 비우면 삭제하고, 다시 입력하면 기존 id를 유지한다", () => {
    const withContacts: StudentListRow = {
      ...student,
      contacts: [
        { contactId: "c-1", relationship: "모", phone: "010-1111-2222" },
        { contactId: "c-2", relationship: "부", phone: "010-3333-4444" },
      ],
    };
    const basicInfo = {
      registeredOn: "2026-03-01",
      contactRelationship: "모",
      contactPhone: "010-1111-2222",
      secondaryContactRelationship: "",
      secondaryContactPhone: "",
    };

    expect(applyStudentEnrollmentSave(withContacts, { ...buildInput([]), basicInfo }).contacts).toHaveLength(1);
    const updated = applyStudentEnrollmentSave(withContacts, {
      ...buildInput([]),
      basicInfo: {
        ...basicInfo,
        secondaryContactRelationship: "조모",
        secondaryContactPhone: "010-5555-6666",
      },
    });
    expect(updated.contacts?.[1]).toEqual({
      contactId: "c-2", relationship: "조모", phone: "010-5555-6666", phoneLast4: "6666",
    });
  });

  it("악기 변경이 없으면 이름만 바꾸고 악기는 그대로 둔다", () => {
    const merged = applyStudentEnrollmentSave(student, { ...buildInput([]), name: "김민지B" });

    expect(merged.name).toBe("김민지B");
    expect(merged.instruments).toEqual([piano, violin]);
    expect(merged.instrumentNames).toEqual(["피아노", "바이올린"]);
  });
});

describe("수강 변경 검증 보조", () => {
  it("같은 악기·수업 형태로 수강 중인 악기를 찾는다", () => {
    expect(findActiveEnrollmentConflict([piano, violin], { instrumentId: "piano", lessonType: "academy" })).toBe(piano);
    expect(findActiveEnrollmentConflict([piano, violin], { instrumentId: "piano", lessonType: "private" })).toBeUndefined();
    expect(
      findActiveEnrollmentConflict([{ ...piano, active: false }], { instrumentId: "piano", lessonType: "academy" }),
    ).toBeUndefined();
  });

  it("활성 악기가 둘 이상일 때만 종료할 수 있다", () => {
    expect(canEndStudentInstrument([piano, violin])).toBe(true);
    expect(canEndStudentInstrument([piano])).toBe(false);
    expect(canEndStudentInstrument([piano, { ...violin, active: false }])).toBe(false);
    expect(LAST_INSTRUMENT_END_MESSAGE).toBe(
      "수강 중인 악기는 최소 1개 있어야 합니다. 모두 종료하려면 휴원·퇴원 처리를 해 주세요.",
    );
  });

  it("종료 뒤 남은 정기 외 예정 일정 건수를 안내한다", () => {
    expect(getRemainingEventNotice({ addedStudentInstrumentIds: [], ended: [] })).toBeNull();
    expect(
      getRemainingEventNotice({
        addedStudentInstrumentIds: [],
        ended: [
          { studentInstrumentId: "a", remainingEventCount: 2 },
          { studentInstrumentId: "b", remainingEventCount: 1 },
        ],
      }),
    ).toBe(
      "종료한 수강에 정기 외 예정 일정 3건이 남아 있습니다. 이동·보강·개인레슨 일정은 레슨 시간표에서 확인해 정리해 주세요.",
    );
  });

  it("원생명이 비면 거부한다", () => {
    expect(getStudentEnrollmentValidationError({ ...buildInput([]), name: "  " })).toBe("원생명은 필수입니다.");
  });

  it("학원 수업은 선생님과 모든 요일의 시간이 있어야 한다", () => {
    expect(
      getStudentEnrollmentValidationError(
        buildInput([{ ...cello, action: "add", startedOn: "2026-10-20", teacherId: null }]),
      ),
    ).toBe("학원레슨 선생님을 선택해야 합니다.");
  });

  it("30분 또는 직접 입력 개인레슨은 금액을 직접 입력해야 저장된다", () => {
    const change = { ...cello, action: "add" as const, startedOn: "2026-10-20",
      lessonType: "private" as const, sessionsPerMonth: 4, lessonDurationMinutes: 30,
      weeklySchedules: [{ weekdayLabel: "금", startTime: "17:00", endTime: "17:30" }],
      lessonFee: 0, finalMonthlyFee: 0 };
    expect(getStudentEnrollmentValidationError(buildInput([change]))).toBe("수업 시간에 맞는 레슨비를 직접 입력해 주세요.");
    expect(getStudentEnrollmentValidationError(buildInput([{ ...change, lessonFee: 100000,
      finalMonthlyFee: 100000 }]))).toBeNull();
  });

  it("추가하는 수강은 악기와 시작일이 필요하고 같은 조합을 두 번 추가할 수 없다", () => {
    expect(
      getStudentEnrollmentValidationError(
        buildInput([{ ...cello, action: "add", startedOn: "2026-10-20", instrumentId: "", instrumentName: "" }]),
      ),
    ).toBe("악기를 선택해 주세요.");
    expect(
      getStudentEnrollmentValidationError(buildInput([{ ...cello, action: "add", startedOn: "" }])),
    ).toBe("수강 시작일을 입력해 주세요.");
    expect(
      getStudentEnrollmentValidationError(
        buildInput([
          { ...cello, action: "add", startedOn: "2026-10-20" },
          { ...cello, action: "add", startedOn: "2026-10-21" },
        ]),
      ),
    ).toBe("같은 악기와 수업 형태를 두 번 추가할 수 없습니다.");
  });

  it("문제가 없으면 null을 돌려준다", () => {
    expect(
      getStudentEnrollmentValidationError(
        buildInput([{ ...cello, action: "add", startedOn: "2026-10-20" }, { action: "end", studentInstrumentId: "si-violin" }]),
      ),
    ).toBeNull();
  });
});

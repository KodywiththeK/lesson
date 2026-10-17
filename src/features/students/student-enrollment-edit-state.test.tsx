import { describe, expect, it } from "vitest";

import type { StudentListInstrument, StudentListRow } from "@/domain/student-list";
import type { TeacherListRow } from "@/domain/teacher-list";

import {
  buildEnrollmentChanges,
  canEndInstrument,
  canRemoveAdded,
  createEnrollmentEdits,
  enrollmentEditsReducer,
  getAddableInstruments,
  getAddedInstrumentLabels,
  getAvailableLessonTypes,
  getBlockedSectionLabels,
  getEffectiveEnrollmentKeys,
  getLessonTypeChoices,
  type EnrollmentEdits,
} from "./student-enrollment-edit-state";
import { instrumentOptions } from "./student-form-options";

const teachers = [
  { teacherId: "teacher-1", name: "박선생", part: "피아노" },
  { teacherId: "teacher-2", name: "최선생", part: "바이올린" },
  { teacherId: "teacher-4", name: "윤선생", part: "바이올린" },
  { teacherId: "teacher-5", name: "강선생", part: "첼로" },
].map((teacher) => ({
  academyId: "academy-1",
  contact: "010-0000-0000",
  registeredAt: "2026-08-01",
  payType: "monthly" as const,
  ...teacher,
})) satisfies TeacherListRow[];

const piano: StudentListInstrument = {
  studentInstrumentId: "si-piano",
  teacherId: "teacher-1",
  teacherName: "박선생",
  instrumentId: "piano",
  instrumentName: "피아노",
  lessonType: "academy",
  weekdayLabels: ["월", "수"],
  startTime: "15:00",
  endTime: "15:50",
  progress: "체르니 100",
  lessonFee: 150000,
  discountTotal: 0,
  finalMonthlyFee: 150000,
  active: true,
  weeklySchedules: [
    { weekday: "monday", weekdayLabel: "월", startTime: "15:00", endTime: "15:50" },
    { weekday: "wednesday", weekdayLabel: "수", startTime: "15:00", endTime: "15:50" },
  ],
};

const violin: StudentListInstrument = {
  ...piano,
  studentInstrumentId: "si-violin",
  teacherId: "teacher-2",
  teacherName: "최선생",
  instrumentId: "violin",
  instrumentName: "바이올린",
  lessonType: "private",
  weekdayLabels: ["화"],
  startTime: "17:00",
  endTime: "17:40",
  progress: "자유곡",
  lessonFee: 200000,
  finalMonthlyFee: 200000,
  weeklySchedules: [
    { weekday: "tuesday", weekdayLabel: "화", startTime: "17:00", endTime: "17:40" },
  ],
};

function studentWith(instruments: StudentListInstrument[]): StudentListRow {
  return {
    academyId: "academy-1",
    studentId: "student-9",
    name: "한소희",
    registeredOn: "2026-08-01",
    teacherNames: [],
    instrumentNames: [],
    weekdayLabels: [],
    instruments,
  };
}

const cello = instrumentOptions.find((option) => option.id === "cello")!;
const flute = instrumentOptions.find((option) => option.id === "flute")!;
const pianoOption = instrumentOptions.find((option) => option.id === "piano")!;

function reduce(edits: EnrollmentEdits, ...actions: Parameters<typeof enrollmentEditsReducer>[1][]) {
  return actions.reduce(enrollmentEditsReducer, edits);
}

describe("createEnrollmentEdits", () => {
  it("활성 악기마다 studentInstrumentId를 키로 초안을 만들고 종료·추가는 비워 둔다", () => {
    const edits = createEnrollmentEdits(studentWith([piano, violin]));

    expect(Object.keys(edits.drafts)).toEqual(["si-piano", "si-violin"]);
    expect(edits.drafts["si-violin"]).toMatchObject({ teacherId: "teacher-2", lessonType: "private" });
    expect(edits.endedIds).toEqual([]);
    expect(edits.added).toEqual([]);
  });
});

describe("수강 종료 예정", () => {
  const twoInstruments = () => createEnrollmentEdits(studentWith([piano, violin]));

  it("활성 악기가 둘이면 하나를 종료 예정으로 표시하고 입력한 초안은 남겨 되돌릴 수 있다", () => {
    const edited = reduce(twoInstruments(), {
      type: "updateInstrument",
      studentInstrumentId: "si-violin",
      draft: { ...twoInstruments().drafts["si-violin"], teacherId: "teacher-4" },
    });
    const ended = reduce(edited, { type: "endInstrument", studentInstrumentId: "si-violin" });

    expect(ended.endedIds).toEqual(["si-violin"]);
    expect(ended.drafts["si-violin"].teacherId).toBe("teacher-4");

    const restored = reduce(ended, { type: "restoreInstrument", studentInstrumentId: "si-violin" });

    expect(restored.endedIds).toEqual([]);
    expect(restored.drafts["si-violin"].teacherId).toBe("teacher-4");
  });

  it("남는 활성 악기가 하나뿐이면 종료 예정으로 바꾸지 않는다", () => {
    const oneEnded = reduce(twoInstruments(), { type: "endInstrument", studentInstrumentId: "si-violin" });

    expect(canEndInstrument(oneEnded, "si-piano")).toBe(false);
    expect(
      reduce(oneEnded, { type: "endInstrument", studentInstrumentId: "si-piano" }).endedIds,
    ).toEqual(["si-violin"]);
    expect(canEndInstrument(createEnrollmentEdits(studentWith([piano])), "si-piano")).toBe(false);
  });

  it("새로 추가한 악기가 있으면 기존 악기를 모두 종료 예정으로 바꿀 수 있다", () => {
    const withAdded = reduce(createEnrollmentEdits(studentWith([violin])), {
      type: "addInstrument",
      instrument: cello,
      teachers,
      startedOn: "2026-10-17",
    });

    expect(canEndInstrument(withAdded, "si-violin")).toBe(true);
    expect(
      reduce(withAdded, { type: "endInstrument", studentInstrumentId: "si-violin" }).endedIds,
    ).toEqual(["si-violin"]);
  });

  it("기존 악기를 모두 종료 예정으로 표시했다면 추가한 마지막 악기는 지울 수 없고, 되돌리면 지울 수 있다", () => {
    const withAdded = reduce(createEnrollmentEdits(studentWith([violin])), {
      type: "addInstrument",
      instrument: cello,
      teachers,
      startedOn: "2026-10-17",
    });
    const [added] = withAdded.added;
    const ended = reduce(withAdded, { type: "endInstrument", studentInstrumentId: "si-violin" });

    expect(canRemoveAdded(withAdded, added.key)).toBe(true);
    expect(canRemoveAdded(ended, added.key)).toBe(false);
    expect(reduce(ended, { type: "removeAdded", key: added.key }).added).toHaveLength(1);

    const restored = reduce(ended, { type: "restoreInstrument", studentInstrumentId: "si-violin" });

    expect(reduce(restored, { type: "removeAdded", key: added.key }).added).toEqual([]);
  });

  it("수강을 끝낸(비활성) 악기는 종료할 수 없다", () => {
    const edits = createEnrollmentEdits(
      studentWith([{ ...piano, active: false }]),
    );

    expect(canEndInstrument(edits, "si-piano")).toBe(false);
  });
});

describe("악기 추가", () => {
  it("이미 수강 중인 악기·수업 형태는 고를 수 없고 피아노는 남은 수업 형태만 고를 수 있다", () => {
    const edits = createEnrollmentEdits(studentWith([piano, violin]));

    expect(getAvailableLessonTypes(edits, pianoOption)).toEqual(["private"]);
    expect(getAvailableLessonTypes(edits, instrumentOptions.find((o) => o.id === "violin")!)).toEqual([]);
    expect(getAddableInstruments(edits).map((option) => option.name)).toEqual(["피아노", "첼로", "플루트"]);
  });

  it("종료 예정으로 표시한 악기·수업 형태도 저장 전까지는 수강 중으로 보고 고를 수 없다", () => {
    const edits = reduce(createEnrollmentEdits(studentWith([piano, violin])), {
      type: "endInstrument",
      studentInstrumentId: "si-violin",
    });

    expect(getAddableInstruments(edits).map((option) => option.name)).not.toContain("바이올린");
  });

  it("추가하면 사용할 수 있는 첫 수업 형태로 초안과 오늘 시작일을 만든다", () => {
    const edits = reduce(createEnrollmentEdits(studentWith([piano])), {
      type: "addInstrument",
      instrument: pianoOption,
      teachers,
      startedOn: "2026-10-17",
    });

    expect(edits.added).toHaveLength(1);
    expect(edits.added[0]).toMatchObject({
      startedOn: "2026-10-17",
      draft: { instrumentId: "piano", lessonType: "private", teacherId: "teacher-1" },
    });
  });

  it("같은 악기를 두 번 추가하면 남은 수업 형태만 쓰고, 더 고를 형태가 없으면 추가하지 않는다", () => {
    const first = reduce(createEnrollmentEdits(studentWith([violin])), {
      type: "addInstrument",
      instrument: pianoOption,
      teachers,
      startedOn: "2026-10-17",
    });
    const second = reduce(first, {
      type: "addInstrument",
      instrument: pianoOption,
      teachers,
      startedOn: "2026-10-17",
    });
    const third = reduce(second, {
      type: "addInstrument",
      instrument: pianoOption,
      teachers,
      startedOn: "2026-10-17",
    });

    expect(second.added.map((added) => added.draft.lessonType)).toEqual(["academy", "private"]);
    expect(third.added).toHaveLength(2);
    expect(getAvailableLessonTypes(second, pianoOption, second.added[0].key)).toEqual(["academy"]);
  });

  it("추가한 섹션은 수정하고 저장 전에 지울 수 있고 키는 겹치지 않는다", () => {
    const added = reduce(
      createEnrollmentEdits(studentWith([violin])),
      { type: "addInstrument", instrument: cello, teachers, startedOn: "2026-10-17" },
      { type: "addInstrument", instrument: flute, teachers, startedOn: "2026-10-17" },
    );
    const [firstKey, secondKey] = added.added.map((item) => item.key);

    expect(firstKey).not.toBe(secondKey);

    const edited = reduce(added, { type: "updateAdded", key: firstKey, patch: { startedOn: "2026-11-01" } });

    expect(edited.added[0].startedOn).toBe("2026-11-01");
    expect(edited.added[1].startedOn).toBe("2026-10-17");

    const removed = reduce(edited, { type: "removeAdded", key: firstKey });
    const readded = reduce(removed, {
      type: "addInstrument",
      instrument: cello,
      teachers,
      startedOn: "2026-10-17",
    });

    expect(removed.added.map((item) => item.key)).toEqual([secondKey]);
    expect(readded.added.map((item) => item.key)).not.toContain(firstKey);
  });

  it("같은 이름의 추가 악기는 수업 형태를 덧붙여 구분한다", () => {
    const edits = reduce(
      createEnrollmentEdits(studentWith([violin])),
      { type: "addInstrument", instrument: pianoOption, teachers, startedOn: "2026-10-17" },
      { type: "addInstrument", instrument: pianoOption, teachers, startedOn: "2026-10-17" },
      { type: "addInstrument", instrument: cello, teachers, startedOn: "2026-10-17" },
    );

    expect(getAddedInstrumentLabels(edits.added)).toEqual([
      "새 피아노(학원레슨)",
      "새 피아노(개인레슨)",
      "새 첼로",
    ]);
  });
});

const pianoPrivate: StudentListInstrument = {
  ...piano,
  studentInstrumentId: "si-piano-private",
  lessonType: "private",
};

function changeLessonType(
  edits: EnrollmentEdits,
  studentInstrumentId: string,
  lessonType: "academy" | "private",
) {
  return reduce(edits, {
    type: "updateInstrument",
    studentInstrumentId,
    draft: { ...edits.drafts[studentInstrumentId], lessonType },
  });
}

describe("수업 형태 충돌 사전 차단", () => {
  it("저장 후 모습의 (악기, 수업 형태)를 모은다: 기존 수강은 현재 초안 형태, 종료 예정은 저장된 형태, 추가 섹션 포함", () => {
    const base = createEnrollmentEdits(studentWith([piano, violin]));
    const edited = reduce(
      changeLessonType(base, "si-piano", "private"),
      { type: "endInstrument", studentInstrumentId: "si-violin" },
      { type: "addInstrument", instrument: cello, teachers, startedOn: "2026-10-17" },
    );
    const edited2 = changeLessonType(edited, "si-violin", "academy");

    expect(
      getEffectiveEnrollmentKeys(edited2).map(({ instrumentId, lessonType }) => [instrumentId, lessonType]),
    ).toEqual([
      ["piano", "private"],
      ["violin", "private"],
      ["cello", "private"],
    ]);
  });

  it("종료한(비활성) 수강은 충돌 대상이 아니다", () => {
    const edits = createEnrollmentEdits(studentWith([piano, { ...pianoPrivate, active: false }]));

    expect(getEffectiveEnrollmentKeys(edits)).toHaveLength(1);
    expect(getAvailableLessonTypes(edits, pianoOption)).toEqual(["private"]);
  });

  it("비피아노 악기는 개인레슨만 고르고, 저장된 현재 값이 학원레슨이면 그 값도 유지한다", () => {
    const privateViolin = createEnrollmentEdits(studentWith([violin]));
    const legacyViolin = createEnrollmentEdits(studentWith([{ ...violin, lessonType: "academy" }]));

    expect(getLessonTypeChoices(privateViolin, "si-violin")).toEqual([{ lessonType: "private" }]);
    expect(getLessonTypeChoices(legacyViolin, "si-violin")).toEqual([
      { lessonType: "academy" },
      { lessonType: "private" },
    ]);
  });

  it("피아노를 학원레슨과 개인레슨으로 함께 수강 중이면 서로의 형태를 막고 이유를 알려 준다", () => {
    const edits = createEnrollmentEdits(studentWith([piano, pianoPrivate]));

    expect(getLessonTypeChoices(edits, "si-piano")).toEqual([
      { lessonType: "academy" },
      {
        lessonType: "private",
        disabledReason: "이미 같은 악기를 개인레슨으로 수강 중이라 선택할 수 없습니다.",
      },
    ]);
    expect(getLessonTypeChoices(edits, "si-piano-private")).toEqual([
      {
        lessonType: "academy",
        disabledReason: "이미 같은 악기를 학원레슨으로 수강 중이라 선택할 수 없습니다.",
      },
      { lessonType: "private" },
    ]);
  });

  it("다른 악기의 형태는 막지 않는다", () => {
    const edits = createEnrollmentEdits(studentWith([piano, violin]));

    expect(getLessonTypeChoices(edits, "si-piano")).toEqual([
      { lessonType: "academy" },
      { lessonType: "private" },
    ]);
  });

  it("기존 수강이 수업 형태를 바꾸면 같은 조합이 추가 선택지에서 빠지고 바뀐 형태는 다시 열린다", () => {
    const base = createEnrollmentEdits(studentWith([piano]));
    const changed = changeLessonType(base, "si-piano", "private");

    expect(getAvailableLessonTypes(base, pianoOption)).toEqual(["private"]);
    expect(getAvailableLessonTypes(changed, pianoOption)).toEqual(["academy"]);
  });

  it("추가 섹션이 쓰는 조합은 기존 섹션이 고를 수 없다", () => {
    const withAdded = reduce(createEnrollmentEdits(studentWith([piano])), {
      type: "addInstrument",
      instrument: pianoOption,
      teachers,
      startedOn: "2026-10-17",
    });

    expect(withAdded.added[0].draft.lessonType).toBe("private");
    expect(getLessonTypeChoices(withAdded, "si-piano")).toEqual([
      { lessonType: "academy" },
      {
        lessonType: "private",
        disabledReason: "이미 같은 악기를 개인레슨으로 수강 중이라 선택할 수 없습니다.",
      },
    ]);
  });

  it("종료 예정 수강의 조합은 저장 전까지 계속 막힌다", () => {
    const edits = reduce(createEnrollmentEdits(studentWith([piano, pianoPrivate])), {
      type: "endInstrument",
      studentInstrumentId: "si-piano-private",
    });

    expect(getLessonTypeChoices(edits, "si-piano")).toEqual([
      { lessonType: "academy" },
      {
        lessonType: "private",
        disabledReason: "이미 같은 악기를 개인레슨으로 수강 중이라 선택할 수 없습니다.",
      },
    ]);
    expect(getAvailableLessonTypes(edits, pianoOption)).toEqual([]);
  });

  it("충돌이 없는 수정은 저장 변경이 달라지지 않는다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const edited = reduce(initial, {
      type: "updateInstrument",
      studentInstrumentId: "si-violin",
      draft: { ...initial.drafts["si-violin"], teacherId: "teacher-4" },
    });

    expect(getLessonTypeChoices(edited, "si-violin")).toEqual([{ lessonType: "private" }]);
    expect(
      buildEnrollmentChanges({
        initial,
        edits: edited,
        teachers,
        referenceMonth: "2026-08",
        initialReferenceMonth: "2026-08",
      }),
    ).toEqual([expect.objectContaining({ action: "update", studentInstrumentId: "si-violin", lessonType: "private" })]);
  });
});

describe("buildEnrollmentChanges", () => {
  const referenceMonth = "2026-08";

  function build(initial: EnrollmentEdits, edits: EnrollmentEdits) {
    return buildEnrollmentChanges({
      initial,
      edits,
      teachers,
      referenceMonth,
      initialReferenceMonth: referenceMonth,
    });
  }

  it("바꾼 것이 없으면 변경도 없다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));

    expect(build(initial, initial)).toEqual([]);
  });

  it("바꾼 악기만 update로 보내고 요일은 요일 이름과 순서로 정리한다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const edited = reduce(initial, {
      type: "updateInstrument",
      studentInstrumentId: "si-violin",
      draft: {
        ...initial.drafts["si-violin"],
        teacherId: "teacher-4",
        schedules: [
          { weekday: "thursday", startTime: "18:00", endTime: "18:40" },
          ...initial.drafts["si-violin"].schedules,
        ],
      },
    });

    expect(build(initial, edited)).toEqual([
      expect.objectContaining({
        action: "update",
        studentInstrumentId: "si-violin",
        teacherId: "teacher-4",
        teacherName: "윤선생",
        instrumentId: "violin",
        instrumentName: "바이올린",
        lessonType: "private",
        weeklySchedules: [
          { weekdayLabel: "화", startTime: "17:00", endTime: "17:40" },
          { weekdayLabel: "목", startTime: "18:00", endTime: "18:40" },
        ],
        progress: "자유곡",
        lessonFee: 200000,
        finalMonthlyFee: 200000,
      }),
    ]);
  });

  it("고쳤다가 원래대로 되돌린 악기는 보내지 않는다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const original = initial.drafts["si-piano"];
    const toggled = reduce(
      initial,
      { type: "updateInstrument", studentInstrumentId: "si-piano", draft: { ...original, teacherId: "" } },
      { type: "updateInstrument", studentInstrumentId: "si-piano", draft: original },
    );

    expect(build(initial, toggled)).toEqual([]);
  });

  it("새 악기는 시작일과 함께 add로 보내고 담당 선생님은 악기 파트의 유일한 선생님으로 정한다", () => {
    const initial = createEnrollmentEdits(studentWith([piano]));
    const withCello = reduce(initial, {
      type: "addInstrument",
      instrument: cello,
      teachers,
      startedOn: "2026-10-17",
    });
    const [added] = withCello.added;
    const filled = reduce(withCello, {
      type: "updateAdded",
      key: added.key,
      patch: {
        draft: {
          ...added.draft,
          weeklySchedules: [
            { weekday: "friday", startTime: "16:00", endTime: "16:40" },
            { weekday: "tuesday", startTime: "17:00", endTime: "17:40" },
          ],
          fee: { ...added.draft.fee, lessonFee: 180000, feeSource: "manual" },
        },
      },
    });

    expect(build(initial, filled)).toEqual([
      expect.objectContaining({
        action: "add",
        startedOn: "2026-10-17",
        instrumentId: "cello",
        instrumentName: "첼로",
        teacherId: "teacher-5",
        teacherName: "강선생",
        lessonType: "private",
        weeklySchedules: [
          { weekdayLabel: "화", startTime: "17:00", endTime: "17:40" },
          { weekdayLabel: "금", startTime: "16:00", endTime: "16:40" },
        ],
        lessonFee: 180000,
        finalMonthlyFee: 180000,
        progress: expect.any(String),
      }),
    ]);
  });

  it("종료 예정 악기는 end만 보내고 고친 내용은 보내지 않으며 순서는 update, add, end다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const edited = reduce(
      initial,
      {
        type: "updateInstrument",
        studentInstrumentId: "si-violin",
        draft: { ...initial.drafts["si-violin"], teacherId: "teacher-4" },
      },
      {
        type: "updateInstrument",
        studentInstrumentId: "si-piano",
        draft: { ...initial.drafts["si-piano"], teacherId: "" },
      },
      { type: "addInstrument", instrument: cello, teachers, startedOn: "2026-10-17" },
      { type: "endInstrument", studentInstrumentId: "si-violin" },
    );

    expect(build(initial, edited).map((change) => [change.action, "studentInstrumentId" in change ? change.studentInstrumentId : "new"])).toEqual([
      ["update", "si-piano"],
      ["add", "new"],
      ["end", "si-violin"],
    ]);
  });

  it("등록일을 바꿔 기준 달이 달라지면 지인 소개 할인이 있는 악기만 달라진 값으로 보낸다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const referral = reduce(initial, {
      type: "updateInstrument",
      studentInstrumentId: "si-violin",
      draft: {
        ...initial.drafts["si-violin"],
        fee: { ...initial.drafts["si-violin"].fee, discountKinds: ["referral"] },
      },
    });
    const changes = buildEnrollmentChanges({
      initial,
      edits: referral,
      teachers,
      referenceMonth: "2026-09",
      initialReferenceMonth: referenceMonth,
    });

    expect(changes).toEqual([
      expect.objectContaining({
        action: "update",
        studentInstrumentId: "si-violin",
        referralDiscountMonth: "2026-09",
      }),
    ]);
  });
});

describe("getBlockedSectionLabels", () => {
  it("저장을 막는 섹션의 이름을 알리고 종료 예정 섹션은 검사하지 않는다", () => {
    const initial = createEnrollmentEdits(studentWith([piano, violin]));
    const edited = reduce(
      initial,
      {
        type: "updateInstrument",
        studentInstrumentId: "si-piano",
        draft: {
          ...initial.drafts["si-piano"],
          schedules: [...initial.drafts["si-piano"].schedules, { weekday: "thursday" }],
        },
      },
      { type: "addInstrument", instrument: cello, teachers, startedOn: "2026-10-17" },
    );

    expect(getBlockedSectionLabels(edited, teachers, "2026-08")).toEqual(["피아노", "새 첼로"]);

    const withPianoEnded = reduce(edited, { type: "endInstrument", studentInstrumentId: "si-piano" });

    expect(getBlockedSectionLabels(withPianoEnded, teachers, "2026-08")).toEqual(["새 첼로"]);
  });

  it("추가한 악기는 요일과 레슨비, 시작일이 있어야 저장할 수 있다", () => {
    const withCello = reduce(createEnrollmentEdits(studentWith([piano])), {
      type: "addInstrument",
      instrument: cello,
      teachers,
      startedOn: "",
    });
    const [added] = withCello.added;
    const ready = reduce(withCello, {
      type: "updateAdded",
      key: added.key,
      patch: {
        startedOn: "2026-10-17",
        draft: {
          ...added.draft,
          weeklySchedules: [{ weekday: "monday", startTime: "16:00", endTime: "16:40" }],
          fee: { ...added.draft.fee, lessonFee: 180000, feeSource: "manual" },
        },
      },
    });

    expect(getBlockedSectionLabels(withCello, teachers, "2026-08")).toEqual(["새 첼로"]);
    expect(getBlockedSectionLabels(ready, teachers, "2026-08")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import {
  toDailyAcademyAttendanceSheet,
  type DailyAcademyAttendanceRow,
} from "./academy-lesson-attendance";
import {
  countAttendeesByDate,
  indexSheets,
  passAbsenceOfDeletedMakeup,
  removeAcademyAttendanceRow,
  resetAttendanceSheets,
  resolveAbsenceInSheets,
  updateAttendanceSheets,
} from "./academy-lesson-sheets";

function buildRow(
  overrides: Partial<DailyAcademyAttendanceRow> & Pick<DailyAcademyAttendanceRow, "lessonEventId">,
): DailyAcademyAttendanceRow {
  return {
    academyId: "academy-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-12",
    startTime: "15:00",
    endTime: "15:50",
    status: "pending",
    origin: "regular",
    originLabel: "정기",
    ...overrides,
  };
}

function buildSheets(rows: DailyAcademyAttendanceRow[]) {
  const dates = [...new Set(rows.map((row) => row.date))];

  return indexSheets(
    dates.map((date) =>
      toDailyAcademyAttendanceSheet(
        "academy-1",
        date,
        rows.filter((row) => row.date === date),
      ),
    ),
  );
}

describe("updateAttendanceSheets / resetAttendanceSheets", () => {
  it("선택한 수업의 출결만 바꾸고 초기화하면 처리 기록을 모두 지운다", () => {
    const sheets = buildSheets([
      buildRow({ lessonEventId: "a" }),
      buildRow({ lessonEventId: "b", studentId: "student-2", studentName: "이서윤" }),
    ]);

    const marked = updateAttendanceSheets(sheets, "academy-1", [
      { lessonEventId: "a", studentId: "student-1", status: "absent", reason: "감기", markedAt: "t" },
    ]);

    expect(marked["2026-08-12"].rows.map((row) => row.status)).toEqual(["absent", "pending"]);
    expect(marked["2026-08-12"].rows[0].absenceReason).toBe("감기");

    const reset = resetAttendanceSheets(marked, "academy-1", [
      { lessonEventId: "a", studentId: "student-1" },
    ]);

    expect(reset["2026-08-12"].rows[0]).toMatchObject({ status: "pending" });
    expect(reset["2026-08-12"].rows[0].absenceReason).toBeUndefined();
    expect(reset["2026-08-12"].summary.pending).toBe(2);
  });
});

describe("resolveAbsenceInSheets", () => {
  const absentRow = buildRow({
    lessonEventId: "absent-1",
    status: "absent",
    absenceReason: "결석 확인",
  });

  it("패스로 처리하면 결석 행에 처리 결과를 남기고 결석 대기열에서 뺀다", () => {
    const sheets = resolveAbsenceInSheets(buildSheets([absentRow]), "academy-1", {
      lessonEventId: "absent-1",
      resolution: "pass",
      reason: "보호자 요청",
    });

    expect(sheets["2026-08-12"].rows[0]).toMatchObject({
      status: "absent",
      absenceResolution: "pass",
      absenceReason: "보호자 요청",
    });
    expect(sheets["2026-08-12"].absenceQueue).toEqual([]);
  });

  it("사유를 비우면 기존 결석 기록을 그대로 둔다", () => {
    const sheets = resolveAbsenceInSheets(buildSheets([absentRow]), "academy-1", {
      lessonEventId: "absent-1",
      resolution: "pass",
    });

    expect(sheets["2026-08-12"].rows[0].absenceReason).toBe("결석 확인");
  });

  it("보강으로 처리하면 보강일에 보강 수업 일정이 생기고 원본은 결석 기록으로 남는다", () => {
    const makeupRow = buildRow({
      lessonEventId: "makeup-1",
      date: "2026-08-14",
      status: "pending",
      origin: "makeup",
      originLabel: "보강 수업",
    });
    const sheets = resolveAbsenceInSheets(buildSheets([absentRow]), "academy-1", {
      lessonEventId: "absent-1",
      resolution: "makeup",
      makeupRow,
    });

    expect(sheets["2026-08-14"].rows).toEqual([makeupRow]);
    expect(sheets["2026-08-12"].rows[0]).toMatchObject({
      status: "absent",
      absenceResolution: "makeup",
    });
  });

  it("없는 수업을 처리하려 하면 오류로 알린다", () => {
    expect(() =>
      resolveAbsenceInSheets(buildSheets([absentRow]), "academy-1", {
        lessonEventId: "missing",
        resolution: "pass",
      }),
    ).toThrow("결석 처리할 수업을 찾을 수 없습니다.");
  });
});

describe("removeAcademyAttendanceRow", () => {
  it("삭제한 일정만 시간표에서 빼고 같은 날 다른 일정은 남긴다", () => {
    const sheets = removeAcademyAttendanceRow(
      buildSheets([
        buildRow({ lessonEventId: "a" }),
        buildRow({ lessonEventId: "b", studentId: "student-2" }),
      ]),
      "academy-1",
      "a",
    );

    expect(sheets["2026-08-12"].rows.map((row) => row.lessonEventId)).toEqual(["b"]);
    expect(sheets["2026-08-12"].summary.total).toBe(1);
  });
});

describe("countAttendeesByDate", () => {
  it("날짜별 등원 인원을 원생 기준으로 센다", () => {
    const rows = [
      buildRow({ lessonEventId: "a" }),
      buildRow({ lessonEventId: "b", studentId: "student-1", startTime: "17:00" }),
      buildRow({ lessonEventId: "c", studentId: "student-2" }),
      buildRow({ lessonEventId: "d", studentId: "student-3", date: "2026-08-13" }),
    ];

    expect(countAttendeesByDate(rows)).toEqual({ "2026-08-12": 2, "2026-08-13": 1 });
  });
});

describe("passAbsenceOfDeletedMakeup", () => {
  const absent = buildRow({ lessonEventId: "absent-1", status: "absent", absenceResolution: "makeup" });
  const makeup = buildRow({
    lessonEventId: "makeup-1",
    date: "2026-08-24",
    origin: "makeup",
    sourceLessonEventId: "absent-1",
  });

  it("보강 일정을 지우면 연결된 결석을 보강 없는 패스 처리로 바꾼다", () => {
    const sheets = passAbsenceOfDeletedMakeup(buildSheets([absent, makeup]), "academy-1", makeup);

    expect(sheets["2026-08-12"].rows[0]).toMatchObject({ status: "absent", absenceResolution: "pass" });
    expect(sheets["2026-08-12"].absenceQueue).toEqual([]);
  });

  it("보강 일정이 아니거나 연결된 결석을 모르면 그대로 둔다", () => {
    const regular = buildRow({ lessonEventId: "regular-1", date: "2026-08-24" });
    const unlinked = { ...makeup, sourceLessonEventId: undefined };
    const original = buildSheets([absent, makeup]);

    expect(passAbsenceOfDeletedMakeup(original, "academy-1", regular)).toBe(original);
    expect(passAbsenceOfDeletedMakeup(original, "academy-1", unlinked)).toBe(original);
  });
});

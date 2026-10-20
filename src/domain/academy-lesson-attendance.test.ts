import { describe, expect, it } from "vitest";

import {
  buildDailyAcademyAttendance,
  checkAcademyLessonEditable,
  checkAcademyLessonMoveTarget,
  findUnresolvedAbsences,
  formatAbsenceReason,
  formatAcademyLessonOriginLabel,
  markAllAcademyLessonAttendance,
  markStudentAcademyLessonAttendance,
  removeResolvedAbsenceFromQueue,
  type DailyAcademyAttendanceRow,
} from "./academy-lesson-attendance";
import type { AcademyLessonEvent } from "./academy-lesson-schedule";

const events: AcademyLessonEvent[] = [
  {
    id: "lesson-2",
    academyId: "academy-1",
    enrollmentId: "enrollment-2",
    studentId: "student-2",
    studentName: "이서윤",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "16:00",
    endTime: "16:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-1",
    academyId: "academy-1",
    enrollmentId: "enrollment-1",
    studentId: "student-1",
    studentName: "김민지",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-other-date",
    academyId: "academy-1",
    studentId: "student-3",
    studentName: "박하준",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-21",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
  {
    id: "lesson-other-academy",
    academyId: "academy-2",
    studentId: "student-4",
    studentName: "최민준",
    instrumentId: "piano",
    instrumentName: "피아노",
    date: "2026-08-20",
    startTime: "15:00",
    endTime: "15:50",
    generatedFromEnrollment: true,
  },
];

describe("buildDailyAcademyAttendance", () => {
  it("시간 미정 수업도 실제 시각 입력 없이 출석 처리한다", () => {
    const sheet = buildDailyAcademyAttendance([{
      ...events[0],
      startTime: "",
      endTime: "",
      timeUnspecified: true,
    }], { academyId: "academy-1", date: "2026-08-20" });
    expect(sheet.rows[0].timeUnspecified).toBe(true);

    const checked = markStudentAcademyLessonAttendance(sheet, {
      lessonEventId: "lesson-2",
      status: "present",
      markedAt: "2026-08-20T17:00:00+09:00",
    });
    expect(checked.rows[0]).toMatchObject({ status: "present", timeUnspecified: true });
  });

  it("선택한 날짜의 예상 출석 원생을 시간과 이름 순서로 보여준다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    expect(sheet.rows.map((row) => row.studentName)).toEqual(["김민지", "이서윤"]);
    expect(sheet.rows.every((row) => row.status === "pending")).toBe(true);
    expect(sheet.summary).toEqual({
      total: 2,
      present: 0,
      absent: 0,
      pending: 2,
    });
  });
});

describe("markStudentAcademyLessonAttendance", () => {
  it("개별 원생을 출석 또는 결석으로 처리하고 결석 대기열을 만든다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markStudentAcademyLessonAttendance(sheet, {
      lessonEventId: "lesson-1",
      status: "absent",
      reason: "감기",
      markedAt: "2026-08-20T15:05:00+09:00",
    });

    expect(result.rows.find((row) => row.lessonEventId === "lesson-1")).toMatchObject({
      status: "absent",
      absenceReason: "감기",
    });
    expect(result.absenceQueue).toEqual([
      {
        academyId: "academy-1",
        lessonEventId: "lesson-1",
        studentId: "student-1",
        studentName: "김민지",
        instrumentId: "piano",
        instrumentName: "피아노",
        originalDate: "2026-08-20",
        reason: "감기",
        markedAt: "2026-08-20T15:05:00+09:00",
      },
    ]);
  });
});

describe("markAllAcademyLessonAttendance", () => {
  it("전체 출석은 모든 원생을 출석으로 처리하고 결석 대기열을 비운다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markAllAcademyLessonAttendance(sheet, {
      status: "present",
      markedAt: "2026-08-20T15:00:00+09:00",
    });

    expect(result.rows.every((row) => row.status === "present")).toBe(true);
    expect(result.absenceQueue).toEqual([]);
    expect(result.summary).toMatchObject({ present: 2, absent: 0, pending: 0 });
  });

  it("전체 결석은 모든 원생을 결석 처리하고 결석 대기열로 이동한다", () => {
    const sheet = buildDailyAcademyAttendance(events, {
      academyId: "academy-1",
      date: "2026-08-20",
    });

    const result = markAllAcademyLessonAttendance(sheet, {
      status: "absent",
      reason: "태풍 휴강",
      markedAt: "2026-08-20T15:00:00+09:00",
    });

    expect(result.rows.every((row) => row.status === "absent")).toBe(true);
    expect(result.absenceQueue.map((absence) => absence.studentName)).toEqual([
      "김민지",
      "이서윤",
    ]);
    expect(result.summary).toMatchObject({ present: 0, absent: 2, pending: 0 });
  });
});

describe("removeResolvedAbsenceFromQueue", () => {
  it("보강 또는 패스로 확정된 결석 원생은 결석 대기열에서 제거한다", () => {
    const sheet = markAllAcademyLessonAttendance(
      buildDailyAcademyAttendance(events, {
        academyId: "academy-1",
        date: "2026-08-20",
      }),
      {
        status: "absent",
        reason: "태풍 휴강",
        markedAt: "2026-08-20T15:00:00+09:00",
      },
    );

    const result = removeResolvedAbsenceFromQueue(sheet, {
      lessonEventId: "lesson-1",
    });

    expect(result.absenceQueue.map((absence) => absence.lessonEventId)).toEqual([
      "lesson-2",
    ]);
  });
});

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
    ...overrides,
  };
}

describe("findUnresolvedAbsences", () => {
  it("처리하지 않은 결석만 돌려주고 보강·패스로 확정한 결석은 제외한다", () => {
    const rows = [
      buildRow({ lessonEventId: "a", status: "absent" }),
      buildRow({ lessonEventId: "b", status: "absent", absenceResolution: "makeup" }),
      buildRow({ lessonEventId: "c", status: "absent", absenceResolution: "pass" }),
      buildRow({ lessonEventId: "d", status: "present" }),
      buildRow({ lessonEventId: "e", status: "pending" }),
    ];

    expect(findUnresolvedAbsences(rows).map((row) => row.lessonEventId)).toEqual(["a"]);
  });
});

describe("checkAcademyLessonEditable", () => {
  it("출결을 처리하기 전 일정은 이동·삭제할 수 있다", () => {
    const row = buildRow({ lessonEventId: "a" });

    expect(checkAcademyLessonEditable(row, "move")).toEqual({ ok: true });
    expect(checkAcademyLessonEditable(row, "delete")).toEqual({ ok: true });
  });

  it("이미 출석·결석이 처리된 일정은 초기화한 뒤에 이동·삭제하라고 안내한다", () => {
    const row = buildRow({ lessonEventId: "a", status: "present" });

    expect(checkAcademyLessonEditable(row, "delete")).toEqual({
      ok: false,
      reason: "이미 출결이 처리된 일정은 삭제할 수 없습니다. 먼저 출결을 초기화해 주세요.",
    });
    expect(checkAcademyLessonEditable(row, "move")).toEqual({
      ok: false,
      reason: "이미 출결이 처리된 일정은 이동할 수 없습니다. 먼저 출결을 초기화해 주세요.",
    });
  });
});

describe("formatAcademyLessonOriginLabel", () => {
  it("학원 레슨의 보강 일정은 보강 수업으로 표시한다", () => {
    expect(formatAcademyLessonOriginLabel("makeup")).toBe("보강 수업");
    expect(formatAcademyLessonOriginLabel("regular")).toBe("정기");
    expect(formatAcademyLessonOriginLabel("rescheduled")).toBe("이동");
  });
});

describe("checkAcademyLessonMoveTarget", () => {
  const row = buildRow({ lessonEventId: "a", date: "2026-08-21" });

  it("같은 달 안의 다른 날짜로는 옮길 수 있다", () => {
    expect(checkAcademyLessonMoveTarget(row, "2026-08-31")).toEqual({ ok: true });
  });

  it("달을 넘기면 같은 달 안에서만 이동할 수 있다고 안내한다", () => {
    const message =
      "일정은 같은 달 안에서만 이동할 수 있습니다. 다른 달에 수업을 잡으려면 일정 추가를 이용해 주세요.";

    expect(checkAcademyLessonMoveTarget(row, "2026-09-01")).toEqual({ ok: false, reason: message });
    expect(checkAcademyLessonMoveTarget(row, "2027-08-21")).toEqual({ ok: false, reason: message });
  });
});

describe("formatAbsenceReason", () => {
  it("사유가 없거나 기본 문구(결석 확인)면 -로 보여 준다", () => {
    expect(formatAbsenceReason(undefined)).toBe("-");
    expect(formatAbsenceReason("")).toBe("-");
    expect(formatAbsenceReason("   ")).toBe("-");
    expect(formatAbsenceReason("결석 확인")).toBe("-");
  });

  it("직접 입력한 사유는 그대로 보여 준다", () => {
    expect(formatAbsenceReason("감기로 결석")).toBe("감기로 결석");
    expect(formatAbsenceReason(" 가족 여행 ")).toBe("가족 여행");
  });
});

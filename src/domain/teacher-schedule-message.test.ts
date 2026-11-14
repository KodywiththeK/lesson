import { describe, expect, it } from "vitest";

import type { PrivateLesson } from "./private-lesson";
import { formatTeacherMonthScheduleMessage } from "./teacher-schedule-message";

function lesson(
  id: string,
  studentName: string,
  startAt: string,
  overrides: Partial<PrivateLesson> = {},
): PrivateLesson {
  return {
    id,
    academyId: "academy-1",
    studentId: `student-${id}`,
    studentName,
    instrumentId: "violin",
    instrumentName: "바이올린",
    teacherId: "teacher-1",
    teacherName: "이선생",
    startAt,
    endAt: startAt,
    status: "scheduled",
    ...overrides,
  };
}

describe("formatTeacherMonthScheduleMessage", () => {
  it("날짜별로 묶어 안내 문구와 함께 문자 양식을 만든다", () => {
    const lessons = [
      lesson("c", "이유나", "2026-11-10T16:50:00+09:00"),
      lesson("a", "백서희", "2026-11-04T16:00:00+09:00"),
      lesson("b", "김예인", "2026-11-10T14:40:00+09:00"),
      lesson("d", "백서희", "2026-11-12T16:00:00+09:00"),
    ];

    expect(
      formatTeacherMonthScheduleMessage({ lessons, teacherId: "teacher-1", month: "2026-11" }),
    ).toBe(
      [
        "[더 클래식 음악학원]",
        "",
        "안녕하세요, 음악학원입니다",
        "11월 선생님 스케줄표 입니다",
        "",
        "11/4 백서희 16:00 바이올린",
        "",
        "11/10 김예인 14:40 바이올린",
        "11/10 이유나 16:50 바이올린",
        "",
        "11/12 백서희 16:00 바이올린",
        "",
        "스케줄 변동사항이 있으시면 연락 부탁드립니다!",
      ].join("\n"),
    );
  });

  it("선택한 선생님의 해당 월 일정만 넣고 취소된 일정은 뺀다", () => {
    const lessons = [
      lesson("mine", "백서희", "2026-11-04T16:00:00+09:00"),
      lesson("other-teacher", "김예인", "2026-11-04T17:00:00+09:00", { teacherId: "teacher-2" }),
      lesson("other-month", "조이안", "2026-12-01T16:00:00+09:00"),
      lesson("cancelled", "이유나", "2026-11-05T16:00:00+09:00", { status: "cancelled" }),
    ];

    const message = formatTeacherMonthScheduleMessage({ lessons, teacherId: "teacher-1", month: "2026-11" });

    expect(message).toContain("11/4 백서희 16:00 바이올린");
    expect(message).not.toContain("김예인");
    expect(message).not.toContain("조이안");
    expect(message).not.toContain("이유나");
  });

  it("UTC로 저장된 시각도 한국 날짜·시간으로 바꾸고 시간대가 섞여도 시각 순서로 둔다", () => {
    const lessons = [
      // 한국 11/10 15:20
      lesson("late", "조이안", "2026-11-10T06:20:00+00:00"),
      // 한국 11/10 14:40
      lesson("early", "김예인", "2026-11-10T14:40:00+09:00"),
      // 한국 11/1 00:30 (UTC로는 10/31)
      lesson("midnight", "박서아", "2026-10-31T15:30:00.000Z"),
    ];

    const message = formatTeacherMonthScheduleMessage({ lessons, teacherId: "teacher-1", month: "2026-11" });

    expect(message).toContain("11/1 박서아 00:30 바이올린");
    expect(message.indexOf("김예인")).toBeLessThan(message.indexOf("조이안"));
    expect(message).toContain("11/10 조이안 15:20 바이올린");
  });

  it("해당 월 일정이 없으면 안내 문구만 돌려준다", () => {
    expect(
      formatTeacherMonthScheduleMessage({ lessons: [], teacherId: "teacher-1", month: "2026-11" }),
    ).toBe("해당 월에 등록된 레슨이 없습니다.");
  });
});

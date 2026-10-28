import { describe, expect, it } from "vitest";

import {
  calculateLessonEndTime,
  getLessonScheduleValidationError,
  hasSameStudentName,
  registerStudent,
} from "./student-registration";

describe("calculateLessonEndTime", () => {
  it("개인레슨 시작 시간과 회당 길이로 종료 시간을 계산한다", () => {
    expect(calculateLessonEndTime("15:20", 30)).toBe("15:50");
    expect(calculateLessonEndTime("15:20", 45)).toBe("16:05");
    expect(calculateLessonEndTime("15:20", 40)).toBe("16:00");
    expect(calculateLessonEndTime("15:20", 60)).toBe("16:20");
    expect(calculateLessonEndTime(undefined, 40)).toBeUndefined();
    expect(calculateLessonEndTime("23:40", 40)).toBeUndefined();
    expect(calculateLessonEndTime("12:99", 40)).toBeUndefined();
    expect(calculateLessonEndTime("24:00", 40)).toBeUndefined();
  });

  it("직접 입력 길이는 5~240분의 정수만 허용한다", () => {
    const input = { lessonType: "private" as const, teacherId: "t1", sessionsPerMonth: 4,
      weeklySchedules: [{ startTime: "15:00", endTime: "15:30" }] };
    expect(getLessonScheduleValidationError({ ...input, lessonDurationMinutes: 30 })).toBeNull();
    expect(getLessonScheduleValidationError({ ...input, lessonDurationMinutes: 4 })).toMatch(/5~240분/);
    expect(getLessonScheduleValidationError({ ...input, lessonDurationMinutes: 241 })).toMatch(/5~240분/);
  });
});

describe("registerStudent", () => {
  it("30분·직접 입력 길이는 레슨비를 수동 입력해야 한다", () => {
    const input = {
      academyId: "academy-1", studentId: "student-1", name: "김민지",
      registeredAt: "2026-08-20", guardians: [],
      instruments: [{
        instrumentId: "piano", instrumentName: "피아노", teacherId: "teacher-1",
        teacherName: "박선생", lessonType: "private" as const, sessionsPerMonth: 4,
        lessonDurationMinutes: 30, weekdays: ["monday" as const], progress: "바이엘 1",
        lessonFee: 0, discounts: [], finalMonthlyFee: 0,
      }],
    };
    expect(() => registerStudent(input)).toThrow("수업 시간에 맞는 레슨비를 직접 입력해 주세요.");
    expect(() => registerStudent({ ...input, instruments: [{ ...input.instruments[0], lessonDurationMinutes: 45 }] }))
      .toThrow("수업 시간에 맞는 레슨비를 직접 입력해 주세요.");
    expect(registerStudent({ ...input, instruments: [{ ...input.instruments[0], lessonFee: 120000,
      finalMonthlyFee: 120000 }] }).enrollments[0].lessonFee).toBe(120000);
  });

  it("원생 기본 정보와 악기별 수강 설정을 등록 결과로 만든다", () => {
    const result = registerStudent({
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민지",
      age: 10,
      grade: "초3",
      school: "한빛초",
      registeredAt: "2026-08-20",
      guardians: [
        {
          relationship: "모",
          phone: "010-1111-2222",
        },
      ],
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          lessonType: "academy",
          weekdays: ["monday", "wednesday"],
          startTime: "15:00",
          endTime: "15:50",
          progress: "바이엘 2",
          lessonFee: 160000,
          discounts: [
            {
              type: "sibling",
              label: "형제 할인",
              amount: 10000,
            },
          ],
          finalMonthlyFee: 150000,
        },
        {
          instrumentId: "violin",
          instrumentName: "바이올린",
          teacherId: "teacher-2",
          teacherName: "이선생",
          lessonType: "private",
          sessionsPerMonth: 4,
          lessonDurationMinutes: 40,
          weekdays: ["monday"],
          progress: "스즈키 1",
          lessonFee: 0,
          discounts: [],
          finalMonthlyFee: 0,
        },
      ],
    });

    expect(result.student).toMatchObject({
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민지",
      status: "enrolled",
    });
    expect(result.enrollments).toHaveLength(2);
    expect(result.enrollments[0]).toMatchObject({
      academyId: "academy-1",
      studentId: "student-1",
      instrumentId: "piano",
      lessonType: "academy",
      active: true,
      weekdays: ["monday", "wednesday"],
      startTime: "15:00",
      endTime: "15:50",
      finalMonthlyFee: 150000,
    });
  });

  it("학원 수업 수강 설정은 반복 일정 생성 기준으로 표시한다", () => {
    const result = registerStudent({
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민지",
      registeredAt: "2026-08-20",
      guardians: [],
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          lessonType: "academy",
          weekdays: ["monday"],
          startTime: "15:00",
          endTime: "15:50",
          progress: "바이엘 2",
          lessonFee: 160000,
          discounts: [],
          finalMonthlyFee: 160000,
        },
      ],
    });

    expect(result.scheduleSources).toEqual([
      {
        academyId: "academy-1",
        enrollmentId: "student-1:piano:monday",
        studentId: "student-1",
        studentName: "김민지",
        instrumentId: "piano",
        instrumentName: "피아노",
        lessonType: "academy",
        active: true,
        weekdays: ["monday"],
        startTime: "15:00",
        endTime: "15:50",
      },
    ]);
  });

  it("최종 수강료가 있는 학원 수업은 고정 수입 기준으로 만든다", () => {
    const result = registerStudent({
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민지",
      registeredAt: "2026-08-20",
      guardians: [],
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          lessonType: "academy",
          weekdays: ["monday"],
          startTime: "15:00",
          endTime: "15:50",
          progress: "바이엘 2",
          lessonFee: 160000,
          discounts: [
            {
              type: "multi-instrument",
              label: "두 악기 할인",
              amount: 10000,
            },
          ],
          finalMonthlyFee: 150000,
        },
        {
          instrumentId: "violin",
          instrumentName: "바이올린",
          teacherId: "teacher-2",
          teacherName: "이선생",
          lessonType: "private",
          sessionsPerMonth: 4,
          lessonDurationMinutes: 40,
          weekdays: ["monday"],
          progress: "스즈키 1",
          lessonFee: 0,
          discounts: [],
          finalMonthlyFee: 0,
        },
      ],
    });

    expect(result.fixedIncomeSources).toEqual([
      {
        academyId: "academy-1",
        studentId: "student-1",
        studentName: "김민지",
        enrollmentId: "student-1:piano",
        instrumentId: "piano",
        instrumentName: "피아노",
        monthlyAmount: 150000,
        registeredOn: "2026-08-20",
        lessonFee: 160000,
        discountTotal: 10000,
        discountLabel: undefined,
        progress: "바이엘 2",
        effectiveFrom: "2026-08",
      },
    ]);
  });

  it("최종 수강료가 레슨비에서 할인 합계를 뺀 금액과 다르면 등록을 거부한다", () => {
    expect(() =>
      registerStudent({
        academyId: "academy-1",
        studentId: "student-1",
        name: "김민지",
        registeredAt: "2026-08-20",
        guardians: [],
        instruments: [
          {
            instrumentId: "piano",
            instrumentName: "피아노",
            teacherId: "teacher-1",
            teacherName: "박선생",
            lessonType: "academy",
            weekdays: ["monday"],
            startTime: "15:00",
            endTime: "15:50",
            progress: "바이엘 2",
            lessonFee: 160000,
            discounts: [
              {
                type: "sibling",
                label: "형제 할인",
                amount: 10000,
              },
            ],
            finalMonthlyFee: 130000,
          },
        ],
      }),
    ).toThrow("최종 수강료가 레슨비와 할인 합계와 일치하지 않습니다.");
  });

  it("시간 미정 학원레슨은 요일별 반복 일정으로 등록한다", () => {
    const result = registerStudent({
      academyId: "academy-1",
      studentId: "student-1",
      name: "김민지",
      registeredAt: "2026-08-20",
      guardians: [],
      instruments: [
        {
          instrumentId: "piano",
          instrumentName: "피아노",
          teacherId: "teacher-1",
          teacherName: "박선생",
          lessonType: "academy",
          weekdays: ["monday"],
          weeklySchedules: [{ weekday: "monday" }],
          progress: "바이엘 2",
          lessonFee: 160000,
          discounts: [],
          finalMonthlyFee: 160000,
        },
      ],
    });
    expect(result.scheduleSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ startTime: "", endTime: "" }),
    ]));
  });

  it("학원레슨은 시작·종료 시간 중 하나만 입력하면 저장하지 않는다", () => {
    expect(getLessonScheduleValidationError({
      lessonType: "academy",
      teacherId: "teacher-1",
      weeklySchedules: [{ startTime: "15:00" }],
    })).toBe("시작 시간과 종료 시간을 함께 입력해 주세요.");
  });

  it("개인레슨은 월 횟수·수업 길이와 자동 계산한 종료 시간을 검증한다", () => {
    expect(getLessonScheduleValidationError({
      lessonType: "private",
      sessionsPerMonth: 4,
      lessonDurationMinutes: 40,
      weeklySchedules: [{ startTime: "09:30", endTime: "10:10" }],
    })).toBeNull();
    expect(getLessonScheduleValidationError({
      lessonType: "private",
      sessionsPerMonth: 4,
      lessonDurationMinutes: 40,
      weeklySchedules: [{ startTime: "09:30", endTime: "10:30" }],
    })).toBe("개인레슨 종료 시간은 시작 시간에 수업 시간을 더한 값이어야 합니다.");
  });

  it("학원 수업은 하나 이상의 수업 요일이 필요하다", () => {
    expect(() =>
      registerStudent({
        academyId: "academy-1",
        studentId: "student-1",
        name: "김민지",
        registeredAt: "2026-08-20",
        guardians: [],
        instruments: [
          {
            instrumentId: "piano",
            instrumentName: "피아노",
            teacherId: "teacher-1",
            teacherName: "박선생",
            lessonType: "academy",
            weekdays: [],
            progress: "바이엘 2",
            lessonFee: 160000,
            discounts: [],
            finalMonthlyFee: 160000,
          },
        ],
      }),
    ).toThrow("학원레슨 요일을 선택해야 합니다.");
  });
});

describe("hasSameStudentName", () => {
  it("이미 같은 이름의 원생이 있으면 구분이 필요하다", () => {
    expect(hasSameStudentName("홍길동", ["김하늘", "홍길동"])).toBe(true);
    expect(hasSameStudentName("  홍길동 ", ["홍길동"])).toBe(true);
  });

  it("구분 접미사가 같아도, 접미사가 없는 이름과 접미사가 있는 이름이 섞여도 구분이 필요하다", () => {
    expect(hasSameStudentName("홍길동a", ["홍길동a"])).toBe(true);
    expect(hasSameStudentName("홍길동", ["홍길동a"])).toBe(true);
    expect(hasSameStudentName("홍길동b", ["홍길동"])).toBe(true);
  });

  it("홍길동a, 홍길동b처럼 접미사로 이미 구분했으면 경고하지 않는다", () => {
    expect(hasSameStudentName("홍길동b", ["홍길동a"])).toBe(false);
  });

  it("영문 이름의 마지막 글자는 접미사로 보지 않는다", () => {
    expect(hasSameStudentName("Amy", ["Amb"])).toBe(false);
    expect(hasSameStudentName("amy", ["Amy"])).toBe(true);
  });

  it("이름이 비었거나 같은 이름이 없으면 경고하지 않는다", () => {
    expect(hasSameStudentName("", ["홍길동"])).toBe(false);
    expect(hasSameStudentName("김하늘", ["홍길동"])).toBe(false);
    expect(hasSameStudentName("김하늘", [])).toBe(false);
  });
});

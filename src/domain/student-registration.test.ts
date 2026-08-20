import { describe, expect, it } from "vitest";

import { registerStudent } from "./student-registration";

describe("registerStudent", () => {
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
          weekdays: [],
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
        enrollmentId: "student-1:piano",
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
          weekdays: [],
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

  it("학원 수업은 수업 요일과 시간이 필요하다", () => {
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
    ).toThrow("학원 수업은 하나 이상의 수업 요일이 필요합니다.");
  });
});
